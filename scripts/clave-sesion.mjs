/* Pone una SESSION_SECRET nueva en Railway sin mostrarla nunca. Lo ejecuta Bruno (usa su sesión del CLI de Railway).
     node scripts/clave-sesion.mjs --proyecto <id> --ambiente pruebas --servicio <nombre>            → ensayo: revisa el CLI y no cambia nada
     node scripts/clave-sesion.mjs --proyecto <id> --ambiente pruebas --servicio <nombre> --cambiar  → la crea, la manda y Railway publica

   La clave se genera en memoria y viaja a Railway por la entrada estándar (no queda en los argumentos del proceso).
   En pantalla solo aparece su huella de 8 caracteres. Pruebas y producción llevan claves distintas.
   Al cambiarla, todos tienen que volver a entrar con Google. Es el mismo mecanismo de grillas/scripts/rotar-claves.mjs. */
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : ''; };
const proyecto = arg('proyecto'), ambiente = arg('ambiente'), servicio = arg('servicio'), cambiar = process.argv.includes('--cambiar');
function alto(m) { console.error('\n✗ ' + m + '\n'); process.exit(1); }
if (!proyecto || !ambiente || !servicio) alto('Uso: node scripts/clave-sesion.mjs --proyecto <id> --ambiente <pruebas|production> --servicio <nombre> [--cambiar]');

function railway(args, entrada = '') {
  return new Promise((res, rej) => {
    const p = spawn('npx', ['-y', '@railway/cli', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', c => c === 0 ? res(out) : rej(new Error(`railway ${args.slice(0, 2).join(' ')}: ${err.trim().split('\n').pop()}`)));
    p.stdin.end(entrada);
  });
}
const DONDE = ['-p', proyecto, '-e', ambiente, '-s', servicio];

try {
  const ayuda = await railway(['variable', 'set', '--help']);
  const faltan = ['--stdin', '--project', '--environment', '--service'].filter(f => !ayuda.includes(f));
  if (faltan.length) alto('Esta versión del CLI de Railway no acepta: ' + faltan.join(', '));
  console.log(`\n✓ El CLI de Railway acepta el comando. Destino: proyecto ${proyecto}, ambiente «${ambiente}», servicio «${servicio}».`);
  if (!cambiar) { console.log('  Ensayo: no se cambió nada. Para crear la clave, agrega --cambiar.\n'); process.exit(0); }
  const clave = crypto.randomBytes(32).toString('base64url');
  await railway(['variable', 'set', 'SESSION_SECRET', '--stdin', ...DONDE], clave);
  console.log(`✓ SESSION_SECRET nueva en «${ambiente}» (huella ${crypto.createHash('sha256').update(clave).digest('hex').slice(0, 8)}). Railway la publica solo.`);
  console.log('  Si hay cambios en borrador en Railway, hay que aplicarlos. Todos vuelven a entrar con Google.\n');
} catch (e) { alto(e.message); }
