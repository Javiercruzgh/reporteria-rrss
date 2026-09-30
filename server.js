/* Herramienta de Monkey System · servidor HTTP nativo de Node, sin framework ni build.
   Lo público (login y estilos) va primero; desde «solo el equipo» todo pide sesión @monkeylabs.cl. */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import * as C from './lib/config.js';
import { registrar } from './lib/db.js';
import { sesion, verificarGoogle, cookieSesion, cookieSalir } from './lib/auth.js';
import * as tareas from './lib/tareas.js';
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
async function leerJson(req, limite = 1e6) {
  const trozos = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limite) throw new Err(413, 'Solicitud demasiado grande.'); trozos.push(c); }
  try { return trozos.length ? JSON.parse(Buffer.concat(trozos).toString('utf8')) : {}; } catch { throw new Err(400, 'JSON inválido.'); }
}
const redirigir = (res, a) => { res.writeHead(302, { Location: a, 'Cache-Control': 'no-store' }); res.end(); };

/* ---------- estáticos ---------- */
// Lo único que se ve sin sesión. Nada con datos o links internos va en estas carpetas.
const PUBLICAS = [/^\/login\.html$/, /^\/assets\//, /^\/css\//, /^\/favicon/];
/* Fuera de producción, cada página lleva una franja visible para que nadie confunda los datos de prueba con los reales.
   Es la misma de Grillas (rosada a rayas, «PRUEBAS ·» en el título) y no se muestra dentro de un iframe. */
const FRANJA = { local: 'Local · datos ficticios', pruebas: 'Ambiente de pruebas · datos ficticios' };
const conFranja = html => html
  .replace(/<title>/, `<title>${C.MODO === 'pruebas' ? 'PRUEBAS' : 'LOCAL'} · `)
  .replace(/<body([^>]*)>/, `<body$1 data-modo="${C.MODO}"><div class="franja-modo" role="note">${FRANJA[C.MODO]}</div>`
    + `<script>if (window.top !== window.self) { document.querySelector('.franja-modo').remove(); document.body.removeAttribute('data-modo'); }</script>`);
async function estatico(req, res, ruta) {
  const p = ruta.endsWith('/') ? ruta + 'index.html' : ruta;
  const f = path.normalize(path.join(PUB, p));
  if (!f.startsWith(PUB + path.sep)) throw new Err(404, 'No existe');
  const st = await fsp.stat(f).catch(() => null);
  if (!st?.isFile()) { if (st?.isDirectory()) return redirigir(res, ruta + '/'); throw new Err(404, 'No existe'); }
  const ext = path.extname(f), cache = /^\/assets\//.test(ruta) ? 'public, max-age=86400' : 'no-store';
  if (ext === '.html' && !C.ES_PRODUCCION) {
    const html = conFranja(await fsp.readFile(f, 'utf8'));
    return enviar(res, 200, req.method === 'HEAD' ? '' : html, TIPOS[ext], { 'Cache-Control': cache });
  }
  res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': cache, 'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff' });
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

  // ---- herramienta de ejemplo: Lista de tareas (se reemplaza por la herramienta nueva)
  if (ruta === '/api/tareas' && M === 'GET') {
    const q = url.searchParams;
    return enviar(res, 200, { ...tareas.listar({ q: q.get('q') || '', estado: q.get('estado') || '', papelera: q.get('papelera') === '1' }), estados: tareas.ESTADOS });
  }
  if (ruta === '/api/tareas' && M === 'POST') return enviar(res, 201, tareas.crear(u, await leerJson(req)));
  if (ruta === '/api/tareas/lote' && M === 'POST') return enviar(res, 200, tareas.lote(u, await leerJson(req)));
  if (partes[0] === 'api' && partes[1] === 'tareas' && partes[2]) {
    const id = partes[2];
    if (partes[3] === 'restaurar' && M === 'POST') return enviar(res, 200, tareas.restaurar(u, id));
    if (partes.length === 3 && M === 'GET') return enviar(res, 200, tareas.aApi(tareas.obtener(id)));
    if (partes.length === 3 && M === 'PATCH') return enviar(res, 200, tareas.editar(u, id, await leerJson(req)));
    if (partes.length === 3 && M === 'DELETE') return enviar(res, 200, tareas.aPapelera(u, id));   // DELETE = a la papelera, nunca borrar
  }
  if (ruta === '/api/actividad') { admin(); return enviar(res, 200, tareas.actividad()); }
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
    enviar(res, code, esApi ? { error: code === 500 ? 'Algo falló en el servidor.' : e.message } : `<!doctype html><meta charset=utf-8><title>${HERRAMIENTA.nombre}</title><body style="font:16px system-ui;background:#131114;color:#F6ECE2;padding:40px"><h1>${code}</h1><p>${String(e.message || '').replace(/</g, '&lt;')}</p><p><a style="color:#FC3297" href="/">Volver al inicio</a></p>`,
      esApi ? undefined : 'text/html; charset=utf-8');
  }
});
servidor.listen(C.PORT, () => console.log(`${HERRAMIENTA.nombre} en ${C.PUBLIC_URL} · modo ${C.MODO} · login ${C.AUTH ? 'Google' : 'local (' + C.DEV_USER + ')'}`));
