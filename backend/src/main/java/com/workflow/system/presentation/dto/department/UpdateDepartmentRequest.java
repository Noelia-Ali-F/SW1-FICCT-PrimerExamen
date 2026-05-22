package com.workflow.system.presentation.dto.department;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateDepartmentRequest {
  @NotBlank(message = "name es obligatorio")
  private String name;

  private String description;
}

