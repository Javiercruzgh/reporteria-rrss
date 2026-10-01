/* Modo presentación: una lámina a pantalla completa, con flechas, espacio o clic para avanzar y Escape para salir. */
export function presentar(cont, desde = 0) {
  const ls = [...cont.querySelectorAll('.lamina')]; if (!ls.length) return;
  let i = Math.max(0, Math.min(desde, ls.length - 1));
  const contador = document.createElement('div'); contador.className = 'contador'; document.body.appendChild(contador);
  const mostrar = () => { ls.forEach((l, k) => l.classList.toggle('actual', k === i)); contador.textContent = `${i + 1} / ${ls.length} · Esc para salir`; };
  const salir = () => {
    document.body.classList.remove('presentando'); ls.forEach(l => l.classList.remove('actual')); contador.remove();
    removeEventListener('keydown', tecla, true); cont.removeEventListener('click', clic);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    ls[i].scrollIntoView({ block: 'center' });
  };
  const tecla = e => {
    if (e.key === 'Escape') { e.preventDefault(); return salir(); }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); i = Math.min(i + 1, ls.length - 1); mostrar(); }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); i = Math.max(i - 1, 0); mostrar(); }
  };
  const clic = e => { if (e.target.closest('a')) return; i = e.clientX < innerWidth / 3 ? Math.max(i - 1, 0) : Math.min(i + 1, ls.length - 1); mostrar(); };
  document.body.classList.add('presentando'); mostrar();
  addEventListener('keydown', tecla, true); cont.addEventListener('click', clic);
  document.documentElement.requestFullscreen?.().catch(() => {});
  document.addEventListener('fullscreenchange', function f() { if (!document.fullscreenElement && document.body.classList.contains('presentando')) salir(); document.removeEventListener('fullscreenchange', f); });
}
