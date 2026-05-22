package com.workflow.system.presentation.dto.report;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class RecentItemResponse {
  String type; // PROCESS | TASK
  String id;
  String title;
  String status;
  Instant ts;
}

