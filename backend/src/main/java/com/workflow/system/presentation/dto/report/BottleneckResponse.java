package com.workflow.system.presentation.dto.report;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BottleneckResponse {
  String activityName;
  /** Promedio en horas de espera/ejecución para tareas abiertas (PENDING/IN_PROGRESS). */
  double avgHours;
  long affectedTasks;
}

