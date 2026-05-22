package com.workflow.system.presentation.dto.configuration;

import com.workflow.system.presentation.dto.diagram.DiagramValidationError;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ConfigurationValidationResponse {
  boolean isValid;
  List<DiagramValidationError> errors;
}

