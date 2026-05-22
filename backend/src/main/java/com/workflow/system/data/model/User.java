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
@Document(collection = "users")
public class User {
  @Id private String id;

  private String fullName;

  @Indexed(unique = true)
  private String email;

  private String password;
  private String roleId;
  private String departmentId;
  private Status status;

  @CreatedDate private Instant createdAt;
  @LastModifiedDate private Instant updatedAt;
}

