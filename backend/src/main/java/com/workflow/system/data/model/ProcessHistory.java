package com.workflow.system.data.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "process_history")
public class ProcessHistory {
  @Id private String id;

  @Indexed private String processInstanceId;
  @Indexed private String policyId;

  private String activityNodeId;
  private HistoryAction action;
  private String userId;

  private String previousStatus;
  private String newStatus;

  private String observation;

  @CreatedDate private Instant createdAt;
}

