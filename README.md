# Reportería RRSS · Monkey System (Digital Labs)

Reportes mensuales de redes orgánicas, armados por el equipo sin pasar por Claude y compartidos con el cliente en un link propio.

- **Para el equipo (con la cuenta @monkeylabs.cl):** una grilla con los clientes del mes y el estado de cada reporte. Al abrir uno se ven las láminas tal como las verá el cliente, con los números ya calculados desde Metricool. Los textos se escriben haciendo clic sobre ellos.
- **Para el cliente:** un link por reporte (`/r/…`) que se abre sin cuenta, en computador o teléfono, se puede presentar a pantalla completa y guardar en PDF. Solo muestra el reporte cuando el equipo lo marca «listo».

Clientes de partida: Achs (Seguro Laboral, Achs Salud, Hospital del Trabajador y Segurito, más social listening), Alflorex, Muno, Pesas Chile, STP y Wurtex. Se agregan o cambian en la pestaña **Clientes**, sin tocar código.

## Cómo se arma un reporte

1. **Reportes →** elegir el mes → **Crear reporte** en el cliente.
2. **↻ Actualizar datos:** trae de Metricool el mes (hasta ayer, o el fin de mes) y el mismo tramo del mes anterior. La fecha de corte se cambia en «Datos hasta».
3. **Escribir los textos:** clic sobre cualquier espacio rosado de las láminas. Se guarda solo al salir del texto. `**así**` queda en negrita y una línea en blanco empieza otro párrafo.
   - **✦ Proponer textos** (opcional): Claude redacta los espacios vacíos siguiendo los lineamientos del cliente. Nunca reemplaza lo que ya escribió el equipo, salvo que se pida en «Más → Reescribir todos los textos».
4. **Achs · ⇪ Subir Brandwatch:** el PDF mensual de Brandwatch. Claude lo lee y arma las láminas de social listening (menciones, sentimiento, temas, canales, aprendizajes y alertas).
5. **Marcar listo → Copiar link del cliente.** Se puede seguir corrigiendo después; el cliente ve siempre la última versión. «Volver a borrador» lo oculta de nuevo y «Más → Cambiar el link» invalida el anterior.

### Qué muestra cada reporte

Portada · resumen del mes (tabla por red o por marca, y el funnel conocimiento → consideración) · por cada red: sus indicadores contra el mes anterior, la lectura y el top 3 de contenidos · hallazgo y evidencia · competencia en Instagram · optimizaciones (escalar, corregir, testear) · social listening (Achs) · notas metodológicas.

Reglas de cálculo (las mismas de los reportes de septiembre 2026):
- Engagement de Instagram = interacciones del feed ÷ alcance del feed.
- Achs, TikTok: un video con 50.000 vistas o más en el mes cuenta como «pauta estimada» y el top muestra solo orgánicos (la regla se cambia por cliente).
- LinkedIn: las interacciones incluyen clics.
- Top ordenado por visibilidad: alcance en Instagram y Facebook, vistas en TikTok y YouTube, impresiones en LinkedIn.

## Verla en tu computador

```bash
npm install
npm start
```

Se abre en http://localhost:5003, sin login (entras como pruebas@monkeylabs.cl) y con la franja «LOCAL · DATOS FICTICIOS».

- **Sin clave de Metricool,** los datos son inventados, para probar la herramienta. Con tu clave de prueba en `.env` (`METRICOOL_TOKEN` y `METRICOOL_USER_ID`), trae los datos reales. El archivo `.env` nunca va a GitHub y las claves nunca se pegan en un chat.
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
  - `textos.js`: los espacios de texto de cada reporte.
  - `ia.js`: Claude (proponer textos y leer Brandwatch).
  - `reportes.js`, `clientes.js`, `periodos.js`, `clientes-iniciales.js`.
  - `config.js`, `auth.js`, `db.js`, `herramienta.js`: de la plantilla.
- `public/`:
  - `index.html` + `js/app.js`: el constructor para el equipo.
  - `publico/`: las láminas (`laminas.js`, `reporte.css`) y la página del cliente (`cliente.html`). Lo usan las dos caras, así el equipo ve exactamente lo que verá el cliente.
- `test/`: las pruebas automáticas.
