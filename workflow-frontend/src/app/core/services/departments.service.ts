import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Department } from '../models/department.model';

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class DepartmentsService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Department[]>('/api/departments');
  }

  getById(id: string) {
    return this.http.get<Department>(`/api/departments/${id}`);
  }

  create(payload: CreateDepartmentRequest) {
    return this.http.post<Department>('/api/departments', payload);
  }

  update(id: string, payload: CreateDepartmentRequest) {
    return this.http.put<Department>(`/api/departments/${id}`, payload);
  }

  deactivate(id: string) {
    return this.http.patch<Department>(`/api/departments/${id}/deactivate`, {});
  }

  activate(id: string) {
    return this.http.patch<Department>(`/api/departments/${id}/activate`, {});
  }
}

