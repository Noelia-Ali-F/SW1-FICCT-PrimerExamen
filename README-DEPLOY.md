# Despliegue y pruebas — ExSW1-2026

## Estado del stack

| Servicio   | Puerto local (compose por defecto) | Notas |
|-----------|--------------------------------------|--------|
| Frontend  | **http://localhost:8086**            | Nginx + Angular; proxy `/api` y `/ws` al backend |
| Backend   | **http://localhost:8083**          | API REST + WebSocket |
| MongoDB   | **27017**                          | Base `exsw1` |

> El `docker-compose.yml` por defecto usa **perfil `dev`**, **seguridad desactivada** y **seed** de datos (incluye usuario admin). Sirve para demo y pruebas funcionales rápidas sin bloqueo de login.

## Levantar todo (local)

```bash
docker compose build
docker compose up -d
```

- Abrir el frontend: **http://localhost:8086**
- Health backend: **http://localhost:8083/api/health**

## Modo UAT (con login JWT)

Mismo seed de desarrollo, pero la API exige token (la UI tiene pantalla de login).

```bash
docker compose -f docker-compose.yml -f docker-compose.uat.yml up -d --build
```

Credenciales sembradas (solo con perfil **`dev`** en backend):

- **Email:** `admin@local.test`
- **Contraseña:** `Admin123!`

## Producción (plantilla)

1. Copiar `docker-compose.prod.example.yml` y ajustar `APP_JWT_SECRET`, URI de Mongo real y claves de IA si aplica.
2. Activar **`SPRING_PROFILES_ACTIVE=prod`**: en `application-prod.yml` la seguridad por defecto es **activa** (sobrescribible con `APP_SECURITY_ENABLED`).
3. **No hay seed automático en `prod`**: hay que poblar usuarios/roles (por ejemplo importando una BD ya sembrada en UAT, o un proceso de migración propio).

## Variables críticas (backend)

| Variable | Descripción |
|----------|-------------|
| `SPRING_PROFILES_ACTIVE` | `dev` (seed + relajado) o `prod` |
| `SPRING_DATA_MONGODB_URI` | Cadena Mongo (Atlas, Cosmos, contenedor, etc.) |
| `APP_SECURITY_ENABLED` | `false` demo rápida; `true` UAT/prod con JWT |
| `APP_JWT_SECRET` | Secreto fuerte (32+ caracteres) en cualquier entorno con login |
| `APP_JWT_TTLMINUTES` | TTL del token (ej. `240`) |
| `OPENAI_API_KEY` / `APP_AI_PROVIDER` | Opcional; el asistente puede usar manual interno sin clave |

## Frontend en runtime (`env.js`)

En el contenedor Nginx, el build sirve `public/env.js`. Para otro host de API sin recompilar:

```js
window.__WF_ENV__ = {
  API_BASE_URL: "https://tu-dominio.com"
};
```

Con el proxy por defecto, **same-origin** `/api` es lo recomendado.

## Nube (resumen)

- **Azure:** Container Apps o App Service para frontend + backend; Mongo Atlas o Cosmos DB for MongoDB.
- **Google Cloud:** Cloud Run (stateless) + Mongo Atlas; front y back como servicios separados con HTTPS; WebSockets soportados en Cloud Run.

Mantener **un solo origen HTTPS** para el front y proxy de `/api` y `/ws` evita problemas de CORS y mixed content.

## Checklist antes de presentar pruebas

1. `docker compose up -d` y comprobar **8086** (UI) y **8083/api/health**.
2. Flujo **login** si usas UAT (`docker-compose.uat.yml`).
3. **CRUD** usuarios, roles, departamentos, políticas.
4. **Editor de diagramas**: crear nodos, flechas, guardar, validar; **Colaborar** con dos ventanas (cursor + ops).
5. **Reportes / dashboard**: datos reales desde API (no mocks).
6. Revisar logs: `docker logs exsw1-backend` / `docker logs exsw1-frontend`.

Guías de casos de uso manuales: `SMOKE-TEST.md`, `SMOKE-CU5-CU6.md`.
