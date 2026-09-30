/* Flujo completo contra el servidor: crear un reporte, traer datos (simulados), escribir y proponer textos,
   el link del cliente (solo cuando está listo), permisos entre dos personas, la franja y producción sin sesión.
   Metricool y la IA van siempre simulados: las pruebas nunca llaman a servicios reales aunque exista un .env. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporal = () => fs.mkdtempSync(path.join(os.tmpdir(), 'reporteria-flujo-'));

// las pruebas automáticas usan los puertos 5900–5999 (las herramientas, del 5001 al 5899)
async function puertoLibre() {
  for (;;) {
    const p = 5900 + Math.floor(Math.random() * 100);
    if (await new Promise(r => { const s = net.createServer().once('error', () => r(false)).listen(p, () => s.close(() => r(true))); })) return p;
  }
}
/** Levanta el servidor como `usuario` (sin login, salvo que env traiga GOOGLE_CLIENT_ID). */
async function levantar(usuario, datos = temporal(), env = {}) {
  const port = await puertoLibre(), B = `http://localhost:${port}`;
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { PATH: process.env.PATH, PORT: String(port), DATA_DIR: datos, MODO: 'local', DEV_USER: usuario, METRICOOL_MODO: 'simulado', IA_MODO: 'simulado', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = ''; srv.stderr.on('data', d => { salida += d; });
  let listo = false;
  for (let i = 0; i < 50 && !listo && srv.exitCode === null; i++) { try { await fetch(B + '/api/config'); listo = true; } catch { await new Promise(r => setTimeout(r, 100)); } }
  if (!listo) { srv.kill(); throw Object.assign(new Error('el servidor no arrancó: ' + salida), { salida }); }
  const j = async (ruta, opt = {}) => { const bin = Buffer.isBuffer(opt.body); const r = await fetch(B + ruta, { ...opt, redirect: 'manual', headers: { 'Content-Type': bin ? 'application/pdf' : 'application/json' }, body: opt.body && (bin ? opt.body : JSON.stringify(opt.body)) }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const txt = async ruta => { const r = await fetch(B + ruta, { redirect: 'manual' }); return { status: r.status, texto: await r.text(), location: r.headers.get('location') }; };
  return { B, j, txt, datos, parar: () => new Promise(r => { srv.once('exit', r); srv.kill(); }) };
}

const marca = (nombre, blogId, redes = ['instagram', 'tiktok']) => ({ nombre, blogId, redes });
const nuevoCliente = (s, nombre, marcas = [marca(nombre, '4369569')], extra = {}) => s.j('/api/clientes', { method: 'POST', body: { nombre, marcas, ...extra } }).then(r => r.body);

test('local: crear un reporte, traer datos, escribir textos, marcar listo y compartir el link', async () => {
  const s = await levantar('pruebas@monkeylabs.cl');
  try {
    const cfg = (await s.j('/api/config')).body;
    assert.equal(cfg.modo, 'local'); assert.equal(cfg.nombre, 'Reportería RRSS');
    const est = (await s.j('/api/estado')).body;
    assert.equal(est.metricool.modo, 'simulado'); assert.equal(est.ia.modo, 'simulado');

    assert.deepEqual((await s.j('/api/reportes?mes=2026-09')).body.clientes, [], 'parte vacía: no hay marcas fijas');
    assert.equal((await s.j('/api/metricool/marcas')).body.marcas.length, 3, 'la lista de marcas de Metricool (simulada)');
    assert.equal((await nuevoCliente(s, 'Alflorex')).id, 'alflorex');
    const grilla = (await s.j('/api/reportes?mes=2026-09')).body;
    assert.deepEqual(grilla.clientes.map(c => [c.id, c.reporte]), [['alflorex', null]]);
    assert.equal((await s.j('/api/reportes?mes=sept')).status, 400);

    const r = (await s.j('/api/reportes', { method: 'POST', body: { cliente: 'alflorex', mes: '2026-09', hasta: '2026-09-28' } })).body;
    assert.equal(r.estado, 'borrador'); assert.equal(r.desde, '2026-09-01');
    const dup = await s.j('/api/reportes', { method: 'POST', body: { cliente: 'alflorex', mes: '2026-09' } });
    assert.equal(dup.status, 409); assert.equal(dup.body.id, r.id, 'avisa cuál es el que ya existe');
    assert.equal((await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { estado: 'listo' } })).status, 400, 'sin datos no se marca listo');
    assert.equal((await s.j(`/api/reportes/${r.id}/proponer`, { method: 'POST', body: {} })).status, 400);

    const d = (await s.j(`/api/reportes/${r.id}/datos`, { method: 'POST' })).body;
    assert.equal(d.datosOrigen, 'simulado'); assert.ok(d.modelo.simulado);
    assert.deepEqual(d.modelo.marcas[0].redes.map(x => x.red), ['instagram', 'tiktok']);
    assert.equal(d.modelo.comparacion, '1 al 28 de agosto de 2026');
    assert.ok(d.claves.length >= 8);

    // textos: se mezclan por clave y no se pisan cambios ajenos
    const t1 = (await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { textos: { 'resumen.texto': 'Hola **mundo**', 'inventada': 'x' }, rev: d.rev, base: { 'resumen.texto': '' } } })).body;
    assert.deepEqual(t1.textos, { 'resumen.texto': 'Hola **mundo**' });
    const choque = await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { textos: { 'resumen.texto': 'Otra versión' }, rev: d.rev, base: { 'resumen.texto': '' } } });
    assert.equal(choque.status, 409); assert.deepEqual(choque.body.claves, ['resumen.texto']);
    const otro = await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { textos: { 'alflorex-hallazgo.hallazgo': 'Idea' }, rev: d.rev, base: { 'alflorex-hallazgo.hallazgo': '' } } });
    assert.equal(otro.status, 200, 'otro texto sí se puede guardar con la versión vieja');

    const p = (await s.j(`/api/reportes/${r.id}/proponer`, { method: 'POST', body: {} })).body;
    assert.ok(!p.propuestos.includes('resumen.texto') && !p.propuestos.includes('alflorex-hallazgo.hallazgo'), 'no toca lo que ya escribió el equipo');
    assert.equal(p.textos['resumen.texto'], 'Hola **mundo**');
    assert.ok(p.claves.every(k => p.textos[k.clave]), 'llenó los vacíos');

    // armar las láminas: quitar, agregar desde el catálogo y volver a la propuesta
    const propuestas = p.modelo.secciones;
    assert.ok(!propuestas.some(x => x.tipo === 'escucha'), 'sin social listening en la propuesta');
    const armadas = [...propuestas.filter(x => x.tipo !== 'competencia'), { tipo: 'libre' }, { tipo: 'escucha' }];
    const ar = (await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { secciones: armadas } })).body;
    assert.equal(ar.modelo.seccionesPropias, true);
    assert.deepEqual(ar.modelo.secciones.slice(-2).map(x => x.tipo), ['libre', 'escucha']);
    assert.equal((await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { secciones: [{ tipo: 'red', marca: 'otra', red: 'instagram' }] } })).status, 400);
    const conPdf = (await s.j(`/api/reportes/${r.id}/escucha`, { method: 'POST', body: Buffer.from('%PDF-1.4') })).body;
    assert.ok(conPdf.claves.some(k => k.clave === 'escucha.lectura') === false && conPdf.claves.some(k => /^s[0-9a-f]{8}\.lectura$/.test(k.clave)), 'la escucha agregada pide su lectura');
    assert.equal((await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { secciones: null } })).body.modelo.seccionesPropias, false);

    // link del cliente: no existe hasta que está listo
    const token = p.link.split('/r/')[1];
    assert.equal((await s.j('/api/publico/' + token)).status, 404);
    const listo = (await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { estado: 'listo' } })).body;
    assert.equal(listo.estado, 'listo');
    const pub = (await s.j('/api/publico/' + token)).body;
    assert.equal(pub.modelo.cliente.nombre, 'Alflorex'); assert.equal(pub.textos['resumen.texto'], 'Hola **mundo**');
    assert.ok(!JSON.stringify(pub).includes('pruebas@monkeylabs.cl'), 'el cliente no ve quién editó');
    const pag = await s.txt('/r/' + token);
    assert.equal(pag.status, 200); assert.match(pag.texto, /publico\/cliente\.js/);
    assert.equal((await s.j('/api/publico/inventado-123456')).status, 404);

    const nuevo = (await s.j(`/api/reportes/${r.id}/nuevo-link`, { method: 'POST' })).body;
    assert.equal((await s.j('/api/publico/' + token)).status, 404, 'el link anterior deja de funcionar');
    assert.equal((await s.j('/api/publico/' + nuevo.link.split('/r/')[1])).status, 200);

    // importar datos del conector
    const datos = { alflorex: { actual: { redes: { instagram: { comunidad: 10, posts: [], reels: [], historias: [] } } }, anterior: { redes: { instagram: { comunidad: 8 } } } } };
    assert.equal((await s.j(`/api/reportes/${r.id}/importar`, { method: 'POST', body: { datos: { otra: datos.alflorex } } })).status, 400);
    const imp = (await s.j(`/api/reportes/${r.id}/importar`, { method: 'POST', body: { datos, origen: 'conector' } })).body;
    assert.equal(imp.datosOrigen, 'conector'); assert.equal(imp.modelo.marcas[0].redes[0].kpis[0].var, 25);

    // papelera y restaurar
    assert.equal((await s.j('/api/reportes/' + r.id, { method: 'DELETE' })).status, 200);
    assert.equal((await s.j('/api/publico/' + nuevo.link.split('/r/')[1])).status, 404, 'en la papelera el link no funciona');
    assert.equal((await s.j('/api/papelera')).body.reportes.length, 1);
    assert.equal((await s.j(`/api/reportes/${r.id}/restaurar`, { method: 'POST' })).status, 200);
    assert.ok((await s.j('/api/actividad')).body.some(a => a.accion === 'proponer textos'));
  } finally { await s.parar(); }
});

