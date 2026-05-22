package com.workflow.system.presentation.dto.ai;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import lombok.Data;

@Data
public class AiFormStructuredAutofillRequest {
  private String policyId;
  private String activityNodeId;

  @NotNull private JsonNode form;

  /** Valores ya capturados (clave campo). */
  private Map<String, Object> currentValues;

  @NotBlank(message = "inputText es obligatorio")
  private String inputText;
}
