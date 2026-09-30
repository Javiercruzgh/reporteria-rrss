/* Herramienta de ejemplo: Lista de tareas. Es la parte que se reemplaza por la herramienta nueva.
   Muestra el patrón completo: validar lo que llega, guardar, registrar la actividad y mandar a la papelera (nunca borrar). */
import { db, ahora, nuevoId, registrar } from './db.js';
import { delEquipo } from './auth.js';
import { DOMINIO } from './config.js';

export const ESTADOS = [
  { id: 'pendiente', nombre: 'Pendiente' },
  { id: 'en-curso', nombre: 'En curso' },
  { id: 'lista', nombre: 'Lista' }
];
const error = (code, msg) => Object.assign(new Error(msg), { code });
const linea = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export const aApi = t => t && ({
  id: t.id, titulo: t.titulo, detalle: t.detalle, responsable: t.responsable, estado: t.estado, vence: t.vence || '',
  creadoPor: t.creado_por, creadoEn: t.creado_en, editadoPor: t.editado_por, editadoEn: t.editado_en,
  papeleraEn: t.papelera_en, papeleraPor: t.papelera_por
});

/** Revisa y ordena lo que llega del navegador. Con `parcial`, solo lo que viene (para editar). */
export function validar(b = {}, parcial = false) {
  const d = {};
  if (!parcial || 'titulo' in b) { d.titulo = linea(b.titulo, 120); if (!d.titulo) throw error(400, 'La tarea necesita un título.'); }
  if (!parcial || 'detalle' in b) d.detalle = String(b.detalle ?? '').trim().slice(0, 2000);
  if (!parcial || 'responsable' in b) {
    d.responsable = linea(b.responsable, 120).toLowerCase();
    if (d.responsable && (!/^[^@\s]+@[^@\s]+$/.test(d.responsable) || !delEquipo(d.responsable))) throw error(400, `El responsable tiene que ser un correo @${DOMINIO}.`);
  }
  if (!parcial || 'estado' in b) { d.estado = b.estado || 'pendiente'; if (!ESTADOS.some(e => e.id === d.estado)) throw error(400, 'Estado desconocido.'); }
  if (!parcial || 'vence' in b) {
    d.vence = String(b.vence || '').trim() || null;
    if (d.vence && (!/^\d{4}-\d{2}-\d{2}$/.test(d.vence) || isNaN(new Date(d.vence + 'T12:00:00Z')))) throw error(400, 'La fecha límite no es válida.');
  }
  return d;
}

const fila = id => db.prepare('SELECT * FROM tareas WHERE id = ?').get(String(id || ''));
export function obtener(id, { papelera = false } = {}) {
  const t = fila(id);
  if (!t || !!t.papelera_en !== papelera) throw error(404, papelera ? 'Esa tarea no está en la papelera.' : 'Esa tarea no existe o está en la papelera.');
  return t;
}

/** Lista con búsqueda y filtro por estado. Los conteos por estado ignoran el filtro de estado (para los chips). */
export function listar({ q = '', estado = '', papelera = false } = {}) {
  const donde = [papelera ? 'papelera_en IS NOT NULL' : 'papelera_en IS NULL'], args = [];
  if (q) { donde.push('(titulo LIKE ? OR detalle LIKE ? OR responsable LIKE ?)'); const l = `%${linea(q, 80)}%`; args.push(l, l, l); }
  const conteo = { total: 0 };
  for (const r of db.prepare(`SELECT estado, COUNT(*) n FROM tareas WHERE ${donde.join(' AND ')} GROUP BY estado`).all(...args)) { conteo[r.estado] = r.n; conteo.total += r.n; }
  if (estado) { donde.push('estado = ?'); args.push(estado); }
  const orden = papelera ? 'papelera_en DESC'
    : "CASE estado WHEN 'pendiente' THEN 0 WHEN 'en-curso' THEN 1 ELSE 2 END, vence IS NULL, vence, creado_en DESC";
  const tareas = db.prepare(`SELECT * FROM tareas WHERE ${donde.join(' AND ')} ORDER BY ${orden} LIMIT 500`).all(...args).map(aApi);
  return { tareas, conteo };
}

