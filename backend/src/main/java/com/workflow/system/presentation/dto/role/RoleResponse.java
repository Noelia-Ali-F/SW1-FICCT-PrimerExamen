package com.workflow.system.presentation.dto.role;

import com.workflow.system.data.model.Status;
import java.time.Instant;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class RoleResponse {
  String id;
  String name;
  String description;
  List<String> permissions;
  Status status;
  Instant createdAt;
  Instant updatedAt;
}

