declare global {
  interface Window {
    __WF_ENV__?: { API_BASE_URL?: string };
  }
}

// Runtime-configurable API base URL:
// - Default: same-origin `/api` (ideal behind reverse proxy / containers)
// - Override: set `window.__WF_ENV__.API_BASE_URL` in `public/env.js`
export const API_BASE_URL = (window.__WF_ENV__?.API_BASE_URL ?? '/api').replace(/\/$/, '');

