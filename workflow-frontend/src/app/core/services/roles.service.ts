import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Role } from '../models/role.model';

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions?: string[];
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Role[]>('/api/roles');
  }

  getById(id: string) {
    return this.http.get<Role>(`/api/roles/${id}`);
  }

  create(payload: CreateRoleRequest) {
    return this.http.post<Role>('/api/roles', payload);
  }

  update(id: string, payload: CreateRoleRequest) {
    return this.http.put<Role>(`/api/roles/${id}`, payload);
  }

  deactivate(id: string) {
    return this.http.patch<Role>(`/api/roles/${id}/deactivate`, {});
  }

  activate(id: string) {
    return this.http.patch<Role>(`/api/roles/${id}/activate`, {});
  }
}

