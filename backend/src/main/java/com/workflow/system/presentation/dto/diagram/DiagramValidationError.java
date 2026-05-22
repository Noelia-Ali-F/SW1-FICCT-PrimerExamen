package com.workflow.system.presentation.dto.diagram;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiagramValidationError {
  String code;
  String message;
  String elementId; // opcional: nodeId/edgeId/swimlaneId
}

