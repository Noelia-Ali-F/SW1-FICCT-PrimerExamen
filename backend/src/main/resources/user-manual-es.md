# Manual rápido — Workflow System

## Acceso a la app
- **Frontend**: abre la aplicación en el navegador.
- **Backend (API)**: todas las rutas de API empiezan con `/api/*`.

## Navegación (menú lateral)
- **Dashboard**: indicadores y actividad reciente.
- **Usuarios / Roles / Departamentos**: administración (crear, editar, activar/desactivar).
- **Políticas de negocio**: crea políticas y diseña su diagrama.
- **Editor de diagramas**: abre el editor para políticas en estado **DRAFT**.
- **Trámites / Mis actividades / Monitoreo / Reportes**: consulta procesos, tareas, alertas y reportes.

## Políticas de negocio
- **Nueva política**: crea una política en estado **DRAFT**.
- **Diseñar diagrama**: solo disponible cuando la política está en **DRAFT**.
- **Activar**: valida el diagrama; si es válido, pasa a **ACTIVE**.
- **Versionar**: crea una nueva versión en **DRAFT** a partir de una existente.
- **Desactivar**: marca la política como **INACTIVE**.

## Editor de diagramas
### Herramientas UML
- **Nodos**: Inicio, Actividad, Decisión, Fork, Join, Fin.
- **Flecha**: crea transiciones entre nodos.

### Acciones comunes
- **Crear nodo**: selecciona un tipo en la paleta y haz click en el lienzo.
- **Conectar (flecha)**: selecciona “Flecha” → click en nodo origen → click en nodo destino.
- **Mover**: arrastra el nodo.
- **Borrar**: selecciona un nodo y presiona `Delete`/`Backspace` (o usa el botón de borrar si está visible).
- **Guardar**: persiste el diagrama en la política.
- **Validar**: revisa reglas básicas del diagrama y muestra errores.

### Colaboración en tiempo real
- Puedes activar “Colaborar” para ver presencia/cursor y sincronización de cambios entre usuarios
  dentro de la misma política (room por `policyId`).

## Reportes y Dashboard (datos reales)
- **Reportes**: series mensuales y cuellos de botella (actividades lentas).
- **Dashboard**: actividad reciente y cuellos de botella.

## Solución de problemas
- **403/401 en toda la app**: significa seguridad activada sin token. En entorno dev se puede apagar.
- **502 Bad Gateway**: el backend está reiniciando o el proxy no logra conectarse; espera 2–5s y recarga.
- **No carga el editor**: asegúrate de abrir una política en **DRAFT**.

