package com.workflow.system.presentation.dto.report;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class WorkflowActivityDurationDto {
  String policyId;
  String policyName;
  String activityNodeId;
  String activityName;
  Double avgExecutionHours;
  long completedCount;
}

