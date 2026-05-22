package com.workflow.system.presentation.dto.task;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import lombok.Data;

@Data
public class CompleteTaskRequest {
  @NotBlank(message = "userId es obligatorio")
  private String userId;

  private Map<String, Object> formData;
  private String observations;

  // MVP: resultado que decide la transición en DECISION (ej: "aprobada", "rechazada")
  private String transitionConditionResult;
}

