/* Los textos de un reporte: cada lámina tiene uno o más espacios de texto con una clave fija.
   El equipo los escribe en el constructor (clic sobre el texto) o le pide a la IA una propuesta.
   Las claves se arman igual en public/publico/laminas.js (el que dibuja las láminas). */

/** Espacios de texto de un reporte, a partir del modelo de cálculos. `pide` es lo que se espera de cada uno (lo lee la IA). */
export function clavesTexto(modelo) {
  const c = [];
  c.push({ clave: 'general.resumen', lamina: 'Resumen', pide: modelo.marcas.length > 1
    ? 'Resumen ejecutivo del mes comparando las marcas: 3 a 4 frases cortas, una por idea, cada una con su número.'
    : 'Resumen ejecutivo del mes: 3 a 4 frases cortas, una por idea, cada una con su número.' });
  for (const m of modelo.marcas) {
    for (const r of m.redes) c.push({ clave: `${m.id}.${r.red}.lectura`, lamina: `${m.nombre} · ${r.nombre}`, pide: `Lectura de ${r.nombre}: 2 a 3 frases que expliquen las variaciones más importantes por el contenido publicado (qué piezas, qué formato).` });
    c.push({ clave: `${m.id}.hallazgo`, lamina: `${m.nombre} · Hallazgo`, pide: 'El hallazgo del mes: una sola idea, en una frase de máximo 20 palabras, que el cliente pueda repetir.' });
    c.push({ clave: `${m.id}.evidencia`, lamina: `${m.nombre} · Hallazgo`, pide: 'La evidencia del hallazgo: 2 a 3 frases con los números que lo prueban (piezas concretas, comparaciones).' });
    if (m.competencia.length) c.push({ clave: `${m.id}.competencia`, lamina: `${m.nombre} · Competencia`, pide: 'Lectura de la competencia en Instagram: 2 frases sobre dónde está la marca frente a los demás y qué hace mejor quien lidera.' });
    c.push({ clave: `${m.id}.escalar`, lamina: `${m.nombre} · Optimizaciones`, pide: 'Qué escalar el próximo mes: 1 a 2 acciones concretas y medibles, basadas en lo que funcionó.' });
    c.push({ clave: `${m.id}.corregir`, lamina: `${m.nombre} · Optimizaciones`, pide: 'Qué corregir: 1 a 2 acciones concretas sobre lo que bajó o no rindió.' });
    c.push({ clave: `${m.id}.testear`, lamina: `${m.nombre} · Optimizaciones`, pide: 'Qué testear: 1 a 2 pruebas concretas con su métrica de éxito.' });
  }
  if (modelo.conEscucha && modelo.escucha) c.push({ clave: 'escucha.lectura', lamina: 'Social listening', pide: 'Lectura del social listening: 2 a 3 frases sobre qué se dijo de la marca, el sentimiento y qué hacer con eso.' });
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
