import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { User } from '../models/user.model';

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  departmentId: string;
}

export interface UpdateUserRequest {
  fullName: string;
  email: string;
  password?: string;
  roleId: string;
  departmentId: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<User[]>('/api/users');
  }

  getById(id: string) {
    return this.http.get<User>(`/api/users/${id}`);
  }

  create(payload: CreateUserRequest) {
    return this.http.post<User>('/api/users', payload);
  }

  update(id: string, payload: UpdateUserRequest) {
    return this.http.put<User>(`/api/users/${id}`, payload);
  }

  deactivate(id: string) {
    return this.http.patch<User>(`/api/users/${id}/deactivate`, {});
  }

  activate(id: string) {
    return this.http.patch<User>(`/api/users/${id}/activate`, {});
  }
}

