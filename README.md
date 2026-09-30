# Plantilla de herramientas · Monkey System

El punto de partida para crear una herramienta nueva de Monkey System. Cada director crea su propio repo desde esta plantilla, en su cuenta de GitHub, y la construye en su computador. Trae resuelto el login con la cuenta @monkeylabs.cl, el diseño, una herramienta de ejemplo que funciona de punta a punta y lo necesario para conectarla después a la entrada de Monkey System.

> **Antes de empezar, lee la [guía para directores](https://github.com/brunopero-sudo/plataformas-monkeylabs/blob/main/GUIA.md)** (en tu computador está en `../GUIA.md`). Explica cómo nace una herramienta, cómo pedirle cosas a Claude y las reglas. Este README solo cuenta qué trae la plantilla.

## Verla en tu computador

Pídele a Claude: «Levanta la plantilla y muéstramela en el navegador». O, si prefieres la terminal:

```bash
npm start
```

Se abre en http://localhost:5001:
- No pide login: entras como **pruebas@monkeylabs.cl**, que en tu computador es administradora.
- Los datos son de mentira y quedan en la carpeta `data/`, que no se sube a GitHub.
- Arriba aparece la franja **«LOCAL · DATOS FICTICIOS»**, para que nunca se confunda con lo real.

No hace falta instalar nada más que Node 24: la plantilla no usa paquetes externos.

## Qué trae

- **Una herramienta de ejemplo, «Lista de tareas»** (http://localhost:5001). Sirve para ver cómo se hace todo:
  - crear, editar y buscar tareas;
  - filtrar por estado;
  - elegir varias a la vez y cambiarlas juntas;
  - mandar a la papelera y restaurar (nada se borra de verdad);
  - la actividad: quién hizo qué, visible solo para los administradores.

  Es la parte que después se reemplaza por tu herramienta.
- **El kit de diseño** (http://localhost:5001/kit.html): botones, tarjetas, tablas, formularios, diálogos, avisos, la barra de acciones en grupo y cómo se ve en el teléfono. Cada pieza está viva y tiene su código para copiar.
- **`herramienta.json`**: la ficha de tu herramienta (nombre, Lab, quién la ve, dirección). Con ella, Media Labs la agrega a la entrada de Monkey System. Para ver cómo va a quedar: `npm run entrada`.
- **Modo pruebas** (`npm run pruebas`): la franja «AMBIENTE DE PRUEBAS» y una base de datos aparte. Tú no lo necesitas; queda para cuando la herramienta esté publicada y el Lab quiera un ambiente de pruebas en internet.
- **Pruebas automáticas** (`npm test`): revisan que todo siga funcionando. Tienen que pasar antes de pedir el OK.

## Crear tu herramienta

El camino completo está en la [guía para directores, §4](https://github.com/brunopero-sudo/plataformas-monkeylabs/blob/main/GUIA.md#4-cómo-nace-una-herramienta-paso-a-paso). En corto (y cuéntale la idea a Bruno antes de invertir muchas horas):

1. **Crea tu repo desde esta plantilla, en tu cuenta.**
   - En GitHub: «Use this template» → «Create a new repository».
   - Dueño: tu cuenta. Nombre: el de tu herramienta, en minúsculas y con guiones (por ejemplo, `lista-rodajes`). Privado.
   - O pídeselo a Claude: «Crea mi repo desde la plantilla plantilla-monkeylabs, en mi cuenta, y clónalo».
2. **Constrúyela con Claude en tu computador**, de a un paso:
   - «Cambia herramienta.json con el nombre, el Lab, quién ve mi herramienta y la dirección de mi repo.»
   - «Reemplaza la Lista de tareas por mi herramienta, según mi propuesta. Usa los componentes del kit.» Claude sabe cómo hacerlo: está en `CLAUDE.md`.
   - «Levántala y muéstramela, también en el teléfono.»
   - «Corre las pruebas.»
3. **Si usa otros servicios** (Metricool, Airtable, etc.), pruébala con tus propias claves de prueba.
   - Las pegas tú en el archivo `.env` de tu computador, nunca en el chat.
   - Ese archivo no se sube a GitHub.
   - Las claves reales las pone Bruno al publicar.
   - Para Google (planillas, Drive), usa la cuenta pruebas@monkeylabs.cl.
   - Si necesita datos de otra plataforma (por ejemplo, del Portal), invéntalos con el mismo formato y anótalo en la entrega.
4. **Entrégala:** sube tus cambios, invita a `brunopero-sudo` a tu repo y mándale a Bruno la nota de entrega (Claude te la escribe si le pides «prepara la nota de entrega para Bruno»).
5. **Si Bruno la aprueba**, su conversación la copia a la cuenta de Bruno, el Lab que corresponda se hace cargo y se publica en Monkey System.

El detalle técnico de cada paso, para Claude, está en [`docs/PASO-A-OPERATIVO.md`](docs/PASO-A-OPERATIVO.md).

## Carpetas

- `public/`: lo que se ve en el navegador.
  - `index.html` y `js/tareas.js`: la herramienta de ejemplo.
  - `kit.html`: el kit de diseño.
  - `css/sistema.css`: los colores y los componentes.
  - `js/ui.js`: las piezas comunes (avisos, diálogos, selección).
- `lib/`: el servidor.
  - `config.js`: los modos.
  - `auth.js`: el login.
  - `db.js`: la base de datos.
  - `tareas.js`: la lógica de la herramienta de ejemplo.
  - `herramienta.js`: la ficha para la entrada.
- `server.js`: las direcciones de la herramienta.
- `docs/`:
  - `DISENO.md`: diseño y usabilidad.
  - `PASO-A-OPERATIVO.md`: cómo se publica.
- `test/`: las pruebas automáticas.
