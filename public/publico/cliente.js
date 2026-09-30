/* Link del cliente (/r/<token>): el reporte listo, sin nada interno. Se puede presentar o guardar en PDF. */
import { laminas } from './laminas.js';
import { presentar } from './presentar.js';

const token = location.pathname.split('/').filter(Boolean)[1] || '';
const cont = document.getElementById('laminas');
try {
  const r = await fetch('/api/publico/' + encodeURIComponent(token));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Este reporte no está disponible.');
  const M = j.modelo;
  document.title = `${M.cliente.nombre} · ${M.titulo} · Monkey Labs`;
  document.getElementById('titulo').textContent = M.cliente.nombre;
  document.getElementById('sub').textContent = 'Redes orgánicas · ' + M.titulo;
  cont.innerHTML = laminas(M, { textos: j.textos });
  const p = document.getElementById('presentar'), d = document.getElementById('pdf');
  p.hidden = d.hidden = false;
  p.onclick = () => presentar(cont);
  d.onclick = () => print();
} catch (e) {
  cont.innerHTML = `<div class="vacio"><b>No se pudo abrir el reporte</b>${String(e.message).replace(/</g, '&lt;')}</div>`;
}
