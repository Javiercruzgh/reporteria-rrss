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
  { tipo: 'red', nombre: 'Snapshot de una red', desc: 'Indicadores de una red contra el mes anterior y su lectura.', pide: ['marca', 'red'], textos: ['lectura'] },
  { tipo: 'top', nombre: 'Top contenidos de una red', desc: 'Las 3 publicaciones que más rindieron, con sus KPI y espacio para la imagen de cada una.', pide: ['marca', 'red'], textos: [] },
  { tipo: 'hallazgo', nombre: 'Insight y evidencia', desc: 'Dos columnas: a la izquierda el insight; a la derecha, la evidencia que lo prueba.', pide: ['marca'], textos: ['hallazgo', 'evidencia'] },
  { tipo: 'competencia', nombre: 'Competencia', desc: 'Competidores de Instagram según Metricool.', pide: ['marca'], textos: ['texto'] },
  { tipo: 'optimizaciones', nombre: 'Optimizaciones', desc: 'Qué escalar, qué corregir y qué testear el próximo mes.', pide: ['marca'], textos: ['escalar', 'corregir', 'testear'] },
  { tipo: 'escucha', nombre: 'Social listening', desc: 'Lo leído del PDF de Brandwatch (hay que subirlo).', textos: ['lectura'] },
  { tipo: 'blanco', nombre: 'Lámina en blanco', desc: 'Solo un título: el contenido se arma con cajas de texto e imágenes.', textos: ['titulo'] },
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
    for (const r of m.redes) {
      s.push({ id: `${m.id}-${r.red}`, tipo: 'red', marca: m.id, red: r.red });
      if (r.top.length) s.push({ id: `${m.id}-${r.red}-top`, tipo: 'top', marca: m.id, red: r.red });
    }
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
    if (c.tipo === 'red') {   // campos: indicadores ocultos y campos escritos a mano
      const ocultos = [...new Set([].concat(x.ocultos || []).map(o => String(o).slice(0, 60)))].slice(0, 30);
      const extra = [].concat(x.extra || []).slice(0, 10).map(e => ({ etiqueta: String(e?.etiqueta ?? '').trim().slice(0, 60), valor: String(e?.valor ?? '').trim().slice(0, 40) })).filter(e => e.etiqueta);
      if (ocultos.length) s.ocultos = ocultos;
      if (extra.length) s.extra = extra;
    }
    if (c.tipo === 'top' && x.imagenes && typeof x.imagenes === 'object') {   // imagen de cada publicación: { id de la publicación: id de la imagen }
      const im = Object.entries(x.imagenes).filter(([p, i]) => /^[\w:.-]{1,80}$/.test(p) && /^i[0-9a-f]{16}$/.test(i)).slice(0, 10);
      if (im.length) s.imagenes = Object.fromEntries(im);
    }
    const bloques = [].concat(x.bloques || []);
    if (bloques.length > 8) throw error(400, 'Máximo 8 cajas por lámina.');
    const bids = new Set();
    const b = bloques.map(y => {
      if (!['texto', 'imagen'].includes(y?.tipo)) throw error(400, 'Caja de un tipo desconocido.');
      const id = /^[a-z0-9]{1,12}$/.test(y.id || '') && !bids.has(y.id) ? y.id : crypto.randomBytes(3).toString('hex'); bids.add(id);
      if (y.tipo === 'texto') return { id, tipo: 'texto' };
      if (!/^i[0-9a-f]{16}$/.test(y.img || '')) throw error(400, 'Falta la imagen de una caja.');
      return { id, tipo: 'imagen', img: y.img };
    });
    if (b.length) s.bloques = b;
    return s;
  });
}

export const espacios = tipo => POR_TIPO[tipo]?.textos || [];
/** Los espacios de una sección concreta: los de su tipo más sus cajas de texto («b-<id>»). */
export const espaciosDe = s => [...espacios(s.tipo), ...(s.bloques || []).filter(b => b.tipo === 'texto').map(b => 'b-' + b.id)];
