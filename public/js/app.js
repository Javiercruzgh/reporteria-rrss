/* Reportería RRSS · constructor para el equipo. Pantallas por #hash:
   #reportes?mes=AAAA-MM (grilla de clientes del mes), #reporte/<id> (constructor), #clientes, #papelera y #actividad.
   El constructor muestra las láminas tal como las verá el cliente (public/publico/laminas.js); los textos se editan con un clic. */
import { $, $$, api, esc, toast, fechaHora, plural, cargando, vacio, fallo, dialogo, confirmar, iniciarBarra } from './ui.js';
import { laminas, formatear as formatearLocal } from '/publico/laminas.js';
import { presentar } from '/publico/presentar.js';

const ctx = { yo: null, cfg: null };
const corto = email => String(email || '').replace(/@monkeylabs\.cl$/, '');
const REDES = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const tituloMes = m => { const n = MESES[+m.slice(5) - 1]; return n[0].toUpperCase() + n.slice(1) + ' ' + m.slice(0, 4); };
const moverMes = (m, d) => { const f = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1 + d, 1)); return f.toISOString().slice(0, 7); };
// por defecto, el mes pasado hasta el día 5; después, el mes en curso
const mesPorDefecto = () => { const h = new Date(); return moverMes(h.toISOString().slice(0, 7), h.getDate() <= 5 ? -1 : 0); };
const ESTADO = { borrador: 'Borrador', listo: 'Listo para el cliente' };
const ORIGEN = { metricool: 'Metricool', simulado: 'datos inventados', importado: 'importados', conector: 'conector de Metricool' };

const VISTAS = { reportes: vistaMes, reporte: vistaReporte, clientes: vistaClientes, papelera: vistaPapelera, actividad: vistaActividad };
let salir = null;   // limpieza de la vista anterior (por ejemplo, guardar un texto a medio escribir)
async function ir() {
  const [nombre, arg] = location.hash.slice(1).split('?')[0].split('/');
  const v = VISTAS[nombre] ? nombre : 'reportes';
  await salir?.(); salir = null;
  $$('#tabs a[data-v]').forEach(a => a.classList.toggle('on', a.dataset.v === (v === 'reporte' ? 'reportes' : v)));
  const cont = document.createElement('div');
  $('#vista').replaceChildren(cont);
  try { await VISTAS[v](cont, arg); } catch (e) { cont.innerHTML = fallo(e, false); }
}
const param = k => new URLSearchParams(location.hash.split('?')[1] || '').get(k);

/* ============================================================ grilla del mes */
async function vistaMes(el) {
  let mes = /^\d{4}-\d{2}$/.test(param('mes') || '') ? param('mes') : mesPorDefecto();
  el.innerHTML = `
    <div class="cabeza"><div><span class="label pk">DigitalLabs · reportes mensuales</span><h1>Reportería <em>RRSS</em></h1></div>
      <div class="acciones mes-sel"><button class="btn sm" data-m="-1" aria-label="Mes anterior">←</button><b id="mes"></b><button class="btn sm" data-m="1" aria-label="Mes siguiente">→</button>
        <button class="btn pk" id="nuevo">+ Nuevo reporte</button></div></div>
    <div id="avisos"></div>
    <div class="grilla" id="grilla">${cargando('Cargando clientes…')}</div>`;
  const grilla = $('#grilla', el);
  let clientes = [];
  $('#nuevo', el).onclick = async () => {
    const libres = clientes.filter(c => !c.reporte);
    const r = await dialogo(`<form class="form"><h2>Nuevo reporte · ${esc(tituloMes(mes))}</h2>
      ${libres.length ? `<label class="campo">¿Para qué cliente?<select name="cliente" required autofocus>${libres.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}</select></label>` : '<p class="nota">Todos los clientes ya tienen su reporte de este mes.</p>'}
      <p class="nota">¿La marca no está? Agrégala desde la lista de Metricool en <a class="enlace" href="#clientes?nuevo=1">Clientes → Nuevo cliente</a>.</p>
      <p class="aviso crit" data-error hidden></p>
      <div class="fin"><button type="button" class="btn" data-cancelar>Cancelar</button>${libres.length ? '<button class="btn pk">Crear reporte</button>' : ''}</div></form>`,
      { alEnviar: f => api('/api/reportes', { method: 'POST', body: { cliente: f.cliente, mes } }) });
    if (r?.id) location.hash = 'reporte/' + r.id;
  };
  $$('[data-m]', el).forEach(b => b.onclick = () => { mes = moverMes(mes, +b.dataset.m); history.replaceState(null, '', '#reportes?mes=' + mes); cargar(); });
  api('/api/estado').then(s => { $('#avisos', el).innerHTML = [s.metricool.aviso, s.ia.aviso].filter(Boolean).map(a => `<p class="aviso warn">${esc(a)}</p>`).join(''); }).catch(() => {});

  async function cargar() {
    $('#mes', el).textContent = tituloMes(mes);
    try {
      ({ clientes } = await api('/api/reportes?mes=' + mes));
      let vistos = {}; try { vistos = JSON.parse(localStorage.getItem('rr-visto') || '{}'); } catch {}
      grilla.innerHTML = clientes.length ? clientes.map(c => {
        const r = c.reporte, marcas = c.config.marcas.filter(m => m.activa !== false);
        const nuevo = r && r.editadoPor !== ctx.yo.email && (!vistos[r.id] || r.editadoEn > vistos[r.id]);
        return `<article class="card cli" ${r ? `data-abrir="${esc(r.id)}" tabindex="0"` : ''}>
          <span>${r ? `<span class="etq estado ${esc(r.estado)}">${esc(ESTADO[r.estado])}</span>` : '<span class="etq estado sin">Sin crear</span>'}${nuevo ? ` <span class="etq cambio" title="Cambió desde tu última visita">● Cambios de ${esc(corto(r.editadoPor))}</span>` : ''}</span>
          <b>${esc(c.nombre)}</b>
          <p>${marcas.length > 1 ? esc(plural(marcas.length, 'marca', 'marcas')) + ' · ' : ''}${esc([...new Set(marcas.flatMap(m => m.redes))].map(x => REDES[x]).join(', '))}${c.config.escucha ? ' · social listening' : ''}</p>
          <div class="meta">${r ? `<span>${r.datosEn ? `Datos del ${esc(fechaHora(r.datosEn))}` : 'Sin datos todavía'}</span><span>${esc(corto(r.editadoPor))}</span>`
            : `<button class="btn sm pk" data-crear="${esc(c.id)}">Crear reporte</button>`}</div>
        </article>`;
      }).join('') : vacio('Todavía no hay clientes', 'Agrega el primero eligiendo sus marcas de Metricool.', '<a class="btn pk" href="#clientes?nuevo=1">+ Nuevo cliente</a>');
      $$('[data-abrir]', grilla).forEach(a => { a.onclick = () => location.hash = 'reporte/' + a.dataset.abrir; a.onkeydown = e => e.key === 'Enter' && a.click(); });
      $$('[data-crear]', grilla).forEach(b => b.onclick = e => { e.stopPropagation(); crear(b); });
    } catch (e) { grilla.innerHTML = fallo(e); $('[data-reintentar]', grilla)?.addEventListener('click', cargar); }
  }
  async function crear(b) {
    b.disabled = true; b.textContent = 'Creando…';
    try {
      const r = await api('/api/reportes', { method: 'POST', body: { cliente: b.dataset.crear, mes } });
      location.hash = 'reporte/' + r.id + '?nuevo=1';
    } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Crear reporte'; }
  }
  await cargar();
}

