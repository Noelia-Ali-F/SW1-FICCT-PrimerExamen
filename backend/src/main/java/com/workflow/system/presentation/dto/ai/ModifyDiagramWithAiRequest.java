package com.workflow.system.presentation.dto.ai;

import com.workflow.system.presentation.dto.diagram.SaveActivityDiagramRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ModifyDiagramWithAiRequest {
  @NotBlank(message = "policyId es obligatorio")
  private String policyId;

  @NotBlank(message = "createdBy es obligatorio")
  private String createdBy;

  @NotBlank(message = "instruction es obligatorio")
  private String instruction;

  @Valid
  @NotNull(message = "currentDiagram es obligatorio")
  private SaveActivityDiagramRequest currentDiagram;
}

