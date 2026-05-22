package com.workflow.system.presentation.dto.policy;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateBusinessPolicyRequest {
  @NotBlank(message = "name es obligatorio")
  private String name;

  @NotBlank(message = "description es obligatorio")
  private String description;

  @NotBlank(message = "responsibleUserId es obligatorio")
  private String responsibleUserId;
}

