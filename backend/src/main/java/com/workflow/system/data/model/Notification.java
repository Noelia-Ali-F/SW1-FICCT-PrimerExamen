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
@Document(collection = "notifications")
public class Notification {
  @Id private String id;

  /** Destinatario; null para avisos de tareas en pool (rol/departamento sin usuario directo). */
  @Indexed
  private String userId;

  private String title;
  private String message;

  @Indexed
  private NotificationType type;

  @Indexed
  private boolean read;

  private String relatedEntityType;
  private String relatedEntityId;

  @CreatedDate private Instant createdAt;
}
