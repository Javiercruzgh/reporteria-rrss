/* Dibuja las láminas de un reporte. Lo usan el constructor (con los textos editables) y el link del cliente (solo lectura),
   así el equipo ve exactamente lo que verá el cliente. Todo el tamaño va en «em»: la lámina escala con su ancho
   y en el teléfono se reacomoda en una columna (ver reporte.css).
   Las claves de texto son las mismas de lib/textos.js. */

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
const lamina = (clase, cuerpo, nombre) => `<section class="lamina ${clase}" data-nombre="${esc(nombre)}"><div class="lienzo">${cuerpo}<img class="iso" src="/assets/iso.png" alt=""></div></section>`;

/* ---------- piezas ---------- */
function tablaKpis(r, mesAnt) {
  return `<table class="rt kpis"><thead><tr><th>Indicador</th><th>Mes</th><th>vs ${esc(mesAnt)}</th></tr></thead><tbody>
    ${r.kpis.map(k => `<tr><td>${esc(k.etiqueta)}</td><td class="n">${num(k.v, k.formato)}${k.detalle ? ` <small>(${esc(k.detalle)})</small>` : ''}</td><td>${vari(k.var)}</td></tr>`).join('')}
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

/* ---------- láminas ---------- */
function portada(M) {
  return lamina('portada', `<div class="port">
    <span class="kicker">Reporte mensual · redes orgánicas</span>
    <h1>${esc(M.cliente.nombre)}</h1>
    <p class="port-mes acento">${esc(M.titulo)}</p>
    <p class="port-per">${esc(M.periodo)} · comparado con ${esc(M.comparacion)}</p>
    <p class="port-redes">${M.redes.map(esc).join(' · ')}</p>
  </div>`, 'Portada');
}

function resumen(M, ctx) {
  if (M.resumen) {   // varias marcas: tabla por marca
    const filas = M.resumen.filas.map(f => ({ nombre: f.nombre, comunidad: f.comunidad, interacciones: f.interacciones, publicaciones: f.publicaciones }));
    return lamina('ldos', `${cabeza(`${MAYUS(M.cliente.nombre)} · ${MAYUS(M.titulo)}`, 'Resumen', 'del mes')}
      <div class="cols"><div class="col">${txt(ctx, 'general.resumen', { clase: 'caja', vacio: 'Resumen ejecutivo: 3 a 4 ideas con su número.' })}</div>
      <div class="col">${tablaGeneral(filas, M.resumen.total, 'Total ' + M.cliente.nombre).replace('<th>Plataforma</th>', '<th>Marca</th>')}
      <p class="pie">Comunidad = suma de seguidores de todas las redes de cada marca. Publicaciones = feed y videos (sin historias).</p></div></div>`, 'Resumen');
  }
  const m = M.marcas[0]; if (!m) return '';
  return lamina('ldos', `${cabeza(`${MAYUS(m.nombreLargo)} · ${MAYUS(M.titulo)}`, 'Resumen', 'del mes')}
    <div class="cols"><div class="col">${txt(ctx, 'general.resumen', { clase: 'caja', vacio: 'Resumen ejecutivo: 3 a 4 ideas con su número.' })}</div>
    <div class="col">${tablaGeneral(m.general.filas, m.general.total, 'Total ' + m.nombre)}
    ${m.funnel ? funnel(m.funnel) : ''}</div></div>`, 'Resumen');
}

function funnel(f) {
  return `<div class="funnel"><div class="f-paso"><span class="label-s">Conocimiento</span><b>${num(f.conocimiento.v)}</b>${vari(f.conocimiento.var)}<small>alcance del feed + vistas orgánicas</small></div>
    <div class="f-paso"><span class="label-s">Consideración</span><b>${num(f.consideracion.v)}</b>${vari(f.consideracion.var)}<small>guardados + compartidos</small></div></div>`;
}

function divisor(m, i, total) {
  return lamina('divisor', `<div class="div-cont"><span class="kicker">Marca ${i + 1} de ${total}</span><h1 style="${m.color ? `--marca:${esc(m.color)}` : ''}">${esc(m.nombreLargo)}</h1><p class="port-redes">${m.redes.map(r => esc(r.nombre)).join(' · ')}</p></div>`, m.nombre);
}

function snapshotMarca(M, m, ctx) {
  return lamina('ldos', `${cabeza(`${MAYUS(m.nombreLargo)} · SNAPSHOT`, 'Snapshot', 'general')}
    <div class="cols"><div class="col">${m.funnel ? funnel(m.funnel) : ''}</div>
    <div class="col">${tablaGeneral(m.general.filas, m.general.total, 'Total ' + m.nombre)}</div></div>`, `${m.nombre} · General`);
}

function red(M, m, r, ctx) {
  return lamina('red', `${cabeza(`${MAYUS(m.nombreLargo)} · ${MAYUS(r.nombre)}`, r.nombre, 'del mes')}
    <div class="red-grid">
      <div class="red-izq">${tablaKpis(r, M.mesAnterior)}</div>
      <div class="red-der">${txt(ctx, `${m.id}.${r.red}.lectura`, { clase: 'caja', vacio: 'Lectura: qué explica las variaciones (piezas, formatos).' })}
        ${r.top.length ? `<span class="label-s">Top contenidos${r.notaTop ? ` · ${esc(r.notaTop)}` : ''}</span><div class="tops">${r.top.map(tarjetaTop).join('')}</div>` : ''}</div>
    </div>`, `${m.nombre} · ${r.nombre}`);
}

function hallazgo(m, ctx) {
  return lamina('hallazgo', `${cabeza(`${MAYUS(m.nombreLargo)} · HALLAZGO`, 'Hallazgo', 'del mes')}
    ${txt(ctx, `${m.id}.hallazgo`, { clase: 'grande', vacio: 'Una sola idea que el cliente pueda repetir.' })}
    ${txt(ctx, `${m.id}.evidencia`, { clase: 'evidencia', vacio: 'La evidencia: los números que la prueban.' })}`, `${m.nombre} · Hallazgo`);
}

function competencia(M, m, ctx) {
  if (!m.competencia.length) return '';
  const filas = [...m.competencia].sort((a, b) => (b.comunidad.v || 0) - (a.comunidad.v || 0));
  return lamina('ldos', `${cabeza(`${MAYUS(m.nombreLargo)} · COMPETENCIA`, 'Competencia', 'Instagram')}
    <div class="cols"><div class="col ancha"><table class="rt comp"><thead><tr><th>Cuenta</th><th>Comunidad</th><th>Publicaciones</th><th>Engagement*</th></tr></thead><tbody>
      ${filas.map(c => `<tr class="${c.propia ? 'propia' : ''}"><td><b>${esc(c.nombre)}</b>${c.usuario ? ` <small>@${esc(c.usuario)}</small>` : ''}</td><td class="n">${num(c.comunidad.v)} ${vari(c.comunidad.var)}</td><td class="n">${num(c.publicaciones.v)}</td><td class="n">${c.engagement ? num(c.engagement.v, 'dec') : '—'}</td></tr>`).join('')}
    </tbody></table><p class="pie">*Engagement de Metricool: interacciones promedio por cada 1.000 seguidores.</p></div>
    <div class="col">${txt(ctx, `${m.id}.competencia`, { clase: 'caja', vacio: 'Dónde está la marca frente a los demás.' })}</div></div>`, `${m.nombre} · Competencia`);
}

function optimizaciones(m, ctx) {
  const g = (clave, titulo) => `<div class="opt"><span class="label-s">${titulo}</span>${txt(ctx, `${m.id}.${clave}`, { vacio: 'Acción concreta y medible.' })}</div>`;
  return lamina('opts', `${cabeza(`${MAYUS(m.nombreLargo)} · PRÓXIMO MES`, 'Optimizaciones', '')}
    <div class="opts-grid">${g('escalar', 'Escalar')}${g('corregir', 'Corregir')}${g('testear', 'Testear')}</div>`, `${m.nombre} · Optimizaciones`);
}

function escucha(M, ctx) {
  const e = M.escucha; if (!e) return '';
  const s = e.sentimiento || {}, tot = (s.positivo || 0) + (s.neutro || 0) + (s.negativo || 0) || 1;
  const varM = e.menciones != null && e.menciones_anterior ? (e.menciones - e.menciones_anterior) / e.menciones_anterior * 100 : null;
  const maxP = Math.max(1, ...(e.palabras || []).map(p => p.peso || 0));
  const lista = (t, xs) => xs?.length ? `<div class="lista"><span class="label-s">${t}</span><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  return lamina('escucha', `${cabeza(`${MAYUS(M.cliente.nombre)} · SOCIAL LISTENING`, 'Social', 'listening')}
    <div class="esc-grid">
      <div class="esc-num"><span class="label-s">Menciones</span><b>${num(e.menciones)}</b>${vari(varM)}${e.alcance ? `<small>Alcance potencial ${num(e.alcance)}</small>` : ''}
        <span class="label-s">Sentimiento</span><div class="senti"><i class="s-pos" style="flex:${s.positivo || 0}"></i><i class="s-neu" style="flex:${s.neutro || 0}"></i><i class="s-neg" style="flex:${s.negativo || 0}"></i></div>
        <div class="senti-ley"><span><i class="s-pos"></i>Positivo ${num((s.positivo || 0) / tot * 100, 'pct')}</span><span><i class="s-neu"></i>Neutro ${num((s.neutro || 0) / tot * 100, 'pct')}</span><span><i class="s-neg"></i>Negativo ${num((s.negativo || 0) / tot * 100, 'pct')}</span></div></div>
      <div><span class="label-s">Temas</span>${barras((e.temas || []).map(t => ({ nombre: t.nombre, v: t.pct })))}
        <span class="label-s">Canales</span>${barras((e.canales || []).map(t => ({ nombre: t.nombre, v: t.pct })))}</div>
      <div><span class="label-s">Lo que más se dijo</span><div class="nube">${(e.palabras || []).map(p => `<span style="font-size:${0.8 + (p.peso || 0) / maxP * 1.2}em">${esc(p.texto)}</span>`).join(' ')}</div>
        ${txt(ctx, 'escucha.lectura', { clase: 'caja', vacio: 'Qué se dijo, el sentimiento y qué hacer con eso.' })}</div>
    </div>`, 'Social listening')
  + (e.aprendizajes?.length || e.alertas?.length || e.oportunidades?.length ? lamina('opts', `${cabeza(`${MAYUS(M.cliente.nombre)} · SOCIAL LISTENING`, 'Aprendizajes', 'y alertas')}
    <div class="opts-grid">${lista('Aprendizajes', e.aprendizajes)}${lista('Alertas', e.alertas)}${lista('Oportunidades', e.oportunidades)}</div>
    ${e.nota ? `<p class="pie">${esc(e.nota)} Fuente: Brandwatch${e.periodo ? `, ${esc(e.periodo)}` : ''}.</p>` : ''}`, 'Social listening · Aprendizajes') : '');
}

