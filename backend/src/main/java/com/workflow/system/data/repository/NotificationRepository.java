package com.workflow.system.data.repository;

import com.workflow.system.data.model.Notification;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface NotificationRepository extends MongoRepository<Notification, String> {

  List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);

  List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(String userId);

  long countByUserIdAndReadFalse(String userId);
}
