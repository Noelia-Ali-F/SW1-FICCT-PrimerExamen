package com.workflow.system.presentation.dto.ai;

import com.workflow.system.presentation.dto.diagram.SaveActivityDiagramRequest;
import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WorkflowSuggestionResponse {
  private String suggestedPolicyName;
  private String summary;

  // Compatible con el contrato existente para crear/actualizar diagramas (NO se guarda automáticamente).
  private SaveActivityDiagramRequest activityDiagramPayload;

  private List<String> detectedActivities;
  private List<String> detectedRoles;
  private List<String> detectedDecisions;
  private List<String> warnings;
}

