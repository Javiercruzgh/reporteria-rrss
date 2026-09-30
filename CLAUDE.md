# Reportería RRSS (CLAUDE.md técnico)

Herramienta de Digital Labs para Monkey System, creada desde `plantilla-monkeylabs`. Reportes mensuales de redes orgánicas desde Metricool: el equipo los arma en el constructor y el cliente los ve en un link propio. El README explica el uso; aquí va lo necesario para programar.

**Reglas (vienen de la plantilla y de `plataformas-monkeylabs`):**
- Repo del director (`Javiercruzgh/reporteria-rrss`) hasta que Bruno la apruebe; después se copia a `brunopero-sudo` y rigen rama + pull request y «publica en operativo».
- **Secretos:** `METRICOOL_TOKEN` y `ANTHROPIC_API_KEY` solo en `.env` (local) o Railway (Bruno). Claude no los pide, no los lee ni los pega. En git solo va `.env.example`, sin valores.
- **Datos de clientes nunca van a git** (`data/` está en `.gitignore`). Las cuentas de Metricool de los clientes solo se leen.
- Todo en español de Chile.

## Comandos

- `npm install` (una vez: la única dependencia es `@anthropic-ai/sdk`).
- `npm start`: http://localhost:5003, modo local, sin login (entra como `pruebas@monkeylabs.cl`, administradora). Sin `METRICOOL_TOKEN`, Metricool se simula.
- `npm run pruebas`, `npm run dev`, `npm run entrada`: como en la plantilla.
- `npm test`: unidad (períodos, cálculos, textos, clientes, modos) y flujo contra el servidor en los puertos 5900–5999, siempre con `METRICOOL_MODO=simulado` e `IA_MODO=simulado`.
- Antes de levantar el servidor, revisar que el puerto esté libre.

## Arquitectura

Node 24 sin framework ni build. Una dependencia justificada: `@anthropic-ai/sdk` (el Dockerfile corre `npm ci --omit=dev`).

- `server.js`: rutas. Públicas: login, `/css/`, `/assets/`, `/publico/` (código de las láminas, sin datos), `/r/<token>` (página del cliente) y `/api/publico/<token>` (el reporte, solo si está `listo`). Lo demás pide sesión.
- `lib/metricool.js`: `traerMarca(marca, desde, hasta)` → **DatosMarca** normalizado (formato en el comentario inicial). Modos `api` (REST de Metricool con `X-Mc-Auth`; prueba el endpoint v2 y luego los antiguos, y normaliza los nombres de campos), `simulado` (datos inventados con semilla fija) y `apagado` (503 con aviso). **La forma exacta de las respuestas de la API REST no está verificada** con una clave real: al tener clave, probar «Actualizar datos» con Alflorex y comparar con los números del conector (ver «Datos de referencia»).
- `lib/periodos.js`: el mes (hasta ayer o fin de mes) contra el mismo tramo del mes anterior.
- `lib/calculos.js`: aritmética pura de DatosMarca a **modelo** (KPI por red, top 3, funnel, competencia, tabla general, resumen por marca y notas metodológicas). Sin IA.
- `lib/secciones.js`: **nada está fijo por marca.** `CATALOGO` de tipos de lámina (qué piden: marca, red; y sus espacios de texto), `porDefecto(modelo)` (la propuesta según los datos, con ids estables como `alflorex-instagram`) y `validar(lista, cliente)`. `reportes.secciones` guarda la lista armada por el equipo; `null` = la propuesta.
- `lib/textos.js`: `clavesTexto(modelo)`, un espacio por lámina con clave `<id de la sección>.<espacio>` (por ejemplo `resumen.texto`, `alflorex-instagram.lectura`) y lo que pide cada uno. Quitar una lámina no borra sus textos. La IA no escribe las láminas de texto libre (`ia: false`). `public/publico/laminas.js` usa las mismas claves.
- `lib/ia.js`: `proponerTextos` (salida JSON con `output_config.format`) y `leerBrandwatch` (PDF en base64 como `document`). Modelo `IA_MODELO` (por defecto `claude-opus-5-5`), con streaming y `finalMessage()`. Modos `api`, `simulado` (pruebas) y `apagado`.
- `lib/reportes.js`: crear (uno por cliente y mes), actualizar e importar datos, editar textos (se mezclan por clave; con `rev` + `base`, un cambio ajeno a la misma clave responde 409), proponer, subir Brandwatch, estado, nuevo link, papelera y `publico(token)`.
- `lib/clientes.js`: un cliente agrupa marcas de Metricool (`blogId`), con redes, competencia, `reglas.pautaTiktok`, `escucha` (propone la lámina de social listening) y `lineamientos` (los lee la IA). La herramienta parte sin clientes; se crean eligiendo marcas de `listarMarcas()` (`/admin/simpleProfiles` de Metricool, forma sin verificar). Ejemplos de lineamientos en `docs/LINEAMIENTOS.md`.
- `public/js/app.js`: constructor (grilla del mes, reporte con controles para ordenar, quitar y agregar láminas, clientes con la lista de Metricool, papelera, actividad).
- `public/publico/`: `laminas.js` (dibuja cada sección con `L[tipo]`; en el constructor, una lámina sin datos muestra un aviso y al cliente no le llega), `reporte.css` (1 em = 16 px en 1280 de ancho; bajo 700 px de contenedor pasa a una columna; impresión a 1280×720), `presentar.js` y `cliente.html`/`cliente.js`.

