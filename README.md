## ExSW1-2026 — Sistema Workflow (MVP)

Stack principal:

| Capa | Tecnología |
|------|------------|
| **Frontend** | Angular (SPA + login + editor UML colaborativo) |
| **Backend** | Spring Boot 3, MongoDB, JWT, WebSockets |
| **Datos** | MongoDB (Docker o gestionado) |
| **IA** | Asistente (manual + opcional **Gemini / OpenAI / Azure**); carpeta `ai-service` para extensiones Python |

### Arranque recomendado (todo en Docker)

```bash
cd D:\ExSW1-2026
docker compose build
docker compose up -d
```

- **Aplicación:** http://localhost:8086  
- **API:** http://localhost:8083/api  
- **Mongo:** `mongodb://localhost:27017/exsw1` (si ya tienes Mongo local, Docker no debe “pelear” por el 27017)

Despliegue, variables y modos **demo / UAT / prod**: ver **`README-DEPLOY.md`**.

Variables de IA (opcional):

- **Gemini**: `APP_AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`
- **OpenAI**: `APP_AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`

### Desarrollo local (sin Docker del front)

```bash
cd backend
mvn spring-boot:run
```

```bash
cd workflow-frontend
npm install
npm start
```

### Pruebas manuales

- `SMOKE-TEST.md` — CU1–CU4  
- `SMOKE-CU5-CU6.md` — casos adicionales  

Backend: `mvn test`. Frontend: `npm run build`.

### Nota profesional sobre puertos (Docker + local)

En un mismo equipo **no es posible** que dos procesos escuchen el mismo `host:puerto` (por ejemplo, dos servicios en `localhost:8083` o dos Mongo en `localhost:27017`).

- Si tienes **MongoDB instalado como servicio** en Windows usando `27017`, no hace falta exponer Mongo de Docker al host.
- El script `RUN-DEV.ps1` está preparado para **usar Mongo local si ya existe** y así evitar errores tipo “ports are not available”.
