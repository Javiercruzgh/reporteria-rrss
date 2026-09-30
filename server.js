/* Herramienta de Monkey System · servidor HTTP nativo de Node, sin framework ni build.
   Lo público (login y estilos) va primero; desde «solo el equipo» todo pide sesión @monkeylabs.cl. */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import * as C from './lib/config.js';
import { registrar } from './lib/db.js';
import { sesion, verificarGoogle, cookieSesion, cookieSalir } from './lib/auth.js';
import * as reportes from './lib/reportes.js';
import * as clientes from './lib/clientes.js';
import { estado as estadoMetricool, listarMarcas } from './lib/metricool.js';
import { estado as estadoIa } from './lib/ia.js';
import { leer as leerHerramienta } from './lib/herramienta.js';

const PUB = path.join(C.ROOT, 'public');
const HERRAMIENTA = leerHerramienta();
{ const f = C.validar(); if (f.length) { console.error('Faltan variables para arrancar publicado: ' + f.join(', ')); process.exit(1); } }

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

class Err extends Error { constructor(code, msg) { super(msg); this.code = code; } }
function enviar(res, code, cuerpo, tipo = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'Content-Type': tipo, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo));
}
async function leerCuerpo(req, limite) {
  const trozos = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limite) throw new Err(413, 'El archivo es demasiado grande (máximo ' + Math.round(limite / 1e6) + ' MB).'); trozos.push(c); }
  return Buffer.concat(trozos);
}
async function leerJson(req, limite = 1e6) {
  const trozos = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limite) throw new Err(413, 'Solicitud demasiado grande.'); trozos.push(c); }
  try { return trozos.length ? JSON.parse(Buffer.concat(trozos).toString('utf8')) : {}; } catch { throw new Err(400, 'JSON inválido.'); }
}
const redirigir = (res, a) => { res.writeHead(302, { Location: a, 'Cache-Control': 'no-store' }); res.end(); };

