/* Configuración de la herramienta. Todo sale de variables de entorno; sin ellas corre en modo local. */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env local (opcional, nunca va a git)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const linea of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
const lista = s => String(s || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);

export const PROD = env.NODE_ENV === 'production' || !!env.RAILWAY_ENVIRONMENT;
/* Modo:
   - local: tu computador, sin login y con datos de prueba;
   - pruebas: el ambiente de pruebas, con la franja «AMBIENTE DE PRUEBAS» y su propia base de datos;
   - produccion: lo que usa el equipo. */
export const MODOS = ['local', 'pruebas', 'produccion'];
export const MODO = MODOS.includes(env.MODO) ? env.MODO : (PROD ? 'produccion' : 'local');
export const ES_PRODUCCION = MODO === 'produccion';

export const PORT = +env.PORT || 5003;   // el 5000 lo ocupa el Receptor AirPlay del Mac; 5001 es la plantilla y 5002 el prototipo de Paneo
export const PUBLIC_URL = (env.PUBLIC_URL || (env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:' + PORT)).replace(/\/+$/, '');
export const MONKEY_SYSTEM_URL = (env.MONKEY_SYSTEM_URL || 'https://monkey-system-production.up.railway.app').replace(/\/+$/, '');

// Datos: cada modo tiene su propia base, así pruebas nunca toca los datos reales aunque compartan carpeta
export const DATA_DIR = path.resolve(env.DATA_DIR || path.join(ROOT, 'data'));
export const DB_ARCHIVO = path.join(DATA_DIR, `herramienta-${MODO}.sqlite`);

// Acceso: login con Google, solo el dominio del equipo
export const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || '';
export const DOMINIO = (env.DOMINIO_EQUIPO || 'monkeylabs.cl').toLowerCase();
export const CUENTA_PRUEBAS = 'pruebas@monkeylabs.cl';
// fuera de producción, la cuenta de pruebas también es administradora (para probar todo)
export const ADMINS = [...new Set([...lista(env.ADMINS || 'bruno@monkeylabs.cl,emilio@monkeylabs.cl'), ...(ES_PRODUCCION ? [] : [CUENTA_PRUEBAS])])];
export const SESSION_SECRET = env.SESSION_SECRET || (MODO === 'local' ? 'solo-local-no-usar-fuera-del-computador' : '');
export const AUTH = !!GOOGLE_CLIENT_ID;
export const DEV_USER = (env.DEV_USER || CUENTA_PRUEBAS).toLowerCase();   // quién entra sin login (solo sin GOOGLE_CLIENT_ID)

/* Drive: la plantilla no lo usa. Si la herramienta lo necesita, se copia lib/drive.js de monkey-system y se lee este valor:
   fuera de producción es SIEMPRE el simulado, aunque alguien ponga DRIVE_MODO=google. */
export const DRIVE_MODO = ES_PRODUCCION ? (env.DRIVE_MODO || 'google') : 'simulado';

/** Lo que falta para arrancar publicado. Sin login en Railway, cualquiera entraría como la cuenta de pruebas. */
export function validar() {
  const faltan = [];
  if (PROD && !GOOGLE_CLIENT_ID) faltan.push('GOOGLE_CLIENT_ID');
  if (AUTH && SESSION_SECRET.length < 24) faltan.push('SESSION_SECRET (mín. 24 caracteres)');
  return faltan;
}

/* ---------- integraciones de Reportería ----------
   Metricool: el token y el usuario los pone Bruno en Railway (en tu computador, tú en .env). Nunca van en el código.
   Sin token, en producción la carga de datos queda apagada con un aviso; fuera de producción se usan datos inventados. */
export const METRICOOL_TOKEN = env.METRICOOL_TOKEN || '';
export const METRICOOL_USER_ID = env.METRICOOL_USER_ID || '';
export const METRICOOL_MODO = env.METRICOOL_MODO === 'simulado' || (!METRICOOL_TOKEN && !ES_PRODUCCION) ? 'simulado'
  : METRICOOL_TOKEN && METRICOOL_USER_ID ? 'api' : 'apagado';
export const ZONA_HORARIA = env.ZONA_HORARIA || 'America/Santiago';

/* Claude (textos del análisis y lectura del PDF de Brandwatch). La clave es la misma que usa Monkey System.
   Sin clave, la redacción con IA queda apagada y los textos se escriben a mano. IA_MODO=simulado es solo para las pruebas. */
export const IA_MODO = env.IA_MODO === 'simulado' ? 'simulado' : env.ANTHROPIC_API_KEY ? 'api' : 'apagado';
export const IA_MODELO = env.IA_MODELO || 'claude-opus-5-5';
