package com.workflow.system.data.repository;

import com.workflow.system.data.model.ProcessInstance;
import com.workflow.system.data.model.ProcessStatus;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProcessInstanceRepository extends MongoRepository<ProcessInstance, String> {
  List<ProcessInstance> findByPolicyId(String policyId);
  List<ProcessInstance> findByRequestedBy(String requestedBy);

  long countByStatus(ProcessStatus status);
}

