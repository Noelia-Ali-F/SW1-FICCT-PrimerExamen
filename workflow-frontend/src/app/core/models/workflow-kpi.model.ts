export type WorkflowCriticality = 'BAJO' | 'MEDIO' | 'ALTO';

export interface WorkflowKpiFilter {
  policyId?: string;
  status?: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  responsibleId?: string;
  startDate?: string; // yyyy-MM-dd
  endDate?: string; // yyyy-MM-dd
}

export interface WorkflowBottleneck {
  policyId?: string;
  policyName?: string;
  activityNodeId?: string;
  activityName?: string;
  responsibleType?: string;
  responsibleId?: string;
  responsibleName?: string;
  laneName?: string;
  pendingCount: number;
  completedCount: number;
  delayedCount: number;
  averageWaitingTimeHours?: number | null;
  averageExecutionTimeHours?: number | null;
  bottleneckScore: number;
  criticality: WorkflowCriticality;
}

export interface WorkflowWorkloadByResponsible {
  responsibleType: string;
  responsibleId?: string;
  responsibleName?: string;
  pendingCount: number;
  inProgressCount: number;
  totalOpen: number;
}

export interface WorkflowActivityDuration {
  policyId?: string;
  policyName?: string;
  activityNodeId?: string;
  activityName?: string;
  avgExecutionHours?: number | null;
  completedCount: number;
}

export interface WorkflowKpiResponse {
  totalInstances: number;
  runningInstances: number;
  completedInstances: number;
  pendingActivities: number;
  completedActivities: number;
  delayedActivities: number;
  averageProcessDurationHours?: number | null;
  averageActivityDurationHours?: number | null;
  completionRatePct?: number | null;
  worstBottleneck?: WorkflowBottleneck | null;
  bottlenecks: WorkflowBottleneck[];
  workloadByResponsible: WorkflowWorkloadByResponsible[];
  activityDurations: WorkflowActivityDuration[];
}

