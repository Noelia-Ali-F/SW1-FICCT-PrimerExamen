package com.workflow.system.presentation.dto.diagram;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiagramValidationResponse {
  boolean isValid;
  List<DiagramValidationError> errors;
}

