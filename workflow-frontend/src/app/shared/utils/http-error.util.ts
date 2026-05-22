import { HttpErrorResponse } from '@angular/common/http';

export function mapHttpError(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as any;
    if (body?.code === 'DIAGRAM_INVALID' && Array.isArray(body?.errors) && body.errors.length) {
      const parts = body.errors
        .map((e: any) => (e?.message ? String(e.message) : e?.code ? String(e.code) : ''))
        .filter(Boolean);
      const head = body?.message ? String(body.message) : fallback;
      return parts.length ? `${head} — ${parts.join(' · ')}` : head;
    }
    if (body?.message) return String(body.message);
    if (body?.code) return String(body.code);
    if (typeof body === 'string' && body.trim()) return body;
    if (err.status === 0) return 'No se pudo conectar con el backend (CORS/red)';
  }
  return fallback;
}