/* ============================================================ constructor de un reporte */
async function vistaReporte(el, id) {
  let R = null, ocupado = '';
  el.innerHTML = cargando('Abriendo el reporte…');
  const guardando = new Map();   // clave → promesa del guardado en curso

  async function cargar() { R = await api('/api/reportes/' + id); pintar(); }
  function pintar() {
    const M = R.modelo, sinDatos = !R.datosEn;
    el.innerHTML = `
      <div class="editor-cab">
        <a class="volver-mes" href="#reportes?mes=${esc(R.mes)}">← ${esc(tituloMes(R.mes))}</a>
        <div class="ed-tit"><h1>${esc(R.clienteNombre)} <em>${esc(tituloMes(R.mes))}</em></h1>
          <span class="etq estado ${esc(R.estado)}">${esc(ESTADO[R.estado])}</span></div>
        <div class="ed-meta">
          <label>Datos hasta <input type="date" id="hasta" value="${esc(R.hasta)}" min="${esc(R.mes)}-01" max="${esc(R.mes)}-31"></label>
          <span>${R.datosEn ? `Datos de ${esc(ORIGEN[R.datosOrigen] || R.datosOrigen)} · ${esc(fechaHora(R.datosEn))}` : 'Todavía sin datos'}</span>
          <span id="guardado"></span>
        </div>
      </div>
      <div class="herramientas no-imprimir">
        <button class="btn ${sinDatos ? 'pk' : ''}" data-a="datos" title="Trae de Metricool el mes y el mismo tramo del mes anterior">↻ Actualizar datos</button>
        <button class="btn" data-a="proponer" ${sinDatos || R.ia.modo === 'apagado' ? 'disabled' : ''} title="${esc(R.ia.aviso || 'Claude redacta los textos vacíos. Tú los revisas y corriges.')}">✦ Proponer textos</button>
        ${M.secciones.some(x => x.tipo === 'escucha') ? `<button class="btn" data-a="escucha" ${R.ia.modo === 'apagado' ? 'disabled' : ''} title="Sube el PDF mensual de Brandwatch; Claude lo lee y arma las láminas">⇪ Subir Brandwatch</button>` : ''}
        <button class="btn" data-a="presentar" ${sinDatos ? 'disabled' : ''}>▶ Presentar</button>
        <span class="sep"></span>
        ${R.estado === 'listo'
          ? `<button class="btn pk" data-a="link">Copiar link del cliente</button><button class="btn" data-a="borrador">Volver a borrador</button>`
          : `<button class="btn pk" data-a="listo" ${sinDatos ? 'disabled' : ''}>Marcar listo</button>`}
        <details class="mas"><summary class="btn">Más</summary><div class="menu">
          <button data-a="proponerTodo" ${sinDatos || R.ia.modo === 'apagado' ? 'disabled' : ''}>Reescribir todos los textos con IA</button>
          <button data-a="historial">Historial de cambios</button>
          <button data-a="importar">Importar datos (JSON)</button>
          <button data-a="restablecer" ${M.seccionesPropias ? '' : 'disabled'}>Volver a la propuesta de láminas</button>
          <button data-a="pdf" ${sinDatos ? 'disabled' : ''}>Guardar en PDF</button>
          <button data-a="nuevoLink">Cambiar el link del cliente</button>
          <button data-a="papelera" class="rojo">Mandar a la papelera</button>
        </div></details>
      </div>
      ${ocupado ? `<p class="aviso trabajando-a"><span class="giro"></span>${esc(ocupado)}</p>` : ''}
      ${R.metricool.aviso && (R.datosOrigen === 'simulado' || !R.datosEn) ? `<p class="aviso warn">${esc(R.metricool.aviso)}</p>` : ''}
      ${M.simulado ? '<p class="aviso warn">Estos números son inventados (modo de prueba). No compartas este reporte.</p>' : ''}
      ${sinDatos ? vacio('Este reporte todavía no tiene datos', 'Actualiza los datos para traer de Metricool el mes y el mismo tramo del mes anterior.', '<button class="btn pk" data-a="datos">↻ Actualizar datos</button>')
        : `<p class="nota ayuda">Así lo verá el cliente. Haz clic en cualquier texto para escribirlo; se guarda solo. Con las flechas y «+ Agregar lámina» armas el reporte a tu medida. <b>**negrita**</b> y línea en blanco para un párrafo nuevo. ${faltan()}</p>
           <div class="laminas" id="laminas">${laminas(M, { textos: R.textos, editable: true, claves: R.claves, imagen: img => `/api/reportes/${id}/imagen/${img}` })}</div>`}`;
    $$('[data-a]', el).forEach(b => b.onclick = () => { b.closest('details')?.removeAttribute('open'); ACC[b.dataset.a](b); });
    $('#hasta', el).onchange = e => cambiarHasta(e.target);
    const ls = $('#laminas', el); if (ls) { conectarTextos(ls); controlesLaminas(ls); }
  }
  const faltan = () => { const n = R.claves.filter(k => !(R.textos[k.clave] || '').trim()).length; return n ? `Faltan <b>${plural(n, 'texto', 'textos')}</b>.` : 'Todos los textos están escritos.'; };

  async function trabajar(texto, fn) {
    if (ocupado) return toast('Espera a que termine lo anterior.', true);
    await Promise.all(guardando.values());
    ocupado = texto; pintar();
    try { await fn(); } catch (e) { toast(e.message, true); } finally { ocupado = ''; pintar(); }
  }

  const ACC = {
    datos: () => trabajar('Trayendo los datos de Metricool…', async () => { R = await api(`/api/reportes/${id}/datos`, { method: 'POST' }); toast('Datos actualizados.'); }),
    proponer: () => trabajar('Claude está redactando los textos vacíos…', async () => {
      R = await api(`/api/reportes/${id}/proponer`, { method: 'POST', body: {} });
      toast(R.propuestos.length ? `${plural(R.propuestos.length, 'texto propuesto', 'textos propuestos')}. Revísalos antes de marcar listo.` : 'No había textos vacíos.');
    }),
    async proponerTodo() {
      if (!await confirmar({ titulo: '¿Reescribir todos los textos?', texto: 'Claude reemplaza también los textos que ya escribió el equipo. Lo anterior no se guarda aparte.', boton: 'Reescribir todo', peligro: true })) return;
      trabajar('Claude está reescribiendo todos los textos…', async () => { R = await api(`/api/reportes/${id}/proponer`, { method: 'POST', body: { reemplazar: true } }); toast('Textos reescritos. Revísalos.'); });
    },
    escucha() {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/pdf';
      i.onchange = () => { const f = i.files[0]; if (!f) return;
        if (f.size > 25e6) return toast('El PDF pesa más de 25 MB.', true);
        trabajar(`Claude está leyendo «${f.name}»…`, async () => {
          const r = await fetch(`/api/reportes/${id}/escucha`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: f });
          const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'No se pudo leer el PDF.');
          R = j; toast('Social listening cargado. Revisa las láminas.');
        });
      };
      i.click();
    },
    async historial() {
      const { cambios } = await api(`/api/reportes/${id}/cambios`);
      const QUE = { 'editar reporte': 'editó', 'actualizar datos': 'actualizó los datos', 'importar datos': 'importó datos', 'proponer textos': 'pidió textos a la IA', 'subir brandwatch': 'subió Brandwatch', 'subir imagen': 'subió una imagen', 'nuevo link': 'cambió el link', 'crear reporte': 'creó el reporte', 'papelera reporte': 'lo mandó a la papelera', 'restaurar reporte': 'lo restauró' };
      const det = d => d.cambios ? ' · ' + d.cambios.map(c => ({ textos: 'textos', secciones: 'láminas', estado: 'estado', hasta: 'fecha de corte' }[c] || c)).join(', ') : '';
      await dialogo(`<div class="form ancho"><h2>Historial de cambios</h2>
        ${cambios.length ? `<ul class="historial">${cambios.map(c => `<li><time>${esc(fechaHora(c.cuando))}</time> <b>${esc(corto(c.quien))}</b> ${esc(QUE[c.accion] || c.accion)}${esc(det(c.detalle))}</li>`).join('')}</ul>` : '<p class="nota">Sin cambios todavía.</p>'}
        <div class="fin"><button class="btn" data-cancelar>Cerrar</button></div></div>`);
    },
    presentar: () => { const ls = $('#laminas', el); if (ls) presentar(ls); },
    pdf: () => print(),
    async listo() {
      const n = R.claves.filter(k => !(R.textos[k.clave] || '').trim()).length;
      if (!await confirmar({ titulo: '¿Marcar listo para el cliente?', boton: 'Marcar listo',
        texto: `El link del cliente empieza a mostrar el reporte.${n ? ` <b>Quedan ${plural(n, 'texto vacío', 'textos vacíos')}</b>: esos espacios no aparecen.` : ''} Puedes seguir corrigiendo después.` })) return;
      trabajar('Guardando…', async () => { R = await api('/api/reportes/' + id, { method: 'PATCH', body: { estado: 'listo' } }); copiar(); });
    },
    borrador: () => trabajar('Guardando…', async () => { R = await api('/api/reportes/' + id, { method: 'PATCH', body: { estado: 'borrador' } }); toast('Volvió a borrador: el link del cliente deja de mostrarlo.'); }),
    link: () => copiar(),
    async nuevoLink() {
      if (!await confirmar({ titulo: '¿Cambiar el link del cliente?', texto: 'El link anterior deja de funcionar. Úsalo si el link llegó a quien no debía.', boton: 'Cambiar link', peligro: true })) return;
      trabajar('Cambiando el link…', async () => { R = await api(`/api/reportes/${id}/nuevo-link`, { method: 'POST' }); toast('Link cambiado.'); });
    },
    async importar() {
      const d = await dialogo(`<form class="form"><h2>Importar datos</h2>
        <p class="nota">Pega los datos en el formato de la herramienta: <code>{ "marca": { "actual": {…}, "anterior": {…} } }</code>. Sirve para cargar datos sacados con el conector de Metricool mientras no esté la clave. Reemplaza los datos actuales del reporte.</p>
        <label class="campo">JSON<textarea name="json" rows="10" required autofocus></textarea></label>
        <p class="aviso crit" data-error hidden></p>
        <div class="fin"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn pk">Importar</button></div></form>`, {
        alEnviar: async f => { let datos; try { datos = JSON.parse(f.json); } catch { throw new Error('El JSON no es válido.'); }
          return api(`/api/reportes/${id}/importar`, { method: 'POST', body: { datos: datos.datos || datos, origen: 'conector' } }); }
      });
      if (d) { R = d; pintar(); toast('Datos importados.'); }
    },
    async restablecer() {
      if (!await confirmar({ titulo: '¿Volver a la propuesta de láminas?', texto: 'Las láminas vuelven a las que propone la herramienta según los datos. Los textos de las láminas que se mantienen no se pierden.', boton: 'Volver a la propuesta' })) return;
      trabajar('Guardando…', async () => { R = await api('/api/reportes/' + id, { method: 'PATCH', body: { secciones: null } }); toast('Láminas como en la propuesta.'); });
    },
    async papelera() {
      if (!await confirmar({ titulo: '¿Mandar este reporte a la papelera?', texto: 'El link del cliente deja de funcionar. Se puede restaurar desde la Papelera.', boton: 'Mandar a la papelera', peligro: true })) return;
      try { await api('/api/reportes/' + id, { method: 'DELETE' }); toast('Reporte en la papelera.'); location.hash = 'reportes?mes=' + R.mes; } catch (e) { toast(e.message, true); }
    }
  };
  async function copiar() {
    try { await navigator.clipboard.writeText(R.link); toast('Link del cliente copiado. Lo abre sin cuenta.'); }
    catch { await dialogo(`<div class="form"><h2>Link del cliente</h2><input readonly value="${esc(R.link)}" onfocus="this.select()"><div class="fin"><button class="btn" data-cancelar>Cerrar</button></div></div>`); }
  }
  async function cambiarHasta(inp) {
    try {
      R = await api('/api/reportes/' + id, { method: 'PATCH', body: { hasta: inp.value } });
      pintar(); toast('Fecha de corte cambiada. Actualiza los datos para recalcular.');
    } catch (e) { toast(e.message, true); inp.value = R.hasta; }
  }

  /* láminas: subir, bajar, quitar y agregar desde el catálogo */
  function controlesLaminas(ls) {
    const vistas = new Set();
    $$('.lamina[data-sec]', ls).forEach(l => {
      const sid = l.dataset.sec; if (vistas.has(sid)) return; vistas.add(sid);
      const i = R.modelo.secciones.findIndex(x => x.id === sid);
      l.insertAdjacentHTML('afterbegin', `<div class="sec-ctl no-imprimir"><span>${i + 1}</span>
        <button data-mover="-1" ${i === 0 ? 'disabled' : ''} title="Subir" aria-label="Subir lámina">↑</button>
        <button data-mover="1" ${i === R.modelo.secciones.length - 1 ? 'disabled' : ''} title="Bajar" aria-label="Bajar lámina">↓</button>
        <button data-quitar title="Quitar lámina" aria-label="Quitar lámina">✕</button>
        <i></i><button data-caja="texto" title="Agregar una caja de texto">+ Texto</button>
        <button data-caja="imagen" title="Agregar una imagen (PNG, JPG, WEBP o GIF)">+ Imagen</button>
        ${R.modelo.secciones[i]?.tipo === 'red' ? '<button data-campos title="Elegir qué indicadores aparecen y agregar campos a mano">Campos</button>' : ''}</div>`);
      const ultima = [...ls.querySelectorAll(`.lamina[data-sec="${CSS.escape(sid)}"]`)].at(-1);
      const siguiente = ultima.nextElementSibling;
      (siguiente?.classList.contains('lamina') && !siguiente.dataset.sec ? siguiente : ultima).insertAdjacentHTML('afterend', `<button class="agregar no-imprimir" data-despues="${esc(sid)}">+ Agregar lámina</button>`);
    });
    if (!R.modelo.secciones.length) ls.innerHTML = '<button class="agregar no-imprimir" data-despues="">+ Agregar lámina</button>';
    ls.addEventListener('click', e => {
      const b = e.target.closest('[data-mover],[data-quitar],[data-despues],[data-caja],[data-quitar-caja],[data-campos],[data-img-post],[data-quitar-img-post]'); if (!b) return;
      e.stopPropagation();
      const lista = R.modelo.secciones.map(x => ({ ...x }));
      if (b.dataset.despues != null) return agregarLamina(lista, b.dataset.despues);
      const sid = b.closest('.lamina').dataset.sec, i = lista.findIndex(x => x.id === sid);
      const s = lista[i];
      if (b.dataset.caja === 'texto') return guardarSecciones(lista.with(i, { ...s, bloques: [...(s.bloques || []), { tipo: 'texto' }] }), 'Caja agregada: haz clic en ella para escribir.', sid);
      if (b.dataset.caja === 'imagen') return subirImagen(lista, i);
      if (b.dataset.quitarCaja) return guardarSecciones(lista.with(i, { ...s, bloques: (s.bloques || []).filter(x => x.id !== b.dataset.quitarCaja) }), 'Caja quitada.', sid);
      if (b.dataset.campos != null) return elegirCampos(lista, i);
      if (b.dataset.imgPost) return subirImagen(lista, i, (x, img) => ({ ...x, imagenes: { ...(x.imagenes || {}), [b.dataset.imgPost]: img } }));
      if (b.dataset.quitarImgPost) { const im = { ...(s.imagenes || {}) }; delete im[b.dataset.quitarImgPost]; return guardarSecciones(lista.with(i, { ...s, imagenes: im }), 'Imagen quitada.', sid); }
      if (b.dataset.quitar != null) {
        lista.splice(i, 1);
        return guardarSecciones(lista, 'Lámina quitada. Sus textos quedan guardados por si la vuelves a agregar.');
      }
      const j = i + +b.dataset.mover; [lista[i], lista[j]] = [lista[j], lista[i]];
      guardarSecciones(lista, '', sid);
    });
  }
  async function guardarSecciones(lista, aviso = '', enfocar = '') {
    await trabajar('Guardando las láminas…', async () => {
      R = await api('/api/reportes/' + id, { method: 'PATCH', body: { secciones: lista } });
      if (aviso) toast(aviso);
    });
    if (enfocar) $(`.lamina[data-sec="${CSS.escape(enfocar)}"]`, el)?.scrollIntoView({ block: 'center' });
  }
  /* imagen: se achica en el navegador (máximo 1600 px) antes de subirla */
  function subirImagen(lista, i, poner = (s, img) => ({ ...s, bloques: [...(s.bloques || []), { tipo: 'imagen', img }] })) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return;
      trabajar('Subiendo la imagen…', async () => {
        const cuerpo = await achicar(f);
        const r = await fetch(`/api/reportes/${id}/imagen`, { method: 'POST', headers: { 'Content-Type': cuerpo.type || 'application/octet-stream' }, body: cuerpo });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'No se pudo subir la imagen.');
        R = await api('/api/reportes/' + id, { method: 'PATCH', body: { secciones: lista.with(i, poner(lista[i], j.img)) } });
        toast('Imagen agregada.');
      });
    };
    inp.click();
  }
  async function achicar(f) {
    if (f.type === 'image/gif') { if (f.size > 5e6) throw new Error('El GIF pesa más de 5 MB.'); return f; }
    const bmp = await createImageBitmap(f).catch(() => { throw new Error('No se pudo leer la imagen.'); });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (k === 1 && f.size < 1.5e6) return f;
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const tipo = f.type === 'image/png' ? 'image/png' : 'image/jpeg';   // PNG conserva la transparencia (logos)
    return new Promise(ok => c.toBlob(ok, tipo, 0.85));
  }
  /* campos de una lámina de red: qué indicadores se ven y cuáles se agregan a mano */
  async function elegirCampos(lista, i) {
    const s = lista[i], m = R.modelo.marcas.find(x => x.id === s.marca), red = m?.redes.find(x => x.red === s.red);
    if (!red) return toast('Esta lámina todavía no tiene datos.', true);
    const ocultos = new Set(s.ocultos || []);
    const fila = (e = {}) => `<div class="extra-f"><input name="etq" placeholder="Nombre del campo" maxlength="60" value="${esc(e.etiqueta || '')}"><input name="val" placeholder="Valor" maxlength="40" value="${esc(e.valor || '')}"><button type="button" class="btn sm" data-x>✕</button></div>`;
    const r = await dialogo(`<form class="form"><h2>Campos · ${esc(m.nombre)} · ${esc(red.nombre)}</h2>
      <p class="nota">Marca los indicadores que se ven en la tabla.</p>
      <div class="checks">${red.kpis.map(k => `<label><input type="checkbox" name="kpi" value="${esc(k.etiqueta)}" ${ocultos.has(k.etiqueta) ? '' : 'checked'}> ${esc(k.etiqueta)}</label>`).join('')}</div>
      <p class="nota">Campos escritos a mano (por ejemplo, ventas o clics que no vienen de Metricool). Van al final de la tabla.</p>
      <div id="extras">${(s.extra || []).map(fila).join('')}</div>
      <button type="button" class="btn sm" id="mas-extra">+ Agregar campo</button>
      <p class="aviso crit" data-error hidden></p>
      <div class="fin"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn pk">Guardar</button></div></form>`, {
      alAbrir: d => {
        $('#mas-extra', d).onclick = () => { if ($$('.extra-f', d).length < 10) $('#extras', d).insertAdjacentHTML('beforeend', fila()); };
        $('#extras', d).onclick = e => e.target.closest('[data-x]')?.closest('.extra-f').remove();
      },
      alEnviar: (_, d) => {
        const vis = new Set($$('[name=kpi]:checked', d).map(x => x.value));
        const extra = $$('.extra-f', d).map(f => ({ etiqueta: $('[name=etq]', f).value.trim(), valor: $('[name=val]', f).value.trim() })).filter(e => e.etiqueta);
        return api('/api/reportes/' + id, { method: 'PATCH', body: { secciones: lista.with(i, { ...s, ocultos: red.kpis.map(k => k.etiqueta).filter(x => !vis.has(x)), extra }) } });
      }
    });
    if (r) { R = r; pintar(); toast('Campos guardados.'); $(`.lamina[data-sec="${CSS.escape(s.id)}"]`, el)?.scrollIntoView({ block: 'center' }); }
  }
  async function agregarLamina(lista, despues) {
    const marcas = R.modelo.marcasCliente || [];
    const NOMBRE_RED = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube' };
    const r = await dialogo(`<form class="form ancho"><h2>Agregar lámina</h2>
      <div class="catalogo">${R.catalogo.map((c, i) => `<label class="cat"><input type="radio" name="tipo" value="${esc(c.tipo)}" ${i === 0 ? 'required' : ''}><span><b>${esc(c.nombre)}</b><small>${esc(c.desc)}</small></span></label>`).join('')}</div>
      <div class="dos" id="params">
        <label class="campo" data-p="marca">Marca<select name="marca">${marcas.map(m => `<option value="${esc(m.id)}">${esc(m.nombre)}</option>`).join('')}</select></label>
        <label class="campo" data-p="red">Red<select name="red"></select></label>
      </div>
      <p class="aviso crit" data-error hidden></p>
      <div class="fin"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn pk">Agregar</button></div></form>`, {
      alAbrir: d => {
        const redes = () => { const m = marcas.find(x => x.id === $('[name=marca]', d).value); $('[name=red]', d).innerHTML = (m?.redes || []).map(x => `<option value="${x}">${NOMBRE_RED[x] || x}</option>`).join(''); };
        const ver = () => {
          const c = R.catalogo.find(x => x.tipo === $('[name=tipo]:checked', d)?.value), pide = c?.pide || [];
          $$('[data-p]', d).forEach(p => { const no = !pide.includes(p.dataset.p); p.style.display = no ? 'none' : ''; $('select', p).disabled = no; });
        };
        d.addEventListener('change', e => { if (e.target.name === 'marca') redes(); ver(); });
        redes(); ver();
      },
      alEnviar: f => {
        if (!f.tipo) throw new Error('Elige qué lámina agregar.');
        const nueva = { id: 's' + Math.random().toString(36).slice(2, 10), tipo: f.tipo, ...(f.marca ? { marca: f.marca } : {}), ...(f.red ? { red: f.red } : {}) };
        const i = despues ? lista.findIndex(x => x.id === despues) + 1 : lista.length;
        lista.splice(i, 0, nueva);
        return nueva;
      }
    });
    if (r) await guardarSecciones(lista, 'Lámina agregada.', r.id);
  }

  /* textos: clic para editar; al salir del texto se guarda */
  function conectarTextos(ls) {
    ls.addEventListener('click', e => { const t = e.target.closest('.txt.editable'); if (t && !t.isContentEditable) editar(t); });
    ls.addEventListener('keydown', e => { const t = e.target.closest('.txt.editable'); if (t && !t.isContentEditable && e.key === 'Enter') { e.preventDefault(); editar(t); } });
  }
  function editar(t) {
    const clave = t.dataset.clave, base = R.textos[clave] || '';
    t.contentEditable = 'plaintext-only'; t.classList.add('editando'); t.textContent = base; t.focus();
    const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r);
    t.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); t.textContent = base; t.blur(); } if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) t.blur(); };
    t.onblur = () => {
      t.onblur = t.onkeydown = null; t.contentEditable = 'false'; t.classList.remove('editando');
      const nuevo = t.innerText.replace(/\u00a0/g, ' ').trim();
      const p = guardarTexto(t, clave, nuevo, base); guardando.set(clave, p); p.finally(() => guardando.delete(clave));
    };
  }
  async function guardarTexto(t, clave, nuevo, base) {
    t.classList.toggle('vacio', !nuevo);
    if (nuevo === base) { t.innerHTML = nuevo ? formatearLocal(nuevo) : ''; return; }
    t.innerHTML = nuevo ? formatearLocal(nuevo) : '';
    const g = $('#guardado', el); if (g) g.textContent = 'Guardando…';
    try {
      const r = await api('/api/reportes/' + id, { method: 'PATCH', body: { textos: { [clave]: nuevo }, rev: R.rev, base: { [clave]: base } } });
      R.textos = r.textos; R.rev = r.rev;
      if (g) g.textContent = 'Guardado ' + new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const ayuda = $('.ayuda', el); if (ayuda) ayuda.innerHTML = ayuda.innerHTML.replace(/(Faltan <b>.*?<\/b>\.|Todos los textos están escritos\.)$/, faltan());
    } catch (e) {
      if (g) g.textContent = '';
      toast(e.message, true);
      if (/Recarga/.test(e.message)) { await cargar(); }
    }
  }
  /* aviso de cambios: cada 20 segundos pregunta si alguien más cambió el reporte */
  const visto = () => { try { const v = JSON.parse(localStorage.getItem('rr-visto') || '{}'); v[id] = new Date().toISOString(); localStorage.setItem('rr-visto', JSON.stringify(v)); } catch {} };
  let avisado = 0;
  const reloj = setInterval(async () => {
    if (!R || document.hidden) return;
    try {
      const v = await api(`/api/reportes/${id}/version`);
      if (v.rev > R.rev && v.editadoPor !== ctx.yo.email && v.rev !== avisado) {
        avisado = v.rev; $('.cambio-aviso', el)?.remove();
        el.insertAdjacentHTML('afterbegin', `<div class="cambio-aviso no-imprimir" role="status"><span><b>${esc(corto(v.editadoPor))}</b> cambió este reporte.</span><button class="btn sm pk" data-recargar>Ver los cambios</button><button class="btn sm" data-cerrar>Después</button></div>`);
        const a = $('.cambio-aviso', el);
        $('[data-recargar]', a).onclick = async () => { await Promise.all(guardando.values()); a.remove(); await cargar(); visto(); };
        $('[data-cerrar]', a).onclick = () => a.remove();
      } else if (v.rev > R.rev && v.editadoPor === ctx.yo.email) R.rev = v.rev;
    } catch {}
  }, 20000);
  salir = () => { clearInterval(reloj); visto(); return Promise.all(guardando.values()); };
  addEventListener('beforeunload', e => { if (guardando.size) e.preventDefault(); });
  await cargar(); visto();
}

