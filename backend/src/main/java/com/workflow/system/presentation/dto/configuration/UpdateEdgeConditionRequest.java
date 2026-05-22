package com.workflow.system.presentation.dto.configuration;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateEdgeConditionRequest {
  @NotBlank(message = "condition es obligatorio")
  private String condition;
}

