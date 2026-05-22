package com.workflow.system.presentation.dto.user;

import com.workflow.system.data.model.Status;
import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class UserResponse {
  String id;
  String fullName;
  String email;
  String roleId;
  String departmentId;
  Status status;
  Instant createdAt;
  Instant updatedAt;
}

