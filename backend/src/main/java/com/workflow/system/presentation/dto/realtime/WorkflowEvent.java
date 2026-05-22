package com.workflow.system.presentation.dto.realtime;

import java.time.Instant;
import java.util.Map;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WorkflowEvent {
  private String type;
  private Instant ts;
  private Map<String, Object> payload;
}

