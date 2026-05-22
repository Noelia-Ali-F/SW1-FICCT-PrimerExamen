export type HistoryAction =
  | 'PROCESS_CREATED'
  | 'TASK_CREATED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'PROCESS_ADVANCED'
  | 'PROCESS_COMPLETED'
  | 'PROCESS_CANCELLED';

export interface ProcessHistory {
  id: string;
  processInstanceId: string;
  policyId: string;
  activityNodeId?: string;
  action: HistoryAction;
  userId?: string;
  previousStatus?: string;
  newStatus?: string;
  observation?: string;
  createdAt?: string;
}

