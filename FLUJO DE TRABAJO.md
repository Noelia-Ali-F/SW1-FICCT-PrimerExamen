# FLUJO DE TRABAJO

## 1. Que es este sistema

Este proyecto es un sistema web para gestionar tramites y procesos de trabajo.

La idea principal es esta:

1. Se define una politica de negocio.
2. Se dibuja su flujo de trabajo.
3. Se inicia un tramite real usando esa politica.
4. El sistema genera tareas para los usuarios.
5. Los usuarios completan esas tareas.
6. El sistema muestra avance, reportes y notificaciones.

En resumen, el sistema sirve para organizar como se hace un proceso dentro de una empresa o institucion.

## 2. Conceptos importantes

### Politica

Es la regla o proceso que se quiere controlar.

Ejemplo:

- Aprobacion de vacaciones
- Solicitud de compra
- Registro de permiso

### Diagrama

Es el dibujo del proceso.

Muestra los pasos, decisiones y responsables.

Ejemplo:

Solicitud -> Revision -> Aprobacion -> Finalizacion

### Tramite

Es un caso real que usa una politica.

Ejemplo:

"La solicitud de vacaciones de Juan Perez"

### Tarea o actividad

Es una accion puntual que un usuario debe realizar.

Ejemplo:

- Revisar solicitud
- Aprobar
- Rechazar
- Llenar formulario

## 3. Como funciona el sistema

El flujo general del sistema es este:

```text
CREAR USUARIOS Y ROLES
          |
          v
CREAR POLITICA DE NEGOCIO
          |
          v
DISEÑAR DIAGRAMA DEL PROCESO
          |
          v
ACTIVAR POLITICA
          |
          v
INICIAR TRAMITE REAL
          |
          v
GENERAR TAREAS PARA USUARIOS
          |
          v
COMPLETAR ACTIVIDADES
          |
          v
VER AVANCE, REPORTES Y NOTIFICACIONES
```

### Paso 1. Crear usuarios, roles y departamentos

Primero se registran las personas que van a usar el sistema.

Tambien se pueden definir:

- roles
- departamentos

Esto sirve para saber a quien asignar las tareas.

### Paso 2. Crear una politica de negocio

Luego se crea una politica.

La politica tiene datos como:

- nombre
- descripcion
- responsable
- creador

Ejemplo:

Politica: Aprobacion de vacaciones

## Paso 3. Diseñar el diagrama

A esa politica se le crea un diagrama de workflow.

Ese diagrama define:

- que pasos existen
- en que orden van
- donde hay decisiones
- quien debe hacerse cargo de cada actividad

Ejemplo:

1. El empleado registra la solicitud
2. El jefe revisa
3. RRHH aprueba o rechaza
4. El proceso termina

Esquema simple:

```text
[Inicio]
   |
   v
[Empleado registra solicitud]
   |
   v
[Jefe revisa]
   |
   v
{Aprobado?}
  |     |
  |Si   |No
  v     v
[RRHH] [Rechazado]
  |
  v
[Fin]
```

## Paso 4. Activar la politica

Cuando la politica ya esta lista, se activa.

Solo una politica activa deberia usarse para iniciar tramites reales.

## Paso 5. Crear un tramite

Despues se crea un tramite usando una politica activa.

Ese tramite es un caso real.

Ejemplo:

Un usuario inicia una solicitud de vacaciones.

## Paso 6. El sistema genera tareas

Segun el diagrama, el sistema crea tareas.

Cada tarea puede estar asignada a:

- un usuario
- un rol
- un departamento

Ejemplo:

La tarea "Revisar solicitud" va para el jefe.

```text
TRAMITE CREADO
      |
      v
EL SISTEMA LEE EL DIAGRAMA
      |
      v
IDENTIFICA EL PASO ACTUAL
      |
      v
CREA LA TAREA
      |
      v
LA ASIGNA A:
 - USUARIO
 - ROL
 - DEPARTAMENTO
```

## Paso 7. El usuario completa sus tareas

Cada usuario entra a la pantalla de "Mis actividades".

Desde ahi puede:

- ver sus tareas
- iniciar una tarea
- llenar formularios
- completar la actividad

Cuando termina una tarea, el sistema avanza al siguiente paso del flujo.

```text
USUARIO ABRE "MIS ACTIVIDADES"
            |
            v
VE SUS TAREAS PENDIENTES
            |
            v
INICIA UNA TAREA
            |
            v
LLENA FORMULARIO / AGREGA DATOS
            |
            v
COMPLETA LA ACTIVIDAD
            |
            v
EL SISTEMA MUEVE EL TRAMITE AL SIGUIENTE PASO
```

## Paso 8. El sistema muestra seguimiento

El sistema tiene pantallas para ver:

- cuantos tramites existen
- cuales estan activos
- cuales tareas faltan
- reportes
- cuellos de botella
- notificaciones

## 4. Pantallas principales del sistema

### Login

Sirve para entrar al sistema.

### Dashboard

