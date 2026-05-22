package com.workflow.system.presentation.dto.report;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MonthlyCountResponse {
  /** Formato yyyy-MM (UTC) */
  String month;
  long count;
}

