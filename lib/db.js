/* Base de datos propia de la herramienta: SQLite integrado en Node (sin dependencias).
   Vive en DATA_DIR (en Railway, el volumen /data) y cada modo tiene su propio archivo (ver config.js). */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_ARCHIVO, ES_PRODUCCION } from './config.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
export const db = new DatabaseSync(DB_ARCHIVO);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS registro (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cuando TEXT NOT NULL, quien TEXT, accion TEXT NOT NULL, detalle TEXT
);
CREATE TABLE IF NOT EXISTS tareas (
  id TEXT PRIMARY KEY, titulo TEXT NOT NULL, detalle TEXT NOT NULL DEFAULT '', responsable TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'pendiente', vence TEXT,
  creado_por TEXT NOT NULL, creado_en TEXT NOT NULL, editado_por TEXT, editado_en TEXT,
  papelera_en TEXT, papelera_por TEXT
);
CREATE INDEX IF NOT EXISTS tareas_papelera ON tareas (papelera_en, estado);
`);

export const ahora = () => new Date().toISOString();
export const nuevoId = (pref = '') => pref + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
export const json = (s, def) => { try { return s == null ? def : JSON.parse(s); } catch { return def; } };

export function ajuste(clave, def = null) { const r = db.prepare('SELECT valor FROM ajustes WHERE clave = ?').get(clave); return r ? json(r.valor, def) : def; }
export function guardarAjuste(clave, valor) { db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').run(clave, JSON.stringify(valor)); }
/** Registro de actividad: quién hizo qué. Se ve en la pestaña Actividad (solo administradores). */
export function registrar(quien, accion, detalle) { db.prepare('INSERT INTO registro (cuando, quien, accion, detalle) VALUES (?, ?, ?, ?)').run(ahora(), quien || 'sistema', accion, typeof detalle === 'string' ? detalle : JSON.stringify(detalle || {})); }

/* Migraciones: cada una corre una sola vez y queda marcada con ajuste('migr_…'). Ejemplo:
   if (!ajuste('migr_cliente')) { db.exec("ALTER TABLE tareas ADD COLUMN cliente TEXT NOT NULL DEFAULT ''"); guardarAjuste('migr_cliente', true); } */

// datos de ejemplo, solo fuera de producción y solo la primera vez
if (!ES_PRODUCCION && !ajuste('semilla')) {
  const ins = db.prepare('INSERT INTO tareas (id, titulo, detalle, responsable, estado, vence, creado_por, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const en = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  [
    ['Revisar la grilla de octubre', 'Confirmar copys y fechas con el cliente antes del viernes.', 'pruebas@monkeylabs.cl', 'pendiente', en(2)],
    ['Subir el material final del rodaje', 'Videos y fotos retocadas al banco audiovisual.', 'pruebas@monkeylabs.cl', 'en-curso', en(5)],
    ['Cotizar la jornada de fotos', '', '', 'pendiente', null],
    ['Enviar el reporte mensual', 'Reportería RRSS de septiembre.', 'pruebas@monkeylabs.cl', 'lista', en(-3)]
  ].forEach(([t, d, r, e, v], i) => ins.run(nuevoId('t'), t, d, r, e, v, 'sistema', new Date(Date.now() - i * 60e3).toISOString()));
  guardarAjuste('semilla', true);
}
