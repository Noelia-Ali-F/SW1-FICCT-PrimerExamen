package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.NotificationService;
import com.workflow.system.presentation.dto.notification.NotificationResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
  private final NotificationService notificationService;

  @GetMapping("/user/{userId}")
  public List<NotificationResponse> listByUser(@PathVariable String userId) {
    return notificationService.getByUser(userId);
  }

  @GetMapping("/user/{userId}/unread")
  public List<NotificationResponse> unreadByUser(@PathVariable String userId) {
    return notificationService.getUnreadByUser(userId);
  }

  @GetMapping("/user/{userId}/unread/count")
  public long unreadCount(@PathVariable String userId) {
    return notificationService.countUnread(userId);
  }

  @PatchMapping("/{id}/read")
  public NotificationResponse markRead(@PathVariable String id) {
    return notificationService.markAsRead(id);
  }

  @PatchMapping("/user/{userId}/read-all")
  public void markAllRead(@PathVariable String userId) {
    notificationService.markAllAsRead(userId);
  }
}
