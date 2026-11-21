# Despliegue en Railway

Railway no ejecuta `compose.yaml` tal cual: cada servicio del compose pasa a
ser un servicio de un proyecto de Railway. MySQL se reemplaza por el MySQL
administrado de Railway, que trae su propio almacenamiento y respaldos.

| Compose | Railway | Configuración |
|---|---|---|
| `db` (mysql:8.4) | **MySQL** (Database → MySQL) | Ninguna: Railway crea las variables `MYSQL*` |
| `api` | **api** (GitHub Repo) | [api.json](api.json) |
| `web` | **web** (GitHub Repo) | [web.json](web.json); es el único con dominio público |

Lo que hace el compose y Railway no, ya lo resuelve el código:

- No hay `depends_on`: la API reintenta la conexión a MySQL durante un minuto
  (`waitForDatabase`) y después aplica las migraciones al arrancar.
- La red privada puede ser solo IPv6: la API escucha en `::`, y nginx también
  en `[::]`.
- nginx toma la dirección de la API de `API_UPSTREAM`; en compose vale
  `api:3000`.
- El dominio público usa HTTPS: con `SESSION_COOKIE_SECURE=true`, la cookie de
  sesión solo viaja por HTTPS.

## Con la CLI (como está desplegado)

`railway up` sube el directorio local, sin pasar por GitHub, y respeta
`.gitignore` (no sube `.env` ni `node_modules`). Se usa la CLI 5 o posterior;
`npx @railway/cli@latest` sirve sin instalarla.

```sh
railway init --name guerra-naval
railway add --database mysql
railway add --service api \
  -v 'DB_HOST=${{MySQL.MYSQLHOST}}' -v 'DB_PORT=${{MySQL.MYSQLPORT}}' \
  -v 'DB_USER=${{MySQL.MYSQLUSER}}' -v 'DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}' \
  -v 'DB_NAME=${{MySQL.MYSQLDATABASE}}' -v 'HOST=::' -v 'PORT=3000' \
  -v 'SESSION_COOKIE_SECURE=true' -v 'RAILWAY_DOCKERFILE_PATH=deploy/api.Dockerfile'
railway add --service web \
  -v 'API_UPSTREAM=${{api.RAILWAY_PRIVATE_DOMAIN}}:3000' -v 'PORT=8080' \
  -v 'RAILWAY_DOCKERFILE_PATH=deploy/web.Dockerfile'
railway up --service api --ci
railway up --service web --ci
railway domain --service web --port 8080
```

Para publicar cambios basta con repetir los dos `railway up`.

`RAILWAY_DOCKERFILE_PATH` reemplaza al archivo de configuración: así
desplegado, Railway no lee `api.json` ni `web.json`. Para que use su
healthcheck y su política de reinicio, indica la ruta del archivo en
**Settings → Config-as-code** de cada servicio.

## Desde GitHub (panel)

1. Sube la rama a GitHub (Railway construye desde el repositorio).
2. En Railway: **New Project → Empty project**.
3. **+ New → Database → MySQL**. Déjale el nombre `MySQL`.
4. **+ New → GitHub Repo**, elige el repositorio y la rama, y llama al servicio
   `api`. En **Settings**:
   - **Config-as-code → Railway Config File**: `/deploy/railway/api.json`.
   - **Variables → Raw Editor**:

     ```env
     DB_HOST=${{MySQL.MYSQLHOST}}
     DB_PORT=${{MySQL.MYSQLPORT}}
     DB_USER=${{MySQL.MYSQLUSER}}
     DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
     DB_NAME=${{MySQL.MYSQLDATABASE}}
     HOST=::
     PORT=3000
     SESSION_COOKIE_SECURE=true
     ```

   - Sin dominio público: solo la web habla con la API, por la red privada.
5. **+ New → GitHub Repo** otra vez, mismo repositorio y rama; llama al
   servicio `web`. En **Settings**:
   - **Railway Config File**: `/deploy/railway/web.json`.
   - **Variables**:

     ```env
     API_UPSTREAM=${{api.RAILWAY_PRIVATE_DOMAIN}}:3000
     PORT=8080
     ```

   - **Networking → Generate Domain**, con puerto destino `8080`.
6. Abre el dominio `*.up.railway.app` de `web`. En el registro de `api` debe
   aparecer `migrations applied` en el primer arranque.

## Comprobar

```sh
curl https://<dominio-web>/api/health      # {"status":"ok"}
```

Con la CLI (`railway login`, `railway link`), `railway logs --service api`
muestra el arranque, y `railway connect MySQL` abre un cliente SQL.
