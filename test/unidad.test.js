/* Pruebas sin servidor: el contrato herramienta.json, la configuración por modo y la lógica de la herramienta de ejemplo. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'reporteria-unidad-'));
process.env.MODO = 'local';
const { leer, validar, entradaSistema, comoCodigo } = await import('../lib/herramienta.js');
const P = await import('../lib/periodos.js');
const K = await import('../lib/calculos.js');
const { clavesTexto, limpiarTextos } = await import('../lib/textos.js');
const { validarConfig } = await import('../lib/clientes.js');
const S = await import('../lib/secciones.js');

/** Lee la configuración en un proceso aparte, con otras variables de entorno. */
function config(env) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e',
    "const c = await import('./lib/config.js'); console.log(JSON.stringify({ modo: c.MODO, db: c.DB_ARCHIVO, drive: c.DRIVE_MODO, admins: c.ADMINS, faltan: c.validar(), puerto: c.PORT }))"],
  { cwd: ROOT, env: { PATH: process.env.PATH, DATA_DIR: '/tmp/x', ...env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('herramienta.json está bien y se traduce a la entrada de Monkey System', () => {
  const h = leer();
  assert.deepEqual(validar(h), []);
  assert.deepEqual(entradaSistema({ ...h, ver: 'jefes', urls: { produccion: 'https://tareas.up.railway.app' } }),
    { id: 'reporteria-rrss', nombre: 'Reportería RRSS', desc: h.descripcion, url: 'https://tareas.up.railway.app', externo: true, nuevo: true, ver: 'jefes' });
  assert.ok(!('ver' in entradaSistema(h)), 'con ver: todos no hace falta el campo');
  assert.match(comoCodigo(h), /Lab «DigitalLabs» \(id: 'digital'\)/);
  assert.match(comoCodigo({ ...h, nombre: "Tareas d'Achs" }), /nombre: 'Tareas d\\'Achs'/, 'escapa las comillas');
});

test('herramienta.json: detecta lo que hay que corregir', () => {
  const h = leer();
  const problemas = validar({ ...h, lab: 'marketing', ver: 'algunos', puerto: 5000, estado: 'operativo', urls: { pruebas: 'http://x' }, variables: [{ nombre: 'clave', valor: '123' }] });
  for (const campo of ['lab', 'ver', 'puerto', 'urls.pruebas', 'urls.produccion', 'variables[0].nombre', 'variables[0]: sin valores']) assert.ok(problemas.some(p => p.startsWith(campo)), campo);
  assert.ok(validar({ ...h, estado: 'entregada', repo: '' }).some(p => p.startsWith('repo: falta')), 'entregar pide el repo');
  assert.ok(validar({ ...h, repo: 'github.com/ana/tareas' }).some(p => p.startsWith('repo:')), 'el repo con https://github.com/…');
  assert.deepEqual(validar({ ...h, estado: 'entregada', repo: 'https://github.com/ana-monkeylabs/lista-rodajes' }), []);
});

test('configuración por modo: pruebas tiene su propia base, nunca el Drive real y la cuenta de pruebas es administradora', () => {
  const local = config({});
  assert.equal(local.modo, 'local'); assert.equal(local.puerto, 5003); assert.match(local.db, /herramienta-local\.sqlite$/);
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

test('herramienta.json: las claves van marcadas como secreto y sin valor', () => {
  const v = Object.fromEntries(leer().variables.map(x => [x.nombre, x]));
  for (const k of ['METRICOOL_TOKEN', 'ANTHROPIC_API_KEY', 'SESSION_SECRET']) { assert.equal(v[k]?.secreto, true, k); assert.ok(!('valor' in v[k]), k); }
});

test('Metricool e IA: sin clave, en local se simula y en producción queda apagado', () => {
  const leerModos = env => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', "const c = await import('./lib/config.js'); console.log(JSON.stringify({ m: c.METRICOOL_MODO, ia: c.IA_MODO }))"],
      { cwd: ROOT, env: { PATH: process.env.PATH, DATA_DIR: '/tmp/x', METRICOOL_TOKEN: '', ANTHROPIC_API_KEY: '', ...env }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout);
  };
  assert.deepEqual(leerModos({}), { m: 'simulado', ia: 'apagado' });
  assert.deepEqual(leerModos({ MODO: 'produccion' }), { m: 'apagado', ia: 'apagado' });
  assert.deepEqual(leerModos({ MODO: 'produccion', METRICOOL_TOKEN: 't', METRICOOL_USER_ID: '1', ANTHROPIC_API_KEY: 'k' }), { m: 'api', ia: 'api' });
});

test('períodos: el mes se compara con el mismo tramo del mes anterior', () => {
  assert.deepEqual(P.periodo('2026-09', '2026-09-28').anterior, { mes: '2026-08', desde: '2026-08-01', hasta: '2026-08-28' });
  assert.deepEqual(P.periodo('2026-03', '2026-03-31').anterior, { mes: '2026-02', desde: '2026-02-01', hasta: '2026-02-28' }, 'mes completo contra mes completo');
  assert.equal(P.periodo('2026-03', '2026-03-30').anterior.hasta, '2026-02-28', 'no se pasa del fin de febrero');
  assert.equal(P.periodo('2026-01', '2026-01-15').anterior.mes, '2025-12');
  assert.equal(P.hastaPorDefecto('2026-09', new Date('2026-09-30T12:00:00Z')), '2026-09-29');
  assert.equal(P.hastaPorDefecto('2026-08', new Date('2026-09-30T12:00:00Z')), '2026-08-31');
  assert.throws(() => P.periodo('2026-09', '2026-10-01'), /dentro del mes/);
  assert.equal(P.textoPeriodo('2026-09-01', '2026-09-28'), '1 al 28 de septiembre de 2026');
});

const pub = (o) => ({ fecha: '2026-09-10', ...o });
test('cálculos: Instagram (engagement sobre alcance del feed) y top por alcance', () => {
  const m = K.modeloMarca({ id: 'a', nombre: 'A', redes: ['instagram'] }, {
    actual: { redes: { instagram: { comunidad: 110, posts: [pub({ alcance: 100, interacciones: 10, guardados: 2 })], reels: [pub({ alcance: 300, interacciones: 20, compartidos: 3 })], historias: [{ alcance: 50 }] } } },
    anterior: { redes: { instagram: { comunidad: 100, posts: [pub({ alcance: 200, interacciones: 10 })], reels: [], historias: [] } } }
  });
  const ig = m.redes[0], k = Object.fromEntries(ig.kpis.map(x => [x.clave, x]));
  assert.equal(k.comunidad.var, 10);
  assert.equal(k.interacciones.v, 30); assert.equal(k.alcanceFeed.v, 400);
  assert.equal(k.engagement.v, 7.5); assert.equal(k.engagement.a, 5);
  assert.equal(ig.top[0].alcance, 300, 'el top va por alcance');
  assert.deepEqual(m.funnel.consideracion, { v: 5, a: 0, var: null });
  assert.equal(m.general.total.publicaciones.v, 2, 'las historias no cuentan como publicaciones');
});

test('cálculos: TikTok con regla de pauta (Achs) deja el top solo con orgánicos', () => {
  const v = (vistas, id) => pub({ id, vistas, likes: 1, comentarios: 0, compartidos: 0 });
  const m = K.modeloMarca({ id: 'a', nombre: 'A', redes: ['tiktok'] }, {
    actual: { redes: { tiktok: { comunidad: 10, videos: [v(80000, 'pagado'), v(3000, 'o1'), v(1000, 'o2')] } } }, anterior: { redes: {} }
  }, { pautaTiktok: 50000 });
  const tt = m.redes[0], k = Object.fromEntries(tt.kpis.map(x => [x.clave, x]));
  assert.equal(k.vistas.v, 84000); assert.equal(k.vistasOrg.v, 4000); assert.equal(k.promOrg.v, 2000);
  assert.deepEqual(tt.top.map(x => x.id), ['o1', 'o2']);
  assert.match(tt.notas[0], /50\.000 vistas/);
  const sin = K.modeloMarca({ id: 'a', nombre: 'A', redes: ['tiktok'] }, { actual: { redes: { tiktok: { videos: [v(80000, 'x')] } } }, anterior: { redes: {} } });
  assert.equal(sin.redes[0].top[0].id, 'x', 'sin regla, todo cuenta');
});

test('cálculos: LinkedIn suma los clics a las interacciones', () => {
  const m = K.modeloMarca({ id: 'a', nombre: 'A', redes: ['linkedin'] }, { actual: { redes: { linkedin: { posts: [pub({ impresiones: 1000, likes: 5, comentarios: 1, compartidos: 1, clics: 13 })] } } }, anterior: { redes: {} } });
  const k = Object.fromEntries(m.redes[0].kpis.map(x => [x.clave, x]));
  assert.equal(k.interacciones.v, 20); assert.equal(k.engagement.v, 2);
});

const ACHS = { id: 'achs', nombre: 'Achs', config: { escucha: true, reglas: { pautaTiktok: 50000 }, marcas: [
  { id: 'seguro-laboral', nombre: 'Seguro Laboral', redes: ['instagram', 'tiktok'] }, { id: 'salud', nombre: 'Achs Salud', redes: ['instagram'] },
  { id: 'hospital', nombre: 'Hospital', redes: ['instagram'] }, { id: 'segurito', nombre: 'Segurito', redes: ['instagram'] },
  { id: 'masterbrand', nombre: 'Masterbrand', redes: ['linkedin'], activa: false }] } };
const modeloAchs = (extra = {}) => {
  const d = { actual: { redes: { instagram: { comunidad: 1, posts: [], reels: [], historias: [] } } }, anterior: { redes: {} } };
  return K.modelo(ACHS, { mes: '2026-09', desde: '2026-09-01', hasta: '2026-09-28', anterior: P.periodo('2026-09', '2026-09-28').anterior,
    datos: Object.fromEntries(ACHS.config.marcas.map(m => [m.id, d])), ...extra });
};

test('láminas: la propuesta sale de los datos, sin nada fijo por marca', () => {
  const M = modeloAchs({ escucha: { menciones: 5 } });
  assert.equal(M.marcas.length, 4, 'la marca inactiva no se reporta');
  assert.equal(M.resumen.filas.length, 4);
  assert.equal(M.titulo, 'Septiembre 2026'); assert.equal(M.mesAnterior, 'agosto');
  assert.equal(M.seccionesPropias, false);
  const tipos = M.secciones.map(x => x.tipo);
  assert.deepEqual(tipos.slice(0, 2), ['portada', 'resumen']); assert.deepEqual(tipos.slice(-3), ['escucha', 'notas', 'gracias']);
  assert.equal(tipos.filter(t => t === 'divisor').length, 4, 'con varias marcas, un separador por marca');
  const claves = clavesTexto(M).map(c => c.clave);
  assert.ok(claves.includes('resumen.texto') && claves.includes('escucha.lectura') && claves.includes('salud-instagram.lectura') && claves.includes('segurito-optimizaciones.testear'));
  assert.deepEqual(limpiarTextos({ 'resumen.texto': ' hola ', 'otra.cosa': 'x' }, claves), { 'resumen.texto': 'hola' }, 'solo claves conocidas');
  const una = K.modelo({ id: 'x', nombre: 'X', config: { marcas: [{ id: 'x', nombre: 'X', redes: ['instagram'] }] } }, { mes: '2026-09', desde: '2026-09-01', hasta: '2026-09-28', anterior: P.periodo('2026-09', '2026-09-28').anterior, datos: { x: { actual: { redes: { instagram: {} } }, anterior: { redes: {} } } } });
  assert.ok(!una.secciones.some(x => x.tipo === 'divisor' || x.tipo === 'escucha'), 'una marca sin social listening: sin separadores ni escucha');
});

test('láminas: el equipo arma su lista y se valida contra las marcas del cliente', () => {
  const lista = S.validar([{ id: 'portada', tipo: 'portada' }, { tipo: 'red', marca: 'salud', red: 'instagram' }, { tipo: 'libre' }, { tipo: 'escucha' }], ACHS);
  assert.equal(lista.length, 4); assert.match(lista[1].id, /^s[0-9a-f]{8}$/, 'las nuevas reciben id');
  assert.throws(() => S.validar([{ tipo: 'inventada' }], ACHS), /tipo desconocido/);
  assert.throws(() => S.validar([{ tipo: 'hallazgo' }], ACHS), /Elige una marca/);
  assert.throws(() => S.validar([{ tipo: 'red', marca: 'salud', red: 'tiktok' }], ACHS), /no tiene esa red/);
  assert.throws(() => S.validar([{ id: 'a', tipo: 'portada' }, { id: 'a', tipo: 'gracias' }], ACHS), /mismo identificador/);
  const M = modeloAchs({ secciones: lista });
  assert.equal(M.seccionesPropias, true);
  const claves = clavesTexto(M);
  assert.deepEqual(claves.map(c => c.clave), [`${lista[1].id}.lectura`, `${lista[2].id}.titulo`, `${lista[2].id}.texto`], 'sin PDF, la escucha no pide texto');
  assert.equal(claves.find(c => c.clave.endsWith('.titulo')).ia, false, 'la IA no inventa láminas de texto libre');
});

test('clientes: la configuración se valida antes de guardarse', () => {
  const ok = validarConfig({ marcas: [{ nombre: 'Muno', blogId: '4323563', redes: ['instagram', 'otra'] }], reglas: { pautaTiktok: '50000' } });
  assert.deepEqual(ok.marcas[0], { id: 'muno', nombre: 'Muno', blogId: '4323563', redes: ['instagram'], competencia: true, activa: true });
  assert.equal(ok.reglas.pautaTiktok, 50000);
  assert.throws(() => validarConfig({ marcas: [] }), /al menos una marca/);
  assert.throws(() => validarConfig({ marcas: [{ nombre: 'X', blogId: 'abc', redes: ['instagram'] }] }), /solo dígitos/);
  assert.throws(() => validarConfig({ marcas: [{ nombre: 'X', redes: [] }] }), /al menos una red/);
  assert.throws(() => validarConfig({ marcas: [{ nombre: 'X', redes: ['tiktok'] }, { nombre: 'x', redes: ['tiktok'] }] }), /repite/);
});

test('láminas: campos y cajas se validan', async () => {
  const { validar } = await import('../lib/secciones.js');
  const cli = { nombre: 'X', config: { marcas: [{ id: 'x', nombre: 'X', redes: ['instagram'] }] } };
  const [s] = validar([{ id: 'x-instagram', tipo: 'red', marca: 'x', red: 'instagram', ocultos: ['Historias'], extra: [{ etiqueta: 'Ventas', valor: '10' }, { etiqueta: '' }], bloques: [{ tipo: 'texto' }] }], cli);
  assert.deepEqual(s.ocultos, ['Historias']); assert.deepEqual(s.extra, [{ etiqueta: 'Ventas', valor: '10' }]); assert.equal(s.bloques[0].tipo, 'texto');
  assert.throws(() => validar([{ tipo: 'blanco', bloques: [{ tipo: 'imagen', img: 'javascript:alert(1)' }] }], cli), /imagen/);
  assert.throws(() => validar([{ tipo: 'blanco', bloques: Array(9).fill({ tipo: 'texto' }) }], cli), /Máximo 8/);
  assert.equal(validar([{ tipo: 'portada', ocultos: ['x'] }], cli)[0].ocultos, undefined, 'los campos son solo de las láminas de red');
});

test('láminas: cada red con datos trae su top y la marca su insight; el top guarda la imagen de cada publicación', async () => {
  const { porDefecto, validar } = await import('../lib/secciones.js');
  const M = { marcas: [{ id: 'x', competencia: [], redes: [{ red: 'instagram', top: [{ id: '1' }] }, { red: 'tiktok', top: [] }] }] };
  const ids = porDefecto(M).map(s => s.id);
  assert.ok(ids.includes('x-instagram-top') && !ids.includes('x-tiktok-top'), 'sin publicaciones no hay lámina de top');
  assert.ok(ids.indexOf('x-instagram-top') === ids.indexOf('x-instagram') + 1 && ids.includes('x-hallazgo'));
  const cli = { nombre: 'X', config: { marcas: [{ id: 'x', nombre: 'X', redes: ['instagram'] }] } };
  const [t] = validar([{ id: 'x-instagram-top', tipo: 'top', marca: 'x', red: 'instagram', imagenes: { '3997131597904688164': 'i0123456789abcdef', '<script>': 'i0123456789abcdef', '2': 'javascript:x' } }], cli);
  assert.deepEqual(t.imagenes, { '3997131597904688164': 'i0123456789abcdef' });
});
