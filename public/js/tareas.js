/* Herramienta de ejemplo: Lista de tareas. Es la parte que se reemplaza por la herramienta nueva.
   Pantallas por #hash (Tareas, Papelera, Actividad), con los patrones de Monkey System:
   filtros con chips, búsqueda, tarjetas, selección múltiple con barra pegajosa, diálogo para crear y editar,
   confirmación antes de mandar a la papelera y estados de carga, vacío y error. */
import { $, $$, api, esc, toast, fecha, fechaHora, plural, cargando, vacio, fallo, dialogo, confirmar, iniciarBarra, seleccionMultiple } from './ui.js';

const ctx = { yo: null, cfg: null, estados: [] };
const nombreEstado = id => ctx.estados.find(e => e.id === id)?.nombre || id;
const puede = t => !!t && (ctx.yo.admin || t.creadoPor === ctx.yo.email);   // la regla real está en el servidor (lib/tareas.js)
const corto = email => String(email || '').replace(/@monkeylabs\.cl$/, '');

const VISTAS = { tareas: vistaTareas, papelera: vistaPapelera, actividad: vistaActividad };
async function ir() {
  const nombre = location.hash.slice(1).split('?')[0], v = VISTAS[nombre] ? nombre : 'tareas';
  $$('#tabs a[data-v]').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  const cont = document.createElement('div');
  $('#vista').replaceChildren(cont);
  try { await VISTAS[v](cont); } catch (e) { cont.innerHTML = fallo(e, false); }
}

