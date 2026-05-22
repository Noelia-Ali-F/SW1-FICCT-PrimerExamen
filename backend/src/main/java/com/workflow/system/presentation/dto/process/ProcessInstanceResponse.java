package com.workflow.system.presentation.dto.process;

import com.workflow.system.data.model.ProcessStatus;
import java.time.Instant;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ProcessInstanceResponse {
  String id;
  String policyId;
  ProcessStatus status;
  String requestedBy;
  List<String> currentNodeIds;
  Instant startedAt;
  Instant finishedAt;
  Instant createdAt;
  Instant updatedAt;
}

