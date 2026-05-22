package com.workflow.system.data.repository;

import com.workflow.system.data.model.ActivityDiagram;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ActivityDiagramRepository extends MongoRepository<ActivityDiagram, String> {
  Optional<ActivityDiagram> findByPolicyId(String policyId);
  boolean existsByPolicyId(String policyId);
}

