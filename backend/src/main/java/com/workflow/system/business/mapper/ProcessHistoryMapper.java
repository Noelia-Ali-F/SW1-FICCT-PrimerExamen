package com.workflow.system.business.mapper;

import com.workflow.system.data.model.ProcessHistory;
import com.workflow.system.presentation.dto.process.ProcessHistoryResponse;
import org.springframework.stereotype.Component;

@Component
public class ProcessHistoryMapper {
  public ProcessHistoryResponse toResponse(ProcessHistory h) {
    return ProcessHistoryResponse.builder()
        .id(h.getId())
        .processInstanceId(h.getProcessInstanceId())
        .policyId(h.getPolicyId())
        .activityNodeId(h.getActivityNodeId())
        .action(h.getAction())
        .userId(h.getUserId())
        .previousStatus(h.getPreviousStatus())
        .newStatus(h.getNewStatus())
        .observation(h.getObservation())
        .createdAt(h.getCreatedAt())
        .build();
  }
}

