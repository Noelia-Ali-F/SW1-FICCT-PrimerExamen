package com.workflow.system.presentation.dto.form;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DynamicFormValidationResponse {
  boolean isValid;
  List<FormValidationErrorDto> errors;
}

