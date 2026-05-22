package com.workflow.system.presentation.dto.form;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DynamicFormSummaryResponse {
  String id;
  String activityNodeId;
  String name;
}
