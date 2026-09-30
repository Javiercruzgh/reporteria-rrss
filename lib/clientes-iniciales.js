/* Clientes con los que parte la herramienta (30-09-2026). Se cargan una sola vez; después se editan en la pestaña Clientes.
   blogId = el número de la marca en Metricool (no es secreto: se ve en la dirección de Metricool).
   Redes posibles: instagram, tiktok, facebook, linkedin, youtube. */

const LINEAMIENTOS_ACHS = `Achs es el cliente más exigente: el reporte se lee en su directorio.
- Cada marca se analiza por separado y el resumen compara las cuatro. Masterbrand no se reporta (solo alimenta el social listening).
- Tono sobrio e institucional. Nada de chistes ni emojis. Primera persona plural ("subimos", "bajamos") solo para lo que hizo la agencia.
- Cada afirmación lleva su número. Las variaciones se explican por el contenido (qué piezas, qué formato), no por el algoritmo.
- TikTok: Metricool no separa orgánico de pagado. Todo video con 50.000 vistas o más en el mes cuenta como "pauta estimada"; el top de TikTok muestra solo orgánicos y el análisis los separa.
- LinkedIn: las interacciones incluyen clics. Es el canal de reputación: destacar piezas de empresas adheridas con resultados.
- Facebook es un canal pasivo; no proponer invertir más en él salvo que los datos lo justifiquen.
- Las optimizaciones son concretas y medibles, en tres grupos: escalar, corregir y testear.`;

const LINEAMIENTOS_GENERALES = `Tono cercano pero profesional, en español de Chile. Cada afirmación lleva su número.
- Explicar las variaciones por el contenido (qué piezas, qué formato, qué momento del calendario).
- El hallazgo es una sola idea que el cliente pueda repetir; la evidencia la prueba con números.
- Las optimizaciones son concretas y medibles, en tres grupos: escalar, corregir y testear.`;

const marca = (id, nombre, blogId, redes, extra = {}) => ({ id, nombre, blogId, redes, competencia: true, activa: true, ...extra });

export const CLIENTES_INICIALES = [
  {
    id: 'achs', nombre: 'Achs',
    config: {
      marcas: [
        marca('seguro-laboral', 'Seguro Laboral', '3235334', ['instagram', 'tiktok', 'linkedin', 'facebook'], { nombreLargo: 'Achs Seguro Laboral', color: '#17C24B' }),
        marca('salud', 'Achs Salud', '3235336', ['instagram', 'tiktok', 'linkedin', 'facebook'], { color: '#3D8BFF' }),
        marca('hospital', 'Hospital del Trabajador', '3235338', ['instagram', 'linkedin', 'facebook'], { color: '#3D8BFF' }),
        marca('segurito', 'Segurito', '3235340', ['instagram', 'tiktok', 'facebook', 'youtube'], { color: '#17C24B' }),
        marca('masterbrand', 'Masterbrand', '3235332', ['linkedin', 'youtube'], { activa: false, competencia: false })
      ],
      escucha: true,
      reglas: { pautaTiktok: 50000 },
      lineamientos: LINEAMIENTOS_ACHS
    }
  },
  { id: 'alflorex', nombre: 'Alflorex', config: { marcas: [marca('alflorex', 'Alflorex', '4369569', ['instagram', 'tiktok'])], escucha: false, reglas: {}, lineamientos: LINEAMIENTOS_GENERALES } },
  { id: 'muno', nombre: 'Muno', config: { marcas: [marca('muno', 'Muno', '4323563', ['instagram', 'tiktok'])], escucha: false, reglas: {}, lineamientos: LINEAMIENTOS_GENERALES } },
  { id: 'pesas-chile', nombre: 'Pesas Chile', config: { marcas: [marca('pesas-chile', 'Pesas Chile', '2814179', ['instagram', 'tiktok'])], escucha: false, reglas: {}, lineamientos: LINEAMIENTOS_GENERALES } },
  { id: 'stp', nombre: 'STP', config: { marcas: [marca('stp', 'STP', '6962385', ['instagram', 'tiktok'])], escucha: false, reglas: {}, lineamientos: LINEAMIENTOS_GENERALES } },
  { id: 'wurtex', nombre: 'Wurtex', config: { marcas: [marca('wurtex', 'Wurtex', '6962412', ['instagram', 'tiktok'])], escucha: false, reglas: {}, lineamientos: LINEAMIENTOS_GENERALES } }
];
