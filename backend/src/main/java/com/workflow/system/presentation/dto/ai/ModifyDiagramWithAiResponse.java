package com.workflow.system.presentation.dto.ai;

import com.workflow.system.presentation.dto.diagram.SaveActivityDiagramRequest;
import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ModifyDiagramWithAiResponse {
  private String summary;
  private SaveActivityDiagramRequest activityDiagramPayload;
  private List<String> warnings;
}

