package com.workflow.system.data.repository;

import com.workflow.system.data.model.Role;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface RoleRepository extends MongoRepository<Role, String> {
  Optional<Role> findByNameIgnoreCase(String name);
  boolean existsByNameIgnoreCase(String name);
}

