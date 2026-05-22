package com.workflow.system.presentation.dto.report;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class WorkflowWorkloadByResponsibleDto {
  String responsibleType; // USER/ROLE/DEPARTMENT/UNASSIGNED
  String responsibleId;
  String responsibleName;
  long pendingCount;
  long inProgressCount;
  long totalOpen;
}

