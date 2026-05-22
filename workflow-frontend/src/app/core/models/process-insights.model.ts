export type InsightSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface BottleneckInsight {
  title: string;
  description: string;
  severity: InsightSeverity;
  relatedActivityName: string | null;
  relatedUserId: string | null;
  relatedRoleId: string | null;
  relatedDepartmentId: string | null;
  count: number;
  recommendation: string;
}

export interface Recommendation {
  title: string;
  description: string;
  priority: RecommendationPriority;
  suggestedAction: string;
}

export interface ProcessInsights {
  totalProcesses: number;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  cancelledTasks: number;
  bottlenecks: BottleneckInsight[];
  recommendations: Recommendation[];
  summary: string;
}
