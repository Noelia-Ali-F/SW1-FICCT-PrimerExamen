package com.workflow.system.presentation.dto.task;

import com.workflow.system.data.model.TaskStatus;
import java.time.Instant;
import java.util.Map;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ActivityTaskResponse {
  String id;
  String processInstanceId;
  String policyId;
  String activityNodeId;
  String activityName;
  String assignedToUserId;
  String assignedRoleId;
  String assignedDepartmentId;
  TaskStatus status;
  Map<String, Object> formData;
  String observations;
  Instant startedAt;
  Instant completedAt;
  Instant createdAt;
  Instant updatedAt;
}

