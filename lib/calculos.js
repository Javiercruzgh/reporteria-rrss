/* Cálculos del reporte: de los datos de Metricool (actual y mes anterior) a los números que muestran las láminas.
   No usa IA ni llama a nada: es aritmética, y es lo mismo que recibe la IA para redactar.
   Reglas que vienen de los reportes de septiembre 2026 (ver las notas metodológicas en modelo().notas):
   - Engagement de Instagram = interacciones del feed ÷ alcance del feed.
   - TikTok con regla de pauta: un video con N vistas o más en el mes es «pauta estimada»; el top muestra solo orgánicos.
   - Top de contenidos ordenado por visibilidad: alcance (Instagram, Facebook), vistas (TikTok, YouTube) e impresiones (LinkedIn). */
import { NOMBRE_RED } from './metricool.js';
import { textoPeriodo, tituloMes, nombreMes } from './periodos.js';

const n = v => Number.isFinite(v) ? v : 0;
const suma = (lista, campo) => lista.reduce((a, p) => a + n(p[campo]), 0);
const prom = (lista, campo) => { const v = lista.filter(p => Number.isFinite(p[campo])); return v.length ? suma(v, campo) / v.length : null; };
export const variacion = (v, a) => Number.isFinite(v) && Number.isFinite(a) && a !== 0 ? (v - a) / Math.abs(a) * 100 : null;
const kpi = (clave, etiqueta, v, a, extra = {}) => ({ clave, etiqueta, v: v ?? null, a: a ?? null, var: variacion(v, a), formato: 'n', ...extra });
const vacia = { comunidad: null, posts: [], reels: [], historias: [], videos: [] };

/* ---------- por red ---------- */
function instagram(cur = vacia, ant = vacia) {
  const feed = x => [...(x.posts || []), ...(x.reels || [])];
  const f = feed(cur), fa = feed(ant);
  const inter = suma(f, 'interacciones'), interA = suma(fa, 'interacciones');
  const alc = suma(f, 'alcance'), alcA = suma(fa, 'alcance');
  const er = alc ? inter / alc * 100 : null, erA = alcA ? interA / alcA * 100 : null;
  const top = [...f].sort((a, b) => n(b.alcance) - n(a.alcance)).slice(0, 3).map(p => ({ ...p,
    metricas: [['Alcance', p.alcance], ['Vistas', p.vistas], ['Interacciones', p.interacciones], ['Compartidos', p.compartidos], ['Guardados', p.guardados],
      ['ER s/alcance', p.alcance ? p.interacciones / p.alcance * 100 : null, 'pct']] }));
  return {
    kpis: [
      kpi('comunidad', 'Comunidad', cur.comunidad, ant.comunidad),
      kpi('feed', 'Contenido feed (posts + reels)', f.length, fa.length, { detalle: `${(cur.posts || []).length} + ${(cur.reels || []).length}` }),
      kpi('historias', 'Historias', (cur.historias || []).length, (ant.historias || []).length),
      kpi('interacciones', 'Interacciones', inter, interA),
      kpi('alcanceFeed', 'Alcance del feed', alc, alcA),
      kpi('alcPosts', 'Alcance promedio posts', prom(cur.posts || [], 'alcance'), prom(ant.posts || [], 'alcance')),
      kpi('alcReels', 'Alcance promedio reels', prom(cur.reels || [], 'alcance'), prom(ant.reels || [], 'alcance')),
      kpi('alcHistorias', 'Alcance promedio historias', prom(cur.historias || [], 'alcance'), prom(ant.historias || [], 'alcance')),
      kpi('engagement', 'Engagement', er, erA, { formato: 'pct' })
    ],
    resumen: { comunidad: [cur.comunidad, ant.comunidad], interacciones: [inter, interA], publicaciones: [f.length, fa.length] },
    top, funnel: { alcance: alc, alcanceA: alcA, consideracion: suma(f, 'guardados') + suma(f, 'compartidos'), consideracionA: suma(fa, 'guardados') + suma(fa, 'compartidos') },
    notas: ['Engagement de Instagram = interacciones del feed ÷ alcance del feed.']
  };
}

