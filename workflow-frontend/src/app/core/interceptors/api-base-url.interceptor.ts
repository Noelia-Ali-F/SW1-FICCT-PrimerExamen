import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../services/api.config';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const token = (() => {
    try {
      return localStorage.getItem('wf_access_token');
    } catch {
      return null;
    }
  })();

  // Solo prefijamos requests a "/api/*" (ruta relativa)
  if (req.url.startsWith('/api/')) {
    const base = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
    const withBase = req.clone({ url: base + req.url.replace('/api', '') });
    if (token) {
      return next(withBase.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    }
    return next(withBase);
  }
  return next(req);
};

