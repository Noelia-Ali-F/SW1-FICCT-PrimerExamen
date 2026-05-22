package com.workflow.system.presentation.dto.policy;

import com.workflow.system.data.model.PolicyStatus;
import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BusinessPolicyResponse {
  String id;
  String name;
  String description;
  Integer version;
  PolicyStatus status;
  String responsibleUserId;
  String createdBy;
  Instant createdAt;
  Instant updatedAt;
}

