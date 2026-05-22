package com.workflow.system.presentation.dto.form;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.Data;

@Data
public class CreateDynamicFormRequest {
  @NotBlank(message = "name es obligatorio")
  private String name;

  private String description;

  @Valid @NotEmpty(message = "fields es obligatorio")
  private List<FormFieldRequest> fields;
}

