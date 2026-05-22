package com.workflow.system.presentation.dto.form;

import java.time.Instant;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DynamicFormResponse {
  String id;
  String policyId;
  String activityNodeId;
  String name;
  String description;
  List<FormFieldResponse> fields;
  Instant createdAt;
  Instant updatedAt;
}

