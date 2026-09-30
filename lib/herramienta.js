/* herramienta.json: el contrato para vincular la herramienta a la entrada de Monkey System.
   Al pasar a operativo, Media Labs copia lo que devuelve comoCodigo() en lib/sistema.js de monkey-system
   (`npm run entrada` lo imprime). Los campos de la entrada están explicados al principio de ese archivo. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

export const LABS = { media: 'MediaLabs', digital: 'DigitalLabs', project: 'ProjectLabs', creative: 'CreativeLabs' };
export const VER = { todos: 'Todo el equipo', jefes: 'Administradores y jefes de proyecto', bruno: 'Solo Bruno' };
// borrador: en desarrollo en la cuenta del director · entregada: invitó a brunopero-sudo y avisó · operativo: publicada por Bruno
export const ESTADOS = ['borrador', 'entregada', 'operativo'];

export const leer = (archivo = path.join(ROOT, 'herramienta.json')) => JSON.parse(fs.readFileSync(archivo, 'utf8'));

/** Lo que hay que corregir en herramienta.json (lista vacía = está bien). */
export function validar(h = {}) {
  const p = [], u = h.urls || {};
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(h.id || '')) p.push('id: minúsculas, números y guiones (por ejemplo «lista-tareas»).');
  if (!h.nombre || h.nombre.length > 40) p.push('nombre: obligatorio, máximo 40 caracteres.');
  if (!LABS[h.lab]) p.push(`lab: uno de ${Object.keys(LABS).join(', ')}.`);
  if (!h.descripcion || h.descripcion.length > 70) p.push('descripcion: obligatoria, máximo 70 caracteres (es la línea chica bajo el nombre, en la entrada).');
  if (!VER[h.ver]) p.push('ver: todos, jefes o bruno.');
  if (!ESTADOS.includes(h.estado)) p.push('estado: borrador, entregada u operativo.');
  if (!(Number.isInteger(h.puerto) && h.puerto > 5000 && h.puerto < 5900)) p.push('puerto: entre 5001 y 5899 (el 5000 lo usa el Mac y del 5900 al 5999 corren las pruebas automáticas).');
  if (h.responsable && !/^[^@\s]+@monkeylabs\.cl$/.test(h.responsable)) p.push('responsable: un correo @monkeylabs.cl.');
  for (const k of ['pruebas', 'produccion']) if (u[k] && !/^https:\/\/[^\s]+$/.test(u[k])) p.push(`urls.${k}: tiene que empezar con https://.`);
  if (h.repo && !/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+$/.test(h.repo)) p.push('repo: la dirección del repo en GitHub (https://github.com/<usuario>/<herramienta>).');
  if (h.estado === 'entregada' && !h.repo) p.push('repo: falta la dirección de tu repo, para que Bruno la revise.');
  if (h.estado === 'operativo' && !u.produccion) p.push('urls.produccion: falta la dirección de producción.');
  if (!Array.isArray(h.variables)) p.push('variables: una lista (puede ir vacía).');
  else h.variables.forEach((v, i) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(v?.nombre || '')) p.push(`variables[${i}].nombre: en MAYÚSCULAS_CON_GUION_BAJO.`);
    if (v && 'valor' in v) p.push(`variables[${i}]: sin valores aquí; los pone Bruno directo en Railway.`);
  });
  return p;
}

/** La entrada de lib/sistema.js (monkey-system) que corresponde a esta herramienta. `icono` queda reservado: hoy la entrada muestra un punto. */
export function entradaSistema(h) {
  const e = { id: h.id, nombre: h.nombre, desc: h.descripcion, url: h.urls?.produccion || '(falta urls.produccion)', externo: true, nuevo: true };
  if (h.ver && h.ver !== 'todos') e.ver = h.ver;
  return e;
}

/** El mismo objeto, listo para pegar en lib/sistema.js. */
export function comoCodigo(h) {
  const v = x => typeof x === 'string' ? `'${x.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'` : String(x);
  const e = entradaSistema(h);
  return `// monkey-system · lib/sistema.js · Lab «${LABS[h.lab] || h.lab}» (id: '${h.lab}') → herramientas:\n{ ${Object.entries(e).map(([k, x]) => `${k}: ${v(x)}`).join(', ')} }`;
}
