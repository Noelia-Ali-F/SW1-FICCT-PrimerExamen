/**
 * Configuración en tiempo de ejecución (sin recompilar todo el frontend).
 *
 * - Con `ng serve`, `proxy.conf.json` reenvía `/api` y `/ws` a http://localhost:8083
 *   (funciona con localhost o 127.0.0.1). No hace falta fijar API_BASE_URL aquí.
 * - Si la app corre detrás de nginx/Docker (u otro host/puerto), no aplica el
 *   bloque de localhost:4200: se usa el mismo origen `/api` o lo que definas
 *   en `window.__WF_ENV__.API_BASE_URL` según el despliegue (p. ej. env.js
 *   montado por el contenedor o variables del entorno).
 *
 * Puedes cambiar `API_BASE_URL` en este archivo para apuntar a otra API sin
 * volver a ejecutar `ng build` completo del bundle (solo recarga del navegador).
 */
(function () {
  window.__WF_ENV__ = window.__WF_ENV__ || {};
  // En `ng serve` con proxy.conf.json, las peticiones a `/api` ya van al backend: no forzar URL absoluta.
  // Solo si alguien sirve el front sin proxy y necesita otro host, puede definir aquí API_BASE_URL manualmente.
})();
