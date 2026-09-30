/* Pruebas sin servidor: el contrato herramienta.json, la configuración por modo y la lógica de la herramienta de ejemplo. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'plantilla-unidad-'));
process.env.MODO = 'local';
const { leer, validar, entradaSistema, comoCodigo } = await import('../lib/herramienta.js');
const T = await import('../lib/tareas.js');

/** Lee la configuración en un proceso aparte, con otras variables de entorno. */
function config(env) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e',
    "const c = await import('./lib/config.js'); console.log(JSON.stringify({ modo: c.MODO, db: c.DB_ARCHIVO, drive: c.DRIVE_MODO, admins: c.ADMINS, faltan: c.validar(), puerto: c.PORT }))"],
  { cwd: ROOT, env: { PATH: process.env.PATH, DATA_DIR: '/tmp/x', ...env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('herramienta.json de la plantilla está bien y se traduce a la entrada de Monkey System', () => {
  const h = leer();
  assert.deepEqual(validar(h), []);
  assert.deepEqual(entradaSistema({ ...h, ver: 'jefes', urls: { produccion: 'https://tareas.up.railway.app' } }),
    { id: 'tareas', nombre: 'Lista de tareas', desc: h.descripcion, url: 'https://tareas.up.railway.app', externo: true, nuevo: true, ver: 'jefes' });
  assert.ok(!('ver' in entradaSistema(h)), 'con ver: todos no hace falta el campo');
  assert.match(comoCodigo(h), /Lab «ProjectLabs» \(id: 'project'\)/);
  assert.match(comoCodigo({ ...h, nombre: "Tareas d'Achs" }), /nombre: 'Tareas d\\'Achs'/, 'escapa las comillas');
});

test('herramienta.json: detecta lo que hay que corregir', () => {
  const h = leer();
  const problemas = validar({ ...h, lab: 'marketing', ver: 'algunos', puerto: 5000, estado: 'operativo', urls: { pruebas: 'http://x' }, variables: [{ nombre: 'clave', valor: '123' }] });
  for (const campo of ['lab', 'ver', 'puerto', 'urls.pruebas', 'urls.produccion', 'variables[0].nombre', 'variables[0]: sin valores']) assert.ok(problemas.some(p => p.startsWith(campo)), campo);
  assert.ok(validar({ ...h, estado: 'entregada' }).some(p => p.startsWith('repo: falta')), 'entregar pide el repo');
  assert.ok(validar({ ...h, repo: 'github.com/ana/tareas' }).some(p => p.startsWith('repo:')), 'el repo con https://github.com/…');
  assert.deepEqual(validar({ ...h, estado: 'entregada', repo: 'https://github.com/ana-monkeylabs/lista-rodajes' }), []);
});

test('configuración por modo: pruebas tiene su propia base, nunca el Drive real y la cuenta de pruebas es administradora', () => {
  const local = config({});
  assert.equal(local.modo, 'local'); assert.equal(local.puerto, 5001); assert.match(local.db, /herramienta-local\.sqlite$/);
  const pruebas = config({ MODO: 'pruebas', DRIVE_MODO: 'google' });
  assert.equal(pruebas.modo, 'pruebas'); assert.match(pruebas.db, /herramienta-pruebas\.sqlite$/);
  assert.equal(pruebas.drive, 'simulado', 'aunque pidan DRIVE_MODO=google');
  assert.ok(pruebas.admins.includes('pruebas@monkeylabs.cl'));
  const prod = config({ MODO: 'produccion' });
  assert.ok(!prod.admins.includes('pruebas@monkeylabs.cl'), 'en producción la cuenta de pruebas no es administradora');
  assert.equal(prod.drive, 'google');
  assert.deepEqual(config({ RAILWAY_ENVIRONMENT: 'production' }).faltan, ['GOOGLE_CLIENT_ID'], 'publicado sin login no arranca');
  assert.deepEqual(config({ MODO: 'pruebas', GOOGLE_CLIENT_ID: 'x' }).faltan, ['SESSION_SECRET (mín. 24 caracteres)']);
});

test('tareas: datos de ejemplo, validación y edición', () => {
  const yo = { email: 'pruebas@monkeylabs.cl', admin: true };
  assert.equal(T.listar().tareas.length, 4, 'fuera de producción parte con 4 tareas de ejemplo');
  assert.throws(() => T.crear(yo, { titulo: '   ' }), /título/);
  assert.throws(() => T.crear(yo, { titulo: 'x', responsable: 'alguien@gmail.com' }), /monkeylabs\.cl/);
  assert.throws(() => T.crear(yo, { titulo: 'x', vence: '2026-13-40' }), /fecha/);
  assert.throws(() => T.crear(yo, { titulo: 'x', estado: 'archivada' }), /Estado/);
  const t = T.crear(yo, { titulo: '  Llamar   al cliente ', responsable: 'Emilio@MonkeyLabs.cl', vence: '2026-10-15' });
  assert.equal(t.titulo, 'Llamar al cliente'); assert.equal(t.responsable, 'emilio@monkeylabs.cl'); assert.equal(t.estado, 'pendiente');
  const e = T.editar(yo, t.id, { estado: 'lista', titulo: 'Llamar al cliente' });
  assert.equal(e.estado, 'lista'); assert.equal(e.editadoPor, yo.email);
  assert.deepEqual(T.actividad(1)[0].detalle.cambios, ['estado'], 'registra solo lo que cambió');
  assert.equal(T.listar({ q: 'llamar' }).tareas.length, 1);
  assert.equal(T.listar({ estado: 'lista' }).conteo.total, 5, 'los conteos ignoran el filtro de estado');
});

test('tareas: la papelera respeta quién puede y se puede restaurar', () => {
  const ana = { email: 'ana@monkeylabs.cl', admin: false }, beto = { email: 'beto@monkeylabs.cl', admin: false }, admin = { email: 'emilio@monkeylabs.cl', admin: true };
  const t = T.crear(ana, { titulo: 'De Ana' }), u = T.crear(beto, { titulo: 'De Beto' });
  assert.throws(() => T.aPapelera(beto, t.id), e => e.code === 403);
  T.aPapelera(ana, t.id);
  assert.throws(() => T.obtener(t.id), e => e.code === 404, 'sale de la lista');
  assert.equal(T.listar({ papelera: true }).tareas[0].id, t.id);
  assert.throws(() => T.restaurar(beto, t.id), e => e.code === 403);
  assert.equal(T.restaurar(admin, t.id).papeleraEn, null);
  const r = T.lote(ana, { ids: [t.id, u.id, 'no-existe'], accion: 'papelera' });
  assert.deepEqual(r.hechas, [t.id]);
  assert.deepEqual(r.omitidas.map(o => o.motivo).sort(), ['es de otra persona', 'no existe']);
  assert.deepEqual(T.lote(beto, { ids: [u.id], accion: 'estado', estado: 'en-curso' }).hechas, [u.id]);
  assert.throws(() => T.lote(beto, { ids: [], accion: 'estado', estado: 'lista' }), /elegidas/);
});
