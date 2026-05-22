import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DashboardReport, ProcessStatus, TaskStatus } from '../models/dashboard-report.model';
import { WorkflowKpiFilter, WorkflowKpiResponse } from '../models/workflow-kpi.model';

export interface MonthlyCount {
  month: string; // yyyy-MM
  count: number;
}

export interface Bottleneck {
  activityName: string;
  avgHours: number;
  affectedTasks: number;
}

export interface RecentItem {
  type: 'PROCESS' | 'TASK';
  id: string;
  title: string;
  status: string;
  ts: string;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  getDashboardReport() {
    return this.http.get<DashboardReport>('/api/reports/dashboard');
  }

  getProcessesByStatus() {
    return this.http.get<Record<ProcessStatus, number>>('/api/reports/processes-by-status');
  }

  getTasksByStatus() {
    return this.http.get<Record<TaskStatus, number>>('/api/reports/tasks-by-status');
  }

  getProcessesMonthly(months = 4) {
    return this.http.get<MonthlyCount[]>(`/api/reports/processes-monthly?months=${months}`);
  }

  getBottlenecks(top = 5) {
    return this.http.get<Bottleneck[]>(`/api/reports/bottlenecks?top=${top}`);
  }

  getRecent(limit = 6) {
    return this.http.get<RecentItem[]>(`/api/reports/recent?limit=${limit}`);
  }

  getWorkflowKpis(filter?: WorkflowKpiFilter) {
    const p = new URLSearchParams();
    if (filter?.policyId) p.set('policyId', filter.policyId);
    if (filter?.status) p.set('status', filter.status);
    if (filter?.responsibleId) p.set('responsibleId', filter.responsibleId);
    if (filter?.startDate) p.set('startDate', filter.startDate);
    if (filter?.endDate) p.set('endDate', filter.endDate);
    const qs = p.toString();
    return this.http.get<WorkflowKpiResponse>(`/api/reports/workflow-kpis${qs ? `?${qs}` : ''}`);
  }
}

