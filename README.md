# Guerra naval

Juego de guerra naval por turnos, proyecto de Diseño Basado en Patrones.

## Estructura

| Carpeta | Capa | Contenido |
|---|---|---|
| `src/domain` | Dominio | Entidades y reglas del juego |
| `src/application` | Aplicación | Fachada `Game` y resultados de los casos de uso |
| `src/infrastructure/http` | Infraestructura | API HTTP sobre `Game` y su contrato OpenAPI |
| `web` | Presentación | Cliente Vue independiente; solo conoce `openapi.json` |

## Uso

```sh
npm install && npm start          # API en http://127.0.0.1:3000
cd web && npm install && npm run dev   # vista en http://localhost:5173
```

Cuando cambie la API: `npm run openapi` en la raíz y `npm run contract` en `web`.
