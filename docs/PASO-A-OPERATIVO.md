# De la idea a operativo: detalle técnico

**El camino en simple** (idea, repo en tu cuenta, construir, entregar, revisión y aprobación) está en la [guía para directores, §4](https://github.com/brunopero-sudo/plataformas-monkeylabs/blob/main/GUIA.md#4-cómo-nace-una-herramienta-paso-a-paso). **Cómo revisa Bruno** está en el mapa, en [«Revisar la propuesta de un director»](https://github.com/brunopero-sudo/plataformas-monkeylabs/blob/main/CLAUDE.md#revisar-la-propuesta-de-un-director).

Aquí va lo técnico de cada paso, para el Claude del director y para las conversaciones de Bruno. Los directores tienen solo lectura en `plataformas-monkeylabs` y en esta plantilla, y no tocan las plataformas existentes.

## 1. Crear el repo (Claude del director)

- [ ] Crear el repo privado desde la plantilla, en la cuenta del director, con el nombre de la herramienta en minúsculas y con guiones. También se puede con «Use this template» en GitHub.
  ```bash
  gh repo create <usuario>/<id> --template brunopero-sudo/plantilla-monkeylabs --private --clone
  ```
- [ ] Ajustar:
  - `herramienta.json`: `id`, `nombre`, `lab`, `descripcion`, `ver`, `responsable` (el correo del director), `repo` (`https://github.com/<usuario>/<id>`) y un `puerto` libre desde el 5002;
  - el `name` de `package.json`;
  - el puerto de `.claude/launch.json`.

## 2. Construir y probar en local (Claude del director)

- [ ] Reemplazar la herramienta de ejemplo (`CLAUDE.md`, «Reemplazar la herramienta de ejemplo»). Commits chicos. En su repo, el director puede unir a `main`, porque ahí no se publica nada.
- [ ] `npm test` pasa, y la revisión en el navegador está hecha en escritorio y a 375 px.
- [ ] **Servicios externos** (Metricool, Airtable, etc.):
  - claves de prueba del director, que él pega en `.env`;
  - cada nombre va sin valor en `.env.example` y en `herramienta.json` (`variables`, con `secreto: true`);
  - en `npm test` el servicio se simula;
  - detalle en `CLAUDE.md`, «Integraciones con servicios externos».
- [ ] **Google** (Drive, Sheets, Apps Script): recursos de pruebas@monkeylabs.cl.
- [ ] **Datos de una plataforma existente** (por ejemplo, proyectos del Portal): se inventan con el mismo formato y se anotan en la entrega. La conexión real la hace el Lab al aprobarse.

## 3. Antes de entregar (Claude del director)

- [ ] En `herramienta.json`, `estado: "entregada"`. `npm run entrada` no debe mostrar nada que corregir.
- [ ] Revisar que el historial de git no tenga `.env`, `data/` ni bases de datos. Si esto muestra algo, avisarle a Bruno antes de entregar:
  ```bash
  git log --all --name-only --format= | grep -E '(^|/)\.env$|^data/|\.sqlite'
  ```
- [ ] Subir los cambios e invitar a `brunopero-sudo` (con lectura basta):
  ```bash
  gh api repos/<usuario>/<id>/collaborators/brunopero-sudo -X PUT -f permission=pull
  ```
- [ ] Escribir la nota de entrega para Bruno (GUIA §4, paso 5): qué hace, a qué Lab va, qué datos y claves necesitaría en producción (solo los nombres) y cómo se levanta.

## 4. Revisión

La hacen el Orquestador y el Lab, según el mapa («Revisar la propuesta de un director»). Los ajustes vuelven al director, que los hace en su repo y vuelve a avisar.

## 5. Al aprobarse: el repo pasa a la cuenta de Bruno (conversación del Lab)

- [ ] Revisar de nuevo el historial (el mismo comando del paso 3). Si hay algo, se copia sin historial, porque lo que entró a git queda para siempre.
- [ ] Copiar el repo, con su historial:
  ```bash
  git clone --mirror https://github.com/<usuario>/<id>.git
  gh repo create brunopero-sudo/<id> --private
  git -C <id>.git push --mirror https://github.com/brunopero-sudo/<id>.git
  ```
- [ ] Proteger `main` (pull request, code owners, descartar aprobaciones viejas, sin force push ni borrado). Revisar `.github/CODEOWNERS` (`@brunopero-sudo`) y la plantilla de pull request.
- [ ] El Orquestador la suma al mapa (el Lab a cargo y el puerto definitivo), a `clonar.sh` y a `.claude/launch.json`.
- [ ] Desde aquí rigen las reglas de siempre: rama y pull request en el repo de Bruno, y solo Bruno decide qué sale a producción.

## 6. Publicar, con «publica en operativo» (conversación del Lab)

- [ ] Crear en Railway el proyecto `<id>`, con:
  - el servicio conectado a `brunopero-sudo/<id>`, rama `main`;
  - un volumen en `/data`;
  - un dominio fijo.
- [ ] Poner las variables sin valor secreto:
  - `GOOGLE_CLIENT_ID` (el mismo cliente de Monkey System);
  - `PUBLIC_URL`;
  - `DATA_DIR=/data`;
  - `MODO` sin definir: en Railway es `produccion`.
- [ ] **Bruno:**
  - aprieta **Run** en el comando que le deja Claude para crear `SESSION_SECRET` sin que nadie la vea:
    ```bash
    node scripts/clave-sesion.mjs --proyecto <id del proyecto> --servicio <id del servicio> --ambiente production --cambiar
    ```
  - pone en Railway las claves reales de las integraciones (las de `herramienta.json` con `secreto: true`);
  - agrega el dominio como origen autorizado en Google Cloud (cliente OAuth «Grillas MonkeyLabs»).
- [ ] Aplicar los cambios en borrador de Railway (`get-staged-changes` y luego `accept-deploy`).
- [ ] Verificar en producción: el login con Google, que no haya franja y que las integraciones funcionen con las claves reales.

## 7. En la entrada de Monkey System

- [ ] En `herramienta.json`, `estado: "operativo"` y `urls.produccion`; después, `npm run entrada`.
- [ ] **Media Labs:** pega esa línea en `lib/sistema.js` de monkey-system, dentro del Lab indicado, con un pull request. Es producción: se une con otro «publica en operativo».
- [ ] **Orquestador:** actualiza «Mapa de plataformas» y «Quién ve qué en Monkey System».

Si más adelante el Lab quiere un ambiente de pruebas en internet, la plantilla ya trae `MODO=pruebas` (ver `CLAUDE.md`, «Modos»).