## Modos

Los de la plantilla (local, pruebas, produccion), más:

| | local / pruebas | produccion |
|---|---|---|
| Metricool sin clave | simulado (aviso «datos inventados») | apagado (aviso para Bruno) |
| Metricool con `METRICOOL_TOKEN` + `METRICOOL_USER_ID` | api | api |
| IA sin `ANTHROPIC_API_KEY` | apagada (textos a mano) | apagada |

## Datos de referencia

Los reportes standalone de septiembre 2026 (Achs, Alflorex, Muno, Pesas Chile) están en la carpeta del proyecto `reporteria/referencia-septiembre/` (fuera de git). Alflorex del 1 al 28 de septiembre, sacado con el conector de Metricool (brandId 4369569), da: Instagram 6.628 seguidores (6.557 en agosto), 8 carruseles + 3 reels, 22 historias, alcance del feed 4.052 (3.303), 208 interacciones (209); TikTok 481 (459), sin videos en septiembre y 5 en agosto (2.050 vistas). Sirve para comparar cuando la API REST esté conectada.

Campos del conector (Data Studio) que alimentan el formato: `IGPO*` (posts), `IGRE*` (reels), `IGST01/10` (historias), `IGEV01` (seguidores de Instagram, último día), `TKEV07` (seguidores de TikTok), `TKPO*` (videos), `IGCO02/03/07/08/10/12` (competidores; el engagement viene como fracción y se guarda ×1.000).

## Integraciones con servicios externos

- **La clave se lee de `process.env`** (en `lib/config.js`). Se lista sin valor en `.env.example` y en `herramienta.json` (`variables`, con `secreto: true`). Nunca va en el código.
- **Sin clave, esa función queda apagada con un aviso claro** («Falta la clave de Metricool en .env»), sin romper el resto. Es el patrón de la clasificación de Monkey System.
- **En local, con claves de prueba del director**, en `.env`. Nunca contra cuentas o bases de los clientes: los originales de terceros no se tocan y hacer copias sí está permitido. Las claves reales las pone Bruno en Railway al publicar.
- **Google** (Drive, Sheets, Apps Script): con recursos de pruebas@monkeylabs.cl, que nunca se agrega a nada real. Para Drive, ver «Lecciones».
- **En `npm test` el servicio se simula** con un cliente falso: sin llamadas reales ni claves. Es el patrón de `test/clasificar.test.js` en monkey-system.

## herramienta.json → entrada de Monkey System

`npm run entrada` imprime el objeto para `lib/sistema.js` de monkey-system: `{ id, nombre, desc: descripcion, url: urls.produccion, externo: true, nuevo: true, ver }`, en el Lab indicado. `ver` se omite si es `todos`. `icono` queda reservado, porque hoy la entrada muestra un punto. `variables` lista los nombres (nunca los valores) que Bruno pone en Railway. `estado` es `borrador` (en desarrollo), `entregada` (el director invitó a brunopero-sudo y avisó; pide `repo`) u `operativo` (pide `urls.produccion`). El paso a paso completo está en `docs/PASO-A-OPERATIVO.md`.

## Convenciones

