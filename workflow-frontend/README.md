# WorkflowFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.8.

## Ejecución local para desarrollo

**Backend recomendado** (puerto alineado con `public/env.js` para `ng serve`):

```bash
cd D:\ExSW1-2026\backend
mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=8083"
```

**Frontend recomendado**:

```bash
cd D:\ExSW1-2026\workflow-frontend
npm start
```

**URLs**

| Recurso        | URL                                      |
| -------------- | ---------------------------------------- |
| Frontend dev   | http://localhost:4200                  |
| Backend API    | http://localhost:8083/api              |
| Health         | http://localhost:8083/api/health       |

La base de la API en desarrollo también se documenta en `public/env.js` (`API_BASE_URL` cuando el host es `localhost:4200`).

**Nota (Docker / nginx)**  
Si usas el frontend servido en **http://localhost:8086** (stack `docker compose`), la imagen incluye el build estático del momento. Para ver cambios recientes del código Angular:

```bash
docker compose build frontend
docker compose up -d frontend
```

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
