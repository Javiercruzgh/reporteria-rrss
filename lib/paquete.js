/* Paquete: un archivo con varios clientes y sus datos de un mes, para cargar todo de una vez
   (por ejemplo, los datos sacados con el conector de Metricool mientras no esté la clave).
   Formato: { formato: 'reporteria-rrss/paquete', mes, hasta?, clientes: [{ nombre, marcas: [{ nombre, blogId, redes, nombreLargo? }],
              escucha?, reglas?, lineamientos?, datos: { <blogId>: { actual, anterior } } }] }
   Los clientes se reconocen por el número de Metricool de sus marcas: si ya existe, no se toca su configuración
   (la pudo cambiar el equipo); si no, se crea. El reporte del mes se crea si falta y sus datos se reemplazan. */
import * as clientes from './clientes.js';
import * as reportes from './reportes.js';
import { esMes } from './periodos.js';
import { registrar } from './db.js';

const error = (code, msg) => Object.assign(new Error(msg), { code });

export function importarPaquete(u, p = {}) {
  if (p.formato !== 'reporteria-rrss/paquete') throw error(400, 'Este archivo no es un paquete de Reportería RRSS.');
  if (!esMes(p.mes)) throw error(400, 'El paquete no dice de qué mes es.');
  if (!Array.isArray(p.clientes) || !p.clientes.length || p.clientes.length > 50) throw error(400, 'El paquete no trae clientes.');
  const resultado = [];
  for (const x of p.clientes) {
    const blogIds = (x.marcas || []).map(m => String(m.blogId || ''));
    let c = clientes.listar().find(k => k.config.marcas.some(m => m.blogId && blogIds.includes(m.blogId)));
    const nuevo = !c;
    if (nuevo) {
      c = clientes.crear(u, { nombre: x.nombre, marcas: x.marcas, escucha: !!x.escucha, lineamientos: x.lineamientos || '' });
      if (x.reglas) c = clientes.editar(u, c.id, { config: { ...c.config, reglas: x.reglas } });
    }
    const porBlog = new Map(c.config.marcas.map(m => [m.blogId, m.id])), datos = {};
    for (const [blog, d] of Object.entries(x.datos || {})) {
      const id = porBlog.get(String(blog));
      if (!id) throw error(400, `${c.nombre} no tiene la marca con número de Metricool ${blog}. Agrégala en Clientes y vuelve a importar.`);
      datos[id] = d;
    }
    let r;
    try { r = reportes.crear(u, { cliente: c.id, mes: p.mes, hasta: p.hasta }); }
    catch (e) { if (e.code !== 409) throw e; r = { id: e.id }; }
    reportes.importar(u, r.id, { datos, origen: 'conector' });
    resultado.push({ cliente: c.nombre, nuevo, reporte: r.id, marcas: Object.keys(datos).length });
  }
  registrar(u.email, 'importar paquete', { mes: p.mes, clientes: resultado.map(r => r.cliente) });
  return { mes: p.mes, clientes: resultado };
}
