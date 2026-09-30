/* Reportes: uno por cliente y mes. El flujo es:
   crear → actualizar datos (Metricool) → escribir o proponer textos → (Achs) subir Brandwatch → marcar listo → compartir el link.
   El link del cliente (/r/<token>) solo muestra el reporte cuando está «listo», sin nada interno. */
import crypto from 'node:crypto';
import { db, ahora, nuevoId, json, registrar } from './db.js';
import * as clientes from './clientes.js';
import { traerMarca, estado as estadoMetricool, METRICOOL_ORIGEN } from './metricool.js';
import { periodo, hastaPorDefecto, esMes } from './periodos.js';
import { modelo as calcular } from './calculos.js';
import { clavesTexto, limpiarTextos } from './textos.js';
import { CATALOGO, validar as validarSecciones } from './secciones.js';
import * as ia from './ia.js';
import { PUBLIC_URL } from './config.js';

export const ESTADOS = [{ id: 'borrador', nombre: 'Borrador' }, { id: 'listo', nombre: 'Listo para el cliente' }];
const error = (code, msg) => Object.assign(new Error(msg), { code });
const token = () => crypto.randomBytes(18).toString('base64url');
const fila = id => db.prepare('SELECT * FROM reportes WHERE id = ?').get(String(id || ''));

export function obtener(id, { papelera = false } = {}) {
  const r = fila(id);
  if (!r || !!r.papelera_en !== papelera) throw error(404, papelera ? 'Ese reporte no está en la papelera.' : 'Ese reporte no existe o está en la papelera.');
  return r;
}
const resumen = r => r && ({
  id: r.id, cliente: r.cliente, mes: r.mes, desde: r.desde, hasta: r.hasta, estado: r.estado, rev: r.rev,
  datosEn: r.datos_en, datosOrigen: r.datos_origen, conEscucha: !!r.escucha,
  editadoPor: r.editado_por || r.creado_por, editadoEn: r.editado_en || r.creado_en, papeleraEn: r.papelera_en, papeleraPor: r.papelera_por
});

/** El modelo completo (lo que dibujan las láminas) de un reporte. */
function armar(r) {
  const c = clientes.aApi(db.prepare('SELECT * FROM clientes WHERE id = ?').get(r.cliente));
  if (!c) throw error(404, 'El cliente de este reporte ya no existe.');
  const p = periodo(r.mes, r.hasta);
  const m = calcular(c, { mes: r.mes, desde: r.desde, hasta: r.hasta, anterior: p.anterior, datos: json(r.datos, null), datosEn: r.datos_en, escucha: json(r.escucha, null), secciones: json(r.secciones, null) });
  return { cliente: c, modelo: m, claves: clavesTexto(m), textos: json(r.textos, {}) };
}
export const linkCliente = r => `${PUBLIC_URL}/r/${r.token}`;

/** La grilla: cada cliente con su reporte del mes (o sin crear). */
export function mes(m) {
  if (!esMes(m)) throw error(400, 'El mes tiene que ser como 2026-09.');
  const rs = db.prepare('SELECT * FROM reportes WHERE mes = ? AND papelera_en IS NULL').all(m);
  return { mes: m, clientes: clientes.listar().map(c => ({ ...c, reporte: resumen(rs.find(r => r.cliente === c.id)) || null })) };
}

export function detalle(id) {
  const r = obtener(id), a = armar(r);
  return { ...resumen(r), link: linkCliente(r), clienteNombre: a.cliente.nombre, marcasConfig: a.cliente.config.marcas,
    modelo: a.modelo, claves: a.claves, textos: a.textos, catalogo: CATALOGO, metricool: estadoMetricool(), ia: ia.estado() };
}

