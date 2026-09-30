/* Acceso: login con Google, solo correos del dominio del equipo. Sesión en cookie firmada (mh_s).
   Es el mismo login de Monkey System (Google Identity Services → tokeninfo → cookie firmada). */
import crypto from 'node:crypto';
import { AUTH, GOOGLE_CLIENT_ID, DOMINIO, ADMINS, SESSION_SECRET, PROD, DEV_USER } from './config.js';

const firma = s => crypto.createHmac('sha256', SESSION_SECRET).update(s).digest('base64url');
export const esAdmin = email => ADMINS.includes(String(email || '').toLowerCase());
export const delEquipo = email => String(email || '').toLowerCase().endsWith('@' + DOMINIO);

export function cookies(req) {
  const o = {};
  (req.headers.cookie || '').split(/;\s*/).forEach(c => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i)] = decodeURIComponent(c.slice(i + 1)); });
  return o;
}
export function cookie(nombre, valor, dias) {
  return `${nombre}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.round(dias * 86400)}${PROD ? '; Secure' : ''}`;
}
const conRol = u => u && { ...u, admin: esAdmin(u.email) };

/** Usuario de la sesión o null. Sin GOOGLE_CLIENT_ID (uso local) entra como DEV_USER. */
export function sesion(req) {
  if (!AUTH) return conRol({ email: DEV_USER, nombre: DEV_USER.split('@')[0] + ' (local)' });
  const v = cookies(req).mh_s; if (!v) return null;
  const [datos, f] = v.split('.'); if (!datos || !f) return null;
  const a = Buffer.from(firma(datos)), b = Buffer.from(f);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const u = JSON.parse(Buffer.from(datos, 'base64url').toString());
    return u.x > Date.now() && delEquipo(u.email) ? conRol({ email: u.email, nombre: u.nombre }) : null;
  } catch { return null; }
}

export async function verificarGoogle(credencial) {
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credencial));
  const t = await r.json().catch(() => ({}));
  if (!r.ok || t.aud !== GOOGLE_CLIENT_ID || !/accounts\.google\.com$/.test(t.iss || '') || String(t.email_verified) !== 'true') {
    throw Object.assign(new Error('No se pudo verificar la cuenta de Google.'), { code: 401 });
  }
  if (!delEquipo(t.email)) throw Object.assign(new Error(`Solo pueden entrar cuentas @${DOMINIO}.`), { code: 403 });
  return { email: t.email.toLowerCase(), nombre: t.name || t.email };
}

export function cookieSesion(u) {
  const datos = Buffer.from(JSON.stringify({ email: u.email, nombre: u.nombre, x: Date.now() + 30 * 86400000 })).toString('base64url');
  return cookie('mh_s', datos + '.' + firma(datos), 30);
}
export const cookieSalir = () => cookie('mh_s', '', 0);
