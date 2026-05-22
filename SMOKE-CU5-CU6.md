## SMOKE CU5/CU6 (Frontend + Backend) — guía rápida

Esta guía asume que ya existen:
- 1 rol
- 1 departamento
- 1 usuario
- 1 política **ACTIVE**
- 1 diagrama válido con **DECISION**
- formularios/configuración válidos

Base URL (dev): `http://localhost:8083`

### 1) Verificar backend

**PowerShell**

```powershell
Invoke-WebRequest http://localhost:8083/api/health -UseBasicParsing
```

**curl**

```bash
curl http://localhost:8083/api/health
```

### 2) Listar políticas

```bash
curl http://localhost:8083/api/policies
```

### 3) Copiar un `policyId` con `status` = `ACTIVE`

### 4) Crear trámite (CU5)

```bash
curl -X POST http://localhost:8083/api/process-instances ^
  -H "Content-Type: application/json" ^
  -d "{\"policyId\":\"POLICY_ID\",\"requestedBy\":\"USER_ID\"}"
```

### 5) Listar trámites

```bash
curl http://localhost:8083/api/process-instances
```

### 6) Listar tareas del usuario (CU6)

```bash
curl http://localhost:8083/api/tasks/my/USER_ID
```

### 7) Iniciar tarea

```bash
curl -X PATCH http://localhost:8083/api/tasks/TASK_ID/start ^
  -H "Content-Type: application/json" ^
  -d "{\"userId\":\"USER_ID\"}"
```

### 8) Completar tarea

```bash
curl -X PATCH http://localhost:8083/api/tasks/TASK_ID/complete ^
  -H "Content-Type: application/json" ^
  -d "{\"userId\":\"USER_ID\",\"formData\":{\"descripcionSolicitud\":\"Solicitud de prueba desde smoke test\"},\"observations\":\"Actividad completada correctamente\",\"transitionConditionResult\":\"aprobada\"}"
```

> Si `transitionConditionResult` está vacío y el flujo pasa por un `DECISION`, el backend debe devolver un error claro.

### 9) Volver a listar tareas

```bash
curl http://localhost:8083/api/tasks/my/USER_ID
```

### 10) Consultar trámite

```bash
curl http://localhost:8083/api/process-instances/PROCESS_INSTANCE_ID
```

### 11) Resultado esperado
- Si el workflow tiene más actividades, debe crear la **siguiente tarea** (PENDING).
- Si llega a `END`, el trámite debe quedar en **COMPLETED**.
- Si está en `DECISION`, `transitionConditionResult` debe coincidir con `condition` de alguna `edge` (ej: `"aprobada"`, `"rechazada"`).

### 12) Errores comunes
- **Policy no ACTIVE**: no permite crear trámite.
- **Diagrama inválido**: no arranca el proceso.
- **Configuración incompleta** (CU4): validación falla (ej: condición obligatoria en DECISION, form requerido).
- **TASK_ID incorrecto**: 404.
- **USER_ID no asignado / sin permisos**: error de reglas de negocio.
- **transitionConditionResult no coincide**: no encuentra transición válida y devuelve error.