/* ---------- Tareas ---------- */
async function vistaTareas(el) {
  const f = { q: '', estado: '' };
  let lista = [], conteo = {}, trabajando = '';
  el.innerHTML = `
    <div class="cabeza"><div><span class="label pk">ProjectLabs · herramienta de ejemplo</span><h1>Lista de <em>tareas</em></h1></div>
      <div class="acciones"><button class="btn pk" id="nueva">+ Nueva tarea</button></div></div>
    <div class="filtros">
      <div class="fila"><span class="label">Estado</span><div class="chips" id="chips"></div></div>
      <div class="fila"><span class="label">Buscar</span><label class="buscar" style="flex:1"><input id="q" type="search" placeholder="Título, detalle o responsable" aria-label="Buscar tareas"></label></div>
    </div>
    <div id="sel"></div>
    <div class="grilla" id="grilla">${cargando('Cargando tareas…')}</div>`;
  const grilla = $('#grilla', el);
  const sel = seleccionMultiple({ contenedor: grilla, ids: () => lista.map(t => t.id), alCambiar: barraSel, alAbrir: id => editar(lista.find(t => t.id === id)) });

  async function cargar() {
    try {
      const r = await api('/api/tareas?' + new URLSearchParams(f));
      lista = r.tareas; conteo = r.conteo; ctx.estados = r.estados;
      pintar(); sel.ajustar(lista.map(t => t.id));
    } catch (e) { grilla.innerHTML = fallo(e); $('[data-reintentar]', grilla)?.addEventListener('click', cargar); }
  }
  function chips() {
    $('#chips', el).innerHTML = [{ id: '', nombre: 'Todas', n: conteo.total || 0 }, ...ctx.estados.map(e => ({ ...e, n: conteo[e.id] || 0 }))]
      .map(e => `<button class="chip ${f.estado === e.id ? 'on' : ''}" data-estado="${e.id}" aria-pressed="${f.estado === e.id}">${esc(e.nombre)} <small>${e.n}</small></button>`).join('');
    $$('[data-estado]', el).forEach(b => b.onclick = () => { f.estado = b.dataset.estado; cargar(); });
  }
  const hoy = new Date().toISOString().slice(0, 10);
  const tarjeta = t => `<article class="card" data-id="${esc(t.id)}" tabindex="0" aria-label="${esc(t.titulo)}">
      <button class="sel" data-sel aria-label="Elegir «${esc(t.titulo)}»" title="Elegir (con Shift eliges un rango)"></button>
      <span><span class="etq estado ${esc(t.estado)}">${esc(nombreEstado(t.estado))}</span></span>
      <b>${esc(t.titulo)}</b>${t.detalle ? `<p>${esc(t.detalle)}</p>` : ''}
      <div class="meta"><span>${t.responsable ? esc(corto(t.responsable)) : 'Sin responsable'}</span>${t.vence ? `<span class="${t.vence < hoy && t.estado !== 'lista' ? 'tarde' : ''}">Vence ${esc(fecha(t.vence))}</span>` : ''}</div>
    </article>`;
  function pintar() {
    chips();
    grilla.innerHTML = lista.length ? lista.map(tarjeta).join('')
      : f.q || f.estado ? vacio('No hay tareas con ese filtro', 'Prueba quitando la búsqueda o eligiendo «Todas».')
      : vacio('Todavía no hay tareas', 'Crea la primera para empezar.', '<button class="btn pk" data-nueva>+ Nueva tarea</button>');
    $('[data-nueva]', grilla)?.addEventListener('click', () => editar());
    sel.marcar();
  }

  // barra de acciones en grupo (aparece cuando hay algo elegido)
  function barraSel(ids = sel.elegidas()) {
    if (!ids.length) { $('#sel', el).innerHTML = ''; return; }
    const propias = ids.filter(id => puede(lista.find(t => t.id === id))).length;
    $('#sel', el).innerHTML = `<div class="accion-sel ${trabajando ? 'ocupada' : ''}">
      <span class="cuenta">${plural(ids.length, 'tarea elegida', 'tareas elegidas')}<small>${propias < ids.length ? `${propias} las puedes mandar a la papelera` : 'Shift elige un rango · Esc quita'}</small></span>
      <div class="acc">${ctx.estados.map(e => `<button class="btn sm" data-a="estado" data-estado="${e.id}">${esc(e.nombre)}</button>`).join('')}
        <button class="btn sm peligro" data-a="papelera">Mandar a la papelera</button></div>
      <div class="acc2">${ids.length < lista.length ? `<button class="mas" data-a="todas">Elegir las ${lista.length}</button>` : ''}<button class="mas" data-a="nada">Quitar selección</button></div>
      ${trabajando ? `<div class="trabajando"><div class="giro"></div>${esc(trabajando)}</div>` : ''}</div>`;
    $$('#sel [data-a]', el).forEach(b => b.onclick = () => ACCIONES[b.dataset.a](sel.elegidas(), b.dataset));
  }
  async function enGrupo(texto, fn) {
    trabajando = texto; barraSel();
    try { await fn(); } catch (e) { toast(e.message, true); } finally { trabajando = ''; barraSel(); }
  }
  const ACCIONES = {
    todas: () => sel.todas(),
    nada: () => sel.limpiar(),
    estado: (ids, { estado }) => enGrupo(`Cambiando ${plural(ids.length, 'tarea', 'tareas')}…`, async () => {
      const r = await api('/api/tareas/lote', { method: 'POST', body: { ids, accion: 'estado', estado } });
      toast(`${plural(r.hechas.length, 'tarea quedó', 'tareas quedaron')} en «${nombreEstado(estado)}».`);
      await cargar();
    }),
    async papelera(ids) {
      const no = ids.filter(id => !puede(lista.find(t => t.id === id))).length;
      const ok = await confirmar({ titulo: `¿Mandar ${plural(ids.length - no, 'tarea', 'tareas')} a la papelera?`, peligro: true, boton: 'Mandar a la papelera',
        texto: `Salen de la lista y quedan en la Papelera, desde donde se pueden restaurar.${no ? ` <b>${plural(no, 'de las elegidas no se mueve', 'de las elegidas no se mueven')}</b>: son de otra persona.` : ''}` });
      if (!ok) return;
      await enGrupo('Mandando a la papelera…', async () => {
        const r = await api('/api/tareas/lote', { method: 'POST', body: { ids, accion: 'papelera' } });
        toast(`${plural(r.hechas.length, 'tarea', 'tareas')} en la papelera${r.omitidas.length ? ` · ${r.omitidas.length} quedaron en la lista` : ''}.`);
        await cargar();
      });
    }
  };

  // crear y editar (el mismo diálogo)
  async function editar(t) {
    const r = await dialogo(`<form class="form" novalidate>
        <h2>${t ? 'Editar tarea' : 'Nueva tarea'}</h2>
        <label class="campo">Título<input name="titulo" required maxlength="120" value="${esc(t?.titulo)}" autofocus></label>
        <label class="campo">Detalle <small>Opcional</small><textarea name="detalle" maxlength="2000">${esc(t?.detalle)}</textarea></label>
        <div class="dos">
          <label class="campo">Responsable<input name="responsable" type="email" placeholder="nombre@monkeylabs.cl" value="${esc(t?.responsable)}"></label>
          <label class="campo">Fecha límite<input name="vence" type="date" value="${esc(t?.vence)}"></label>
        </div>
        <label class="campo">Estado<select name="estado">${ctx.estados.map(e => `<option value="${e.id}" ${(t?.estado || 'pendiente') === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></label>
        ${t ? `<p class="nota">Creada por ${esc(corto(t.creadoPor))} el ${esc(fechaHora(t.creadoEn))}${t.editadoPor ? ` · editada por ${esc(corto(t.editadoPor))} el ${esc(fechaHora(t.editadoEn))}` : ''}.</p>` : ''}
        <p class="aviso crit" data-error hidden></p>
        <div class="fin">${puede(t) ? '<button type="button" class="btn peligro izq" data-papelera>Mandar a la papelera</button>' : ''}
          <button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn pk">${t ? 'Guardar cambios' : 'Crear tarea'}</button></div>
      </form>`, {
      alEnviar: datos => t ? api('/api/tareas/' + t.id, { method: 'PATCH', body: datos }) : api('/api/tareas', { method: 'POST', body: datos }),
      alAbrir: (d, cerrar) => $('[data-papelera]', d)?.addEventListener('click', async () => {
        if (!await confirmar({ titulo: '¿Mandar esta tarea a la papelera?', texto: `«${esc(t.titulo)}» sale de la lista y se puede restaurar desde la Papelera.`, boton: 'Mandar a la papelera', peligro: true })) return;
        try { await api('/api/tareas/' + t.id, { method: 'DELETE' }); cerrar({ papelera: true }); } catch (e) { toast(e.message, true); }
      })
    });
    if (!r) return;
    toast(r.papelera ? 'Tarea en la papelera.' : t ? 'Cambios guardados.' : 'Tarea creada.');
    await cargar();
  }

  let espera; $('#q', el).addEventListener('input', e => { clearTimeout(espera); espera = setTimeout(() => { f.q = e.target.value.trim(); cargar(); }, 250); });
  $('#nueva', el).onclick = () => editar();
  await cargar();
}

/* ---------- Papelera ---------- */
async function vistaPapelera(el) {
  el.innerHTML = `<div class="cabeza"><div><span class="label pk">Lista de tareas</span><h1>Papelera</h1></div></div>
    <p class="aviso">Lo que está aquí no se borra solo y se puede restaurar. Si hay que borrar algo del todo, se le pide a Bruno.</p>
    <div id="caja">${cargando()}</div>`;
  const caja = $('#caja', el);
  async function cargar() {
    try {
      const { tareas, estados } = await api('/api/tareas?papelera=1'); ctx.estados = estados;
      caja.innerHTML = !tareas.length ? vacio('La papelera está vacía', 'Aquí llega lo que se manda a la papelera desde la lista.')
        : `<div class="bloque"><div class="tabla-caja"><table class="tabla"><thead><tr><th>Tarea</th><th>Estado</th><th>La mandó</th><th>Cuándo</th><th></th></tr></thead><tbody>
          ${tareas.map(t => `<tr><td><b>${esc(t.titulo)}</b>${t.responsable ? `<br><small>${esc(corto(t.responsable))}</small>` : ''}</td>
            <td><span class="etq estado ${esc(t.estado)}">${esc(nombreEstado(t.estado))}</span></td><td>${esc(corto(t.papeleraPor))}</td><td><small>${esc(fechaHora(t.papeleraEn))}</small></td>
            <td>${puede(t) || t.papeleraPor === ctx.yo.email ? `<button class="btn sm" data-restaurar="${esc(t.id)}">Restaurar</button>` : ''}</td></tr>`).join('')}
          </tbody></table></div></div>`;
      $$('[data-restaurar]', caja).forEach(b => b.onclick = async () => {
        b.disabled = true;
        try { await api(`/api/tareas/${b.dataset.restaurar}/restaurar`, { method: 'POST' }); toast('Tarea restaurada: volvió a la lista.'); cargar(); } catch (e) { toast(e.message, true); b.disabled = false; }
      });
    } catch (e) { caja.innerHTML = fallo(e); $('[data-reintentar]', caja)?.addEventListener('click', cargar); }
  }
  await cargar();
}

/* ---------- Actividad (solo administradores) ---------- */
const QUE = { crear: 'Creó una tarea', editar: 'Editó una tarea', papelera: 'Mandó a la papelera', restaurar: 'Restauró una tarea', lote: 'Cambió en grupo' };
function detalle(r) {
  const d = r.detalle || {};
  if (r.accion === 'lote') return `${d.accion === 'estado' ? `a «${nombreEstado(d.estado)}»` : 'a la papelera'} · ${plural(d.n || 0, 'tarea', 'tareas')}${d.omitidas ? ` · ${d.omitidas} sin cambiar` : ''}`;
  if (r.accion === 'editar') return `${d.titulo || ''} · ${(d.cambios || []).join(', ')}`;
  return d.titulo || '';
}
async function vistaActividad(el) {
  if (!ctx.yo.admin) { el.innerHTML = vacio('Solo administradores', 'La actividad la ven Bruno y Emilio.'); return; }
  el.innerHTML = `<div class="cabeza"><div><span class="label pk">Lista de tareas · solo administradores</span><h1>Actividad</h1></div></div><div id="caja">${cargando()}</div>`;
  const filas = (await api('/api/actividad')).filter(r => r.accion !== 'login');
  $('#caja', el).innerHTML = !filas.length ? vacio('Todavía no hay actividad')
    : `<div class="bloque"><p>Quién creó, editó, cambió o mandó a la papelera. Las últimas 200 acciones, sin los ingresos.</p><div class="tabla-caja"><table class="tabla"><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Detalle</th></tr></thead><tbody>
      ${filas.map(r => `<tr><td><small>${esc(fechaHora(r.cuando))}</small></td><td>${esc(corto(r.quien))}</td><td>${esc(QUE[r.accion] || r.accion)}</td><td><small>${esc(detalle(r))}</small></td></tr>`).join('')}
      </tbody></table></div></div>`;
}

/* ---------- inicio ---------- */
iniciarBarra().then(({ cfg, yo }) => { Object.assign(ctx, { cfg, yo }); addEventListener('hashchange', ir); ir(); })
  .catch(e => { $('#vista').innerHTML = fallo(e, false); });
