package com.workflow.system.data.model;

import java.time.Instant;
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
@Document(collection = "policies")
public class BusinessPolicy {
  @Id private String id;

  @Indexed(unique = true)
  private String name;

  private String description;
  private Integer version;
  private PolicyStatus status;

  private String responsibleUserId;
  private String createdBy;

  @CreatedDate private Instant createdAt;
  @LastModifiedDate private Instant updatedAt;
}

