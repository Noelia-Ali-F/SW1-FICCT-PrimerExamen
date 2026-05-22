import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CreateProcessInstanceRequest, ProcessInstance } from '../models/process-instance.model';
import { ProcessHistory } from '../models/process-history.model';

@Injectable({ providedIn: 'root' })
export class ProcessInstanceService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<ProcessInstance[]>('/api/process-instances');
  }

  getById(id: string) {
    return this.http.get<ProcessInstance>(`/api/process-instances/${id}`);
  }

  create(payload: CreateProcessInstanceRequest) {
    return this.http.post<ProcessInstance>('/api/process-instances', payload);
  }

  cancel(id: string, userId: string) {
    return this.http.patch<ProcessInstance>(`/api/process-instances/${id}/cancel`, {}, { params: { userId } });
  }

  getHistory(id: string) {
    return this.http.get<ProcessHistory[]>(`/api/process-instances/${id}/history`);
  }
}

