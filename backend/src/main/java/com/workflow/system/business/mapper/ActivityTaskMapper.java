package com.workflow.system.business.mapper;

import com.workflow.system.data.model.ActivityTask;
import com.workflow.system.presentation.dto.task.ActivityTaskResponse;
import org.springframework.stereotype.Component;

@Component
public class ActivityTaskMapper {
  public ActivityTaskResponse toResponse(ActivityTask t) {
    return ActivityTaskResponse.builder()
        .id(t.getId())
        .processInstanceId(t.getProcessInstanceId())
        .policyId(t.getPolicyId())
        .activityNodeId(t.getActivityNodeId())
        .activityName(t.getActivityName())
        .assignedToUserId(t.getAssignedToUserId())
        .assignedRoleId(t.getAssignedRoleId())
        .assignedDepartmentId(t.getAssignedDepartmentId())
        .status(t.getStatus())
        .formData(t.getFormData())
        .observations(t.getObservations())
        .startedAt(t.getStartedAt())
        .completedAt(t.getCompletedAt())
        .createdAt(t.getCreatedAt())
        .updatedAt(t.getUpdatedAt())
        .build();
  }
}

