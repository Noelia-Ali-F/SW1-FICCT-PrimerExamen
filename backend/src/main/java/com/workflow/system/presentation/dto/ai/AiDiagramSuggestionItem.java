package com.workflow.system.presentation.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public class AiDiagramSuggestionItem {
  public enum AiDiagramSuggestionKind {
    LANE,
    ACTIVITY,
    TRANSITION
  }

  AiDiagramSuggestionKind type;

  // LANE
  String name;
  /** Detección textual (responsables, roles, áreas). */
  String reason;

  // ACTIVITY
  String description;
  String laneName;
  Integer order;

  // TRANSITION
  String from;
  String to;
  String label;
}