export function crear(u, { cliente, mes: m, hasta } = {}) {
  const c = clientes.obtener(cliente);
  const p = periodo(m, hasta || hastaPorDefecto(m));
  const ya = db.prepare('SELECT id FROM reportes WHERE cliente = ? AND mes = ? AND papelera_en IS NULL').get(c.id, p.mes);
  if (ya) throw Object.assign(error(409, `Ya existe el reporte de ${c.nombre} de ese mes.`), { id: ya.id });
  const id = nuevoId('r');
  db.prepare('INSERT INTO reportes (id, cliente, mes, desde, hasta, token, creado_por, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, c.id, p.mes, p.desde, p.hasta, token(), u.email, ahora());
  registrar(u.email, 'crear reporte', { id, cliente: c.id, mes: p.mes });
  return resumen(fila(id));
}

function guardar(u, r, campos) {
  const ks = Object.keys(campos);
  db.prepare(`UPDATE reportes SET ${ks.map(k => `${k} = ?`).join(', ')}, rev = rev + 1, editado_por = ?, editado_en = ? WHERE id = ?`)
    .run(...ks.map(k => campos[k]), u.email, ahora(), r.id);
  return fila(r.id);
}

/** Trae de Metricool el mes y el mismo tramo del mes anterior, para cada marca activa. */
export async function actualizarDatos(u, id, opciones = {}) {
  const r = obtener(id), c = clientes.aApi(clientes.obtener(r.cliente));
  const p = periodo(r.mes, r.hasta), datos = {};
  for (const m of c.config.marcas.filter(m => m.activa !== false)) {
    try {
      const [actual, anterior] = await Promise.all([traerMarca(m, p.desde, p.hasta, opciones), traerMarca(m, p.anterior.desde, p.anterior.hasta, opciones)]);
      datos[m.id] = { actual, anterior };
    } catch (e) { throw error(e.code || 502, `${m.nombre}: ${e.message}`); }
  }
  const n = guardar(u, r, { datos: JSON.stringify(datos), datos_en: ahora(), datos_origen: METRICOOL_ORIGEN() });
  registrar(u.email, 'actualizar datos', { id: r.id, cliente: r.cliente, mes: r.mes, origen: n.datos_origen });
  return detalle(r.id);
}

/** Carga datos ya normalizados (por ejemplo, sacados con el conector de Metricool) en vez de llamar a la API. */
export function importar(u, id, { datos, origen = 'importado' } = {}) {
  const r = obtener(id), c = clientes.aApi(clientes.obtener(r.cliente));
  if (!datos || typeof datos !== 'object') throw error(400, 'Faltan los datos a importar.');
  const marcas = new Set(c.config.marcas.map(m => m.id)), limpio = {};
  for (const [k, v] of Object.entries(datos)) {
    if (!marcas.has(k)) throw error(400, `La marca «${k}» no es de ${c.nombre}.`);
    if (!v?.actual?.redes || !v?.anterior?.redes) throw error(400, `La marca «${k}» necesita «actual» y «anterior», cada uno con «redes».`);
    limpio[k] = { actual: v.actual, anterior: v.anterior };
  }
  if (!Object.keys(limpio).length) throw error(400, 'No hay marcas en los datos.');
  guardar(u, r, { datos: JSON.stringify(limpio), datos_en: ahora(), datos_origen: String(origen).slice(0, 30) });
  registrar(u.email, 'importar datos', { id: r.id, cliente: r.cliente, mes: r.mes, marcas: Object.keys(limpio) });
  return detalle(r.id);
}

/** Cambios desde el constructor: textos (se mezclan por clave), fecha de corte y estado.
    Con `rev`, si alguien más cambió el mismo texto después, responde 409 para no pisarlo. */
export function editar(u, id, b = {}) {
  const r = obtener(id), campos = {};
  if (b.textos) {
    const a = armar(r), actuales = a.textos, nuevos = limpiarTextos(b.textos, a.claves.map(k => k.clave));
    if (b.rev != null && +b.rev !== r.rev && b.base) {
      const pisados = Object.keys(nuevos).filter(k => (actuales[k] ?? '') !== (b.base[k] ?? ''));
      if (pisados.length) throw Object.assign(error(409, 'Alguien más cambió este texto mientras lo editabas. Recarga para ver su versión.'), { claves: pisados });
    }
    campos.textos = JSON.stringify({ ...actuales, ...nuevos });
  }
  if ('secciones' in b) {   // null = volver a la propuesta según los datos
    const lista = b.secciones === null ? null : validarSecciones(b.secciones, clientes.aApi(clientes.obtener(r.cliente)));
    const imgs = (lista || []).flatMap(x => (x.bloques || []).filter(y => y.img).map(y => y.img));
    const deEste = new Set(db.prepare('SELECT id FROM imagenes WHERE reporte = ?').all(r.id).map(x => x.id));
    if (imgs.some(i => !deEste.has(i))) throw error(400, 'Una imagen no es de este reporte. Súbela de nuevo.');
    campos.secciones = lista === null ? null : JSON.stringify(lista);
  }
  if ('hasta' in b && b.hasta !== r.hasta) {
    const p = periodo(r.mes, b.hasta);
    campos.hasta = p.hasta; campos.desde = p.desde;
  }
  if ('estado' in b) {
    if (!ESTADOS.some(e => e.id === b.estado)) throw error(400, 'Estado desconocido.');
    if (b.estado === 'listo' && !r.datos) throw error(400, 'Antes de marcarlo listo, actualiza los datos.');
    campos.estado = b.estado;
  }
  if (!Object.keys(campos).length) return detalle(r.id);
  guardar(u, r, campos);
  registrar(u.email, 'editar reporte', { id: r.id, cliente: r.cliente, mes: r.mes, cambios: Object.keys(campos), ...(b.textos ? { textos: Object.keys(b.textos) } : {}) });
  return detalle(r.id);
}

/** La IA propone textos. Por defecto solo llena los vacíos; con `reemplazar`, reescribe todos. */
export async function proponer(u, id, { reemplazar = false, claves: soloClaves } = {}) {
  const r = obtener(id); if (!r.datos) throw error(400, 'Primero actualiza los datos.');
  const a = armar(r);
  let claves = a.claves.filter(k => k.ia !== false && (reemplazar || !(a.textos[k.clave] || '').trim()));
  if (Array.isArray(soloClaves) && soloClaves.length) claves = a.claves.filter(k => soloClaves.includes(k.clave));
  if (!claves.length) return { ...detalle(r.id), propuestos: [] };
  const nuevos = await ia.proponerTextos({ modelo: a.modelo, claves, lineamientos: a.cliente.config.lineamientos, actuales: a.textos });
  const actual = json(fila(r.id).textos, {});   // pudo cambiar mientras la IA escribía: se mezclan sobre lo último
  guardar(u, r, { textos: JSON.stringify({ ...actual, ...limpiarTextos(nuevos, claves.map(k => k.clave)) }) });
  registrar(u.email, 'proponer textos', { id: r.id, cliente: r.cliente, mes: r.mes, n: Object.keys(nuevos).length });
  return { ...detalle(r.id), propuestos: Object.keys(nuevos) };
}

/** Social listening: lee el PDF de Brandwatch con IA y lo guarda. */
export async function subirEscucha(u, id, pdf) {
  const r = obtener(id), c = clientes.aApi(clientes.obtener(r.cliente));
  if (!Buffer.isBuffer(pdf) || pdf.subarray(0, 5).toString() !== '%PDF-') throw error(400, 'El archivo tiene que ser un PDF.');
  const escucha = await ia.leerBrandwatch(pdf, { cliente: c.nombre, mes: r.mes });
  guardar(u, r, { escucha: JSON.stringify({ ...escucha, leidoEn: ahora() }) });
  registrar(u.email, 'subir brandwatch', { id: r.id, cliente: r.cliente, mes: r.mes });
  return detalle(r.id);
}

export function nuevoLink(u, id) {
  const r = obtener(id);
  guardar(u, r, { token: token() });
  registrar(u.email, 'nuevo link', { id: r.id, cliente: r.cliente, mes: r.mes });
  return detalle(r.id);
}

export function aPapelera(u, id) {
  const r = obtener(id);
  db.prepare('UPDATE reportes SET papelera_en = ?, papelera_por = ? WHERE id = ?').run(ahora(), u.email, r.id);
  registrar(u.email, 'papelera reporte', { id: r.id, cliente: r.cliente, mes: r.mes });
  return { ok: true };
}
export function restaurar(u, id) {
  const r = obtener(id, { papelera: true });
  if (db.prepare('SELECT 1 FROM reportes WHERE cliente = ? AND mes = ? AND papelera_en IS NULL').get(r.cliente, r.mes))
    throw error(409, 'Ya hay otro reporte de ese cliente y mes. Manda ese a la papelera primero.');
  db.prepare('UPDATE reportes SET papelera_en = NULL, papelera_por = NULL WHERE id = ?').run(r.id);
  registrar(u.email, 'restaurar reporte', { id: r.id, cliente: r.cliente, mes: r.mes });
  return resumen(fila(r.id));
}
export const papelera = () => ({
  reportes: db.prepare('SELECT * FROM reportes WHERE papelera_en IS NOT NULL ORDER BY papelera_en DESC LIMIT 200').all().map(resumen),
  clientes: clientes.listar({ papelera: true })
});

/* ---------- imágenes de las láminas ---------- */
const FIRMAS = [['image/png', b => b.subarray(0, 4).toString('hex') === '89504e47'], ['image/jpeg', b => b.subarray(0, 3).toString('hex') === 'ffd8ff'],
  ['image/webp', b => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'], ['image/gif', b => b.subarray(0, 4).toString() === 'GIF8']];
export function subirImagen(u, id, buf) {
  const r = obtener(id), tipo = FIRMAS.find(([, f]) => buf.length > 12 && f(buf))?.[0];
  if (!tipo) throw error(400, 'La imagen tiene que ser PNG, JPG, WEBP o GIF.');
  const img = 'i' + crypto.randomBytes(8).toString('hex');
  db.prepare('INSERT INTO imagenes (id, reporte, tipo, datos, creado_por, creado_en) VALUES (?, ?, ?, ?, ?, ?)').run(img, r.id, tipo, buf, u.email, ahora());
  registrar(u.email, 'subir imagen', { id: r.id, cliente: r.cliente, mes: r.mes, img });
  return { img };
}
const imagenDe = (reporte, img) => {
  const x = db.prepare('SELECT tipo, datos FROM imagenes WHERE id = ? AND reporte = ?').get(String(img || ''), reporte);
  if (!x) throw error(404, 'Esa imagen no existe.');
  return x;
};
export const imagen = (id, img) => imagenDe(obtener(id).id, img);
/** Imagen para el link del cliente: solo si el reporte está listo (mismo criterio que publico). */
export function imagenPublica(tk, img) {
  const r = typeof tk === 'string' && tk.length > 10 ? db.prepare('SELECT * FROM reportes WHERE token = ?').get(tk) : null;
  if (!r || r.papelera_en || r.estado !== 'listo') throw error(404, 'Esa imagen no existe.');
  return imagenDe(r.id, img);
}

/* ---------- aviso de cambios ---------- */
/** Liviano, para que el constructor pregunte cada tanto si alguien más cambió el reporte. */
export function version(id) { const r = obtener(id); return { rev: r.rev, editadoPor: r.editado_por || r.creado_por, editadoEn: r.editado_en || r.creado_en }; }
/** Los últimos cambios de un reporte, para el historial del constructor. */
export const cambios = id => db.prepare("SELECT cuando, quien, accion, detalle FROM registro WHERE json_extract(detalle, '$.id') = ? ORDER BY id DESC LIMIT 50").all(obtener(id).id)
  .map(x => ({ ...x, detalle: json(x.detalle, {}) }));

/** Lo que ve el cliente con su link. Solo si está listo; si no, el mismo 404 que un link inventado. */
export function publico(tk) {
  const r = typeof tk === 'string' && tk.length > 10 ? db.prepare('SELECT * FROM reportes WHERE token = ?').get(tk) : null;
  if (!r || r.papelera_en || r.estado !== 'listo') throw error(404, 'Este reporte no está disponible.');
  const a = armar(r);
  return { modelo: a.modelo, textos: a.textos };
}

export const actividad = (limite = 200) => db.prepare('SELECT * FROM registro ORDER BY id DESC LIMIT ?').all(limite).map(x => ({ ...x, detalle: json(x.detalle, {}) }));
