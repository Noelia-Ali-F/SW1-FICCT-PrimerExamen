import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Acceso a /reports (indicadores/KPI): requiere permisos REPORTS_VIEW o ADMIN
 * (JWT y login usan estos strings; roles como SUPERVISOR en BD deben incluir REPORTS_VIEW).
 */
export const reportsGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.canViewReportsKpis()) return true;
  void router.navigate(['/dashboard'], { queryParams: { forbidden: 'kpi' } });
  return false;
};
