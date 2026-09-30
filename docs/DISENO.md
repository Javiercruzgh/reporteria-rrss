# Diseño y usabilidad

Todas las herramientas de Monkey System se ven y se usan igual. Quien ya usó una, tiene que entender la siguiente sin explicación. Las piezas vivas y su código están en `/kit.html`; aquí van las reglas.

## Principios

1. **Primero el teléfono.** Se diseña para 375 px de ancho y después se aprovecha el espacio del computador.
2. **Una acción principal por pantalla**, en rosa. Lo demás, con botones de borde.
3. **Nada se pierde:** borrar es mandar a la papelera, siempre con confirmación, y se puede restaurar.
4. **El sistema dice lo que pasó:** cada acción termina en un aviso breve con el resultado, y cada zona que carga tiene su estado de carga, de vacío y de error.
5. **Español de Chile, directo y amable.**

## Marca (la de la licitación Achs Salud)

- **Colores** (tokens en `sistema.css`):

  | Token | Color | Uso |
  |---|---|---|
  | `--ink` | `#131114` | Fondo |
  | `--ink-3` | — | Tarjetas |
  | `--cream` | `#F6ECE2` | Texto, y el fondo de la barra de acciones en grupo |
  | `--pink` | `#FC3297` | El acento: acción principal, lo elegido, la palabra destacada |
  | `--purple` / `--lila` | `#512168` | El resplandor y detalles |
  | `--ok`, `--warn`, `--crit` | — | Solo estados: listo, atención y error o peligro |

- **Tipografías:**
  - Archivo ancho (`font-variation-settings:"wdth" 122`, peso 800) para títulos.
  - Neue Metana Next para la palabra en rosa (`<em>` dentro del título).
  - IBM Plex Mono en mayúsculas espaciadas para etiquetas, fechas y datos chicos.
  - Archivo normal para leer.
- **Textura:** el grano (`.grain`) y el resplandor (`.glow`) van en todas las páginas, detrás del contenido.
- **Nombre de la herramienta:** la última palabra va en rosa (`Lista de <em>tareas</em>`).

## Estructura de una pantalla

1. **Franja de pruebas** (solo fuera de producción; la pone el servidor).
2. **Barra superior**, pegada arriba en el computador:
   - el link de vuelta a Monkey System, con el logo;
   - el nombre de la herramienta;
   - las pestañas;
   - quién entró (y «admin», si corresponde).
3. **Cabeza:**
   - una etiqueta en mono con el Lab o el contexto (`ProjectLabs · Lista de tareas`);
   - el título grande;
   - a la derecha, la acción principal.
4. **Filtros:** chips por categoría, con su número, y un buscador.
5. **Barra de acciones en grupo** (`#sel`), solo cuando hay algo elegido.
6. **Contenido:** una grilla de tarjetas (cuando cada ítem tiene más de dos datos) o una tabla (para listas de registro, como la papelera o la actividad).

## Patrones

- **Crear y editar:**
  - un diálogo con el mismo formulario;
  - el título dice qué se hace («Nueva tarea», «Editar tarea»);
  - el botón principal repite el verbo («Crear tarea», «Guardar cambios»);
  - si el servidor rechaza algo, el error aparece dentro del diálogo y no se pierde lo escrito.
- **Confirmar un borrado** (`confirmar()`):
  - el título es una pregunta con cuántas cosas se mueven: «¿Mandar 3 tareas a la papelera?»;
  - el texto dice qué pasa y cómo deshacerlo: «Salen de la lista y se pueden restaurar desde la Papelera.»;
  - si algunas no se van a mover, lo dice y por qué: «1 de las elegidas no se mueve: es de otra persona.»;
  - el botón repite la acción en rojo lleno: «Mandar a la papelera», nunca «Aceptar».
- **Selección múltiple:**
  - la casilla en la esquina de cada tarjeta elige (en pantallas táctiles se ve siempre);
  - con algo elegido, un clic en la tarjeta también elige;
  - Shift elige un rango y Escape quita todo;
  - la barra crema dice cuántas hay, las acciones, «Elegir las N» y «Quitar selección»;
  - después de una acción quedan elegidas solo las que no se pudieron cambiar.
- **Avisos:**
  - `toast` para el resultado de una acción, en pasado y con números («2 tareas quedaron en «Lista».»);
  - en rojo, si falló;
  - `.aviso` fijo para algo que hay que saber antes de actuar.
- **Estados:**
  - cargando, con el giro y lo que se está cargando;
  - vacío, con qué hacer y un botón si corresponde;
  - error, con qué pasó y «Reintentar».
- **Permisos:**
  - lo que alguien no puede hacer no se le muestra (el botón de papelera en una tarea ajena);
  - igual, el servidor lo valida.
- **Formularios:**
  - el nombre del campo va arriba y lo opcional dice «Opcional»;
  - el error va debajo del campo;
  - los correos se aceptan solo @monkeylabs.cl;
  - las fechas con el selector del navegador.

