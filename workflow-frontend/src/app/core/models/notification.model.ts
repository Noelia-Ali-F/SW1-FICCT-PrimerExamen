export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'PROCESS_CREATED'
  | 'PROCESS_COMPLETED'
  | 'PROCESS_CANCELLED'
  | 'SYSTEM_INFO';

export interface Notification {
  id: string;
  userId: string | null;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string | null;
}
