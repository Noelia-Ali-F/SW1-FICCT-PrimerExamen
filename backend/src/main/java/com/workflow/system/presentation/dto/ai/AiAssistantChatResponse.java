package com.workflow.system.presentation.dto.ai;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiAssistantChatResponse {
  private String answer;
  private List<String> sources;

  /** Texto legible de lo que el backend ejecutó (notificaciones, etc.). */
  private List<String> actionsExecuted;
}

