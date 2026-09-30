/* Flujo completo contra el servidor: la API de la herramienta de ejemplo, permisos entre dos personas,
   la franja y los datos aparte del modo pruebas, y que en producción sin sesión no se vea nada. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporal = () => fs.mkdtempSync(path.join(os.tmpdir(), 'plantilla-flujo-'));

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
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { PATH: process.env.PATH, PORT: String(port), DATA_DIR: datos, MODO: 'local', DEV_USER: usuario, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = ''; srv.stderr.on('data', d => { salida += d; });
  let listo = false;
  for (let i = 0; i < 50 && !listo && srv.exitCode === null; i++) { try { await fetch(B + '/api/config'); listo = true; } catch { await new Promise(r => setTimeout(r, 100)); } }
  if (!listo) { srv.kill(); throw Object.assign(new Error('el servidor no arrancó: ' + salida), { salida }); }
  const j = async (ruta, opt = {}) => { const r = await fetch(B + ruta, { ...opt, redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: opt.body && JSON.stringify(opt.body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const txt = async ruta => { const r = await fetch(B + ruta, { redirect: 'manual' }); return { status: r.status, texto: await r.text(), location: r.headers.get('location') }; };
  return { B, j, txt, datos, parar: () => new Promise(r => { srv.once('exit', r); srv.kill(); }) };
}

test('local: crear, editar, cambiar en grupo, papelera, restaurar y actividad', async () => {
  const s = await levantar('pruebas@monkeylabs.cl');
  try {
    const cfg = (await s.j('/api/config')).body;
    assert.equal(cfg.modo, 'local'); assert.equal(cfg.nombre, 'Lista de tareas'); assert.match(cfg.monkeySystem, /^https:\/\/monkey-system/);
    assert.deepEqual((await s.j('/api/yo')).body, { email: 'pruebas@monkeylabs.cl', nombre: 'pruebas (local)', admin: true });

    const inicial = (await s.j('/api/tareas')).body;
    assert.equal(inicial.tareas.length, 4); assert.equal(inicial.estados.length, 3);
    assert.equal((await s.j('/api/tareas', { method: 'POST', body: { titulo: '' } })).status, 400);
    const c = await s.j('/api/tareas', { method: 'POST', body: { titulo: 'Grabar el spot', responsable: 'emilio@monkeylabs.cl' } });
    assert.equal(c.status, 201);
    const id = c.body.id;
    assert.equal((await s.j('/api/tareas/' + id, { method: 'PATCH', body: { estado: 'en-curso' } })).body.estado, 'en-curso');

    const ids = inicial.tareas.slice(0, 2).map(t => t.id);
    const l = await s.j('/api/tareas/lote', { method: 'POST', body: { ids, accion: 'estado', estado: 'lista' } });
    assert.deepEqual(l.body.hechas, ids);
    assert.equal((await s.j('/api/tareas?estado=lista')).body.tareas.length, 3);

    assert.equal((await s.j('/api/tareas/' + id, { method: 'DELETE' })).status, 200);
    assert.equal((await s.j('/api/tareas/' + id)).status, 404);
    assert.equal((await s.j('/api/tareas?papelera=1')).body.tareas[0].id, id);
    assert.equal((await s.j(`/api/tareas/${id}/restaurar`, { method: 'POST' })).status, 200);
    assert.equal((await s.j('/api/tareas/' + id)).body.titulo, 'Grabar el spot');

    const act = (await s.j('/api/actividad')).body.map(r => r.accion);
    for (const a of ['crear', 'editar', 'lote', 'papelera', 'restaurar']) assert.ok(act.includes(a), a);
    assert.equal((await s.j('/api/no-existe')).status, 404);
  } finally { await s.parar(); }
});

test('dos personas: se puede editar lo de otro, pero no mandarlo a la papelera ni ver la actividad', async () => {
  const datos = temporal();
  const a = await levantar('pruebas@monkeylabs.cl', datos);
  let id;
  try { id = (await a.j('/api/tareas', { method: 'POST', body: { titulo: 'De pruebas' } })).body.id; } finally { await a.parar(); }
  const b = await levantar('camila@monkeylabs.cl', datos);
  try {
    assert.equal((await b.j('/api/yo')).body.admin, false);
    assert.equal((await b.j('/api/tareas/' + id, { method: 'PATCH', body: { estado: 'lista' } })).status, 200);
    assert.equal((await b.j('/api/tareas/' + id, { method: 'DELETE' })).status, 403);
    const l = await b.j('/api/tareas/lote', { method: 'POST', body: { ids: [id], accion: 'papelera' } });
    assert.deepEqual(l.body, { hechas: [], omitidas: [{ id, motivo: 'es de otra persona' }] });
    assert.equal((await b.j('/api/actividad')).status, 403);
  } finally { await b.parar(); }
});

test('franja: en local y en pruebas sí (con su título), y pruebas guarda en su propia base', async () => {
  const datos = temporal();
  const local = await levantar('pruebas@monkeylabs.cl', datos);
  try {
    const p = await local.txt('/');
    assert.match(p.texto, /<body data-modo="local"><div class="franja-modo" role="note">Local · datos ficticios<\/div>/);
    assert.match(p.texto, /<title>LOCAL · Lista de tareas/);
    assert.match((await local.txt('/kit.html')).texto, /franja-modo/);
  } finally { await local.parar(); }
  const pruebas = await levantar('pruebas@monkeylabs.cl', datos, { MODO: 'pruebas' });
  try {
    assert.equal((await pruebas.j('/api/config')).body.modo, 'pruebas');
    const p = await pruebas.txt('/login.html');
    assert.match(p.texto, /Ambiente de pruebas · datos ficticios/);
    assert.match(p.texto, /<title>PRUEBAS · Entrar/);
    await pruebas.j('/api/tareas', { method: 'POST', body: { titulo: 'Solo en pruebas' } });
  } finally { await pruebas.parar(); }
  assert.ok(fs.existsSync(path.join(datos, 'herramienta-local.sqlite')) && fs.existsSync(path.join(datos, 'herramienta-pruebas.sqlite')), 'una base por modo');
  const otra = await levantar('pruebas@monkeylabs.cl', datos);
  try { assert.equal((await otra.j('/api/tareas?q=Solo en pruebas')).body.tareas.length, 0, 'lo de pruebas no aparece en local'); } finally { await otra.parar(); }
});

test('producción: sin sesión no se ve nada, sin franja, y no arranca sin las variables', async () => {
  const s = await levantar('pruebas@monkeylabs.cl', temporal(), { MODO: 'produccion', GOOGLE_CLIENT_ID: 'prueba.apps.googleusercontent.com', SESSION_SECRET: 'x'.repeat(32) });
  try {
    assert.equal((await s.j('/api/tareas')).status, 401);
    assert.equal((await s.j('/api/yo')).status, 401);
    for (const ruta of ['/', '/kit.html', '/js/ui.js', '/js/tareas.js']) {
      const r = await s.txt(ruta);
      assert.equal(r.status, 302, ruta); assert.match(r.location, /^\/login\.html\?next=/, ruta);
    }
    const login = await s.txt('/login.html');
    assert.equal(login.status, 200); assert.ok(!login.texto.includes('franja-modo'), 'en producción no hay franja');
    assert.equal((await s.txt('/css/sistema.css')).status, 200);
    assert.equal((await s.j('/api/config')).body.modo, 'produccion');
  } finally { await s.parar(); }
  await assert.rejects(levantar('x@monkeylabs.cl', temporal(), { MODO: 'produccion', GOOGLE_CLIENT_ID: 'x' }), /SESSION_SECRET/);
  await assert.rejects(levantar('x@monkeylabs.cl', temporal(), { RAILWAY_ENVIRONMENT: 'production' }), /GOOGLE_CLIENT_ID/);
});
