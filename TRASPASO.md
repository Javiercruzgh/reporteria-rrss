# Traspaso a Bruno · Reportería RRSS

Herramienta nueva de Digital Labs, hecha por Javier (director) desde `plantilla-monkeylabs`. Está en el repo `Javiercruzgh/reporteria-rrss`. Hoy funciona en local con datos de prueba y con datos reales cargados a mano desde el conector de Metricool. **No está publicada.**

## Qué hace

- El equipo arma el reporte mensual de redes orgánicas de cada cliente en un constructor. Los datos vienen de Metricool, del mes contra el mismo tramo del mes anterior.
- El reporte se arma con láminas, sin nada fijo por marca:
  - snapshot y top 3 de contenidos por red, con la imagen de cada publicación;
  - insight y evidencia por marca;
  - competencia, optimizaciones y social listening (desde el PDF de Brandwatch);
  - cajas de texto e imágenes, y una lámina en blanco.
- La IA es opcional: propone textos y lee el PDF de Brandwatch. Sin clave, los textos se escriben a mano.
- El cliente ve el reporte en un link propio (`/r/<token>`), sin cuenta, solo cuando el equipo lo marca «listo». Puede presentarlo o guardarlo en PDF.
- Varias personas pueden editar al mismo tiempo: un aviso muestra los cambios de otros y un historial guarda quién hizo qué.
- El uso está en el [README](README.md) y lo técnico en [CLAUDE.md](CLAUDE.md).

## Lo que tiene que hacer Bruno

1. **Regenerar el token de Metricool.** El anterior quedó expuesto en un chat el 30-09 (Javier lo borró, pero hay que darlo por comprometido). Se regenera en la sección API de la cuenta de Metricool.
2. **Revisar la propuesta** con el Orquestador, según «Revisar la propuesta de un director» en `plataformas-monkeylabs/CLAUDE.md`.
3. **Con su OK:** copiar el repo a `brunopero-sudo`, proteger `main` y asignarlo a la conversación de Digital Labs.
4. **Con «publica en operativo»:**
   - crear el servicio en Railway con un volumen en `/data` y las variables de abajo;
   - agregar el dominio como origen autorizado en el cliente OAuth «Grillas MonkeyLabs»;
   - Media Labs agrega la herramienta a la entrada (`npm run entrada`).

   El checklist completo está en `docs/PASO-A-OPERATIVO.md`.

## Variables para Railway (las pone Bruno; nunca en el código ni en el chat)

| Variable | Valor | Obligatoria |
|---|---|---|
| `GOOGLE_CLIENT_ID` | El mismo cliente OAuth de Monkey System | Sí |
| `SESSION_SECRET` | Una clave larga nueva, solo para esta herramienta | Sí |
| `PUBLIC_URL` | La URL pública del servicio | Sí |
| `DATA_DIR` | `/data` (el volumen) | Sí |
| `METRICOOL_TOKEN` | **El token nuevo**, el regenerado | Sí, para datos reales |
| `METRICOOL_USER_ID` | `2262331` (la cuenta de bruno@, dueña de las marcas). No es secreto. | Sí, para datos reales |
| `ANTHROPIC_API_KEY` | Clave de Claude | No: sin ella, los textos se escriben a mano. Costo estimado: USD 2 a 3 al mes |
| `ADMINS` | `bruno@monkeylabs.cl,emilio@monkeylabs.cl` | Ya viene por defecto |

**Para más adelante (no está programado):** elegir imágenes directo desde Drive con Google Picker. Hace falta habilitar la Picker API en el proyecto «Grillas MonkeyLabs» y crear una clave de API restringida al dominio. Hoy las imágenes se suben desde el computador; con Google Drive para escritorio, las carpetas de Drive aparecen ahí.

## Lo que falta verificar con el token nuevo

La conexión directa con la API REST de Metricool (`lib/metricool.js`) **no está probada con una clave real**: la forma de las respuestas se armó a partir de la documentación. Los datos reales de las pruebas se sacaron con el conector de Metricool. Para verificarla:

1. Con el token en el `.env` local, correr `npm start` y crear el cliente Alflorex desde «Clientes → Nuevo cliente». La lista de marcas debe venir de Metricool, no las 3 de prueba.
2. Crear su reporte de septiembre 2026, con datos hasta el 28, y apretar «Actualizar datos».
3. Comparar con lo que dio el conector: Instagram 6.628 seguidores (6.557 en agosto), 8 carruseles y 3 reels, 22 historias, alcance del feed 4.052 (3.303) y 208 interacciones (209); TikTok 481 seguidores (459), sin videos en septiembre y 5 en agosto.
4. Si algo no calza, se ajusta la normalización en `lib/metricool.js`, que es el único archivo que conoce los nombres de los campos de Metricool.

## Marcas en Metricool (blogId)

Son los números que la herramienta guarda por marca. Con el token, se eligen solos desde la lista de Metricool; sin él, se escriben en «Editar cliente → Número en Metricool».

| Cliente | Marca | blogId | Redes en Metricool |
|---|---|---|---|
| Achs | Masterbrand | 3235332 | LinkedIn, YouTube |
| Achs | Seguro Laboral | 3235334 | Facebook, Instagram, LinkedIn, TikTok |
| Achs | Salud | 3235336 | Facebook, Instagram, LinkedIn, TikTok |
| Achs | Hospital del Trabajador | 3235338 | Facebook, Instagram, LinkedIn |
| Achs | Segurito | 3235340 | Facebook, Instagram, TikTok, YouTube |
| Alflorex | Alflorex | 4369569 | Facebook, Instagram, TikTok, YouTube |
| Muno | Muno | 4323563 | Facebook, Instagram, TikTok, YouTube |
| Pesas Chile | Pesas Chile | 2814179 | Facebook, Instagram, TikTok |
| STP | STP | 6962385 | Instagram, TikTok |
| Wurtex | Wurtex | 6962412 | Instagram, TikTok |

Achs lleva social listening (PDF mensual de Brandwatch) y la regla de pauta de TikTok en 50.000 vistas. Los lineamientos de ejemplo están en `docs/LINEAMIENTOS.md`.

## Seguridad

- En git no hay claves ni datos de clientes: `data/` y `.env` están ignorados y solo va `.env.example`, sin valores.
- Lo único que se ve sin sesión es el login, el código de las láminas (`/publico/`) y el link del cliente, que solo existe si el reporte está «listo». El link no se indexa y se puede cambiar; al cambiarlo, el anterior deja de funcionar.
- Las imágenes se revisan por su firma (PNG, JPG, WEBP o GIF; SVG no) y solo se sirven dentro de su reporte.
- Borrar es mandar a la papelera; la de clientes es solo para administradores.
