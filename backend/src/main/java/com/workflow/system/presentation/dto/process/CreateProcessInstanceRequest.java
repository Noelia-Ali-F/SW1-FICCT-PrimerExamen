package com.workflow.system.presentation.dto.process;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateProcessInstanceRequest {
  @NotBlank(message = "policyId es obligatorio")
  private String policyId;

  @NotBlank(message = "requestedBy es obligatorio")
  private String requestedBy;
}

