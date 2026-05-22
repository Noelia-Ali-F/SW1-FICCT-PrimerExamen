package com.workflow.system.business.mapper;

import com.workflow.system.data.model.ProcessInstance;
import com.workflow.system.presentation.dto.process.ProcessInstanceResponse;
import org.springframework.stereotype.Component;

@Component
public class ProcessInstanceMapper {
  public ProcessInstanceResponse toResponse(ProcessInstance p) {
    return ProcessInstanceResponse.builder()
        .id(p.getId())
        .policyId(p.getPolicyId())
        .status(p.getStatus())
        .requestedBy(p.getRequestedBy())
        .currentNodeIds(p.getCurrentNodeIds())
        .startedAt(p.getStartedAt())
        .finishedAt(p.getFinishedAt())
        .createdAt(p.getCreatedAt())
        .updatedAt(p.getUpdatedAt())
        .build();
  }
}