test('Achs: cuatro marcas y social listening desde el PDF de Brandwatch', async () => {
  const s = await levantar('pruebas@monkeylabs.cl');
  try {
    const achs = await nuevoCliente(s, 'Achs', [marca('Seguro Laboral', '3235334', ['instagram', 'tiktok', 'linkedin', 'facebook']), marca('Achs Salud', '3235336'),
      marca('Hospital del Trabajador', '3235338', ['instagram', 'linkedin', 'facebook']), marca('Segurito', '3235340', ['instagram', 'tiktok', 'facebook', 'youtube'])], { escucha: true });
    await s.j('/api/clientes/achs', { method: 'PATCH', body: { config: { ...achs.config, reglas: { pautaTiktok: 50000 } } } });
    const r = (await s.j('/api/reportes', { method: 'POST', body: { cliente: 'achs', mes: '2026-09' } })).body;
    await s.j(`/api/reportes/${r.id}/datos`, { method: 'POST' });
    assert.equal((await s.j(`/api/reportes/${r.id}/escucha`, { method: 'POST', body: Buffer.from('no es pdf') })).status, 400);
    const e = (await s.j(`/api/reportes/${r.id}/escucha`, { method: 'POST', body: Buffer.from('%PDF-1.4 prueba') })).body;
    assert.equal(e.modelo.marcas.length, 4); assert.ok(e.modelo.resumen);
    assert.equal(e.modelo.escucha.menciones, 1234);
    assert.ok(e.claves.some(k => k.clave === 'escucha.lectura'));
    const tt = e.modelo.marcas.find(m => m.id === 'seguro-laboral').redes.find(x => x.red === 'tiktok');
    assert.equal(tt.pautaUmbral, 50000);
  } finally { await s.parar(); }
});

