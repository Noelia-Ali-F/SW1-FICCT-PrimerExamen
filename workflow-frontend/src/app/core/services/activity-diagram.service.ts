import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ActivityDiagram,
  DiagramValidationResponseDto,
  SaveActivityDiagramPayload
} from '../models/activity-diagram.model';

@Injectable({ providedIn: 'root' })
export class ActivityDiagramService {
  private readonly http = inject(HttpClient);

  getDiagram(policyId: string) {
    return this.http.get<ActivityDiagram>(`/api/policies/${policyId}/diagram`);
  }

  createDiagram(policyId: string, payload: SaveActivityDiagramPayload) {
    return this.http.post<ActivityDiagram>(`/api/policies/${policyId}/diagram`, payload);
  }

  updateDiagram(policyId: string, payload: SaveActivityDiagramPayload) {
    return this.http.put<ActivityDiagram>(`/api/policies/${policyId}/diagram`, payload);
  }

  validateDiagram(policyId: string) {
    return this.http.post<DiagramValidationResponseDto>(
      `/api/policies/${policyId}/diagram/validate`,
      {}
    );
  }
}
