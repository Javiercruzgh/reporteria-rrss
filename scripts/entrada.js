/* npm run entrada: revisa herramienta.json y muestra cómo queda la herramienta en la entrada de Monkey System. */
import { leer, validar, comoCodigo, LABS, VER } from '../lib/herramienta.js';

const h = leer(), problemas = validar(h);
console.log(`\n${h.nombre || '(sin nombre)'} · ${LABS[h.lab] || h.lab} · la ven: ${VER[h.ver] || h.ver} · estado: ${h.estado}${h.repo ? ' · ' + h.repo : ''}\n`);
if (problemas.length) { console.log('Hay que corregir herramienta.json:'); problemas.forEach(p => console.log('  - ' + p)); process.exitCode = 1; }
else console.log('herramienta.json está bien.');

console.log('\nAl pasar a operativo, Media Labs agrega esto en la entrada de Monkey System:\n');
console.log(comoCodigo(h));

const vars = h.variables || [];
if (vars.length) {
  console.log('\nVariables que Bruno pone en Railway (los valores nunca van en el código ni en el chat):');
  vars.forEach(v => console.log(`  - ${v.nombre}${v.secreto ? ' (secreto)' : ''}: ${v.para || ''}`));
}
console.log('');
