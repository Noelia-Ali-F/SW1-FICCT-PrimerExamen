package com.workflow.system.data.model;

import java.time.Instant;
import java.util.Map;
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
@Document(collection = "activity_tasks")
public class ActivityTask {
  @Id private String id;

  @Indexed private String processInstanceId;
  @Indexed private String policyId;

  private String activityNodeId;
  private String activityName;

  // Asignación (según swimlane.responsibleType)
  @Indexed private String assignedToUserId;
  @Indexed private String assignedRoleId;
  @Indexed private String assignedDepartmentId;

  private TaskStatus status;

  private Map<String, Object> formData;
  private String observations;

  private Instant startedAt;
  private Instant completedAt;

  @CreatedDate private Instant createdAt;
  @LastModifiedDate private Instant updatedAt;
}

