# Plantilla de herramientas de Monkey System (CLAUDE.md técnico)

Base para cada herramienta nueva. El README explica qué trae, en simple. Aquí va lo necesario para programar sobre ella.

**Regla principal:**
- **Esta plantilla** (`brunopero-sudo/plantilla-monkeylabs`) **es de solo lectura para los directores.** Cada herramienta nace en un repo propio, creado con «Use this template» en la cuenta del director.
- **En el repo del director:**
  - se programa y se prueba en local;
  - no hay Railway, Vercel ni claves reales;
  - unir a su `main` no publica nada.

  Igual conviene trabajar con commits chicos y ramas cortas.
- **Al aprobarse, el repo se copia a `brunopero-sudo`.** Desde ahí rigen las reglas de siempre:
  - rama y pull request, nunca un push a `main` ni un pull request encima de otro;
  - solo Bruno decide qué sale a producción, con **«publica en operativo»**.
- **Secretos:**
  - las claves reales, nunca;
  - las de prueba de servicios externos las pega el director directo en `.env` (fuera de git), y Claude no las pide, no las lee ni las pega;
  - en git solo va `.env.example`, sin valores.
- **Todo en español de Chile:** interfaz, textos, commits y pull requests.
- **Gobernanza:** está en `CLAUDE.md` y en [`GUIA.md`](https://github.com/brunopero-sudo/plataformas-monkeylabs/blob/main/GUIA.md) de `plataformas-monkeylabs`. El camino completo está en `docs/PASO-A-OPERATIVO.md`.

## Comandos

- `npm start`: http://localhost:5001, modo local. Sin login (entra como `pruebas@monkeylabs.cl`, administradora) y con datos de ejemplo.
- `npm run pruebas`: lo mismo en modo pruebas (franja «AMBIENTE DE PRUEBAS» y base aparte).
- `npm run dev`: como `npm start`, pero se reinicia al guardar.
- `npm test`: pruebas unitarias y el flujo completo contra el servidor. Todas deben pasar antes de pedir el OK.
- `npm run entrada`: revisa `herramienta.json` y muestra la entrada que Media Labs agrega en Monkey System.
- `scripts/clave-sesion.mjs`: lo ejecuta Bruno, nunca Claude. Crea `SESSION_SECRET` en memoria y la manda a Railway por la entrada estándar; en pantalla solo sale su huella. Sin `--cambiar` es un ensayo.
- **Antes de levantar el servidor,** revisar que el puerto esté libre (`lsof -nP -iTCP:<puerto> -sTCP:LISTEN`).
- **En el navegador de la app,** la configuración es «herramienta», en `.claude/launch.json` del repo; su puerto tiene que calzar con `herramienta.json`.
- **En el repo de Bruno,** el Orquestador agrega además la entrada en el `launch.json` del mapa.

## Arquitectura

Node 24 sin framework, sin build y sin dependencias (si una hace falta de verdad, se justifica en el pull request).

- `server.js`: HTTP nativo. Primero van las rutas públicas (`/api/config`, login, `login.html`, `/css/`, `/assets/`); desde «solo el equipo», todo pide sesión. El bloque de la herramienta de ejemplo está marcado.
- `lib/`:
  - `config.js`: variables de entorno y los tres modos.
  - `auth.js`: el mismo login de Monkey System (Google Identity Services → tokeninfo → cookie firmada `mh_s`).
  - `db.js`: `node:sqlite`, con un archivo por modo, el registro de actividad y las migraciones idempotentes (`ajuste('migr_…')`).
  - `tareas.js`: la lógica de la herramienta de ejemplo (validar, guardar, registrar, papelera, lote).
  - `herramienta.js`: valida `herramienta.json` y lo traduce a una entrada de `lib/sistema.js` de monkey-system.
- `public/`:
  - `index.html` + `js/tareas.js`: la herramienta de ejemplo (enrutador por `#hash`).
  - `js/ui.js`: `api`, `toast`, `dialogo`, `confirmar`, `seleccionMultiple`, estados (`cargando`, `vacio`, `fallo`) e `iniciarBarra`.
  - `css/sistema.css`: tokens y componentes.
  - `kit.html`: galería viva de componentes.
  - `login.html`: autónomo, con su script en línea (no importa nada de `/js/`, que pide sesión).
- `herramienta.json`: el contrato con la entrada de Monkey System (ver más abajo).
- `test/`: `unidad.test.js` (contrato, modos y lógica) y `flujo.test.js` (servidor real en los puertos 5900–5999).
- `Dockerfile`: imagen para Railway (Node 24, sin paquetes).

## Modos

| | local | pruebas | produccion |
|---|---|---|---|
| Cuándo | `npm start` (por defecto fuera de Railway) | `MODO=pruebas` | por defecto en Railway |
| Login | sin login si no hay `GOOGLE_CLIENT_ID` | Google | Google (obligatorio: sin él no arranca) |
| Base | `data/herramienta-local.sqlite` | `herramienta-pruebas.sqlite` | `herramienta-produccion.sqlite` |
| Franja | «LOCAL · DATOS FICTICIOS» | «AMBIENTE DE PRUEBAS · DATOS FICTICIOS» | no |
| Datos de ejemplo | sí | sí | no |
| pruebas@ es administradora | sí | sí | no |
| Drive (`DRIVE_MODO`) | simulado | simulado, siempre | el que se configure |

La franja la agrega el servidor (`conFranja` en `server.js`) a todo HTML fuera de producción. No se programa en cada página, y dentro de un iframe no se muestra. Es la misma de Grillas.

## Reemplazar la herramienta de ejemplo

1. Ajustar:
   - `herramienta.json`: `id`, `nombre`, `lab`, `descripcion` (máximo 70 caracteres), `ver`, `responsable`, `repo` y un `puerto` libre desde el 5002 (el definitivo lo asigna el mapa al aprobarse);
   - el `name` de `package.json`;
   - el puerto de `.claude/launch.json`.
2. Renombrar `lib/tareas.js` a `lib/<herramienta>.js` y cambiar la tabla en `lib/db.js` (con sus datos de ejemplo). Conservar el patrón: `validar()`, `registrar()` en cada cambio, `aPapelera()`/`restaurar()` en vez de borrar y `lote()` si hay acciones en grupo.
3. Cambiar el bloque marcado de rutas en `server.js`.
4. Cambiar `public/js/tareas.js` y la barra de `public/index.html` (nombre con la última palabra en `<em>`, pestañas).
5. No tocar: `lib/auth.js`, `lib/config.js`, `public/js/ui.js`, `public/css/sistema.css` y `login.html`. Si hace falta un componente nuevo, se agrega a `sistema.css` y al kit, para que lo aprovechen las demás.
6. Reescribir las pruebas de la herramienta (las de modos, franja y producción se conservan) y `npm test`.
7. Revisar en el navegador, en escritorio y a 375 px, midiendo con JavaScript si el panel está oculto: sin desplazamiento hacia el lado, la barra de acciones pegada y el diálogo a lo ancho.

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
- **Lo público vs. la sesión:** solo `login.html`, `/css/`, `/assets/` y `/api/config` se ven sin sesión. Nada con datos o links internos va ahí. En Monkey System, la lista de la entrada estuvo en `/js/` y se podía abrir sin sesión.
- **Cookies en localhost:** son del host, no del puerto, así que todas las herramientas locales comparten cookies. Por eso esta usa `mh_s` y no `ms_s` (la de Monkey System).
- **Login con Google en un dominio nuevo:** Bruno tiene que agregarlo como origen autorizado en el cliente OAuth («Grillas MonkeyLabs»). Sin eso, el botón de Google falla.
- **Railway sin `GOOGLE_CLIENT_ID`** dejaría entrar a cualquiera como la cuenta de pruebas. Por eso `validar()` no deja arrancar.
- **Railway guarda los cambios de configuración como borrador** hasta que se aplican (`get-staged-changes` y luego `accept-deploy`, con el OK de Bruno).
- **Un ambiente de pruebas nunca se crea duplicando producción:** se copiarían sus claves. Se arma vacío, con claves propias.
- **Puertos:** el 5000 lo ocupa el Receptor AirPlay del Mac. La plantilla usa el 5001, las herramientas desde el 5002 y las pruebas automáticas del 5900 al 5999.
- **Drive:** la plantilla no lo trae. Si la herramienta lo necesita, se copia `lib/drive.js` de monkey-system (real y simulado, con la misma interfaz) y se respeta `DRIVE_MODO`, que fuera de producción es siempre `simulado`. Carpetas con acceso limitado: primero se corta la herencia y después se agregan los editores.
- **git:** `data/` y `.env` están en `.gitignore`. Datos, fotos o planillas de clientes nunca van al repo, porque lo que entra a git queda para siempre.
- **El navegador de la app, con el panel oculto,** entrega capturas negras. Hay que medir con JavaScript (anchos, `scrollWidth`, posición de lo pegajoso).
