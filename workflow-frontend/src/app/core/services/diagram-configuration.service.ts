import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ConfigurationValidationResponse,
  UpdateEdgeConditionRequest
} from '../models/configuration.model';

@Injectable({ providedIn: 'root' })
export class DiagramConfigurationService {
  private readonly http = inject(HttpClient);

  updateEdgeCondition(policyId: string, edgeId: string, payload: UpdateEdgeConditionRequest) {
    return this.http.patch<void>(`/api/policies/${policyId}/edges/${edgeId}/condition`, payload);
  }

  validateConfiguration(policyId: string) {
    return this.http.post<ConfigurationValidationResponse>(
      `/api/policies/${policyId}/configuration/validate`,
      {}
    );
  }
}
