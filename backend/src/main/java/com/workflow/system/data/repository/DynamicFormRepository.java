package com.workflow.system.data.repository;

import com.workflow.system.data.model.DynamicForm;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface DynamicFormRepository extends MongoRepository<DynamicForm, String> {
  Optional<DynamicForm> findByPolicyIdAndActivityNodeId(String policyId, String activityNodeId);
  boolean existsByPolicyIdAndActivityNodeId(String policyId, String activityNodeId);
  List<DynamicForm> findByPolicyId(String policyId);
}

