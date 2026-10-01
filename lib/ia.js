/* IA (Claude) para dos cosas, siempre como propuesta que el equipo revisa:
   1. proponerTextos: redacta los textos de las láminas a partir de los números ya calculados y los lineamientos del cliente.
   2. leerBrandwatch: lee el PDF mensual de Brandwatch y lo deja ordenado para las láminas de social listening.
   Modos (lib/config.js): api (con ANTHROPIC_API_KEY), simulado (solo pruebas) y apagado (sin clave: todo se escribe a mano).
   Costo aproximado: un reporte de una marca ~ USD 0,20; Achs con cuatro marcas ~ USD 0,60; un PDF de Brandwatch ~ USD 0,30. */
import { IA_MODO, IA_MODELO } from './config.js';

export const estado = () => ({
  modo: IA_MODO,
  aviso: IA_MODO === 'apagado' ? 'La redacción con IA está apagada (falta ANTHROPIC_API_KEY). Los textos se escriben a mano.' : ''
});
const error = (code, msg) => Object.assign(new Error(msg), { code });

let _cliente;
async function cliente() {
  if (!_cliente) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); _cliente = new Anthropic(); }
  return _cliente;
}

/** Una llamada con salida JSON según `schema`. Devuelve el objeto. */
async function pedir({ system, content, schema, maxTokens = 16000 }) {
  if (IA_MODO === 'apagado') throw error(503, estado().aviso);
  const c = await cliente();
  let r;
  try {
    r = await c.messages.stream({
      model: IA_MODELO, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema } }
    }).finalMessage();
  } catch (e) {
    console.error('[ia]', e.status, e.message);
    throw error(502, e.status === 401 ? 'La clave de Claude no es válida. Avísale a Bruno.' : e.status === 429 ? 'Claude está saturado. Prueba de nuevo en un minuto.' : 'Claude no respondió. Prueba de nuevo.');
  }
  if (r.stop_reason === 'refusal') throw error(422, 'Claude no quiso procesar este contenido.');
  if (r.stop_reason === 'max_tokens') throw error(502, 'La respuesta de Claude quedó cortada. Prueba de nuevo.');
  const texto = r.content.filter(b => b.type === 'text').map(b => b.text).join('');
  try { return JSON.parse(texto); } catch { throw error(502, 'Claude respondió en un formato inesperado. Prueba de nuevo.'); }
}

/* ---------- 1. textos del reporte ---------- */
const SCHEMA_TEXTOS = {
  type: 'object', additionalProperties: false, required: ['textos'],
  properties: { textos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['clave', 'texto'], properties: { clave: { type: 'string' }, texto: { type: 'string' } } } } }
};

/** Lo que la IA necesita saber del modelo, sin imágenes ni links (menos tokens). */
function paraIa(modelo) {
  const pub = p => ({ fecha: p.fecha, tipo: p.tipo, texto: String(p.texto || '').slice(0, 160), ...(p.marca ? { marca: p.marca } : {}), metricas: Object.fromEntries((p.metricas || []).map(([k, v]) => [k, v == null ? null : Math.round(v * 10) / 10])) });
  const kp = k => ({ [k.etiqueta]: { actual: k.v, anterior: k.a, variacionPct: k.var == null ? null : Math.round(k.var * 10) / 10 } });
  return {
    cliente: modelo.cliente.nombre, mes: modelo.titulo, periodo: modelo.periodo, comparadoCon: modelo.comparacion,
    marcas: modelo.marcas.map(m => ({
      id: m.id, nombre: m.nombreLargo,
      redes: m.redes.map(r => ({ red: r.nombre, kpis: Object.assign({}, ...r.kpis.map(kp)), top: r.top.map(pub), notas: r.notas })),
      funnel: m.funnel, competencia: m.competencia
    })),
    escucha: modelo.escucha || undefined
  };
}

