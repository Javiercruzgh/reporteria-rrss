/* Base de datos propia de la herramienta: SQLite integrado en Node (sin dependencias).
   Vive en DATA_DIR (en Railway, el volumen /data) y cada modo tiene su propio archivo (ver config.js). */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_ARCHIVO } from './config.js';
import { CLIENTES_INICIALES } from './clientes-iniciales.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
export const db = new DatabaseSync(DB_ARCHIVO);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS registro (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cuando TEXT NOT NULL, quien TEXT, accion TEXT NOT NULL, detalle TEXT
);
/* Clientes: lo que se reporta junto (Achs agrupa cinco marcas). La configuración (marcas, redes, reglas, lineamientos) va en JSON. */
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}', orden INTEGER NOT NULL DEFAULT 0,
  creado_por TEXT NOT NULL, creado_en TEXT NOT NULL, editado_por TEXT, editado_en TEXT, papelera_en TEXT, papelera_por TEXT
);
/* Reportes: uno por cliente y mes. datos = lo que llegó de Metricool; textos = el análisis; escucha = lo leído de Brandwatch. */
CREATE TABLE IF NOT EXISTS reportes (
  id TEXT PRIMARY KEY, cliente TEXT NOT NULL, mes TEXT NOT NULL, desde TEXT NOT NULL, hasta TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador', datos TEXT, datos_en TEXT, datos_origen TEXT, textos TEXT NOT NULL DEFAULT '{}', escucha TEXT,
  token TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1,
  creado_por TEXT NOT NULL, creado_en TEXT NOT NULL, editado_por TEXT, editado_en TEXT, papelera_en TEXT, papelera_por TEXT
);
CREATE INDEX IF NOT EXISTS reportes_mes ON reportes (mes, cliente);
CREATE UNIQUE INDEX IF NOT EXISTS reportes_token ON reportes (token);
`);

export const ahora = () => new Date().toISOString();
export const nuevoId = (pref = '') => pref + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
export const json = (s, def) => { try { return s == null ? def : JSON.parse(s); } catch { return def; } };

export function ajuste(clave, def = null) { const r = db.prepare('SELECT valor FROM ajustes WHERE clave = ?').get(clave); return r ? json(r.valor, def) : def; }
export function guardarAjuste(clave, valor) { db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').run(clave, JSON.stringify(valor)); }
/** Registro de actividad: quién hizo qué. Se ve en la pestaña Actividad (solo administradores). */
export function registrar(quien, accion, detalle) { db.prepare('INSERT INTO registro (cuando, quien, accion, detalle) VALUES (?, ?, ?, ?)').run(ahora(), quien || 'sistema', accion, typeof detalle === 'string' ? detalle : JSON.stringify(detalle || {})); }

/* Migraciones: cada una corre una sola vez y queda marcada con ajuste('migr_…'). Ejemplo:
   if (!ajuste('migr_cliente')) { db.exec("ALTER TABLE reportes ADD COLUMN notas TEXT NOT NULL DEFAULT ''"); guardarAjuste('migr_cliente', true); } */

/* Los clientes de la agencia con servicio digital. Se crean una sola vez (también en producción) y después se editan
   desde Clientes, sin tocar código. Los números de marca (blogId) son los de Metricool: no son secretos. */
if (!ajuste('semilla_clientes')) {
  const ins = db.prepare('INSERT OR IGNORE INTO clientes (id, nombre, config, orden, creado_por, creado_en) VALUES (?, ?, ?, ?, ?, ?)');
  CLIENTES_INICIALES.forEach((c, i) => ins.run(c.id, c.nombre, JSON.stringify(c.config), i, 'sistema', ahora()));
  guardarAjuste('semilla_clientes', true);
}
