# Guerra naval

Juego de guerra naval por turnos, proyecto de Diseño Basado en Patrones.

## Estructura

| Carpeta | Capa | Contenido |
|---|---|---|
| `src/domain` | Dominio | Entidades y reglas del juego |
| `src/application` | Aplicación | Fachada `Game` y resultados de los casos de uso |
| `src/infrastructure/http` | Infraestructura | API HTTP sobre `Game` |
| `apps/web` | Presentación | Cliente Vue; solo habla con la API |
| `apps/console` | Presentación | Cliente de consola; solo habla con la API |

Cada aplicación de `apps` es un proyecto aparte y no importa nada de `src`.

## Uso

```sh
npm install && npm start                      # API en http://127.0.0.1:3000
cd apps/web && npm install && npm run dev     # vista web en http://localhost:5173
cd apps/console && npm install && npm start   # consola (API_URL para otra dirección)
```