function tiktok(cur = vacia, ant = vacia, reglas = {}) {
  const umbral = Number(reglas.pautaTiktok) || 0;
  const marcar = lista => (lista || []).map(v => ({ ...v, pauta: umbral > 0 && n(v.vistas) >= umbral, interacciones: v.interacciones ?? n(v.likes) + n(v.comentarios) + n(v.compartidos) }));
  const v = marcar(cur.videos), va = marcar(ant.videos);
  const org = v.filter(x => !x.pauta), orgA = va.filter(x => !x.pauta);
  const kpis = [
    kpi('comunidad', 'Comunidad', cur.comunidad, ant.comunidad),
    kpi('videos', 'Videos publicados', v.length, va.length, umbral ? { detalle: `${v.length - org.length} con pauta est.` } : {}),
    kpi('vistas', umbral ? 'Visualizaciones totales (incl. pauta)' : 'Visualizaciones', suma(v, 'vistas'), suma(va, 'vistas'))
  ];
  if (umbral) kpis.push(kpi('vistasOrg', 'Visualizaciones orgánicas est.', suma(org, 'vistas'), suma(orgA, 'vistas')),
    kpi('promOrg', 'Promedio orgánico por video', prom(org, 'vistas'), prom(orgA, 'vistas')));
  else kpis.push(kpi('promVistas', 'Promedio por video', prom(v, 'vistas'), prom(va, 'vistas')));
  kpis.push(kpi('interacciones', umbral ? 'Interacciones totales' : 'Interacciones', suma(v, 'interacciones'), suma(va, 'interacciones')));
  const top = (umbral ? org : v).sort((a, b) => n(b.vistas) - n(a.vistas)).slice(0, 3).map(p => ({ ...p,
    marca: umbral ? (p.pauta ? 'Pauta est.' : 'Orgánico') : '', metricas: [['Vistas', p.vistas], ['Likes', p.likes], ['Comentarios', p.comentarios], ['Compartidos', p.compartidos]] }));
  return {
    kpis, top, pautaUmbral: umbral || null,
    resumen: { comunidad: [cur.comunidad, ant.comunidad], interacciones: [suma(v, 'interacciones'), suma(va, 'interacciones')], publicaciones: [v.length, va.length] },
    funnel: { alcance: suma(umbral ? org : v, 'vistas'), alcanceA: suma(umbral ? orgA : va, 'vistas'), consideracion: suma(v, 'compartidos'), consideracionA: suma(va, 'compartidos') },
    notas: umbral ? [`Pauta estimada: videos con ${umbral.toLocaleString('es-CL')} vistas o más en el mes. Metricool no separa orgánico de pagado en TikTok; este corte es una aproximación.`] : [],
    notaTop: umbral ? 'Ranking solo con videos orgánicos estimados, ordenados por vistas.' : ''
  };
}

function linkedin(cur = vacia, ant = vacia) {
  const p = cur.posts || [], pa = ant.posts || [];
  const inter = x => x.map(q => ({ ...q, interacciones: n(q.likes) + n(q.comentarios) + n(q.compartidos) + n(q.clics) || n(q.interacciones) }));
  const i = inter(p), ia = inter(pa);
  const eng = x => { const imp = suma(x, 'impresiones'); return imp ? suma(x, 'interacciones') / imp * 100 : null; };
  return {
    kpis: [kpi('comunidad', 'Comunidad', cur.comunidad, ant.comunidad), kpi('publicaciones', 'Publicaciones', p.length, pa.length),
      kpi('impresiones', 'Impresiones totales', suma(p, 'impresiones'), suma(pa, 'impresiones')),
      kpi('interacciones', 'Interacciones (incl. clics)', suma(i, 'interacciones'), suma(ia, 'interacciones')),
      kpi('engagement', 'Engagement', eng(i), eng(ia), { formato: 'pct' })],
    resumen: { comunidad: [cur.comunidad, ant.comunidad], interacciones: [suma(i, 'interacciones'), suma(ia, 'interacciones')], publicaciones: [p.length, pa.length] },
    top: [...i].sort((a, b) => n(b.impresiones) - n(a.impresiones)).slice(0, 3).map(q => ({ ...q,
      metricas: [['Impresiones', q.impresiones], ['Clics', q.clics], ['Reacciones', q.likes], ['Comentarios', q.comentarios], ['Compartidos', q.compartidos],
        ['Engagement', q.impresiones ? q.interacciones / q.impresiones * 100 : null, 'pct']] })),
    notas: ['En LinkedIn las interacciones incluyen clics.']
  };
}

