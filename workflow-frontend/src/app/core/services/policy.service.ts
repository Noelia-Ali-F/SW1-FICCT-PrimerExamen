import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BusinessPolicy } from '../models/business-policy.model';

export interface CreatePolicyPayload {
  name: string;
  description: string;
  responsibleUserId: string;
  createdBy: string;
}

export interface UpdatePolicyPayload {
  name: string;
  description: string;
  responsibleUserId: string;
}

@Injectable({ providedIn: 'root' })
export class PolicyService {
  private readonly http = inject(HttpClient);

  getPolicies() {
    return this.http.get<BusinessPolicy[]>('/api/policies');
  }

  getPolicyById(id: string) {
    return this.http.get<BusinessPolicy>(`/api/policies/${id}`);
  }

  createPolicy(payload: CreatePolicyPayload) {
    return this.http.post<BusinessPolicy>('/api/policies', payload);
  }

  updatePolicy(id: string, payload: UpdatePolicyPayload) {
    return this.http.put<BusinessPolicy>(`/api/policies/${id}`, payload);
  }

  deactivatePolicy(id: string) {
    return this.http.patch<BusinessPolicy>(`/api/policies/${id}/deactivate`, {});
  }

  versionPolicy(id: string, createdBy: string) {
    return this.http.post<BusinessPolicy>(`/api/policies/${id}/version`, {}, {
      params: { createdBy }
    });
  }

  activatePolicy(id: string) {
    return this.http.patch<BusinessPolicy>(`/api/policies/${id}/activate`, {});
  }
}
