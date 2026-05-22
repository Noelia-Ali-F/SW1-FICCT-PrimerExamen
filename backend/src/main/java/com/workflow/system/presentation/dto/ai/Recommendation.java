package com.workflow.system.presentation.dto.ai;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class Recommendation {
  private String title;
  private String description;
  private RecommendationPriority priority;
  private String suggestedAction;
}
