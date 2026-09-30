/* Metricool: trae los datos de una marca para un período y los deja en un formato propio, igual para todas las redes.
   Tres modos (lib/config.js):
   - api: llama a la API de Metricool con METRICOOL_TOKEN y METRICOOL_USER_ID (los pone Bruno en Railway);
   - simulado: datos inventados, para probar en tu computador sin clave (y en las pruebas automáticas);
   - apagado: en producción sin clave. La carga queda apagada con un aviso claro.

   Formato de una marca en un período (DatosMarca):
   { redes: { instagram: { comunidad, serie: [[fecha, n]], posts: [Pub], reels: [Pub], historias: [{ fecha, alcance }] },
              tiktok:    { comunidad, serie, videos: [Pub] },
              facebook:  { comunidad, posts: [Pub] },
              linkedin:  { comunidad, posts: [Pub] },
              youtube:   { comunidad, videos: [Pub], reproducciones } },
     competencia: [{ nombre, usuario, comunidad, publicaciones, interacciones, engagement }] }
   Pub = { id, fecha: 'AAAA-MM-DD', tipo, texto, url, imagen, alcance, vistas, impresiones, interacciones, likes, comentarios, compartidos, guardados, clics } */
import { METRICOOL_MODO, METRICOOL_TOKEN, METRICOOL_USER_ID, ZONA_HORARIA } from './config.js';

export const REDES = ['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube'];
export const NOMBRE_RED = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube' };
const BASE = 'https://app.metricool.com/api';

export const METRICOOL_ORIGEN = () => METRICOOL_MODO === 'api' ? 'metricool' : METRICOOL_MODO;
export const estado = () => ({
  modo: METRICOOL_MODO,
  aviso: METRICOOL_MODO === 'apagado' ? 'Falta la clave de Metricool: Bruno tiene que poner METRICOOL_TOKEN y METRICOOL_USER_ID en Railway.'
    : METRICOOL_MODO === 'simulado' ? 'Sin clave de Metricool: los datos son inventados, solo para probar.' : ''
});

/** Datos de una marca ({ blogId, redes }) entre dos fechas (AAAA-MM-DD, ambas incluidas). */
export async function traerMarca(marca, desde, hasta, { fetchImpl = fetch } = {}) {
  if (METRICOOL_MODO === 'apagado') throw Object.assign(new Error(estado().aviso), { code: 503 });
  if (METRICOOL_MODO === 'simulado') return simular(marca, desde, hasta);
  if (!/^\d+$/.test(String(marca.blogId || ''))) throw Object.assign(new Error(`La marca «${marca.nombre}» no tiene su número de Metricool (blogId). Agrégalo en Clientes.`), { code: 400 });
  const api = cliente(marca.blogId, desde, hasta, fetchImpl);
  const redes = {};
  for (const red of marca.redes || []) redes[red] = await LECTORES[red](api);
  const competencia = marca.competencia !== false && (marca.redes || []).includes('instagram') ? await competenciaInstagram(api).catch(() => []) : [];
  return { redes, competencia };
}

/* ============================================================ API real
   La API de Metricool no tiene documentación completa de analítica. Cada lectura prueba primero el endpoint v2 y,
   si no responde, el antiguo. «Probar conexión» (Clientes → una marca) muestra qué respondió cada uno, sin valores. */
