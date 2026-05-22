import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const url = state.url || '/';
  if (url.startsWith('/login')) return true;

  if (!auth.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { next: url } });
    return false;
  }
  return true;
};

