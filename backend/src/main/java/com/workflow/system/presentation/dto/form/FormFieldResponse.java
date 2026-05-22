package com.workflow.system.presentation.dto.form;

import com.workflow.system.data.model.FormFieldType;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class FormFieldResponse {
  String id;
  String label;
  String name;
  FormFieldType type;
  Boolean required;
  String placeholder;
  String helpText;
  String defaultValue;
  List<String> options;
  Integer order;
  String action;
  Boolean assignsNextTask;
}

