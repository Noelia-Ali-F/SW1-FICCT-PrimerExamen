package com.workflow.system.presentation.dto.form;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class FormValidationErrorDto {
  String code;
  String message;
  String elementId;
}

