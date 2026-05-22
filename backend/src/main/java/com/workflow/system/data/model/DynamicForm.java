package com.workflow.system.data.model;

import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "dynamic_forms")
public class DynamicForm {
  @Id private String id;

  @Indexed private String policyId;
  @Indexed private String activityNodeId;

  private String name;
  private String description;
  private List<FormField> fields;

  @CreatedDate private Instant createdAt;
  @LastModifiedDate private Instant updatedAt;

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class FormField {
    private String id;
    private String label;
    private String name;
    private FormFieldType type;
    private Boolean required;
    private String placeholder;
    private String helpText;
    private String defaultValue;
    private List<String> options;
    private Integer order;
    /** Solo para type=BUTTON: acción simple en ejecución (opcional). */
    private String action;
    /**
     * Solo para type=USER: si es true, el valor elegido asigna la siguiente actividad al usuario
     * indicado (sobreescribe el carril del diagrama para esa tarea).
     */
    private Boolean assignsNextTask;
  }
}

