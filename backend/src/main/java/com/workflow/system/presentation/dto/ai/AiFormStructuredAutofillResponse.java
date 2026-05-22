package com.workflow.system.presentation.dto.ai;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.Data;

@Data
public class AiFormStructuredAutofillResponse {
  private Map<String, Object> suggestedValues = new LinkedHashMap<>();
  private Map<String, Double> confidence = new LinkedHashMap<>();
  private List<String> warnings = new ArrayList<>();
}