- **El servidor decide.** Validación, permisos y filtros van en el servidor; el navegador solo ayuda (ocultar un botón no protege nada). Lo que ve alguien de afuera (un cliente con un link) se arma en el servidor, sin los datos internos (así lo hace Grillas con `paraCliente`).
- **Borrar es mandar a la papelera.** `DELETE` marca `papelera_en` y se puede restaurar. Borrar de verdad no existe en la interfaz; si hace falta, lo decide Bruno.
- **Todo cambio queda en `registro`** (quién, qué y detalle en JSON), que se ve en Actividad.
- **Los errores de la API son `{ error }` en español claro**, y dicen qué hacer. Un 500 nunca muestra el detalle técnico al usuario.
- **Todo texto que llega a HTML pasa por `esc()`.**
- **Si varias personas editan el mismo documento:** cada guardado lleva `rev`, uno viejo responde 409 y el navegador fusiona o avisa (patrón de Grillas: `state.js`).
- **Fechas y números en formato es-CL** (`fecha()`, `fechaHora()` de `ui.js`).

## Lecciones (no repetir errores)

- **Grillas:** las columnas van con `minmax(0,1fr)` (o `minmax(min(260px,100%),1fr)`). Con `1fr` a secas, el teléfono agranda la página hasta el contenido más ancho. Las tablas van dentro de `.tabla-caja`.
- **Lo pegajoso** (`position:sticky`) tiene que ser un elemento cuyo contenedor ocupe toda la columna. Por eso es `#sel` y no `.accion-sel`. En el teléfono la barra superior deja de ser pegajosa y solo queda pegada la de acciones.
- **Escape:** el diálogo lo escucha en `window`, en fase de captura, y lo detiene; así cierra solo el de más arriba y no quita la selección. La selección lo escucha en `document`, también en captura, y no actúa si hay un diálogo abierto.
- **Lo público vs. la sesión:** solo `login.html`, `/css/`, `/assets/`, `/publico/`, `/r/<token>`, `/api/publico/<token>` y `/api/config` se ven sin sesión; `/publico/` es solo código, los datos salen de `/api/publico/` y solo si el reporte está listo. Nada con datos o links internos va ahí. En Monkey System, la lista de la entrada estuvo en `/js/` y se podía abrir sin sesión.
- **Cookies en localhost:** son del host, no del puerto, así que todas las herramientas locales comparten cookies. Por eso esta usa `mh_s` y no `ms_s` (la de Monkey System).
- **Login con Google en un dominio nuevo:** Bruno tiene que agregarlo como origen autorizado en el cliente OAuth («Grillas MonkeyLabs»). Sin eso, el botón de Google falla.
- **Railway sin `GOOGLE_CLIENT_ID`** dejaría entrar a cualquiera como la cuenta de pruebas. Por eso `validar()` no deja arrancar.
- **Railway guarda los cambios de configuración como borrador** hasta que se aplican (`get-staged-changes` y luego `accept-deploy`, con el OK de Bruno).
- **Un ambiente de pruebas nunca se crea duplicando producción:** se copiarían sus claves. Se arma vacío, con claves propias.
- **Puertos:** el 5000 lo ocupa el Receptor AirPlay del Mac. La plantilla usa el 5001, el prototipo de Paneo el 5002, esta herramienta el 5003 y las pruebas automáticas del 5900 al 5999.
- **Clases CSS de las láminas:** `sistema.css` ya define `.dos`, `.tabla`, `.caja` y otras. Las láminas usan nombres propios (`.ldos`, `.rt`, `.s-pos`…); antes de agregar una clase en `reporte.css`, buscarla en `sistema.css`.
- **El link del cliente** no lleva `Referer` ni se indexa (`no-referrer`, `noindex`). Cambiar el link (`nuevo-link`) invalida el anterior.
- **Drive:** la plantilla no lo trae. Si la herramienta lo necesita, se copia `lib/drive.js` de monkey-system (real y simulado, con la misma interfaz) y se respeta `DRIVE_MODO`, que fuera de producción es siempre `simulado`. Carpetas con acceso limitado: primero se corta la herencia y después se agregan los editores.
- **git:** `data/` y `.env` están en `.gitignore`. Datos, fotos o planillas de clientes nunca van al repo, porque lo que entra a git queda para siempre.
- **El navegador de la app, con el panel oculto,** entrega capturas negras. Hay que medir con JavaScript (anchos, `scrollWidth`, posición de lo pegajoso).
