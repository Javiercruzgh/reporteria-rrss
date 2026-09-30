/* Dibuja las láminas de un reporte. Lo usan el constructor (con los textos editables) y el link del cliente (solo lectura),
   así el equipo ve exactamente lo que verá el cliente. Todo el tamaño va en «em»: la lámina escala con su ancho
   y en el teléfono se reacomoda en una columna (ver reporte.css).
   Cada lámina es una sección del reporte (lib/secciones.js); sus textos tienen clave «<sección>.<espacio>», como en lib/textos.js. */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const num = (v, formato = 'n') => v == null || !Number.isFinite(v) ? '—' : formato === 'pct' ? pf.format(v) + '%' : formato === 'dec' ? pf.format(v) : v >= 1e6 ? pf.format(v / 1e6) + ' M' : nf.format(v);
export const vari = v => v == null || !Number.isFinite(v) ? '<span class="var">—</span>'
  : `<span class="var ${v > 0.05 ? 'sube' : v < -0.05 ? 'baja' : ''}">${v > 0 ? '+' : ''}${pf.format(v)}%</span>`;
const fechaCorta = f => f ? `${f.slice(8, 10)}.${f.slice(5, 7)}` : '';
const MAYUS = s => esc(s).toUpperCase();

/** Texto con formato mínimo: párrafos por línea en blanco y **negrita**. */
export function formatear(t) {
  return String(t || '').trim().split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</p>`).join('');
}

/* Un espacio de texto. En el constructor se edita con un clic; en el link del cliente, si está vacío, no aparece. */
function txt(ctx, clave, { clase = '', vacio = 'Escribe aquí' } = {}) {
  const t = ctx.textos[clave] || '';
  if (!ctx.editable) return t.trim() ? `<div class="txt ${clase}">${formatear(t)}</div>` : '';
  const pide = ctx.pide[clave] || '';
  return `<div class="txt ${clase} editable ${t.trim() ? '' : 'vacio'}" data-clave="${esc(clave)}" tabindex="0" title="${esc(pide)}" data-vacio="${esc(vacio)}">${t.trim() ? formatear(t) : ''}</div>`;
}

const cabeza = (kicker, titulo, acento = '') => `<header class="cab"><span class="kicker">${kicker}</span><h2>${esc(titulo)}${acento ? ` <em>${esc(acento)}</em>` : ''}</h2></header>`;
const lamina = (clase, cuerpo, nombre, sec = '') => `<section class="lamina ${clase}" data-nombre="${esc(nombre)}"${sec ? ` data-sec="${esc(sec)}"` : ''}><div class="lienzo">${cuerpo}<img class="iso" src="/assets/iso.png" alt=""></div></section>`;

/* ---------- piezas ---------- */
function tablaKpis(r, mesAnt, s = {}) {
  const ocultos = new Set(s.ocultos || []);
  return `<table class="rt kpis"><thead><tr><th>Indicador</th><th>Mes</th><th>vs ${esc(mesAnt)}</th></tr></thead><tbody>
    ${r.kpis.filter(k => !ocultos.has(k.etiqueta)).map(k => `<tr><td>${esc(k.etiqueta)}</td><td class="n">${num(k.v, k.formato)}${k.detalle ? ` <small>(${esc(k.detalle)})</small>` : ''}</td><td>${vari(k.var)}</td></tr>`).join('')}
    ${(s.extra || []).map(e => `<tr class="manual"><td>${esc(e.etiqueta)}</td><td class="n">${esc(e.valor)}</td><td><span class="var">—</span></td></tr>`).join('')}
  </tbody></table>`;
}
function tablaGeneral(filas, total, nombreTotal) {
  const celda = p => `<td class="n">${num(p.v)} ${vari(p.var)}</td>`;
  return `<table class="rt general"><thead><tr><th>Plataforma</th><th>Comunidad</th><th>Interacciones</th><th>Publicaciones</th></tr></thead><tbody>
    ${filas.map(f => `<tr><td><b>${esc(f.nombre)}</b></td>${celda(f.comunidad)}${celda(f.interacciones)}${celda(f.publicaciones)}</tr>`).join('')}
    <tr class="total"><td><b>${esc(nombreTotal)}</b></td>${celda(total.comunidad)}${celda(total.interacciones)}${celda(total.publicaciones)}</tr>
  </tbody></table>`;
}
function tarjetaTop(p, i) {
  const titulo = String(p.texto || '').split('\n')[0].slice(0, 90) || 'Sin texto';
  return `<article class="top">
    <div class="top-cab"><b class="pos">${i + 1}</b>${p.tipo ? `<span class="tipo">${esc(p.tipo)}</span>` : ''}${p.marca ? `<span class="tipo ${p.pauta ? 'pauta' : ''}">${esc(p.marca)}</span>` : ''}<span class="fecha">${fechaCorta(p.fecha)}</span></div>
    <p class="top-txt">${esc(titulo)}</p>
    <dl>${(p.metricas || []).filter(m => m[1] != null).slice(0, 6).map(([k, v, f]) => `<div><dt>${esc(k)}</dt><dd>${num(v, f)}</dd></div>`).join('')}</dl>
    ${p.url && /^https:\/\//.test(p.url) ? `<a class="ver" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Ver publicación ↗</a>` : ''}
  </article>`;
}
function barras(items, { max, sufijo = '%' } = {}) {
  const m = max || Math.max(1, ...items.map(i => i.v || 0));
  return `<div class="barras">${items.map(i => `<div class="barra-f"><span class="b-nom">${esc(i.nombre)}</span><span class="b-pista"><i style="width:${Math.max(2, (i.v || 0) / m * 100)}%"></i></span><span class="b-v">${num(i.v, sufijo === '%' ? 'pct' : 'n')}</span></div>`).join('')}</div>`;
}

/* ---------- láminas: cada una recibe (M, s, ctx), con s = la sección ---------- */
const k = (s, espacio) => `${s.id}.${espacio}`;
const marcaDe = (M, s) => M.marcas.find(m => m.id === s.marca);
const nombreMarca = (M, s) => marcaDe(M, s)?.nombreLargo || M.marcasCliente?.find(m => m.id === s.marca)?.nombre || s.marca || '';
/** Una lámina que no tiene datos: en el constructor se avisa; al cliente no le llega. */
const sinDatos = (M, s, ctx, titulo, texto) => ctx.editable
  ? lamina('ldos aviso-l', `${cabeza(MAYUS(nombreMarca(M, s) || M.cliente.nombre), titulo)}<p class="falta">${esc(texto)}</p>`, titulo, s.id) : '';

function funnel(f) {
  return `<div class="funnel"><div class="f-paso"><span class="label-s">Conocimiento</span><b>${num(f.conocimiento.v)}</b>${vari(f.conocimiento.var)}<small>alcance del feed + vistas orgánicas</small></div>
    <div class="f-paso"><span class="label-s">Consideración</span><b>${num(f.consideracion.v)}</b>${vari(f.consideracion.var)}<small>guardados + compartidos</small></div></div>`;
}

const L = {
  portada: (M, s) => lamina('portada', `<div class="port">
    <span class="kicker">Reporte mensual · redes orgánicas</span>
    <h1>${esc(M.cliente.nombre)}</h1>
    <p class="port-mes acento">${esc(M.titulo)}</p>
    <p class="port-per">${esc(M.periodo)} · comparado con ${esc(M.comparacion)}</p>
    <p class="port-redes">${M.redes.map(esc).join(' · ')}</p>
  </div>`, 'Portada', s.id),

  resumen(M, s, ctx) {
    const texto = txt(ctx, k(s, 'texto'), { clase: 'caja', vacio: 'Resumen ejecutivo: 3 a 4 ideas con su número.' });
    if (M.resumen) {   // varias marcas: tabla por marca
      return lamina('ldos', `${cabeza(`${MAYUS(M.cliente.nombre)} · ${MAYUS(M.titulo)}`, 'Resumen', 'del mes')}
        <div class="cols"><div class="col">${texto}</div>
        <div class="col">${tablaGeneral(M.resumen.filas, M.resumen.total, 'Total ' + M.cliente.nombre).replace('<th>Plataforma</th>', '<th>Marca</th>')}
        <p class="pie">Comunidad = suma de seguidores de todas las redes de cada marca. Publicaciones = feed y videos (sin historias).</p></div></div>`, 'Resumen', s.id);
    }
    const m = M.marcas[0]; if (!m) return sinDatos(M, s, ctx, 'Resumen', 'Todavía no hay datos: actualízalos para ver esta lámina.');
    return lamina('ldos', `${cabeza(`${MAYUS(m.nombreLargo)} · ${MAYUS(M.titulo)}`, 'Resumen', 'del mes')}
      <div class="cols"><div class="col">${texto}</div>
      <div class="col">${tablaGeneral(m.general.filas, m.general.total, 'Total ' + m.nombre)}${m.funnel ? funnel(m.funnel) : ''}</div></div>`, 'Resumen', s.id);
  },

  divisor(M, s) {
    const m = marcaDe(M, s), nombre = nombreMarca(M, s);
    return lamina('divisor', `<div class="div-cont"><span class="kicker">Marca</span><h1 style="${m?.color ? `--marca:${esc(m.color)}` : ''}">${esc(nombre)}</h1>${m ? `<p class="port-redes">${m.redes.map(r => esc(r.nombre)).join(' · ')}</p>` : ''}</div>`, nombre, s.id);
  },

  marca(M, s, ctx) {
    const m = marcaDe(M, s); if (!m) return sinDatos(M, s, ctx, 'Snapshot general', 'Esta marca no tiene datos en el período.');
    return lamina('ldos', `${cabeza(`${MAYUS(m.nombreLargo)} · SNAPSHOT`, 'Snapshot', 'general')}
      <div class="cols"><div class="col">${txt(ctx, k(s, 'texto'), { clase: 'caja', vacio: 'Cómo le fue a la marca en el conjunto de sus redes.' })}${m.funnel ? funnel(m.funnel) : ''}</div>
      <div class="col">${tablaGeneral(m.general.filas, m.general.total, 'Total ' + m.nombre)}</div></div>`, `${m.nombre} · General`, s.id);
  },

  red(M, s, ctx) {
    const m = marcaDe(M, s), r = m?.redes.find(x => x.red === s.red);
    if (!r) return sinDatos(M, s, ctx, s.red || 'Red', 'No hay datos de esta red en el período. Actualiza los datos o quita la lámina.');
    return lamina('red', `${cabeza(`${MAYUS(m.nombreLargo)} · ${MAYUS(r.nombre)}`, r.nombre, 'del mes')}
      <div class="red-grid">
        <div class="red-izq">${tablaKpis(r, M.mesAnterior, s)}</div>
        <div class="red-der">${txt(ctx, k(s, 'lectura'), { clase: 'caja', vacio: 'Lectura: qué explica las variaciones (piezas, formatos).' })}
          ${r.top.length ? `<span class="label-s">Top contenidos${r.notaTop ? ` · ${esc(r.notaTop)}` : ''}</span><div class="tops">${r.top.map(tarjetaTop).join('')}</div>` : ''}</div>
      </div>`, `${m.nombre} · ${r.nombre}`, s.id);
  },

  hallazgo: (M, s, ctx) => lamina('hallazgo', `${cabeza(`${MAYUS(nombreMarca(M, s))} · HALLAZGO`, 'Hallazgo', 'del mes')}
    ${txt(ctx, k(s, 'hallazgo'), { clase: 'grande', vacio: 'Una sola idea que el cliente pueda repetir.' })}
    ${txt(ctx, k(s, 'evidencia'), { clase: 'evidencia', vacio: 'La evidencia: los números que la prueban.' })}`, 'Hallazgo', s.id),

  competencia(M, s, ctx) {
    const m = marcaDe(M, s);
    if (!m?.competencia.length) return sinDatos(M, s, ctx, 'Competencia', 'Metricool no trajo competidores de Instagram para esta marca. Agrégalos en Metricool o quita la lámina.');
    const filas = [...m.competencia].sort((a, b) => (b.comunidad.v || 0) - (a.comunidad.v || 0));
    return lamina('ldos', `${cabeza(`${MAYUS(m.nombreLargo)} · COMPETENCIA`, 'Competencia', 'Instagram')}
      <div class="cols"><div class="col ancha"><table class="rt comp"><thead><tr><th>Cuenta</th><th>Comunidad</th><th>Publicaciones</th><th>Engagement*</th></tr></thead><tbody>
        ${filas.map(c => `<tr class="${c.propia ? 'propia' : ''}"><td><b>${esc(c.nombre)}</b>${c.usuario ? ` <small>@${esc(c.usuario)}</small>` : ''}</td><td class="n">${num(c.comunidad.v)} ${vari(c.comunidad.var)}</td><td class="n">${num(c.publicaciones.v)}</td><td class="n">${c.engagement ? num(c.engagement.v, 'dec') : '—'}</td></tr>`).join('')}
      </tbody></table><p class="pie">*Engagement de Metricool: interacciones promedio por cada 1.000 seguidores.</p></div>
      <div class="col">${txt(ctx, k(s, 'texto'), { clase: 'caja', vacio: 'Dónde está la marca frente a los demás.' })}</div></div>`, `${m.nombre} · Competencia`, s.id);
  },

  optimizaciones(M, s, ctx) {
    const g = (espacio, titulo) => `<div class="opt"><span class="label-s">${titulo}</span>${txt(ctx, k(s, espacio), { vacio: 'Acción concreta y medible.' })}</div>`;
    return lamina('opts', `${cabeza(`${MAYUS(nombreMarca(M, s))} · PRÓXIMO MES`, 'Optimizaciones', '')}
      <div class="opts-grid">${g('escalar', 'Escalar')}${g('corregir', 'Corregir')}${g('testear', 'Testear')}</div>`, 'Optimizaciones', s.id);
  },

  escucha(M, s, ctx) {
    const e = M.escucha;
    if (!e) return sinDatos(M, s, ctx, 'Social listening', 'Falta subir el PDF de Brandwatch del mes (botón «Subir Brandwatch»). Sin él, esta lámina no aparece en el link del cliente.');
    const se = e.sentimiento || {}, tot = (se.positivo || 0) + (se.neutro || 0) + (se.negativo || 0) || 1;
    const varM = e.menciones != null && e.menciones_anterior ? (e.menciones - e.menciones_anterior) / e.menciones_anterior * 100 : null;
    const maxP = Math.max(1, ...(e.palabras || []).map(p => p.peso || 0));
    const lista = (t, xs) => xs?.length ? `<div class="lista"><span class="label-s">${t}</span><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    return lamina('escucha', `${cabeza(`${MAYUS(M.cliente.nombre)} · SOCIAL LISTENING`, 'Social', 'listening')}
      <div class="esc-grid">
        <div class="esc-num"><span class="label-s">Menciones</span><b>${num(e.menciones)}</b>${vari(varM)}${e.alcance ? `<small>Alcance potencial ${num(e.alcance)}</small>` : ''}
          <span class="label-s">Sentimiento</span><div class="senti"><i class="s-pos" style="flex:${se.positivo || 0}"></i><i class="s-neu" style="flex:${se.neutro || 0}"></i><i class="s-neg" style="flex:${se.negativo || 0}"></i></div>
          <div class="senti-ley"><span><i class="s-pos"></i>Positivo ${num((se.positivo || 0) / tot * 100, 'pct')}</span><span><i class="s-neu"></i>Neutro ${num((se.neutro || 0) / tot * 100, 'pct')}</span><span><i class="s-neg"></i>Negativo ${num((se.negativo || 0) / tot * 100, 'pct')}</span></div></div>
        <div><span class="label-s">Temas</span>${barras((e.temas || []).map(t => ({ nombre: t.nombre, v: t.pct })))}
          <span class="label-s">Canales</span>${barras((e.canales || []).map(t => ({ nombre: t.nombre, v: t.pct })))}</div>
        <div><span class="label-s">Lo que más se dijo</span><div class="nube">${(e.palabras || []).map(p => `<span style="font-size:${0.8 + (p.peso || 0) / maxP * 1.2}em">${esc(p.texto)}</span>`).join(' ')}</div>
          ${txt(ctx, k(s, 'lectura'), { clase: 'caja', vacio: 'Qué se dijo, el sentimiento y qué hacer con eso.' })}</div>
      </div>`, 'Social listening', s.id)
    + (e.aprendizajes?.length || e.alertas?.length || e.oportunidades?.length ? lamina('opts', `${cabeza(`${MAYUS(M.cliente.nombre)} · SOCIAL LISTENING`, 'Aprendizajes', 'y alertas')}
      <div class="opts-grid">${lista('Aprendizajes', e.aprendizajes)}${lista('Alertas', e.alertas)}${lista('Oportunidades', e.oportunidades)}</div>
      ${e.nota ? `<p class="pie">${esc(e.nota)} Fuente: Brandwatch${e.periodo ? `, ${esc(e.periodo)}` : ''}.</p>` : ''}`, 'Social listening · Aprendizajes') : '');
  },

  blanco(M, s, ctx) {
    const t = (ctx.textos[k(s, 'titulo')] || '').trim();
    if (!ctx.editable && !t && !(s.bloques || []).length) return '';
    return lamina('blanco', `<header class="cab"><span class="kicker">${MAYUS(M.cliente.nombre)}</span>${txt(ctx, k(s, 'titulo'), { clase: 'titulo-libre', vacio: 'Título' })}</header>`, t || 'Lámina en blanco', s.id);
  },

  libre(M, s, ctx) {
    const t = (ctx.textos[k(s, 'titulo')] || '').trim();
    if (!ctx.editable && !t && !(ctx.textos[k(s, 'texto')] || '').trim()) return '';
    return lamina('libre', `<header class="cab"><span class="kicker">${MAYUS(M.cliente.nombre)}</span>${txt(ctx, k(s, 'titulo'), { clase: 'titulo-libre', vacio: 'Título' })}</header>
      ${txt(ctx, k(s, 'texto'), { clase: 'texto-libre', vacio: 'Texto de la lámina.' })}`, t || 'Texto libre', s.id);
  },

  notas: (M, s) => lamina('notas', `${cabeza('NOTAS METODOLÓGICAS', 'Cómo', 'se calcula')}<ol class="notas-l">${M.notas.map(n => `<li>${esc(n)}</li>`).join('')}</ol>`, 'Notas', s.id),
  gracias: (M, s) => lamina('portada', `<div class="port"><h1 class="acento">Gracias</h1><p class="port-per">Monkey Labs</p></div>`, 'Gracias', s.id)
};

