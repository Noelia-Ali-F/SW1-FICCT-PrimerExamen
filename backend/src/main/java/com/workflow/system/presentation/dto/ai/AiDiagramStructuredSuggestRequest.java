package com.workflow.system.presentation.dto.ai;

import com.workflow.system.presentation.dto.diagram.SaveActivityDiagramRequest;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Entrada NLP para diagrama (motor local; sustituible por LLM). */
@Data
public class AiDiagramStructuredSuggestRequest {
  private String policyId;

  @NotBlank(message = "description es obligatoria")
  private String description;

  /** Estado actual opcional para contexto/heurísticas posteriores. */
  private SaveActivityDiagramRequest currentDiagram;
}
