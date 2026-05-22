package com.workflow.system.data.repository;

import com.workflow.system.data.model.ActivityTask;
import com.workflow.system.data.model.TaskStatus;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ActivityTaskRepository extends MongoRepository<ActivityTask, String> {
  List<ActivityTask> findByProcessInstanceId(String processInstanceId);

  List<ActivityTask> findByAssignedToUserId(String userId);

  List<ActivityTask> findByAssignedRoleId(String roleId);

  List<ActivityTask> findByAssignedDepartmentId(String departmentId);

  List<ActivityTask> findByStatus(TaskStatus status);

  long countByStatus(TaskStatus status);
}

