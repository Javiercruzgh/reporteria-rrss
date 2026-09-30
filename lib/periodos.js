/* Períodos del reporte. Un reporte cubre un mes (o lo que va del mes) y se compara con el mismo tramo del mes anterior:
   si septiembre va del 1 al 28, agosto también va del 1 al 28. */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dos = n => String(n).padStart(2, '0');
const diasDelMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();   // m de 1 a 12

export const esMes = mes => /^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '');
export const esFecha = f => /^\d{4}-\d{2}-\d{2}$/.test(f || '') && !Number.isNaN(Date.parse(f + 'T00:00:00Z'));
export const nombreMes = mes => MESES[+mes.slice(5, 7) - 1];
export const tituloMes = mes => { const n = nombreMes(mes); return n[0].toUpperCase() + n.slice(1) + ' ' + mes.slice(0, 4); };
export const mesAnterior = mes => { const [a, m] = mes.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${dos(m - 1)}`; };

/** El último día con datos completos de un mes: el fin de mes o, si el mes está en curso, ayer. */
export function hastaPorDefecto(mes, hoy = new Date()) {
  const [a, m] = mes.split('-').map(Number);
  const fin = `${mes}-${dos(diasDelMes(a, m))}`;
  const ayer = new Date(hoy.getTime() - 864e5).toISOString().slice(0, 10);
  return ayer < fin ? ayer : fin;
}

/** Período y comparación. `hasta` tiene que caer dentro del mes. */
export function periodo(mes, hasta = hastaPorDefecto(mes)) {
  if (!esMes(mes)) throw Object.assign(new Error('El mes tiene que ser como 2026-09.'), { code: 400 });
  if (!esFecha(hasta) || hasta.slice(0, 7) !== mes) throw Object.assign(new Error('La fecha de corte tiene que estar dentro del mes del reporte.'), { code: 400 });
  const dia = +hasta.slice(8, 10);
  const ant = mesAnterior(mes), [a, m] = ant.split('-').map(Number);
  const diaAnt = Math.min(dia, diasDelMes(a, m));
  const completo = dia === diasDelMes(+mes.slice(0, 4), +mes.slice(5, 7));
  return {
    mes, desde: `${mes}-01`, hasta, completo,
    anterior: { mes: ant, desde: `${ant}-01`, hasta: completo ? `${ant}-${dos(diasDelMes(a, m))}` : `${ant}-${dos(diaAnt)}` }
  };
}

/** «1 al 28 de septiembre de 2026». */
export function textoPeriodo(desde, hasta) {
  const mes = hasta.slice(0, 7);
  return `${+desde.slice(8, 10)} al ${+hasta.slice(8, 10)} de ${nombreMes(mes)} de ${mes.slice(0, 4)}`;
}
