package com.workflow.system.business.service;

import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.NotificationMapper;
import com.workflow.system.data.model.Notification;
import com.workflow.system.data.model.NotificationType;
import com.workflow.system.data.repository.NotificationRepository;
import com.workflow.system.presentation.dto.notification.NotificationResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationService {
  private final NotificationRepository notificationRepository;
  private final NotificationMapper mapper;

  @SuppressWarnings("null")
  public Notification createNotification(
      String userId,
      String title,
      String message,
      NotificationType type,
      String relatedEntityType,
      String relatedEntityId) {
    Notification n =
        Notification.builder()
            .userId(userId)
            .title(title)
            .message(message)
            .type(type)
            .read(false)
            .relatedEntityType(relatedEntityType)
            .relatedEntityId(relatedEntityId)
            .build();
    return notificationRepository.save(n);
  }

  @SuppressWarnings("null")
  public List<NotificationResponse> getByUser(String userId) {
    return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
        .map(mapper::toResponse)
        .toList();
  }

  @SuppressWarnings("null")
  public List<NotificationResponse> getUnreadByUser(String userId) {
    return notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId).stream()
        .map(mapper::toResponse)
        .toList();
  }

  @SuppressWarnings("null")
  public long countUnread(String userId) {
    return notificationRepository.countByUserIdAndReadFalse(userId);
  }

  @SuppressWarnings("null")
  public NotificationResponse markAsRead(String id) {
    Notification n =
        notificationRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Notificación no encontrada"));
    n.setRead(true);
    return mapper.toResponse(notificationRepository.save(n));
  }

  @SuppressWarnings("null")
  public void markAllAsRead(String userId) {
    List<Notification> unread =
        notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
    for (Notification n : unread) {
      n.setRead(true);
    }
    notificationRepository.saveAll(unread);
  }
}