function facebook(cur = vacia, ant = vacia) {
  const p = cur.posts || [], pa = ant.posts || [];
  return {
    kpis: [kpi('comunidad', 'Comunidad', cur.comunidad, ant.comunidad), kpi('publicaciones', 'Contenido feed', p.length, pa.length),
      kpi('interacciones', 'Interacciones', suma(p, 'interacciones'), suma(pa, 'interacciones')),
      kpi('alcProm', 'Alcance promedio por post', prom(p, 'alcance'), prom(pa, 'alcance'))],
    resumen: { comunidad: [cur.comunidad, ant.comunidad], interacciones: [suma(p, 'interacciones'), suma(pa, 'interacciones')], publicaciones: [p.length, pa.length] },
    top: [...p].sort((a, b) => n(b.alcance) - n(a.alcance)).slice(0, 3).map(q => ({ ...q, metricas: [['Alcance', q.alcance], ['Interacciones', q.interacciones], ['Compartidos', q.compartidos]] })),
    notas: []
  };
}

function youtube(cur = vacia, ant = vacia) {
  const v = cur.videos || [], va = ant.videos || [];
  const inter = x => suma(x, 'likes') + suma(x, 'compartidos');
  return {
    kpis: [kpi('comunidad', 'Suscriptores', cur.comunidad, ant.comunidad), kpi('videos', 'Videos nuevos', v.length, va.length),
      kpi('reproducciones', 'Reproducciones', cur.reproducciones ?? suma(v, 'vistas'), ant.reproducciones ?? suma(va, 'vistas')),
      kpi('likes', 'Likes', suma(v, 'likes'), suma(va, 'likes')), kpi('compartidos', 'Compartidos', suma(v, 'compartidos'), suma(va, 'compartidos'))],
    resumen: { comunidad: [cur.comunidad, ant.comunidad], interacciones: [inter(v), inter(va)], publicaciones: [v.length, va.length] },
    top: [...v].sort((a, b) => n(b.vistas) - n(a.vistas)).slice(0, 3).map(q => ({ ...q, metricas: [['Vistas', q.vistas], ['Likes', q.likes], ['Compartidos', q.compartidos]] })),
    notas: ['En YouTube las interacciones suman likes y compartidos.']
  };
}
const POR_RED = { instagram, tiktok, linkedin, facebook, youtube };

const par = ([v, a]) => ({ v: v ?? null, a: a ?? null, var: variacion(v, a) });

