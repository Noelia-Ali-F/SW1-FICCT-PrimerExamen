import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);

  getByUser(userId: string) {
    return this.http.get<Notification[]>(`/api/notifications/user/${userId}`);
  }

  getUnreadByUser(userId: string) {
    return this.http.get<Notification[]>(`/api/notifications/user/${userId}/unread`);
  }

  countUnread(userId: string) {
    return this.http.get<number>(`/api/notifications/user/${userId}/unread/count`);
  }

  markAsRead(id: string) {
    return this.http.patch<Notification>(`/api/notifications/${id}/read`, {});
  }

  markAllAsRead(userId: string) {
    return this.http.patch(`/api/notifications/user/${userId}/read-all`, {}, { responseType: 'text' });
  }
}
