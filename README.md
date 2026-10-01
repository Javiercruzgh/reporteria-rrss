# Reportería RRSS · Monkey System (Digital Labs)

> **Para Bruno, antes de publicar:** lee [TRASPASO.md](TRASPASO.md) y sigue la lista del [issue #2](https://github.com/Javiercruzgh/reporteria-rrss/issues/2). Lo primero es regenerar el token de Metricool, porque el anterior quedó expuesto en un chat. El token nuevo va en Railway (`METRICOOL_TOKEN`) junto con `METRICOOL_USER_ID=2262331`. Sin token, la herramienta funciona con datos de prueba.

Reportes mensuales de redes orgánicas, armados por el equipo sin pasar por Claude y compartidos con el cliente en un link propio.

- **Para el equipo (con la cuenta @monkeylabs.cl):** una grilla con los clientes del mes y el estado de cada reporte. Al abrir uno se ven las láminas tal como las verá el cliente, con los números ya calculados desde Metricool. Los textos se escriben haciendo clic sobre ellos.
- **Para el cliente:** un link por reporte (`/r/…`) que se abre sin cuenta, en computador o teléfono, se puede presentar a pantalla completa y guardar en PDF. Solo muestra el reporte cuando el equipo lo marca «listo».

La herramienta no trae marcas fijas: sirve para cualquier marca de Metricool. En **Clientes → Nuevo cliente** se eligen de la lista de Metricool las marcas que se reportan juntas (una sola, o varias como las submarcas de Achs), con sus redes, su regla de pauta y sus lineamientos para los textos ([ejemplos para copiar](docs/LINEAMIENTOS.md)).

## Cómo se arma un reporte

1. **Reportes →** elegir el mes → **+ Nuevo reporte** → elegir el cliente.
2. **↻ Actualizar datos:** trae de Metricool el mes (hasta ayer, o el fin de mes) y el mismo tramo del mes anterior. La fecha de corte se cambia en «Datos hasta».
3. **Armar las láminas:** el reporte parte con una propuesta según los datos que hay (portada, resumen, una lámina por red, hallazgo, competencia, optimizaciones, notas). Con las flechas de cada lámina se ordenan, con ✕ se quitan y con **+ Agregar lámina** se suman desde el catálogo: resumen, snapshot de una marca, una red, hallazgo, competencia, optimizaciones, social listening, texto libre, separador de marca, notas y cierre. «Más → Volver a la propuesta de láminas» deshace el armado.
   - **Cajas:** cada lámina tiene **+ Texto** y **+ Imagen** para sumar cajas de texto o imágenes (PNG, JPG, WEBP o GIF; se achican a 1.600 px). La **lámina en blanco** del catálogo es solo un título más las cajas que agregues.
   - **Por cada red:** un snapshot (indicadores y lectura) y una lámina de **top contenidos** con las 3 publicaciones que más rindieron, sus KPI y un espacio para la imagen de cada una (**+ Imagen de la publicación**, desde el computador). Para elegir desde Drive directo, Bruno tiene que habilitar Google Picker en Google Cloud; mientras tanto, con Google Drive para escritorio las carpetas de Drive aparecen en el selector de archivos del computador.
   - **Por cada marca:** una lámina de **insight y evidencia** en dos columnas que contrastan (insight a la izquierda, evidencia a la derecha). Solo texto.
   - **Campos:** en las láminas de cada red, **Campos** elige qué indicadores se ven y agrega campos escritos a mano (por ejemplo, ventas desde Instagram).
   - **Aviso de cambios:** si otra persona cambia el reporte mientras lo tienes abierto, aparece un aviso para ver sus cambios. En la grilla, los reportes que otros cambiaron desde tu última visita llevan una marca. «Más → Historial de cambios» muestra quién cambió qué.
4. **Escribir los textos:** clic sobre cualquier espacio rosado de las láminas. Se guarda solo al salir del texto. `**así**` queda en negrita y una línea en blanco empieza otro párrafo.
   - **✦ Proponer textos** (opcional): Claude redacta los espacios vacíos siguiendo los lineamientos del cliente. Nunca reemplaza lo que ya escribió el equipo, salvo que se pida en «Más → Reescribir todos los textos».
5. **Social listening · ⇪ Subir Brandwatch** (aparece cuando el reporte tiene esa lámina): el PDF mensual de Brandwatch. Claude lo lee y arma las láminas de social listening (menciones, sentimiento, temas, canales, aprendizajes y alertas).
6. **Marcar listo → Copiar link del cliente.** Se puede seguir corrigiendo después; el cliente ve siempre la última versión. «Volver a borrador» lo oculta de nuevo y «Más → Cambiar el link» invalida el anterior.

### Reglas de cálculo

 (las mismas de los reportes de septiembre 2026):
- Engagement de Instagram = interacciones del feed ÷ alcance del feed.
- TikTok con regla de pauta (se activa por cliente; en Achs, 50.000): un video con esas vistas o más en el mes cuenta como «pauta estimada» y el top muestra solo orgánicos.
- LinkedIn: las interacciones incluyen clics.
- Top ordenado por visibilidad: alcance en Instagram y Facebook, vistas en TikTok y YouTube, impresiones en LinkedIn.

## Verla en tu computador

```bash
npm install
npm start
```

Se abre en http://localhost:5003, sin login (entras como pruebas@monkeylabs.cl) y con la franja «LOCAL · DATOS FICTICIOS».

- **Sin clave de Metricool,** los datos y la lista de marcas son inventados, para probar la herramienta. Con tu clave de prueba en `.env` (`METRICOOL_TOKEN` y `METRICOOL_USER_ID`), trae los datos reales. El archivo `.env` nunca va a GitHub y las claves nunca se pegan en un chat.
- **Sin `ANTHROPIC_API_KEY`,** «Proponer textos» y «Subir Brandwatch» quedan apagados y los textos se escriben a mano. El resto funciona igual.
- **Más → Importar datos (JSON)** carga datos ya sacados con el conector de Metricool, en el formato de la herramienta (ver `lib/metricool.js`).

## Costo de la IA

Solo cuando alguien aprieta «Proponer textos» o «Subir Brandwatch» (modelo Claude Opus 5.5). Aproximado: USD 0,20 por reporte de una marca, USD 0,60 por Achs con cuatro marcas y USD 0,30 por PDF de Brandwatch. Al mes, con los seis clientes, alrededor de USD 2 a 3.

## Pruebas

```bash
npm test
```

Metricool y la IA van siempre simulados en las pruebas.

## Carpetas

- `lib/`: el servidor.
  - `metricool.js`: trae y ordena los datos de Metricool (API real o simulada).
  - `calculos.js`: los números de cada lámina.
  - `secciones.js`: el catálogo de láminas y la propuesta inicial de cada reporte.
  - `textos.js`: los espacios de texto de cada lámina.
  - `ia.js`: Claude (proponer textos y leer Brandwatch).
  - `reportes.js`, `clientes.js`, `periodos.js`.
  - `config.js`, `auth.js`, `db.js`, `herramienta.js`: de la plantilla.
- `public/`:
  - `index.html` + `js/app.js`: el constructor para el equipo.
  - `publico/`: las láminas (`laminas.js`, `reporte.css`) y la página del cliente (`cliente.html`). Lo usan las dos caras, así el equipo ve exactamente lo que verá el cliente.
- `test/`: las pruebas automáticas.
