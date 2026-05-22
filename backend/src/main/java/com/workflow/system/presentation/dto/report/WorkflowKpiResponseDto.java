package com.workflow.system.presentation.dto.report;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class WorkflowKpiResponseDto {
  long totalInstances;
  long runningInstances;
  long completedInstances;

  long pendingActivities;
  long completedActivities;
  long delayedActivities;

  /** Duración promedio de trámite en horas (solo COMPLETED). */
  Double averageProcessDurationHours;
  /** Duración promedio de actividad en horas (solo COMPLETED). */
  Double averageActivityDurationHours;

  /** % de cumplimiento dentro del umbral definido (0-100). */
  Double completionRatePct;

  /** Actividad con mayor demora (por score). */
  WorkflowBottleneckDto worstBottleneck;

  List<WorkflowBottleneckDto> bottlenecks;
  List<WorkflowWorkloadByResponsibleDto> workloadByResponsible;
  List<WorkflowActivityDurationDto> activityDurations;
}