/** Una marca: sus redes, la tabla general, el funnel y la competencia. */
export function modeloMarca(marca, datos = {}, reglas = {}) {
  const cur = datos.actual || { redes: {} }, ant = datos.anterior || { redes: {} };
  const redes = (marca.redes || []).filter(r => POR_RED[r] && (cur.redes?.[r] || ant.redes?.[r])).map(red => ({
    red, nombre: NOMBRE_RED[red], ...POR_RED[red](cur.redes[red] || undefined, ant.redes?.[red] || undefined, reglas)
  }));
  const filas = redes.map(r => ({ red: r.red, nombre: r.nombre, comunidad: par(r.resumen.comunidad), interacciones: par(r.resumen.interacciones), publicaciones: par(r.resumen.publicaciones) }));
  const tot = k => par([filas.reduce((a, f) => a + n(f[k].v), 0), filas.reduce((a, f) => a + n(f[k].a), 0)]);
  const total = { comunidad: tot('comunidad'), interacciones: tot('interacciones'), publicaciones: tot('publicaciones') };
  const ig = redes.find(r => r.red === 'instagram'), tt = redes.find(r => r.red === 'tiktok');
  const funnel = ig || tt ? {
    conocimiento: par([n(ig?.funnel.alcance) + n(tt?.funnel.alcance), n(ig?.funnel.alcanceA) + n(tt?.funnel.alcanceA)]),
    consideracion: par([n(ig?.funnel.consideracion) + n(tt?.funnel.consideracion), n(ig?.funnel.consideracionA) + n(tt?.funnel.consideracionA)])
  } : null;
  // competencia (Instagram): la marca primero, después los competidores con su variación contra el mes anterior
  const compA = new Map((ant.competencia || []).map(c => [c.usuario || c.nombre, c]));
  const competencia = (cur.competencia || []).length ? [
    ...(ig ? [{ nombre: marca.nombre, propia: true, comunidad: par(ig.resumen.comunidad), publicaciones: par(ig.resumen.publicaciones), engagement: null }] : []),
    ...cur.competencia.map(c => { const a = compA.get(c.usuario || c.nombre) || {}; return { nombre: c.nombre, usuario: c.usuario, comunidad: par([c.comunidad, a.comunidad]), publicaciones: par([c.publicaciones, a.publicaciones]), engagement: par([c.engagement, a.engagement]) }; })
  ] : [];
  return { id: marca.id, nombre: marca.nombre, nombreLargo: marca.nombreLargo || marca.nombre, color: marca.color || '', redes, general: { filas, total }, funnel, competencia, simulado: !!(cur.simulado || ant.simulado) };
}

/** El reporte completo: portada, resumen (si hay varias marcas), marcas, social listening y notas. */
export function modelo(cliente, reporte) {
  const cfg = cliente.config || {};
  const activas = (cfg.marcas || []).filter(m => m.activa !== false);
  const marcas = activas.filter(m => reporte.datos?.[m.id]).map(m => modeloMarca(m, reporte.datos[m.id], cfg.reglas || {}));
  const resumen = marcas.length > 1 ? {
    filas: marcas.map(m => ({ id: m.id, nombre: m.nombre, redes: m.redes.map(r => r.nombre), ...m.general.total })),
    total: ['comunidad', 'interacciones', 'publicaciones'].reduce((o, k) => ({ ...o, [k]: par([marcas.reduce((a, m) => a + n(m.general.total[k].v), 0), marcas.reduce((a, m) => a + n(m.general.total[k].a), 0)]) }), {})
  } : null;
  const redesUsadas = [...new Set(marcas.flatMap(m => m.redes.map(r => r.nombre)))];
  const hayComp = marcas.some(m => m.competencia.length);
  const notas = [
    `Período. ${textoPeriodo(reporte.desde, reporte.hasta)}, comparado con el mismo tramo de ${nombreMes(reporte.anterior.mes)} (${+reporte.anterior.desde.slice(8)} al ${+reporte.anterior.hasta.slice(8)}). Datos de Metricool${reporte.datosEn ? ` extraídos el ${new Date(reporte.datosEn).toLocaleDateString('es-CL')}` : ''}.`,
    ...new Set(marcas.flatMap(m => m.redes.flatMap(r => r.notas || []))),
    'Top contenidos. Ordenados por visibilidad: alcance en Instagram y Facebook, vistas en TikTok y YouTube, impresiones en LinkedIn.',
    ...(hayComp ? ['Competencia. Engagement según Metricool: interacciones promedio por cada 1.000 seguidores; no es comparable con el engagement propio (sobre alcance).'] : [])
  ];
  return {
    cliente: { id: cliente.id, nombre: cliente.nombre }, mes: reporte.mes, titulo: tituloMes(reporte.mes),
    periodo: textoPeriodo(reporte.desde, reporte.hasta), comparacion: textoPeriodo(reporte.anterior.desde, reporte.anterior.hasta), mesAnterior: nombreMes(reporte.anterior.mes),
    redes: redesUsadas, marcas, resumen, escucha: cfg.escucha ? reporte.escucha || null : undefined, conEscucha: !!cfg.escucha, notas,
    simulado: marcas.some(m => m.simulado)
  };
}
