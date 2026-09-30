/* Los textos de un reporte. Cada lámina (sección) tiene sus espacios, con clave «<id de la sección>.<espacio>».
   El equipo los escribe en el constructor (clic sobre el texto) o le pide a la IA una propuesta.
   public/publico/laminas.js arma las mismas claves. */
import { espaciosDe } from './secciones.js';

const PIDE = {
  resumen: m => m.marcas.length > 1
    ? 'Resumen ejecutivo del mes comparando las marcas: 3 a 4 frases cortas, una por idea, cada una con su número.'
    : 'Resumen ejecutivo del mes: 3 a 4 frases cortas, una por idea, cada una con su número.',
  'marca.texto': (m, s, marca) => `Lectura general de ${marca?.nombre}: 2 frases sobre cómo le fue en el conjunto de sus redes.`,
  'red.lectura': (m, s, marca, red) => `Lectura de ${red?.nombre} de ${marca?.nombre}: 2 a 3 frases que expliquen las variaciones más importantes por el contenido publicado (qué piezas, qué formato).`,
  'hallazgo.hallazgo': (m, s, marca) => `El hallazgo del mes de ${marca?.nombre}: una sola idea, en una frase de máximo 20 palabras, que el cliente pueda repetir.`,
  'hallazgo.evidencia': (m, s, marca) => `La evidencia del hallazgo de ${marca?.nombre}: 2 a 3 frases con los números que lo prueban (piezas concretas, comparaciones).`,
  'competencia.texto': (m, s, marca) => `Lectura de la competencia de ${marca?.nombre} en Instagram: 2 frases sobre dónde está la marca frente a los demás.`,
  'optimizaciones.escalar': (m, s, marca) => `Qué escalar el próximo mes en ${marca?.nombre}: 1 a 2 acciones concretas y medibles, basadas en lo que funcionó.`,
  'optimizaciones.corregir': (m, s, marca) => `Qué corregir en ${marca?.nombre}: 1 a 2 acciones concretas sobre lo que bajó o no rindió.`,
  'optimizaciones.testear': (m, s, marca) => `Qué testear en ${marca?.nombre}: 1 a 2 pruebas concretas con su métrica de éxito.`,
  'escucha.lectura': () => 'Lectura del social listening: 2 a 3 frases sobre qué se dijo de la marca, el sentimiento y qué hacer con eso.',
  'libre.titulo': () => 'Título corto de una lámina de texto libre (solo si el equipo ya escribió el texto; si no, déjalo vacío).',
  'libre.texto': () => 'Texto libre: solo si el equipo ya escribió el título; si no, déjalo vacío.'
};

/** Espacios de texto del reporte, en el orden de las láminas. `pide` es lo que se espera de cada uno (lo lee la IA). */
export function clavesTexto(modelo) {
  const c = [];
  modelo.secciones.forEach((s, i) => {
    const marca = modelo.marcas.find(m => m.id === s.marca), red = marca?.redes.find(r => r.red === s.red);
    if (s.tipo === 'escucha' && !modelo.escucha) return;
    for (const e of espaciosDe(s)) {
      const caja = e.startsWith('b-'), f = caja ? null : PIDE[`${s.tipo}.${e}`] || PIDE[s.tipo];
      c.push({ clave: `${s.id}.${e}`, lamina: `${i + 1}. ${marca ? marca.nombre + ' · ' : ''}${red ? red.nombre : s.tipo}`, pide: f ? f(modelo, s, marca, red) : caja ? 'Caja de texto que escribe el equipo.' : '', ia: !caja && !['libre', 'blanco'].includes(s.tipo) });
    }
  });
  return c;
}

/** Deja solo textos con clave válida y largo razonable. */
export function limpiarTextos(entrada = {}, validas) {
  const ok = new Set(validas), out = {};
  for (const [k, v] of Object.entries(entrada || {})) {
    if (!ok.has(k)) continue;
    out[k] = String(v ?? '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1500);
  }
  return out;
}
