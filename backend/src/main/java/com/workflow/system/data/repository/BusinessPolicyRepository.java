package com.workflow.system.data.repository;

import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.data.model.PolicyStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface BusinessPolicyRepository extends MongoRepository<BusinessPolicy, String> {
  boolean existsByNameIgnoreCase(String name);
  Optional<BusinessPolicy> findByNameIgnoreCase(String name);
  List<BusinessPolicy> findByStatus(PolicyStatus status);
}

