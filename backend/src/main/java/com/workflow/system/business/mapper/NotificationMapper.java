package com.workflow.system.business.mapper;

import com.workflow.system.data.model.Notification;
import com.workflow.system.presentation.dto.notification.NotificationResponse;
import org.springframework.stereotype.Component;

@Component
public class NotificationMapper {
  public NotificationResponse toResponse(Notification n) {
    return NotificationResponse.builder()
        .id(n.getId())
        .userId(n.getUserId())
        .title(n.getTitle())
        .message(n.getMessage())
        .type(n.getType())
        .read(n.isRead())
        .relatedEntityType(n.getRelatedEntityType())
        .relatedEntityId(n.getRelatedEntityId())
        .createdAt(n.getCreatedAt())
        .build();
  }
}