Muestra un resumen general:

- total de politicas
- tramites activos
- tareas pendientes
- tareas completadas
- actividad reciente

### Roles

Sirve para administrar roles.

Ejemplo:

- Administrador
- Supervisor
- Analista

### Departments

Sirve para administrar departamentos.

Ejemplo:

- RRHH
- Finanzas
- Operaciones

### Users

Sirve para crear y administrar usuarios.

### Policies

Es una de las partes mas importantes.

Aqui se puede:

- crear politicas
- editarlas
- versionarlas
- activarlas
- desactivarlas
- generar propuestas con IA

### Diagram Editor

Aqui se diseña el flujo visual del proceso.

Es donde se dibujan nodos, conexiones, decisiones y responsables.

### Process Instances

Aqui se ven los tramites iniciados.

Tambien se pueden crear nuevos tramites y revisar su avance.

### My Tasks

Aqui cada usuario ve las tareas que le corresponden.

Es la pantalla de trabajo diario.

### Reports

Aqui se muestran indicadores y reportes del sistema.

### Monitoring

Sirve para hacer seguimiento de tramites y procesos en ejecucion.

### AI Assistant

Es una seccion donde la inteligencia artificial puede ayudar a:

- responder preguntas
- proponer diagramas
- modificar flujos
- autocompletar formularios

## 5. Estructura tecnica del proyecto

El proyecto esta dividido en varias carpetas:

### `workflow-frontend`

Es la parte visual del sistema.

Aqui estan las pantallas que ve el usuario.

Tecnologia principal:

- Angular

### `backend`

Es la parte del servidor.

Aqui esta la logica del negocio, validaciones, API y seguridad.

Tecnologia principal:

- Spring Boot

### `database`

Contiene archivos relacionados con base de datos.

### `ai-service`

Contiene componentes auxiliares para funciones de inteligencia artificial.

## 6. Ejemplo completo de uso

Ejemplo: aprobacion de vacaciones

1. Se crea la politica "Aprobacion de vacaciones".
2. Se diseña el diagrama:
   Solicitud -> Revision del jefe -> Aprobacion RRHH -> Fin
3. Se activa la politica.
4. Juan crea un tramite para pedir vacaciones.
5. El sistema genera una tarea para el jefe.
6. El jefe entra a "Mis actividades" y revisa.
7. El jefe aprueba.
8. El sistema genera la siguiente tarea para RRHH.
9. RRHH completa la revision.
10. El tramite termina.

Diagrama del ejemplo:

```text
POLITICA: APROBACION DE VACACIONES

[Empleado solicita vacaciones]
              |
              v
[Jefe revisa solicitud]
              |
              v
        {Aprueba?}
          |    |
        Si|    |No
          v    v
 [RRHH registra] [Solicitud rechazada]
          |
          v
       [Fin]
```

Flujo del caso real:

```text
JUAN CREA SU TRAMITE
        |
        v
SE CREA TAREA PARA EL JEFE
        |
        v
JEFE APRUEBA
        |
        v
SE CREA TAREA PARA RRHH
        |
        v
RRHH FINALIZA
        |
        v
TRAMITE COMPLETADO
```

## 7. Que hace la IA en este proyecto

La IA no reemplaza todo el sistema.

Mas bien ayuda en algunas tareas:

- generar propuestas de diagramas a partir de texto
- editar diagramas con instrucciones escritas
- responder preguntas del usuario
- sugerir valores para formularios

## 8. En pocas palabras

Si tuviera que explicarlo de la forma mas simple posible, diria esto:

Este sistema sirve para definir como trabaja un proceso, convertirlo en pasos ordenados, asignar trabajo a personas y controlar que todo avance correctamente.

```text
POLITICA = LA REGLA
DIAGRAMA = EL CAMINO
TRAMITE = EL CASO REAL
TAREA = EL TRABAJO DE CADA PERSONA
```

## 9. Orden recomendado para entenderlo

Si quieres aprender el sistema sin perderte, este es el orden ideal:

1. Leer este archivo
2. Entrar a `Policies`
3. Ver como se crea una politica
4. Ver el `Diagram Editor`
5. Ver `Process Instances`
6. Ver `My Tasks`
7. Ver `Dashboard`
8. Revisar `AI Assistant`

## 10. Idea final

No es solo una pagina web comun.

Es un sistema de gestion de procesos.

Su objetivo es que una organizacion pueda:

- definir reglas
- organizar pasos
- asignar responsables
- ejecutar tramites
- controlar el avance
- detectar problemas

Si entiendes eso, ya entiendes la idea central del proyecto.

## 11. Mapa rapido del sistema

```text
USUARIOS / ROLES / DEPARTAMENTOS
                |
                v
             POLICIES
                |
                v
         DIAGRAM EDITOR
                |
                v
       PROCESS INSTANCES
                |
                v
            MY TASKS
                |
                v
    DASHBOARD / REPORTS / MONITORING
                |
                v
          AI ASSISTANT
```
