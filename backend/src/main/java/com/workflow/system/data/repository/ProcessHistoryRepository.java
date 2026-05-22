package com.workflow.system.data.repository;

import com.workflow.system.data.model.ProcessHistory;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProcessHistoryRepository extends MongoRepository<ProcessHistory, String> {
  List<ProcessHistory> findByProcessInstanceIdOrderByCreatedAtAsc(String processInstanceId);
}

