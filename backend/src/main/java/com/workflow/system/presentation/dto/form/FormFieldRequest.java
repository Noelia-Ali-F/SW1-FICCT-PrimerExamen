package com.workflow.system.presentation.dto.form;

import com.workflow.system.data.model.FormFieldType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import lombok.Data;

@Data
public class FormFieldRequest {
  @NotBlank(message = "field.id es obligatorio")
  private String id;

  @NotBlank(message = "field.label es obligatorio")
  private String label;

  private String name;

  @NotNull(message = "field.type es obligatorio")
  private FormFieldType type;

  private Boolean required;
  private String placeholder;
  private String helpText;
  private String defaultValue;
  private List<String> options;
  private Integer order;
  /** Solo para type=BUTTON: acción simple en ejecución (opcional). */
  private String action;

  /** Solo type=USER: el valor del campo asigna la siguiente actividad al usuario elegido. */
  private Boolean assignsNextTask;
}

