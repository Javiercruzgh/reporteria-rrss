/* Secciones (láminas) de un reporte. Nada está fijo por marca: cada reporte parte con una propuesta según los datos
   que hay, y el equipo agrega, quita y ordena láminas desde el catálogo. Cada sección tiene sus propios espacios de texto,
   con clave «<id de la sección>.<espacio>» (ver textos.js). */
import crypto from 'node:crypto';

/* El catálogo. `pide` = qué necesita elegir quien la agrega (marca, red, título). `textos` = sus espacios de texto. */
export const CATALOGO = [
  { tipo: 'portada', nombre: 'Portada', desc: 'Cliente, mes y período.', textos: [] },
  { tipo: 'resumen', nombre: 'Resumen del mes', desc: 'Tabla por red (o por marca) con comunidad, interacciones y publicaciones, más el funnel.', textos: ['texto'] },
  { tipo: 'divisor', nombre: 'Separador de marca', desc: 'Lámina con el nombre de una marca, para reportes con varias.', pide: ['marca'], textos: [] },
  { tipo: 'marca', nombre: 'Snapshot de una marca', desc: 'Tabla general de una marca y su funnel.', pide: ['marca'], textos: ['texto'] },
  { tipo: 'red', nombre: 'Una red social', desc: 'Indicadores contra el mes anterior, lectura y top 3 de contenidos.', pide: ['marca', 'red'], textos: ['lectura'] },
  { tipo: 'hallazgo', nombre: 'Hallazgo', desc: 'Una idea que el cliente pueda repetir y su evidencia.', pide: ['marca'], textos: ['hallazgo', 'evidencia'] },
  { tipo: 'competencia', nombre: 'Competencia', desc: 'Competidores de Instagram según Metricool.', pide: ['marca'], textos: ['texto'] },
  { tipo: 'optimizaciones', nombre: 'Optimizaciones', desc: 'Qué escalar, qué corregir y qué testear el próximo mes.', pide: ['marca'], textos: ['escalar', 'corregir', 'testear'] },
  { tipo: 'escucha', nombre: 'Social listening', desc: 'Lo leído del PDF de Brandwatch (hay que subirlo).', textos: ['lectura'] },
  { tipo: 'libre', nombre: 'Texto libre', desc: 'Una lámina con título y texto, para lo que no calza en las demás.', textos: ['titulo', 'texto'] },
  { tipo: 'notas', nombre: 'Notas metodológicas', desc: 'Cómo se calcula cada número.', textos: [] },
  { tipo: 'gracias', nombre: 'Cierre', desc: 'Lámina final.', textos: [] }
];
const POR_TIPO = Object.fromEntries(CATALOGO.map(c => [c.tipo, c]));
const error = (code, msg) => Object.assign(new Error(msg), { code });
export const nuevoIdSeccion = () => 's' + crypto.randomBytes(4).toString('hex');

/* La propuesta con la que parte un reporte, según las marcas y redes con datos. Ids estables (se derivan del contenido),
   así los textos no se pierden si el reporte se vuelve a proponer antes de que alguien toque las láminas. */
export function porDefecto(modelo) {
  const s = [{ id: 'portada', tipo: 'portada' }, { id: 'resumen', tipo: 'resumen' }];
  const varias = modelo.marcas.length > 1;
  for (const m of modelo.marcas) {
    if (varias) s.push({ id: `${m.id}-divisor`, tipo: 'divisor', marca: m.id }, { id: `${m.id}-marca`, tipo: 'marca', marca: m.id });
    for (const r of m.redes) s.push({ id: `${m.id}-${r.red}`, tipo: 'red', marca: m.id, red: r.red });
    s.push({ id: `${m.id}-hallazgo`, tipo: 'hallazgo', marca: m.id });
    if (m.competencia.length) s.push({ id: `${m.id}-competencia`, tipo: 'competencia', marca: m.id });
    s.push({ id: `${m.id}-optimizaciones`, tipo: 'optimizaciones', marca: m.id });
  }
  if (modelo.conEscucha) s.push({ id: 'escucha', tipo: 'escucha' });
  s.push({ id: 'notas', tipo: 'notas' }, { id: 'gracias', tipo: 'gracias' });
  return s;
}

/** Revisa la lista que llega del constructor contra las marcas y redes del cliente. */
export function validar(lista, cliente) {
  if (!Array.isArray(lista)) throw error(400, 'Las láminas tienen que ser una lista.');
  if (lista.length > 80) throw error(400, 'Máximo 80 láminas por reporte.');
  const marcas = new Map((cliente.config.marcas || []).map(m => [m.id, m])), ids = new Set();
  return lista.map((x, i) => {
    const c = POR_TIPO[x?.tipo]; if (!c) throw error(400, `La lámina ${i + 1} es de un tipo desconocido.`);
    const id = /^[a-z0-9-]{1,60}$/.test(x.id || '') ? x.id : nuevoIdSeccion();
    if (ids.has(id)) throw error(400, 'Hay dos láminas con el mismo identificador.'); ids.add(id);
    const s = { id, tipo: c.tipo };
    if (c.pide?.includes('marca')) {
      const m = marcas.get(x.marca); if (!m) throw error(400, `Elige una marca de ${cliente.nombre} para «${c.nombre}».`);
      s.marca = m.id;
    }
    if (c.pide?.includes('red')) {
      if (!marcas.get(s.marca).redes.includes(x.red)) throw error(400, `${marcas.get(s.marca).nombre} no tiene esa red.`);
      s.red = x.red;
    }
    return s;
  });
}

export const espacios = tipo => POR_TIPO[tipo]?.textos || [];