/* ============================================================ clientes */
async function vistaClientes(el) {
  el.innerHTML = `<div class="cabeza"><div><span class="label pk">Reportería RRSS</span><h1>Clientes</h1></div>
      <div class="acciones"><button class="btn pk" id="nuevo">+ Nuevo cliente</button></div></div>
    <p class="nota">Cada cliente agrupa las marcas de Metricool que se reportan juntas (por ejemplo, las submarcas de Achs), con sus redes y los lineamientos que sigue la IA al redactar. Los cambios valen para los reportes que se actualicen después.</p>
    <div class="grilla" id="grilla">${cargando()}</div>`;
  const grilla = $('#grilla', el);
  let lista = [];
  async function cargar() {
    try {
      lista = (await api('/api/clientes')).clientes;
      grilla.innerHTML = lista.map(c => `<article class="card" data-id="${esc(c.id)}" tabindex="0"><b>${esc(c.nombre)}</b>
        <p>${c.config.marcas.map(m => `${esc(m.nombre)}${m.activa === false ? ' (no se reporta)' : ''}`).join(' · ')}</p>
        <div class="meta"><span>${c.config.escucha ? 'Con social listening' : ''}</span><span>${c.editadoPor ? 'Editado por ' + esc(corto(c.editadoPor)) : ''}</span></div></article>`).join('')
        || vacio('No hay clientes', 'Crea el primero.');
      $$('[data-id]', grilla).forEach(a => { a.onclick = () => editar(lista.find(c => c.id === a.dataset.id)); a.onkeydown = e => e.key === 'Enter' && a.click(); });
    } catch (e) { grilla.innerHTML = fallo(e); $('[data-reintentar]', grilla)?.addEventListener('click', cargar); }
  }
  async function nuevoCliente() {
    let lista = [], aviso = '';
    try { lista = (await api('/api/metricool/marcas')).marcas; } catch (e) { aviso = e.message; }
    const usadas = new Set(lista.length ? (await api('/api/clientes')).clientes.flatMap(c => c.config.marcas.map(m => m.blogId)) : []);
    const r = await dialogo(`<form class="form ancho"><h2>Nuevo cliente</h2>
      <label class="campo">Nombre del cliente<input name="nombre" required maxlength="60" autofocus></label>
      ${lista.length ? `<span class="label">Marcas de Metricool que se reportan juntas</span>
        <label class="buscar"><input type="search" id="filtro" placeholder="Buscar marca" aria-label="Buscar marca"></label>
        <div class="marcas-mc">${lista.map(m => `<label class="campo check" data-n="${esc(m.nombre.toLowerCase())}"><input type="checkbox" name="mc" value="${esc(m.blogId)}"> ${esc(m.nombre)} <small>${esc(m.redes.join(', ') || 'sin redes detectadas')}${usadas.has(m.blogId) ? ' · ya está en otro cliente' : ''}</small></label>`).join('')}</div>`
        : `<p class="aviso warn">${esc(aviso || 'Metricool no devolvió marcas.')} Puedes crear el cliente y completar sus marcas a mano después.</p>`}
      <p class="aviso crit" data-error hidden></p>
      <div class="fin"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn pk">Crear cliente</button></div></form>`, {
      alAbrir: d => {
        $('#filtro', d)?.addEventListener('input', e => { const q = e.target.value.toLowerCase(); $$('[data-n]', d).forEach(x => { x.style.display = x.dataset.n.includes(q) ? '' : 'none'; }); });
        d.addEventListener('change', e => { if (e.target.name === 'mc' && !$('[name=nombre]', d).value) $('[name=nombre]', d).value = lista.find(m => m.blogId === e.target.value)?.nombre || ''; });
      },
      alEnviar: f => {
        const ids = [].concat(f.mc || []);
        const marcas = lista.filter(m => ids.includes(m.blogId)).map(m => ({ nombre: m.nombre, blogId: m.blogId, redes: m.redes.length ? m.redes : ['instagram'] }));
        return api('/api/clientes', { method: 'POST', body: { nombre: f.nombre, marcas } });
      }
    });
    if (r) { toast('Cliente creado. Revisa sus redes y lineamientos.'); await cargar(); editar(r); }
  }
  $('#nuevo', el).onclick = nuevoCliente;

  const filaMarca = (m = {}) => `<fieldset class="marca-f">
    <div class="dos"><label class="campo">Marca<input data-k="nombre" value="${esc(m.nombre)}" required maxlength="60"></label>
      <label class="campo">Número en Metricool <small>blogId</small><input data-k="blogId" value="${esc(m.blogId)}" inputmode="numeric" pattern="\\d*"></label></div>
    <div class="dos"><label class="campo">Nombre largo <small>Opcional, para los títulos</small><input data-k="nombreLargo" value="${esc(m.nombreLargo)}" maxlength="80"></label>
      <label class="campo">Color <small>Opcional</small><input data-k="color" type="color" value="${esc(m.color || '#fc3297')}" ${m.color ? '' : 'data-sin-color'}></label></div>
    <div class="redes-f">${Object.entries(REDES).map(([k, v]) => `<label class="campo check"><input type="checkbox" data-red="${k}" ${(m.redes || []).includes(k) ? 'checked' : ''}> ${v}</label>`).join('')}</div>
    <div class="redes-f"><label class="campo check"><input type="checkbox" data-k="activa" ${m.activa !== false ? 'checked' : ''}> Se reporta</label>
      <label class="campo check"><input type="checkbox" data-k="competencia" ${m.competencia !== false ? 'checked' : ''}> Con competencia de Instagram</label>
      <button type="button" class="btn sm peligro" data-quitar>Quitar marca</button></div>
    <input type="hidden" data-k="id" value="${esc(m.id)}">
  </fieldset>`;

  async function editar(c) {
    const cfg = c.config;
    const r = await dialogo(`<form class="form ancho"><h2>${esc(c.nombre)}</h2>
      <label class="campo">Nombre del cliente<input name="nombre" value="${esc(c.nombre)}" required maxlength="60"></label>
      <span class="label">Marcas</span><div id="marcas">${cfg.marcas.map(filaMarca).join('')}</div>
      <button type="button" class="btn sm" id="otra">+ Agregar marca</button>
      <div class="dos"><label class="campo check"><input type="checkbox" name="escucha" ${cfg.escucha ? 'checked' : ''}> Social listening (PDF de Brandwatch)</label>
        <label class="campo">Pauta estimada en TikTok <small>Videos con estas vistas o más. 0 = sin regla</small><input name="pauta" type="number" min="0" step="1000" value="${esc(cfg.reglas?.pautaTiktok || 0)}"></label></div>
      <label class="campo">Lineamientos para los textos <small>Los lee la IA al redactar: tono, qué destacar, qué evitar</small><textarea name="lineamientos" rows="8" maxlength="4000">${esc(cfg.lineamientos)}</textarea></label>
      <p class="aviso crit" data-error hidden></p>
      <div class="fin">${ctx.yo.admin ? '<button type="button" class="btn peligro izq" data-papelera>Mandar a la papelera</button>' : ''}<button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn pk">Guardar</button></div></form>`, {
      alAbrir: (d, cerrar) => {
        const cont = $('#marcas', d);
        $('#otra', d).onclick = () => cont.insertAdjacentHTML('beforeend', filaMarca({ redes: ['instagram'] }));
        cont.addEventListener('click', e => { if (e.target.closest('[data-quitar]')) e.target.closest('fieldset').remove(); });
        cont.addEventListener('input', e => { if (e.target.type === 'color') delete e.target.dataset.sinColor; });
        $('[data-papelera]', d)?.addEventListener('click', async () => {
          if (!await confirmar({ titulo: `¿Mandar ${esc(c.nombre)} a la papelera?`, texto: 'Deja de aparecer en la grilla. Sus reportes y links siguen funcionando. Se puede restaurar.', boton: 'Mandar a la papelera', peligro: true })) return;
          try { await api('/api/clientes/' + c.id, { method: 'DELETE' }); cerrar({ papelera: true }); } catch (x) { toast(x.message, true); }
        });
      },
      alEnviar: (f, d) => {
        const marcas = $$('#marcas fieldset', d).map(fs => {
          const v = k => $(`[data-k="${k}"]`, fs);
          return { id: v('id').value, nombre: v('nombre').value, blogId: v('blogId').value, nombreLargo: v('nombreLargo').value,
            color: v('color').dataset.sinColor != null ? '' : v('color').value, activa: v('activa').checked, competencia: v('competencia').checked,
            redes: $$('[data-red]', fs).filter(x => x.checked).map(x => x.dataset.red) };
        });
        return api('/api/clientes/' + c.id, { method: 'PATCH', body: { nombre: f.nombre, config: { marcas, escucha: !!f.escucha, reglas: { pautaTiktok: +f.pauta || 0 }, lineamientos: f.lineamientos } } });
      }
    });
    if (r) { toast(r.papelera ? 'Cliente en la papelera.' : 'Cliente guardado.'); cargar(); }
  }
  await cargar();
  if (param('nuevo')) { history.replaceState(null, '', '#clientes'); nuevoCliente(); }
}

