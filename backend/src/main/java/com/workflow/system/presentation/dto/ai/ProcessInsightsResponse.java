package com.workflow.system.presentation.dto.ai;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ProcessInsightsResponse {
  private long totalProcesses;
  private long totalTasks;
  private long pendingTasks;
  private long inProgressTasks;
  private long completedTasks;
  private long cancelledTasks;
  private List<BottleneckInsight> bottlenecks;
  private List<Recommendation> recommendations;
  private String summary;
}
