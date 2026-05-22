package com.workflow.system.business.exception;

import com.workflow.system.presentation.dto.diagram.DiagramValidationError;
import java.util.List;
import lombok.Getter;

@Getter
public class DiagramInvalidException extends RuntimeException {
  private final List<DiagramValidationError> errors;

  public DiagramInvalidException(String message, List<DiagramValidationError> errors) {
    super(message);
    this.errors = errors;
  }
}

