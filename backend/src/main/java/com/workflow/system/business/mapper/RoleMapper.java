package com.workflow.system.business.mapper;

import com.workflow.system.data.model.Role;
import com.workflow.system.presentation.dto.role.RoleResponse;
import org.springframework.stereotype.Component;

@Component
public class RoleMapper {
  public RoleResponse toResponse(Role r) {
    return RoleResponse.builder()
        .id(r.getId())
        .name(r.getName())
        .description(r.getDescription())
        .permissions(r.getPermissions())
        .status(r.getStatus())
        .createdAt(r.getCreatedAt())
        .updatedAt(r.getUpdatedAt())
        .build();
  }
}