## Tono

- **Tutear**, como a un compañero.
- **Botones con verbo:** «Crear tarea», «Mandar a la papelera», «Restaurar». Nunca «OK», «Submit» ni «Eliminar definitivamente».
- **Avisos en pasado y concretos:** «Tarea creada.», «3 tareas quedaron en «Lista».»
- **Errores que dicen qué hacer:** «El responsable tiene que ser un correo @monkeylabs.cl.» Nunca códigos ni inglés («Error 400», «invalid»).
- **Vacíos que invitan:** «Todavía no hay tareas. Crea la primera para empezar.»
- **Formato:** mayúscula solo al inicio, comillas «así» y fechas como «3 oct 2026».

## En el teléfono

- **Sin desplazamiento hacia el lado:**
  - las grillas van con `minmax(0,1fr)`;
  - las tablas, dentro de `.tabla-caja`;
  - el texto largo se corta con `overflow-wrap:anywhere`.
- **La barra superior:** las pestañas bajan a una segunda fila y la barra se va con el scroll. La barra de acciones queda pegada arriba.
- **Botones:** la acción principal ocupa todo el ancho. Los botones miden 40 px de alto como mínimo.
- **Los diálogos** ocupan el ancho con 16 px de margen, y los campos dobles se apilan.
- **Se prueba de verdad a 375 px** antes de pedir el OK.

## Accesibilidad

- **Foco visible** (contorno rosa) en todo lo que se puede usar con teclado.
- **Las tarjetas** se abren con Enter.
- **Los diálogos** se cierran con Escape y devuelven el foco a donde estaba.
- **Los botones de solo ícono** llevan `aria-label` (por ejemplo, «Elegir «Revisar la grilla»»).
- **Los avisos** usan `role="status"` (o `alert` si es un error).
- **Se respeta `prefers-reduced-motion`.**

## Patrones de otras plataformas

Probados en Grillas (repo `grillas-monkeylabs`, rama `main`). Se copian de ahí cuando una herramienta los necesite.

- **Carriles** (una fila por categoría, con los ítems ordenados por fecha): sirven para cualquier cosa con «ítems en el tiempo por categoría», como entregas por proyecto o rodajes por cliente.
  - Cada categoría tiene su color: Instagram, rosa `#FC3297`; TikTok, lila `#B98BD6`; LinkedIn, ámbar `#E8A33D`; Mailing, verde `#3ECF8E`. Hay variaciones por formato.
  - Fuente: `public/js/shared.js` (`PLATAFORMAS`, `COLORES_FORMATO`, `colorDe`, `ubicarEnCarril`).
- **Fichas compactas:**
  - llevan fecha, categoría (ícono y color), formato, título y estado;
  - al pasar el mouse muestran una miniatura;
  - las imágenes mantienen su proporción real y nunca se estiran;
  - las fotos de fondo de sección van a pantalla completa, con `object-fit:cover` y opacidad ~0,18, y el grano es el protagonista.
- **Un documento, tres vistas:**
  - el mismo JSON se ve como presentación (equipo), como vista cliente (link externo) y como lienzo editable (iframe de 1440 × 900);
  - la vista cliente se arma en el servidor, sin notas internas ni links de Drive (`paraCliente`).
- **Links para clientes sin cuenta:**
  - un token aleatorio por documento (`?c=<token>`) deja una cookie por 120 días y se compara con `timingSafeEqual`;
  - el cliente solo lee, comenta o aprueba, y el servidor mezcla solo eso (`mezclarCliente`);
  - no depende del secreto de sesión: si se cambian las claves, los clientes no se cortan.
- **Comentarios y aprobaciones:**
  - cada ítem queda Pendiente, Aprobado, Con ajustes o Rechazado; los dos últimos abren el panel y piden un comentario con un aviso, pero no es obligatorio (si una herramienta lo quiere obligatorio, lo valida el servidor);
  - arriba, un resumen con cuántos hay por estado;
  - fuente: `public/js/review.js`.
- **Guardado sin pisarse:**
  - cada guardado lleva `rev`; uno viejo responde 409 y el navegador fusiona solo cuando lo nuevo son comentarios del cliente (`state.js`);
  - se guarda una copia en `historial/` cada 2 minutos (quedan las últimas 60).
- **Franja en vistas a pantalla completa** (presentaciones, láminas): en vez de la franja entera va una pestaña angosta centrada, de 18 px y con las esquinas de abajo redondeadas, para no correr la lámina (`conFranja(html, encima)` en `server.js` de Grillas).
- **Ventana bloqueante** para resultados importantes (por ejemplo, el fin de una sincronización): una ventana central que hay que cerrar a mano, con el detalle de lo que cambió (`modal(html, { bloqueante: true })` en `constructor.js`).