/* ============================================================ papelera */
async function vistaPapelera(el) {
  el.innerHTML = `<div class="cabeza"><div><span class="label pk">Reportería RRSS</span><h1>Papelera</h1></div></div>
    <p class="aviso">Lo que está aquí no se borra solo y se puede restaurar. Si hay que borrar algo del todo, se le pide a Bruno.</p><div id="caja">${cargando()}</div>`;
  const caja = $('#caja', el);
  async function cargar() {
    try {
      const { reportes, clientes } = await api('/api/papelera');
      const filas = [...reportes.map(r => ({ tipo: 'reportes', id: r.id, nombre: `${r.cliente} · ${tituloMes(r.mes)}`, por: r.papeleraPor, en: r.papeleraEn })),
        ...clientes.map(c => ({ tipo: 'clientes', id: c.id, nombre: `Cliente ${c.nombre}`, por: '', en: c.papeleraEn, admin: true }))];
      caja.innerHTML = !filas.length ? vacio('La papelera está vacía')
        : `<div class="bloque"><div class="tabla-caja"><table class="tabla"><thead><tr><th>Qué</th><th>La mandó</th><th>Cuándo</th><th></th></tr></thead><tbody>
          ${filas.map(f => `<tr><td><b>${esc(f.nombre)}</b></td><td>${esc(corto(f.por))}</td><td><small>${esc(fechaHora(f.en))}</small></td>
            <td>${!f.admin || ctx.yo.admin ? `<button class="btn sm" data-r="${esc(f.tipo)}/${esc(f.id)}">Restaurar</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
      $$('[data-r]', caja).forEach(b => b.onclick = async () => {
        b.disabled = true;
        try { await api(`/api/${b.dataset.r}/restaurar`, { method: 'POST' }); toast('Restaurado.'); cargar(); } catch (e) { toast(e.message, true); b.disabled = false; }
      });
    } catch (e) { caja.innerHTML = fallo(e); $('[data-reintentar]', caja)?.addEventListener('click', cargar); }
  }
  await cargar();
}

/* ============================================================ actividad (solo administradores) */
async function vistaActividad(el) {
  if (!ctx.yo.admin) { el.innerHTML = vacio('Solo administradores', 'La actividad la ven Bruno y Emilio.'); return; }
  el.innerHTML = `<div class="cabeza"><div><span class="label pk">Reportería RRSS · solo administradores</span><h1>Actividad</h1></div></div><div id="caja">${cargando()}</div>`;
  const filas = (await api('/api/actividad')).filter(r => r.accion !== 'login');
  const det = d => [d.cliente, d.mes && tituloMes(d.mes), d.nombre, d.origen, d.cambios?.join(', '), d.n != null ? plural(d.n, 'texto', 'textos') : ''].filter(Boolean).join(' · ');
  $('#caja', el).innerHTML = !filas.length ? vacio('Todavía no hay actividad')
    : `<div class="bloque"><div class="tabla-caja"><table class="tabla"><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Detalle</th></tr></thead><tbody>
      ${filas.map(r => `<tr><td><small>${esc(fechaHora(r.cuando))}</small></td><td>${esc(corto(r.quien))}</td><td>${esc(r.accion)}</td><td><small>${esc(det(r.detalle || {}))}</small></td></tr>`).join('')}
      </tbody></table></div></div>`;
}

/* ---------- inicio ---------- */
iniciarBarra().then(({ cfg, yo }) => { Object.assign(ctx, { cfg, yo }); addEventListener('hashchange', ir); ir(); })
  .catch(e => { $('#vista').innerHTML = fallo(e, false); });
