package com.workflow.system.business.mapper;

import com.workflow.system.data.model.User;
import com.workflow.system.presentation.dto.user.UserResponse;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {
  public UserResponse toResponse(User u) {
    return UserResponse.builder()
        .id(u.getId())
        .fullName(u.getFullName())
        .email(u.getEmail())
        .roleId(u.getRoleId())
        .departmentId(u.getDepartmentId())
        .status(u.getStatus())
        .createdAt(u.getCreatedAt())
        .updatedAt(u.getUpdatedAt())
        .build();
  }
}