test('clientes: el equipo edita marcas y lineamientos; la papelera de clientes es de administradores', async () => {
  const datos = temporal();
  const b = await levantar('camila@monkeylabs.cl', datos);
  try {
    assert.equal((await b.j('/api/yo')).body.admin, false);
    await nuevoCliente(b, 'Muno', [marca('Muno', '4323563')]);
    const c = (await b.j('/api/clientes/muno')).body;
    const ed = await b.j('/api/clientes/muno', { method: 'PATCH', body: { config: { ...c.config, lineamientos: 'Tono fresco.', marcas: [{ ...c.config.marcas[0], blogId: 'x1' }] } } });
    assert.equal(ed.status, 400);
    const ok = (await b.j('/api/clientes/muno', { method: 'PATCH', body: { config: { ...c.config, lineamientos: 'Tono fresco.' } } })).body;
    assert.equal(ok.config.lineamientos, 'Tono fresco.');
    const nuevo = (await b.j('/api/clientes', { method: 'POST', body: { nombre: 'Honor' } })).body;
    assert.equal(nuevo.id, 'honor'); assert.deepEqual(nuevo.config.marcas[0].redes, ['instagram', 'tiktok']);
    assert.equal((await b.j('/api/clientes/honor', { method: 'DELETE' })).status, 403);
    assert.equal((await b.j('/api/actividad')).status, 403);
  } finally { await b.parar(); }
  const a = await levantar('pruebas@monkeylabs.cl', datos);
  try {
    assert.equal((await a.j('/api/clientes/honor', { method: 'DELETE' })).status, 200);
    assert.ok(!(await a.j('/api/clientes')).body.clientes.some(c => c.id === 'honor'));
    assert.equal((await a.j('/api/clientes/honor/restaurar', { method: 'POST' })).status, 200);
  } finally { await a.parar(); }
});

