package com.workflow.system.presentation.dto.report;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DashboardReportResponse {
  long totalProcesses;
  long processesCreated;
  long processesInProgress;
  long processesCompleted;
  long processesCancelled;

  long totalTasks;
  long tasksPending;
  long tasksInProgress;
  long tasksCompleted;
  long tasksCancelled;
}

