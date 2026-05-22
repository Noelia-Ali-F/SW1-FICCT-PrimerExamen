package com.workflow.system.data.model;

import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "process_instances")
public class ProcessInstance {
  @Id private String id;

  @Indexed private String policyId;
  private ProcessStatus status;

  private String requestedBy;
  private List<String> currentNodeIds;

  private Instant startedAt;
  private Instant finishedAt;

  @CreatedDate private Instant createdAt;
  @LastModifiedDate private Instant updatedAt;
}

