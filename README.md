# Guerra naval

Juego de guerra naval por turnos, proyecto de Diseño Basado en Patrones.

## Estructura

| Carpeta | Capa | Contenido |
|---|---|---|
| `src/domain` | Dominio | Entidades y reglas del juego |
| `src/application` | Aplicación | Fachada `Game` y resultados de los casos de uso |
| `src/infrastructure/http` | Infraestructura | API HTTP sobre `Game`; sesiones por cookie |
| `src/infrastructure/persistence` | Infraestructura | Jugadores y partidas terminadas en MySQL |
| `src/infrastructure/database` | Infraestructura | Conexión y migraciones (`migrations/*.sql`) |
| `deploy`, `compose.yaml` | Despliegue | Imágenes de la API y la web; MySQL, API y web con Docker Compose |
| `apps/web` | Presentación | Cliente Vue; solo habla con la API |
| `apps/console` | Presentación | Cliente de consola; solo habla con la API |

Cada aplicación de `apps` es un proyecto aparte y no importa nada de `src`.

## Despliegue

```sh
cp .env.example .env              # y cambia las contraseñas
docker compose up -d --build      # MySQL, API y web
```

Se juega en http://localhost:8080. La API aplica las migraciones pendientes al
arrancar. MySQL queda publicado solo en esta máquina, en el puerto 3307.

## Desarrollo

La API necesita MySQL. Basta con el servicio `db` del despliegue:

```sh
cp .env.example .env && docker compose up -d db
npm install && npm start                      # API en http://127.0.0.1:3000
cd apps/web && npm install && npm run dev     # vista web en http://localhost:5173
cd apps/console && npm install && npm start   # consola (API_URL para otra dirección)
npm run migrate                               # solo las migraciones
npm test                                      # con DB_HOST en .env también prueba MySQL
```

Un jugador nuevo recibe un código hex de 16 caracteres; con él vuelve a su
partida y a sus partidas guardadas desde cualquier navegador. Solo se guarda
el hash del código, así que perderlo no tiene arreglo.

En ambos clientes las filas se nombran con letras (A, B, ...) y las columnas con
números desde 1: «C4» es la fila 2, columna 3 de la API (base 0). Un barco se
ubica por su extremo izquierdo o superior, y un arma apunta a la esquina
superior izquierda de su área.
