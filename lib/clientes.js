/* Clientes y sus marcas. Se editan desde la pestaña Clientes, sin tocar código:
   qué marcas se reportan, su número de Metricool (blogId), sus redes, la regla de pauta de TikTok y los lineamientos para los textos. */
import { db, ahora, json, registrar } from './db.js';
import { REDES } from './metricool.js';

const error = (code, msg) => Object.assign(new Error(msg), { code });
const linea = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const slug = s => linea(s, 40).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const aApi = c => c && ({ id: c.id, nombre: c.nombre, config: json(c.config, {}), orden: c.orden, editadoPor: c.editado_por, editadoEn: c.editado_en, papeleraEn: c.papelera_en });
const fila = id => db.prepare('SELECT * FROM clientes WHERE id = ?').get(String(id || ''));

export function obtener(id) {
  const c = fila(id);
  if (!c || c.papelera_en) throw error(404, 'Ese cliente no existe.');
  return c;
}
export const listar = ({ papelera = false } = {}) =>
  db.prepare(`SELECT * FROM clientes WHERE papelera_en IS ${papelera ? 'NOT' : ''} NULL ORDER BY orden, nombre`).all().map(aApi);

/** Revisa la configuración que llega del navegador y la deja ordenada. */
export function validarConfig(c = {}) {
  const marcas = Array.isArray(c.marcas) ? c.marcas : [];
  if (!marcas.length) throw error(400, 'El cliente necesita al menos una marca.');
  if (marcas.length > 12) throw error(400, 'Máximo 12 marcas por cliente.');
  const ids = new Set();
  const out = marcas.map((m, i) => {
    const nombre = linea(m.nombre, 60); if (!nombre) throw error(400, `La marca ${i + 1} necesita nombre.`);
    const id = slug(m.id || nombre); if (!id || ids.has(id)) throw error(400, `La marca «${nombre}» repite su identificador.`); ids.add(id);
    const blogId = linea(m.blogId, 20); if (blogId && !/^\d+$/.test(blogId)) throw error(400, `El número de Metricool de «${nombre}» tiene que ser solo dígitos.`);
    const redes = [...new Set([].concat(m.redes || []))].filter(r => REDES.includes(r));
    if (!redes.length) throw error(400, `La marca «${nombre}» necesita al menos una red.`);
    const color = /^#[0-9a-f]{6}$/i.test(m.color || '') ? m.color : '';
    return { id, nombre, blogId, redes, competencia: m.competencia !== false, activa: m.activa !== false, ...(linea(m.nombreLargo, 80) ? { nombreLargo: linea(m.nombreLargo, 80) } : {}), ...(color ? { color } : {}) };
  });
  const pauta = Math.max(0, Math.round(Number(c.reglas?.pautaTiktok) || 0));
  return { marcas: out, escucha: !!c.escucha, reglas: pauta ? { pautaTiktok: pauta } : {}, lineamientos: String(c.lineamientos ?? '').trim().slice(0, 4000) };
}

export function crear(u, { nombre } = {}) {
  nombre = linea(nombre, 60); if (!nombre) throw error(400, 'El cliente necesita un nombre.');
  let id = slug(nombre) || 'cliente'; for (let k = 2; fila(id); k++) id = `${slug(nombre)}-${k}`;
  const config = { marcas: [{ id: slug(nombre), nombre, blogId: '', redes: ['instagram', 'tiktok'], competencia: true, activa: true }], escucha: false, reglas: {}, lineamientos: '' };
  const orden = (db.prepare('SELECT MAX(orden) m FROM clientes').get().m ?? 0) + 1;
  db.prepare('INSERT INTO clientes (id, nombre, config, orden, creado_por, creado_en) VALUES (?, ?, ?, ?, ?, ?)').run(id, nombre, JSON.stringify(config), orden, u.email, ahora());
  registrar(u.email, 'crear cliente', { id, nombre });
  return aApi(fila(id));
}

export function editar(u, id, b = {}) {
  const c = obtener(id);
  const nombre = 'nombre' in b ? linea(b.nombre, 60) : c.nombre; if (!nombre) throw error(400, 'El cliente necesita un nombre.');
  const config = 'config' in b ? validarConfig(b.config) : json(c.config, {});
  db.prepare('UPDATE clientes SET nombre = ?, config = ?, editado_por = ?, editado_en = ? WHERE id = ?').run(nombre, JSON.stringify(config), u.email, ahora(), c.id);
  registrar(u.email, 'editar cliente', { id: c.id, nombre });
  return aApi(fila(c.id));
}

/** Papelera de clientes: solo administradores (sus reportes quedan, pero el cliente deja de aparecer en la grilla). */
export function aPapelera(u, id) {
  const c = obtener(id);
  db.prepare('UPDATE clientes SET papelera_en = ?, papelera_por = ? WHERE id = ?').run(ahora(), u.email, c.id);
  registrar(u.email, 'papelera cliente', { id: c.id, nombre: c.nombre });
  return { ok: true };
}
export function restaurar(u, id) {
  const c = fila(id); if (!c?.papelera_en) throw error(404, 'Ese cliente no está en la papelera.');
  db.prepare('UPDATE clientes SET papelera_en = NULL, papelera_por = NULL WHERE id = ?').run(c.id);
  registrar(u.email, 'restaurar cliente', { id: c.id, nombre: c.nombre });
  return aApi(fila(c.id));
}
