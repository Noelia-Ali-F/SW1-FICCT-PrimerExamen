package com.workflow.system.business.mapper;

import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.presentation.dto.policy.BusinessPolicyResponse;
import org.springframework.stereotype.Component;

@Component
public class BusinessPolicyMapper {
  public BusinessPolicyResponse toResponse(BusinessPolicy p) {
    return BusinessPolicyResponse.builder()
        .id(p.getId())
        .name(p.getName())
        .description(p.getDescription())
        .version(p.getVersion())
        .status(p.getStatus())
        .responsibleUserId(p.getResponsibleUserId())
        .createdBy(p.getCreatedBy())
        .createdAt(p.getCreatedAt())
        .updatedAt(p.getUpdatedAt())
        .build();
  }
}

