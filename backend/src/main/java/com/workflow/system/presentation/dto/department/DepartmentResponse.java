package com.workflow.system.presentation.dto.department;

import com.workflow.system.data.model.Status;
import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DepartmentResponse {
  String id;
  String name;
  String description;
  Status status;
  Instant createdAt;
  Instant updatedAt;
}

