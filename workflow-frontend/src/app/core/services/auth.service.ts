import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse } from '../models/auth.model';

const PERM_STORAGE = 'wf_permissions';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<LoginResponse['user'] | null>(this.readUser());
  readonly token = signal<string | null>(this.readToken());
  /** Permisos del rol (mismos que en el JWT: REPORTS_VIEW, ADMIN, etc.) */
  readonly permissions = signal<string[]>(this.readPermissions());

  /** Indicadores/KPI: REPORTS_VIEW o ADMIN (JWT/roles BD alineados con SecurityConfig). */
  readonly reportsKpisAccess = computed(() => {
    const p = this.permissions();
    return p.includes('ADMIN') || p.includes('REPORTS_VIEW');
  });

  readonly isAuthenticated = () => !!this.token();

  canViewReportsKpis(): boolean {
    return this.reportsKpisAccess();
  }

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>('/api/auth/login', payload);
  }

  applyLogin(res: LoginResponse) {
    const perms = Array.isArray(res.permissions) ? res.permissions : [];
    try {
      localStorage.setItem('wf_access_token', res.accessToken);
      localStorage.setItem('wf_user', JSON.stringify(res.user ?? null));
      localStorage.setItem(PERM_STORAGE, JSON.stringify(perms));
    } catch {
      // ignore
    }
    this.token.set(res.accessToken);
    this.user.set(res.user ?? null);
    this.permissions.set(perms);
  }

  logout() {
    try {
      localStorage.removeItem('wf_access_token');
      localStorage.removeItem('wf_user');
      localStorage.removeItem(PERM_STORAGE);
    } catch {
      // ignore
    }
    this.token.set(null);
    this.user.set(null);
    this.permissions.set([]);
    this.router.navigate(['/login']);
  }

  private readToken(): string | null {
    try {
      return localStorage.getItem('wf_access_token');
    } catch {
      return null;
    }
  }

  private readUser(): LoginResponse['user'] | null {
    try {
      const raw = localStorage.getItem('wf_user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private readPermissions(): string[] {
    try {
      const raw = localStorage.getItem(PERM_STORAGE);
      if (!raw) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
}

