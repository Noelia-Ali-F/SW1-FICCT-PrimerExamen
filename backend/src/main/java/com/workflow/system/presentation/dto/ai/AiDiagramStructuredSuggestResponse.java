package com.workflow.system.presentation.dto.ai;

import java.util.ArrayList;
import java.util.List;
import lombok.Data;

@Data
public class AiDiagramStructuredSuggestResponse {
  private List<AiDiagramSuggestionItem> suggestions = new ArrayList<>();
  private List<String> warnings = new ArrayList<>();
}