function notas(M) {
  return lamina('notas', `${cabeza('NOTAS METODOLÓGICAS', 'Cómo', 'se calcula')}<ol class="notas-l">${M.notas.map(n => `<li>${esc(n)}</li>`).join('')}</ol>`, 'Notas');
}
const gracias = () => lamina('portada', `<div class="port"><h1 class="acento">Gracias</h1><p class="port-per">Monkey Labs</p></div>`, 'Gracias');

/** Todas las láminas en orden. ctx = { textos, editable, claves } */
export function laminas(M, { textos = {}, editable = false, claves = [] } = {}) {
  const ctx = { textos, editable, pide: Object.fromEntries(claves.map(c => [c.clave, c.pide])) };
  const varias = M.marcas.length > 1, out = [portada(M), resumen(M, ctx)];
  M.marcas.forEach((m, i) => {
    if (varias) out.push(divisor(m, i, M.marcas.length), snapshotMarca(M, m, ctx));
    m.redes.forEach(r => out.push(red(M, m, r, ctx)));
    out.push(hallazgo(m, ctx), competencia(M, m, ctx), optimizaciones(m, ctx));
  });
  if (M.conEscucha) out.push(M.escucha ? escucha(M, ctx) : editable ? lamina('notas', `${cabeza(`${MAYUS(M.cliente.nombre)} · SOCIAL LISTENING`, 'Social', 'listening')}<p class="falta">Falta subir el PDF de Brandwatch del mes (botón «Subir Brandwatch»). Sin él, esta lámina no aparece en el link del cliente.</p>`, 'Social listening') : '');
  out.push(notas(M), gracias());
  return out.filter(Boolean).join('');
}
