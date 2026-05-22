import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DynamicForm, DynamicFormSummary, SaveDynamicFormPayload } from '../models/dynamic-form.model';
import { DiagramValidationResponseDto } from '../models/activity-diagram.model';

@Injectable({ providedIn: 'root' })
export class DynamicFormService {
  private readonly http = inject(HttpClient);

  /** Formularios CU4 guardados para la política (sincroniza la tabla del editor con Mongo). */
  listByPolicy(policyId: string) {
    return this.http.get<DynamicFormSummary[]>(`/api/policies/${policyId}/forms`);
  }

  getForm(policyId: string, activityNodeId: string) {
    return this.http.get<DynamicForm>(`/api/policies/${policyId}/activities/${activityNodeId}/form`);
  }

  createForm(policyId: string, activityNodeId: string, payload: SaveDynamicFormPayload) {
    return this.http.post<DynamicForm>(`/api/policies/${policyId}/activities/${activityNodeId}/form`, payload);
  }

  updateForm(policyId: string, activityNodeId: string, payload: SaveDynamicFormPayload) {
    return this.http.put<DynamicForm>(`/api/policies/${policyId}/activities/${activityNodeId}/form`, payload);
  }

  deleteForm(policyId: string, activityNodeId: string) {
    return this.http.delete<void>(`/api/policies/${policyId}/activities/${activityNodeId}/form`);
  }

  validateForm(policyId: string, activityNodeId: string, payload: SaveDynamicFormPayload) {
    return this.http.post<DiagramValidationResponseDto>(
      `/api/policies/${policyId}/activities/${activityNodeId}/form/validate`,
      payload
    );
  }
}
