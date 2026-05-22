export type ProcessStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ProcessInstance {
  id: string;
  policyId: string;
  status: ProcessStatus;
  requestedBy: string;
  currentNodeIds: string[];
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProcessInstanceRequest {
  policyId: string;
  requestedBy: string;
}

