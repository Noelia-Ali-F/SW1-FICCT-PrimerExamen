package com.workflow.system.business.mapper;

import com.workflow.system.data.model.Department;
import com.workflow.system.presentation.dto.department.DepartmentResponse;
import org.springframework.stereotype.Component;

@Component
public class DepartmentMapper {
  public DepartmentResponse toResponse(Department d) {
    return DepartmentResponse.builder()
        .id(d.getId())
        .name(d.getName())
        .description(d.getDescription())
        .status(d.getStatus())
        .createdAt(d.getCreatedAt())
        .updatedAt(d.getUpdatedAt())
        .build();
  }
}

