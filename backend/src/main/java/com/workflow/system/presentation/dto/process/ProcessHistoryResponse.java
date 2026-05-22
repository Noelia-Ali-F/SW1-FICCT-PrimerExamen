package com.workflow.system.presentation.dto.process;

import com.workflow.system.data.model.HistoryAction;
import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ProcessHistoryResponse {
  String id;
  String processInstanceId;
  String policyId;
  String activityNodeId;
  HistoryAction action;
  String userId;
  String previousStatus;
  String newStatus;
  String observation;
  Instant createdAt;
}