/* Cajas que el equipo agrega a cualquier lámina (texto o imagen). Van en una franja al final del contenido;
   en la lámina en blanco ocupan todo el espacio. Una caja de texto vacía no llega al cliente. */
function cajas(s, ctx) {
  const bs = (s.bloques || []).map(b => {
    const quitar = ctx.editable ? `<button type="button" class="caja-x" data-quitar-caja="${esc(b.id)}" title="Quitar caja">✕</button>` : '';
    if (b.tipo === 'imagen') return `<figure class="caja-l imagen" data-bloque="${esc(b.id)}">${quitar}<img src="${esc(ctx.imagen(b.img))}" alt=""></figure>`;
    const t = txt(ctx, k(s, 'b-' + b.id), { clase: 'caja', vacio: 'Escribe aquí.' });
    return t ? `<div class="caja-l texto" data-bloque="${esc(b.id)}">${quitar}${t}</div>` : '';
  }).filter(Boolean);
  return bs.length ? `<div class="cajas n${Math.min(bs.length, 4)}">${bs.join('')}</div>` : '';
}

/** Todas las láminas, en el orden de las secciones del reporte. ctx = { textos, editable, claves, imagen } */
export function laminas(M, { textos = {}, editable = false, claves = [], imagen = img => img } = {}) {
  const ctx = { textos, editable, imagen, pide: Object.fromEntries(claves.map(c => [c.clave, c.pide])) };
  return (M.secciones || []).map(s => {
    const html = L[s.tipo]?.(M, s, ctx) || '', extra = html && cajas(s, ctx);
    if (!extra) return html;
    const i = html.indexOf('<img class="iso"');   // las cajas van dentro de la primera lámina de la sección
    return html.slice(0, i) + extra + html.slice(i);
  }).filter(Boolean).join('');
}
