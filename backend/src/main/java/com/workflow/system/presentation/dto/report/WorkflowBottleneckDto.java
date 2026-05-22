package com.workflow.system.presentation.dto.report;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class WorkflowBottleneckDto {
  String policyId;
  String policyName;
  String activityNodeId;
  String activityName;

  String responsibleType; // USER/ROLE/DEPARTMENT (si aplica)
  String responsibleId;
  String responsibleName;
  String laneName;

  long pendingCount;
  long completedCount;
  long delayedCount;

  /** Promedio de espera en horas: startedAt - createdAt (si hay startedAt). */
  Double averageWaitingTimeHours;
  /** Promedio de ejecución en horas: completedAt - startedAt (si hay ambos). */
  Double averageExecutionTimeHours;

  double bottleneckScore;
  String criticality; // BAJO/MEDIO/ALTO
}