/* ---------- estáticos ---------- */
// Lo único que se ve sin sesión. Nada con datos o links internos va en estas carpetas.
const PUBLICAS = [/^\/login\.html$/, /^\/assets\//, /^\/css\//, /^\/publico\//, /^\/favicon/];
/* Fuera de producción, cada página lleva una franja visible para que nadie confunda los datos de prueba con los reales.
   Es la misma de Grillas (rosada a rayas, «PRUEBAS ·» en el título) y no se muestra dentro de un iframe. */
const FRANJA = { local: 'Local · datos ficticios', pruebas: 'Ambiente de pruebas · datos ficticios' };
const conFranja = html => html
  .replace(/<title>/, `<title>${C.MODO === 'pruebas' ? 'PRUEBAS' : 'LOCAL'} · `)
  .replace(/<body([^>]*)>/, `<body$1 data-modo="${C.MODO}"><div class="franja-modo" role="note">${FRANJA[C.MODO]}</div>`
    + `<script>if (window.top !== window.self) { document.querySelector('.franja-modo').remove(); document.body.removeAttribute('data-modo'); }</script>`);
async function estatico(req, res, ruta, { robots = false } = {}) {
  const p = ruta.endsWith('/') ? ruta + 'index.html' : ruta;
  const f = path.normalize(path.join(PUB, p));
  if (!f.startsWith(PUB + path.sep)) throw new Err(404, 'No existe');
  const st = await fsp.stat(f).catch(() => null);
  if (!st?.isFile()) { if (st?.isDirectory()) return redirigir(res, ruta + '/'); throw new Err(404, 'No existe'); }
  const ext = path.extname(f), cache = /^\/assets\//.test(ruta) ? 'public, max-age=86400' : 'no-store';
  const extra = robots ? { 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' } : {};
  if (ext === '.html' && !C.ES_PRODUCCION) {
    const html = conFranja(await fsp.readFile(f, 'utf8'));
    return enviar(res, 200, req.method === 'HEAD' ? '' : html, TIPOS[ext], { 'Cache-Control': cache, ...extra });
  }
  res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': cache, 'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff', ...extra });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(f).pipe(res);
}

/* ============================================================ rutas */
async function manejar(req, res) {
  const url = new URL(req.url, 'http://x'), ruta = decodeURIComponent(url.pathname), M = req.method;
  const partes = ruta.split('/').filter(Boolean);

  // públicas
  if (ruta === '/api/config') return enviar(res, 200, { auth: C.AUTH, clientId: C.GOOGLE_CLIENT_ID, dominio: C.DOMINIO, modo: C.MODO, nombre: HERRAMIENTA.nombre, monkeySystem: C.MONKEY_SYSTEM_URL });
  if (ruta === '/api/login' && M === 'POST') {
    const b = await leerJson(req); const u = await verificarGoogle(b.credential || '');
    registrar(u.email, 'login', {});
    return enviar(res, 200, { ok: true, nombre: u.nombre }, undefined, { 'Set-Cookie': cookieSesion(u) });
  }
  if (ruta === '/api/logout') return enviar(res, 200, { ok: true }, undefined, { 'Set-Cookie': cookieSalir() });
  // link del cliente: sin sesión, solo el reporte listo (ver reportes.publico)
  if (partes[0] === 'r' && partes.length === 2 && (M === 'GET' || M === 'HEAD')) return estatico(req, res, '/publico/cliente.html', { robots: true });
  if (partes[0] === 'api' && partes[1] === 'publico' && partes.length === 3 && M === 'GET') return enviar(res, 200, reportes.publico(partes[2]), undefined, { 'X-Robots-Tag': 'noindex' });
  if (PUBLICAS.some(r => r.test(ruta))) return estatico(req, res, ruta);

  // desde aquí, solo el equipo
  const u = sesion(req);
  if (!u) {
    if (ruta.startsWith('/api/')) throw new Err(401, 'Tu sesión expiró. Vuelve a entrar.');
    return redirigir(res, '/login.html?next=' + encodeURIComponent(ruta + url.search));
  }
  const admin = () => { if (!u.admin) throw new Err(403, 'Solo los administradores pueden hacer esto.'); };

  if (ruta === '/api/yo') return enviar(res, 200, { email: u.email, nombre: u.nombre, admin: u.admin });
  if (ruta === '/api/herramienta') return enviar(res, 200, HERRAMIENTA);

  if (ruta === '/api/estado') return enviar(res, 200, { metricool: estadoMetricool(), ia: estadoIa() });

  // ---- clientes (marcas, redes, reglas y lineamientos)
  if (ruta === '/api/metricool/marcas') return enviar(res, 200, { marcas: await listarMarcas() });
  if (ruta === '/api/clientes' && M === 'GET') return enviar(res, 200, { clientes: clientes.listar() });
  if (ruta === '/api/clientes' && M === 'POST') return enviar(res, 201, clientes.crear(u, await leerJson(req)));
  if (partes[0] === 'api' && partes[1] === 'clientes' && partes[2]) {
    const id = partes[2];
    if (partes[3] === 'restaurar' && M === 'POST') { admin(); return enviar(res, 200, clientes.restaurar(u, id)); }
    if (partes.length === 3 && M === 'GET') return enviar(res, 200, clientes.aApi(clientes.obtener(id)));
    if (partes.length === 3 && M === 'PATCH') return enviar(res, 200, clientes.editar(u, id, await leerJson(req)));
    if (partes.length === 3 && M === 'DELETE') { admin(); return enviar(res, 200, clientes.aPapelera(u, id)); }
  }

  // ---- reportes
  if (ruta === '/api/reportes' && M === 'GET') return enviar(res, 200, reportes.mes(url.searchParams.get('mes') || ''));
  if (ruta === '/api/reportes' && M === 'POST') return enviar(res, 201, reportes.crear(u, await leerJson(req)));
  if (ruta === '/api/papelera') return enviar(res, 200, reportes.papelera());
  if (partes[0] === 'api' && partes[1] === 'reportes' && partes[2]) {
    const id = partes[2], acc = partes[3];
    if (partes.length === 3 && M === 'GET') return enviar(res, 200, reportes.detalle(id));
    if (partes.length === 3 && M === 'PATCH') return enviar(res, 200, reportes.editar(u, id, await leerJson(req)));
    if (partes.length === 3 && M === 'DELETE') return enviar(res, 200, reportes.aPapelera(u, id));   // a la papelera, nunca borrar
    if (M === 'POST' && acc === 'datos') return enviar(res, 200, await reportes.actualizarDatos(u, id));
    if (M === 'POST' && acc === 'importar') return enviar(res, 200, reportes.importar(u, id, await leerJson(req, 20e6)));
    if (M === 'POST' && acc === 'proponer') return enviar(res, 200, await reportes.proponer(u, id, await leerJson(req)));
    if (M === 'POST' && acc === 'escucha') return enviar(res, 200, await reportes.subirEscucha(u, id, await leerCuerpo(req, 25e6)));
    if (M === 'POST' && acc === 'nuevo-link') return enviar(res, 200, reportes.nuevoLink(u, id));
    if (M === 'POST' && acc === 'restaurar') return enviar(res, 200, reportes.restaurar(u, id));
  }
  if (ruta === '/api/actividad') { admin(); return enviar(res, 200, reportes.actividad()); }
  if (ruta.startsWith('/api/')) throw new Err(404, 'No existe');

  // páginas del equipo
  return estatico(req, res, ruta);
}

const servidor = http.createServer(async (req, res) => {
  try { await manejar(req, res); }
  catch (e) {
    const code = e.code >= 400 && e.code < 600 ? e.code : 500;
    if (code === 500) console.error('[error]', req.method, req.url, e);
    if (res.headersSent) return res.destroy();
    const esApi = req.url.startsWith('/api/');
    enviar(res, code, esApi ? { error: code === 500 ? 'Algo falló en el servidor.' : e.message, ...(e.id ? { id: e.id } : {}), ...(e.claves ? { claves: e.claves } : {}) } : `<!doctype html><meta charset=utf-8><title>${HERRAMIENTA.nombre}</title><body style="font:16px system-ui;background:#131114;color:#F6ECE2;padding:40px"><h1>${code}</h1><p>${String(e.message || '').replace(/</g, '&lt;')}</p><p><a style="color:#FC3297" href="/">Volver al inicio</a></p>`,
      esApi ? undefined : 'text/html; charset=utf-8');
  }
});
servidor.listen(C.PORT, () => console.log(`${HERRAMIENTA.nombre} en ${C.PUBLIC_URL} · modo ${C.MODO} · login ${C.AUTH ? 'Google' : 'local (' + C.DEV_USER + ')'}`));