test('franja: en local y en pruebas sí (también en el link del cliente), y pruebas guarda en su propia base', async () => {
  const datos = temporal();
  const local = await levantar('pruebas@monkeylabs.cl', datos);
  try {
    const p = await local.txt('/');
    assert.match(p.texto, /<body data-modo="local"><div class="franja-modo" role="note">Local · datos ficticios<\/div>/);
    assert.match(p.texto, /<title>LOCAL · Reportería RRSS/);
    assert.match((await local.txt('/r/cualquiera')).texto, /franja-modo/);
  } finally { await local.parar(); }
  const pruebas = await levantar('pruebas@monkeylabs.cl', datos, { MODO: 'pruebas' });
  try {
    assert.equal((await pruebas.j('/api/config')).body.modo, 'pruebas');
    assert.match((await pruebas.txt('/login.html')).texto, /<title>PRUEBAS · Entrar/);
    await nuevoCliente(pruebas, 'STP', [marca('STP', '6962385')]);
    await pruebas.j('/api/reportes', { method: 'POST', body: { cliente: 'stp', mes: '2026-09' } });
  } finally { await pruebas.parar(); }
  assert.ok(fs.existsSync(path.join(datos, 'herramienta-local.sqlite')) && fs.existsSync(path.join(datos, 'herramienta-pruebas.sqlite')), 'una base por modo');
  const otra = await levantar('pruebas@monkeylabs.cl', datos);
  try { assert.deepEqual((await otra.j('/api/reportes?mes=2026-09')).body.clientes, [], 'lo de pruebas no aparece en local'); } finally { await otra.parar(); }
});

test('producción: sin sesión solo se ve el login y el link del cliente', async () => {
  const s = await levantar('pruebas@monkeylabs.cl', temporal(), { MODO: 'produccion', GOOGLE_CLIENT_ID: 'prueba.apps.googleusercontent.com', SESSION_SECRET: 'x'.repeat(32), METRICOOL_MODO: '', IA_MODO: '' });
  try {
    for (const ruta of ['/api/reportes?mes=2026-09', '/api/clientes', '/api/yo', '/api/estado']) assert.equal((await s.j(ruta)).status, 401, ruta);
    for (const ruta of ['/', '/kit.html', '/js/ui.js', '/js/app.js']) {
      const r = await s.txt(ruta);
      assert.equal(r.status, 302, ruta); assert.match(r.location, /^\/login\.html\?next=/, ruta);
    }
    const login = await s.txt('/login.html');
    assert.equal(login.status, 200); assert.ok(!login.texto.includes('franja-modo'), 'en producción no hay franja');
    const cli = await s.txt('/r/algun-token-largo');
    assert.equal(cli.status, 200, 'la página del cliente carga sin sesión'); assert.ok(!cli.texto.includes('franja-modo'));
    assert.equal((await s.txt('/publico/laminas.js')).status, 200);
    assert.equal((await s.j('/api/publico/algun-token-largo')).status, 404);
  } finally { await s.parar(); }
  await assert.rejects(levantar('x@monkeylabs.cl', temporal(), { MODO: 'produccion', GOOGLE_CLIENT_ID: 'x' }), /SESSION_SECRET/);
  await assert.rejects(levantar('x@monkeylabs.cl', temporal(), { RAILWAY_ENVIRONMENT: 'production' }), /GOOGLE_CLIENT_ID/);
});

