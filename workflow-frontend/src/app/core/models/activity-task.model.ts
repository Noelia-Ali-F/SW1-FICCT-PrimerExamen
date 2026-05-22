export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ActivityTask {
  id: string;
  processInstanceId: string;
  policyId: string;
  activityNodeId: string;
  activityName: string;
  assignedToUserId?: string;
  assignedRoleId?: string;
  assignedDepartmentId?: string;
  status: TaskStatus;
  formData?: Record<string, unknown>;
  observations?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StartTaskRequest {
  userId: string;
}

export interface CompleteTaskRequest {
  userId: string;
  formData?: Record<string, unknown>;
  observations?: string;
  transitionConditionResult?: string | null;
}

