package com.workflow.system.presentation.dto.notification;

import com.workflow.system.data.model.NotificationType;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponse {
  private String id;
  private String userId;
  private String title;
  private String message;
  private NotificationType type;
  private boolean read;
  private String relatedEntityType;
  private String relatedEntityId;
  private Instant createdAt;
}
