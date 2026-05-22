package com.workflow.system.presentation.dto.task;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class StartTaskRequest {
  @NotBlank(message = "userId es obligatorio")
  private String userId;
}

