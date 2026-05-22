## Smoke test (CU1–CU4) — manual rápido

### Prerequisitos (recomendado: todo con Docker)

```bash
cd D:\ExSW1-2026
docker compose up -d
```

- **Frontend:** http://localhost:8086  
- **Backend health:** http://localhost:8083/api/health  
- **Mongo:** `mongodb://localhost:27017/exsw1` (si solo levantas mongo: `docker compose up -d mongo`)

> Si usas **UAT con login**: `docker compose -f docker-compose.yml -f docker-compose.uat.yml up -d` y entra con `admin@local.test` / `Admin123!`.

### CU1

- **Roles**: crear 1 rol y verificar que aparece en tabla.
- **Departamentos**: crear 1 depto y verificar que aparece en tabla.
- **Usuarios**: crear 1 usuario (seleccionando rol y depto) y verificar `ACTIVE`.

### CU2

- **Políticas**: crear 1 política DRAFT (responsable y createdBy desde usuarios).
- Editar política (solo DRAFT).
- Versionar política (crear borrador nueva versión).
- Desactivar política (pasa a INACTIVE).

### CU3

- En una política **DRAFT**, abrir **Diseñar diagrama**.
- Cargar ejemplo mínimo o ejemplo con decisión; **Guardar diagrama** y **Validar diagrama**.
- Opcional: activar **Colaborar** y abrir la misma política en otra ventana (cursor + cambios en vivo).

### CU4

- En la sección CU4 del editor:

  - Seleccionar una actividad ACTIVITY y crear/guardar formulario (POST/PUT).
  - Seleccionar una transición (edge) y guardar condición (PATCH).
  - Validar configuración final.