test('láminas: cajas de texto, imágenes, campos y aviso de cambios', async () => {
  const s = await levantar('pruebas@monkeylabs.cl');
  try {
    await nuevoCliente(s, 'Alflorex');
    const r = (await s.j('/api/reportes', { method: 'POST', body: { cliente: 'alflorex', mes: '2026-09' } })).body;
    let d = (await s.j(`/api/reportes/${r.id}/datos`, { method: 'POST' })).body;
    const sube = (buf, tipo) => fetch(`${s.B}/api/reportes/${r.id}/imagen`, { method: 'POST', headers: { 'Content-Type': tipo }, body: buf }).then(async x => ({ status: x.status, body: await x.json() }));
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fe0dc3a2c70000000049454e44ae426082', 'hex');
    assert.equal((await sube(Buffer.from('<svg onload=alert(1)></svg>'), 'image/svg+xml')).status, 400, 'solo imágenes de verdad (no SVG)');
    const { img } = (await sube(png, 'image/png')).body;
    assert.match(img, /^i[0-9a-f]{16}$/);

    const red = d.modelo.secciones.find(x => x.tipo === 'red'), kpi = d.modelo.marcas[0].redes[0].kpis[0].etiqueta;
    const lista = d.modelo.secciones.map(x => x.id === red.id ? { ...x, ocultos: [kpi], extra: [{ etiqueta: 'Ventas desde Instagram', valor: '45' }], bloques: [{ tipo: 'texto' }, { tipo: 'imagen', img }] } : x);
    lista.push({ tipo: 'blanco' });
    d = (await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { secciones: lista } })).body;
    const sec = d.modelo.secciones.find(x => x.id === red.id);
    assert.deepEqual(sec.ocultos, [kpi]); assert.equal(sec.extra[0].valor, '45'); assert.equal(sec.bloques.length, 2);
    const caja = `${red.id}.b-${sec.bloques[0].id}`;
    assert.ok(d.claves.some(c => c.clave === caja && c.ia === false), 'la caja de texto es un espacio más, que escribe el equipo');
    d = (await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { textos: { [caja]: 'Texto de la caja' } } })).body;
    assert.equal(d.textos[caja], 'Texto de la caja');
    const ajena = lista.map(x => x.id === red.id ? { ...x, bloques: [{ tipo: 'imagen', img: 'i0000000000000000' }] } : x);
    assert.equal((await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { secciones: ajena } })).status, 400, 'no acepta imágenes de otro reporte');

    const ruta = `/api/reportes/${r.id}/imagen/${img}`;
    const ver = await fetch(s.B + ruta); assert.equal(ver.status, 200); assert.equal(ver.headers.get('content-type'), 'image/png'); assert.deepEqual(Buffer.from(await ver.arrayBuffer()), png, 'devuelve los mismos bytes');
    // link del cliente: la imagen solo se ve con el reporte listo
    const tk = d.link.split('/r/')[1];
    assert.equal((await fetch(`${s.B}/api/publico/${tk}/imagen/${img}`)).status, 404);
    await s.j('/api/reportes/' + r.id, { method: 'PATCH', body: { estado: 'listo' } });
    assert.equal((await fetch(`${s.B}/api/publico/${tk}/imagen/${img}`)).status, 200);

    const v = (await s.j(`/api/reportes/${r.id}/version`)).body;
    assert.equal(v.editadoPor, 'pruebas@monkeylabs.cl'); assert.ok(v.rev > 1);
    const h = (await s.j(`/api/reportes/${r.id}/cambios`)).body.cambios;
    assert.ok(h.some(c => c.accion === 'subir imagen') && h.some(c => c.accion === 'editar reporte'));
  } finally { await s.parar(); }
});