export function crear(u, datos) {
  const d = validar(datos), id = nuevoId('t');
  db.prepare('INSERT INTO tareas (id, titulo, detalle, responsable, estado, vence, creado_por, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, d.titulo, d.detalle, d.responsable, d.estado, d.vence, u.email, ahora());
  registrar(u.email, 'crear', { id, titulo: d.titulo });
  return aApi(fila(id));
}

export function editar(u, id, datos) {
  const t = obtener(id), d = validar(datos, true);
  const cambios = Object.keys(d).filter(k => (d[k] ?? '') !== (t[k] ?? ''));
  if (!cambios.length) return aApi(t);
  db.prepare(`UPDATE tareas SET ${cambios.map(k => `${k} = ?`).join(', ')}, editado_por = ?, editado_en = ? WHERE id = ?`)
    .run(...cambios.map(k => d[k]), u.email, ahora(), t.id);
  registrar(u.email, 'editar', { id: t.id, titulo: d.titulo || t.titulo, cambios });
  return aApi(fila(t.id));
}

/** Mandar a la papelera: quien la creó o un administrador. Nunca se borra de verdad; se puede restaurar. */
export const puedeMandarAPapelera = (u, t) => u.admin || t.creado_por === u.email;
export function aPapelera(u, id) {
  const t = obtener(id);
  if (!puedeMandarAPapelera(u, t)) throw error(403, 'Solo quien creó la tarea o un administrador puede mandarla a la papelera.');
  db.prepare('UPDATE tareas SET papelera_en = ?, papelera_por = ? WHERE id = ?').run(ahora(), u.email, t.id);
  registrar(u.email, 'papelera', { id: t.id, titulo: t.titulo });
  return { ok: true };
}
export function restaurar(u, id) {
  const t = obtener(id, { papelera: true });
  if (!puedeMandarAPapelera(u, t) && t.papelera_por !== u.email) throw error(403, 'Solo quien creó la tarea o un administrador puede restaurarla.');
  db.prepare('UPDATE tareas SET papelera_en = NULL, papelera_por = NULL WHERE id = ?').run(t.id);
  registrar(u.email, 'restaurar', { id: t.id, titulo: t.titulo });
  return aApi(fila(t.id));
}

/** Acciones en grupo sobre lo elegido. Devuelve qué se hizo y qué no (y por qué), para avisarlo en pantalla. */
export function lote(u, { ids = [], accion, estado } = {}) {
  ids = [...new Set([].concat(ids).map(String))].slice(0, 500);
  if (!ids.length) throw error(400, 'No hay tareas elegidas.');
  if (!['estado', 'papelera'].includes(accion)) throw error(400, 'Acción desconocida.');
  if (accion === 'estado' && !ESTADOS.some(e => e.id === estado)) throw error(400, 'Estado desconocido.');
  const hechas = [], omitidas = [];
  for (const id of ids) {
    const t = fila(id);
    if (!t || t.papelera_en) { omitidas.push({ id, motivo: 'no existe' }); continue; }
    if (accion === 'papelera' && !puedeMandarAPapelera(u, t)) { omitidas.push({ id, motivo: 'es de otra persona' }); continue; }
    if (accion === 'estado') db.prepare('UPDATE tareas SET estado = ?, editado_por = ?, editado_en = ? WHERE id = ?').run(estado, u.email, ahora(), id);
    else db.prepare('UPDATE tareas SET papelera_en = ?, papelera_por = ? WHERE id = ?').run(ahora(), u.email, id);
    hechas.push(id);
  }
  if (hechas.length) registrar(u.email, 'lote', { accion, estado: accion === 'estado' ? estado : undefined, n: hechas.length, omitidas: omitidas.length });
  return { hechas, omitidas };
}

export const actividad = (limite = 200) => db.prepare('SELECT * FROM registro ORDER BY id DESC LIMIT ?').all(limite).map(r => ({ ...r, detalle: JSON.parse(r.detalle || '{}') }));
