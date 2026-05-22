export interface DashboardReport {
  totalProcesses: number;
  processesCreated: number;
  processesInProgress: number;
  processesCompleted: number;
  processesCancelled: number;
  totalTasks: number;
  tasksPending: number;
  tasksInProgress: number;
  tasksCompleted: number;
  tasksCancelled: number;
}

export type ProcessStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

