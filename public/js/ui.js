/* Utilidades de interfaz para cualquier herramienta de Monkey System. Se usan igual en la herramienta y en /kit.html. */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
/** Escapa texto antes de meterlo en HTML. Todo lo que viene del usuario o del servidor pasa por aquí. */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Llama a la API. Si la sesión venció, lleva al login; si algo falla, lanza el mensaje del servidor (en español). */
export async function api(ruta, { method = 'GET', body } = {}) {
  const r = await fetch(ruta, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.hash); throw new Error('Tu sesión expiró.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Algo falló (${r.status}).`);
  return j;
}

let tt;
/** Aviso breve abajo al centro. Con err=true queda en rojo y dura más. */
export function toast(msg, err = false) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; t.setAttribute('role', err ? 'alert' : 'status');
  document.body.appendChild(t); clearTimeout(tt); tt = setTimeout(() => t.remove(), err ? 6000 : 3200);
}

export const fecha = iso => iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* ---------- estados de una zona de la pantalla ---------- */
export const cargando = (texto = 'Cargando…') => `<div class="cargando"><div class="giro"></div>${esc(texto)}</div>`;
export const vacio = (titulo, texto = '', boton = '') => `<div class="vacio"><b>${esc(titulo)}</b>${esc(texto)}${boton ? `<br>${boton}` : ''}</div>`;
export const fallo = (e, reintentar = true) => `<div class="vacio error"><b>No se pudo cargar</b>${esc(e?.message || e)}${reintentar ? '<br><button class="btn" data-reintentar>Reintentar</button>' : ''}</div>`;

/** Diálogo. Devuelve una promesa con los datos del formulario (o null si se cancela).
    Con `alEnviar(datos)`, el diálogo espera esa función: si falla, muestra el error en [data-error] y queda abierto.
    Escape se escucha en `window` en fase de captura (antes que cualquier otro atajo) y se detiene ahí:
    cierra solo el diálogo de más arriba y no llega a otros atajos (por ejemplo, quitar la selección). */
export function dialogo(html, { alAbrir, alEnviar } = {}) {
  return new Promise(ok => {
    const antes = document.activeElement;
    const d = document.createElement('div'); d.className = 'dialogo';
    d.innerHTML = `<div class="caja" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(d);
    const cerrar = v => { d.remove(); removeEventListener('keydown', tecla, true); antes?.focus?.(); ok(v); };
    const tecla = e => { if (e.key === 'Escape' && d === $$('.dialogo').at(-1)) { e.stopPropagation(); e.preventDefault(); cerrar(null); } };
    addEventListener('keydown', tecla, true);
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-cancelar]')) cerrar(null); });
    // campos repetidos (varias casillas con el mismo nombre) llegan como lista
    d.querySelector('form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const o = {}; for (const [k, v] of new FormData(e.target)) o[k] = k in o ? [].concat(o[k], v) : v;
      if (!alEnviar) return cerrar(o);
      const caja = d.querySelector('[data-error]'), btn = e.submitter;
      if (btn) btn.disabled = true; if (caja) caja.hidden = true;
      try { cerrar((await alEnviar(o, d)) ?? o); }
      catch (x) { if (caja) { caja.textContent = x.message; caja.hidden = false; } else toast(x.message, true); }
      finally { if (btn) btn.disabled = false; }
    });
    alAbrir?.(d, cerrar);
    d.querySelector('[autofocus],input,select,textarea,button')?.focus();
  });
}

/** Confirmación antes de algo delicado (mandar a la papelera, cambiar muchas cosas). Dice qué pasa y si se puede deshacer. */
export async function confirmar({ titulo, texto = '', boton = 'Confirmar', peligro = false }) {
  const r = await dialogo(`<form class="form"><h2>${esc(titulo)}</h2>${texto ? `<p class="nota">${texto}</p>` : ''}
    <div class="fin"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn ${peligro ? 'peligro lleno' : 'pk'}" name="ok" value="1">${esc(boton)}</button></div></form>`);
  return !!r;
}

/** Barra superior: link de vuelta a Monkey System y quién entró. */
export async function iniciarBarra() {
  const [cfg, yo] = await Promise.all([api('/api/config'), api('/api/yo')]);
  $$('[data-monkey-system]').forEach(a => a.href = cfg.monkeySystem);
  const y = $('#yo'); if (y) y.innerHTML = `${esc(yo.email)}${yo.admin ? ' · <b>admin</b>' : ''}`;
  $$('[data-solo-admin]').forEach(e => e.hidden = !yo.admin);
  $$('[data-fuera-de-produccion]').forEach(e => e.hidden = cfg.modo === 'produccion');
  return { cfg, yo };
}

/** Selección múltiple sobre una lista de tarjetas (cada una con data-id y un botón [data-sel]).
    Clic en la casilla elige; con algo elegido, clic en la tarjeta también; Shift elige un rango; Escape quita todo. */
export function seleccionMultiple({ contenedor, ids, alCambiar, alAbrir }) {
  const elegidas = new Set(); let ultimo = -1;
  const marcar = () => {
    contenedor.classList.toggle('seleccionando', elegidas.size > 0);
    $$('[data-id]', contenedor).forEach(c => c.classList.toggle('elegida', elegidas.has(c.dataset.id)));
    alCambiar?.([...elegidas]);
  };
  contenedor.addEventListener('click', e => {
    const card = e.target.closest('[data-id]'); if (!card || !contenedor.contains(card)) return;
    const lista = ids(), i = lista.indexOf(card.dataset.id);
    if (e.shiftKey && ultimo >= 0 && (elegidas.size || e.target.closest('[data-sel]'))) {
      for (let k = Math.min(ultimo, i); k <= Math.max(ultimo, i); k++) elegidas.add(lista[k]);
      ultimo = i; return marcar();
    }
    if (e.target.closest('[data-sel]') || elegidas.size || e.metaKey || e.ctrlKey) {
      elegidas.has(card.dataset.id) ? elegidas.delete(card.dataset.id) : elegidas.add(card.dataset.id);
      ultimo = i; return marcar();
    }
    alAbrir?.(card.dataset.id);
  });
  contenedor.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-id]')) e.target.click(); });
  // en captura, pero después del diálogo: si hay uno abierto, Escape es para cerrarlo
  const tecla = e => {
    if (!contenedor.isConnected) return document.removeEventListener('keydown', tecla, true);
    if (e.key === 'Escape' && elegidas.size && !$('.dialogo')) { elegidas.clear(); ultimo = -1; marcar(); }
  };
  document.addEventListener('keydown', tecla, true);
  return {
    elegidas: () => [...elegidas],
    todas() { ids().forEach(id => elegidas.add(id)); marcar(); },
    limpiar() { elegidas.clear(); ultimo = -1; marcar(); },
    /** Tras recargar la lista: quedan elegidas solo las que siguen ahí. */
    ajustar(solo) { for (const id of [...elegidas]) if (!solo.includes(id)) elegidas.delete(id); marcar(); },
    marcar
  };
}