export async function proponerTextos({ modelo, claves, lineamientos, actuales = {} }) {
  if (IA_MODO === 'simulado') return Object.fromEntries(claves.map(c => [c.clave, `Texto propuesto para ${c.lamina} (prueba).`]));
  const system = `Eres analista senior de redes sociales en Monkey Labs, una agencia chilena. Redactas los textos del reporte mensual de redes orgánicas que se le entrega al cliente.
Escribe en español de Chile, claro y directo. Usa solo los números que vienen en los datos (no inventes cifras, piezas ni causas que no se puedan leer de ahí). Escribe los números con punto de miles (12.345) y los porcentajes con coma decimal (4,5%).
Lineamientos de este cliente:
${lineamientos || '(sin lineamientos especiales)'}`;
  const content = `Datos del reporte (ya calculados):
${JSON.stringify(paraIa(modelo))}

Textos que ya escribió el equipo (respeta su enfoque y no los contradigas):
${JSON.stringify(actuales)}

Redacta un texto para cada una de estas claves. Devuelve exactamente estas claves, cada una con lo que pide:
${claves.map(c => `- ${c.clave} (${c.lamina}): ${c.pide}`).join('\n')}`;
  const r = await pedir({ system, content, schema: SCHEMA_TEXTOS });
  const validas = new Set(claves.map(c => c.clave));
  return Object.fromEntries((r.textos || []).filter(t => validas.has(t.clave)).map(t => [t.clave, t.texto]));
}

/* ---------- 2. Brandwatch ---------- */
const pct = { type: 'object', additionalProperties: false, required: ['nombre', 'pct'], properties: { nombre: { type: 'string' }, pct: { type: 'number' } } };
const SCHEMA_ESCUCHA = {
  type: 'object', additionalProperties: false,
  required: ['periodo', 'menciones', 'menciones_anterior', 'alcance', 'nota', 'sentimiento', 'temas', 'canales', 'palabras', 'aprendizajes', 'alertas', 'oportunidades'],
  properties: {
    periodo: { type: 'string', description: 'Período que cubre el PDF, como aparece.' },
    menciones: { type: ['number', 'null'] }, menciones_anterior: { type: ['number', 'null'] }, alcance: { type: ['number', 'null'] },
    nota: { type: 'string', description: 'Una frase: qué marcas o búsquedas cubre el PDF.' },
    sentimiento: { type: 'object', additionalProperties: false, required: ['positivo', 'neutro', 'negativo'], properties: { positivo: { type: ['number', 'null'] }, neutro: { type: ['number', 'null'] }, negativo: { type: ['number', 'null'] } } },
    temas: { type: 'array', items: pct }, canales: { type: 'array', items: pct },
    palabras: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['texto', 'peso'], properties: { texto: { type: 'string' }, peso: { type: 'number' } } } },
    aprendizajes: { type: 'array', items: { type: 'string' } }, alertas: { type: 'array', items: { type: 'string' } }, oportunidades: { type: 'array', items: { type: 'string' } }
  }
};

/** PDF (Buffer) → resumen de social listening. */
export async function leerBrandwatch(pdf, { cliente = '', mes = '' } = {}) {
  if (IA_MODO === 'simulado') return {
    periodo: mes, menciones: 1234, menciones_anterior: 1100, alcance: 250000, nota: 'Datos de prueba.',
    sentimiento: { positivo: 30, neutro: 55, negativo: 15 },
    temas: [{ nombre: 'Tema de prueba', pct: 40 }, { nombre: 'Otro tema', pct: 25 }], canales: [{ nombre: 'X', pct: 50 }, { nombre: 'Noticias', pct: 30 }],
    palabras: [{ texto: 'prueba', peso: 10 }, { texto: 'marca', peso: 6 }], aprendizajes: ['Aprendizaje de prueba.'], alertas: [], oportunidades: ['Oportunidad de prueba.']
  };
  const system = `Lees informes de social listening de Brandwatch para Monkey Labs, una agencia chilena, y los resumes en español de Chile.
Copia los números tal como aparecen en el PDF (porcentajes de 0 a 100). Si un dato no está, déjalo en null o la lista vacía; nunca lo inventes.
Temas y canales: los principales, máximo 6 cada uno. Palabras: hasta 20, con un peso relativo (1 a 10). Aprendizajes, alertas y oportunidades: máximo 3 cada uno, frases cortas.`;
  const r = await pedir({
    system, schema: SCHEMA_ESCUCHA, maxTokens: 8000,
    content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } },
      { type: 'text', text: `Informe de Brandwatch de ${cliente} para ${mes}. Extrae el resumen.` }
    ]
  });
  return r;
}
