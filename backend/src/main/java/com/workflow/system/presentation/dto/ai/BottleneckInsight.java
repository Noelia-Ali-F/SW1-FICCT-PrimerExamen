package com.workflow.system.presentation.dto.ai;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BottleneckInsight {
  private String title;
  private String description;
  private InsightSeverity severity;
  private String relatedActivityName;
  private String relatedUserId;
  private String relatedRoleId;
  private String relatedDepartmentId;
  private long count;
  private String recommendation;
}
