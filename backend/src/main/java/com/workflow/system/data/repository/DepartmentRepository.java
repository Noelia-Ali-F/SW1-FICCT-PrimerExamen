package com.workflow.system.data.repository;

import com.workflow.system.data.model.Department;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface DepartmentRepository extends MongoRepository<Department, String> {
  Optional<Department> findByNameIgnoreCase(String name);
  boolean existsByNameIgnoreCase(String name);
}

