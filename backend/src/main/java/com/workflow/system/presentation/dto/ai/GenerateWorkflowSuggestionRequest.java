package com.workflow.system.presentation.dto.ai;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GenerateWorkflowSuggestionRequest {
  @NotBlank(message = "policyId es obligatorio")
  private String policyId;

  @NotBlank(message = "promptText es obligatorio")
  private String promptText;

  @NotBlank(message = "createdBy es obligatorio")
  private String createdBy;
}

