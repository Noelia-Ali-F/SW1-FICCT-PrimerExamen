package com.workflow.system.business.mapper;

import com.workflow.system.data.model.DynamicForm;
import com.workflow.system.presentation.dto.form.DynamicFormResponse;
import com.workflow.system.presentation.dto.form.FormFieldResponse;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class DynamicFormMapper {
  public DynamicFormResponse toResponse(DynamicForm f) {
    List<FormFieldResponse> fields =
        f.getFields() == null
            ? List.of()
            : f.getFields().stream()
                .map(
                    x ->
                        FormFieldResponse.builder()
                            .id(x.getId())
                            .label(x.getLabel())
                            .name(x.getName())
                            .type(x.getType())
                            .required(x.getRequired())
                            .placeholder(x.getPlaceholder())
                            .helpText(x.getHelpText())
                            .defaultValue(x.getDefaultValue())
                            .options(x.getOptions())
                            .order(x.getOrder())
                            .action(x.getAction())
                            .assignsNextTask(x.getAssignsNextTask())
                            .build())
                .toList();

    return DynamicFormResponse.builder()
        .id(f.getId())
        .policyId(f.getPolicyId())
        .activityNodeId(f.getActivityNodeId())
        .name(f.getName())
        .description(f.getDescription())
        .fields(fields)
        .createdAt(f.getCreatedAt())
        .updatedAt(f.getUpdatedAt())
        .build();
  }
}