function cliente(blogId, desde, hasta, fetchImpl) {
  const iso = { from: `${desde}T00:00:00`, to: `${hasta}T23:59:59`, timezone: ZONA_HORARIA };
  const compacto = { start: desde.replace(/-/g, ''), end: hasta.replace(/-/g, ''), timezone: ZONA_HORARIA };
  async function get(ruta, params) {
    const q = new URLSearchParams({ ...params, userId: METRICOOL_USER_ID, blogId: String(blogId), integrationSource: 'MCP' });
    const r = await fetchImpl(`${BASE}${ruta}?${q}`, { headers: { 'X-Mc-Auth': METRICOOL_TOKEN, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Metricool rechazó la clave. Revisa METRICOOL_TOKEN y METRICOOL_USER_ID.'), { code: 502 });
    if (!r.ok) throw Object.assign(new Error(`Metricool respondió ${r.status} en ${ruta}.`), { code: 502, ruta });
    return r.json();
  }
  /** Prueba cada [ruta, params] en orden y devuelve la primera respuesta que sirva. */
  async function primero(intentos) {
    let ultimo;
    for (const [ruta, params] of intentos) {
      try { const j = await get(ruta, params); if (j != null) return j; } catch (e) { if (e.code === 502 && /clave/.test(e.message)) throw e; ultimo = e; }
    }
    throw ultimo || new Error('Metricool no respondió.');
  }
  const lista = j => Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.data?.data) ? j.data.data : [];
  const publicaciones = async red => lista(await primero([[`/v2/analytics/posts/${red}`, iso]])).map(normalizarPub);
  /** Último valor de una serie (seguidores). Acepta [[t, v]], [{ dateTime, value }] o { data: [{ values: [...] }] }. */
  async function serie(red, metricasViejas) {
    const j = await primero([
      ['/v2/analytics/timelines', { ...iso, network: red, metric: 'followers', subject: 'account' }],
      ...metricasViejas.map(m => [`/stats/timeline/${m}`, compacto])
    ]);
    const puntos = [];
    const visitar = x => {
      if (Array.isArray(x) && x.length === 2 && !Array.isArray(x[0]) && typeof x[0] !== 'object') puntos.push([fechaDe(x[0]), num(x[1])]);
      else if (Array.isArray(x)) x.forEach(visitar);
      else if (x && typeof x === 'object') {
        if ('value' in x && (x.dateTime || x.date || x.timestamp)) puntos.push([fechaDe(x.dateTime || x.date || x.timestamp), num(x.value)]);
        else Object.values(x).forEach(visitar);
      }
    };
    visitar(j);
    const s = puntos.filter(p => p[0] && Number.isFinite(p[1])).sort((a, b) => a[0] < b[0] ? -1 : 1);
    return { comunidad: s.at(-1)?.[1] ?? null, serie: s };
  }
  return { get, primero, lista, publicaciones, serie, iso, compacto };
}

const LECTORES = {
  async instagram(api) {
    const [s, posts, reels, historias] = await Promise.all([
      api.serie('instagram', ['igFollowers']),
      api.publicaciones('instagram'),
      api.primero([['/v2/analytics/reels/instagram', api.iso]]).then(j => api.lista(j).map(p => normalizarPub({ ...p, type: 'reel' }))).catch(() => []),
      api.primero([['/v2/analytics/stories/instagram', api.iso], ['/stats/instagram/stories', api.compacto]]).then(j => api.lista(j).map(normalizarPub)).catch(() => [])
    ]);
    // algunas respuestas de posts traen también los reels: se dejan solo en reels
    const idsReels = new Set(reels.map(r => r.id));
    return { ...s, posts: posts.filter(p => !idsReels.has(p.id) && p.tipo !== 'reel'), reels: reels.length ? reels : posts.filter(p => p.tipo === 'reel'), historias: historias.map(h => ({ fecha: h.fecha, alcance: h.alcance })) };
  },
  async tiktok(api) { const [s, videos] = await Promise.all([api.serie('tiktok', ['tiktokFollowers']), api.publicaciones('tiktok')]); return { ...s, videos: videos.map(v => ({ ...v, tipo: 'video' })) }; },
  async facebook(api) { const [s, posts] = await Promise.all([api.serie('facebook', ['facebookLikes', 'fbFollowers']), api.publicaciones('facebook')]); return { ...s, posts }; },
  async linkedin(api) { const [s, posts] = await Promise.all([api.serie('linkedin', ['inFollowers']), api.publicaciones('linkedin')]); return { ...s, posts }; },
  async youtube(api) { const [s, videos] = await Promise.all([api.serie('youtube', ['ytSubscribers', 'yttotalSubscribers']), api.publicaciones('youtube')]); return { ...s, videos: videos.map(v => ({ ...v, tipo: 'video' })) }; }
};

async function competenciaInstagram(api) {
  const j = await api.primero([['/v2/analytics/competitors/instagram', api.iso]]);
  return api.lista(j).map(c => ({
    nombre: txt(c.displayName ?? c.name ?? c.screenName), usuario: txt(c.screenName ?? c.username ?? ''),
    comunidad: num(c.followers), publicaciones: num(c.posts ?? c.publications), interacciones: num(c.interactions ?? sumar(c.likes, c.comments)),
    engagement: num(c.engagement)
  })).filter(c => c.nombre);
}

/* ---------- normalización: la API usa nombres distintos según la red ---------- */
const num = v => { const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v); return Number.isFinite(n) ? n : null; };
const txt = v => v == null ? '' : String(v);
const sumar = (...xs) => xs.some(x => num(x) != null) ? xs.reduce((a, x) => a + (num(x) || 0), 0) : null;
const pick = (o, ...claves) => { for (const k of claves) { const v = k.split('.').reduce((x, p) => x?.[p], o); if (v != null && v !== '') return v; } return null; };
function fechaDe(v) {
  if (v == null) return '';
  if (typeof v === 'object') v = v.dateTime || v.date || '';
  if (typeof v === 'number') return new Date(v < 1e11 ? v * 1000 : v).toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s.slice(0, 10);
}
const TIPOS = { carousel_album: 'carrusel', carousel: 'carrusel', image: 'imagen', photo: 'imagen', video: 'video', reel: 'reel', reels: 'reel', clips: 'reel', status: 'post', link: 'post', article: 'post', document: 'documento' };
export function normalizarPub(p) {
  const tipo = String(pick(p, 'type', 'mediaType', 'postType') || 'post').toLowerCase();
  const likes = num(pick(p, 'likes', 'reactions', 'likeCount')), comentarios = num(pick(p, 'comments', 'commentsCount'));
  const compartidos = num(pick(p, 'shares', 'shareCount')), guardados = num(pick(p, 'saved', 'saves'));
  const clics = num(pick(p, 'clicks', 'clicksCount'));
  return {
    id: txt(pick(p, 'postId', 'reelId', 'videoId', 'id', 'url', 'permalink', 'shareurl')),
    fecha: fechaDe(pick(p, 'publishedAt', 'timestamp', 'created', 'date', 'publicationDate')),
    tipo: TIPOS[tipo] || tipo,
    texto: txt(pick(p, 'content', 'text', 'description', 'title', 'caption')).slice(0, 600),
    url: txt(pick(p, 'url', 'permalink', 'shareurl', 'link')),
    imagen: txt(pick(p, 'imageUrl', 'thumbnailUrl', 'coverimageurl', 'picture', 'image')),
    alcance: num(pick(p, 'reach', 'reachOrganic')),
    vistas: num(pick(p, 'views', 'videoViews', 'plays', 'viewCount')),
    impresiones: num(pick(p, 'impressions', 'impressionsTotal', 'impressionCount')),
    interacciones: num(pick(p, 'interactions', 'engagementCount')) ?? sumar(likes, comentarios, compartidos, guardados),
    likes, comentarios, compartidos, guardados, clics
  };
}

/* ============================================================ datos inventados
   Deterministas (la misma marca y el mismo período dan lo mismo), para que la demo y las pruebas no cambien. */
function azar(semilla) {
  let h = 2166136261; for (const c of String(semilla)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const TEMAS = ['Guía práctica para el fin de semana', 'Tres mitos que seguimos creyendo', 'Detrás de cámaras con el equipo', 'Lo que nos preguntan siempre',
  'Checklist antes de salir', 'Un día en la vida de nuestra comunidad', 'Receta rápida para la semana', 'Concurso del mes', 'Tutorial en 30 segundos',
  'Respuestas a sus comentarios', 'El dato que nadie te contó', 'Antes y después', 'Tendencia de la semana', 'Preguntas frecuentes', 'Novedades del mes'];
export function simular(marca, desde, hasta) {
  const r = azar(`${marca.blogId || marca.id}|${desde}`), base = azar(String(marca.blogId || marca.id));
  const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 864e5) + 1;
  const entre = (a, b) => Math.round(a + r() * (b - a));
  const escala = 0.4 + base() * 3;                         // cada marca con su tamaño, estable entre meses
  const fecha = () => { const d = new Date(Date.parse(desde) + Math.floor(r() * dias) * 864e5); return d.toISOString().slice(0, 10); };
  const pub = (red, tipo, i, alc) => {
    const alcance = Math.round(alc * (0.4 + r() * 1.8)), likes = Math.round(alcance * (0.01 + r() * 0.05)), comentarios = entre(0, likes / 8), compartidos = entre(0, likes / 5), guardados = entre(0, likes / 4);
    return { id: `${red}-${desde}-${i}`, fecha: fecha(), tipo, texto: TEMAS[Math.floor(r() * TEMAS.length)], url: '', imagen: '', alcance, vistas: Math.round(alcance * (1.3 + r())),
      impresiones: Math.round(alcance * 1.4), interacciones: likes + comentarios + compartidos + guardados, likes, comentarios, compartidos, guardados, clics: red === 'linkedin' ? entre(10, 400) : null };
  };
  const serie = total => Array.from({ length: dias }, (_, d) => [new Date(Date.parse(desde) + d * 864e5).toISOString().slice(0, 10), Math.round(total * (0.985 + 0.015 * d / dias))]);
  const redes = {};
  for (const red of marca.redes || []) {
    const comunidad = Math.round(8000 * escala * (0.9 + base() * 0.4));
    const lista = (n, tipo, alc) => Array.from({ length: n }, (_, i) => pub(red, tipo, i, alc)).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    if (red === 'instagram') redes.instagram = { comunidad, serie: serie(comunidad), posts: lista(entre(3, 10), r() > 0.5 ? 'carrusel' : 'imagen', 400 * escala), reels: lista(entre(2, 8), 'reel', 700 * escala),
      historias: Array.from({ length: entre(5, 30) }, () => ({ fecha: fecha(), alcance: entre(60, 300) * escala | 0 })) };
    else if (red === 'tiktok') redes.tiktok = { comunidad, serie: serie(comunidad), videos: lista(entre(0, 8), 'video', 900 * escala) };
    else if (red === 'youtube') redes.youtube = { comunidad, videos: lista(entre(0, 2), 'video', 500 * escala), reproducciones: entre(2000, 40000) };
    else redes[red] = { comunidad, posts: lista(entre(3, 12), 'post', 300 * escala) };
  }
  const competencia = marca.competencia !== false && redes.instagram ? ['Competidor A', 'Competidor B', 'Competidor C'].map((nombre, i) => ({
    nombre, usuario: `competidor_${'abc'[i]}`, comunidad: Math.round(9000 * escala * (0.5 + base() * 2)), publicaciones: entre(0, 25), interacciones: entre(0, 900), engagement: Math.round(r() * 60) / 100
  })) : [];
  return { redes, competencia, simulado: true };
}
