package com.workflow.system.presentation.dto.role;

import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.Data;

@Data
public class CreateRoleRequest {
  @NotBlank(message = "name es obligatorio")
  private String name;

  private String description;
  private List<String> permissions;
}

