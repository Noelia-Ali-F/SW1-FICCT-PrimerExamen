import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ActivityTask, CompleteTaskRequest, StartTaskRequest } from '../models/activity-task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<ActivityTask[]>('/api/tasks');
  }

  listMyTasks(userId: string) {
    return this.http.get<ActivityTask[]>(`/api/tasks/my/${userId}`);
  }

  getById(id: string) {
    return this.http.get<ActivityTask>(`/api/tasks/${id}`);
  }

  start(taskId: string, payload: StartTaskRequest) {
    return this.http.patch<ActivityTask>(`/api/tasks/${taskId}/start`, payload);
  }

  complete(taskId: string, payload: CompleteTaskRequest) {
    return this.http.patch<ActivityTask>(`/api/tasks/${taskId}/complete`, payload);
  }
}

