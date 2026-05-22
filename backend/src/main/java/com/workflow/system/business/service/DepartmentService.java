package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.DepartmentMapper;
import com.workflow.system.data.model.Department;
import com.workflow.system.data.model.Status;
import com.workflow.system.data.repository.DepartmentRepository;
import com.workflow.system.presentation.dto.department.CreateDepartmentRequest;
import com.workflow.system.presentation.dto.department.UpdateDepartmentRequest;
import com.workflow.system.presentation.dto.department.DepartmentResponse;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DepartmentService {
  private final DepartmentRepository departmentRepository;
  private final DepartmentMapper departmentMapper;

  public DepartmentService(
      DepartmentRepository departmentRepository, DepartmentMapper departmentMapper) {
    this.departmentRepository = departmentRepository;
    this.departmentMapper = departmentMapper;
  }

  @SuppressWarnings("null")
  public DepartmentResponse create(CreateDepartmentRequest req) {
    if (departmentRepository.existsByNameIgnoreCase(req.getName())) {
      throw new BusinessRuleException("Ya existe un departamento con ese nombre");
    }
    Department saved =
        departmentRepository.save(
            Department.builder()
                .name(req.getName().trim())
                .description(req.getDescription())
                .status(Status.ACTIVE)
                .build());
    return departmentMapper.toResponse(saved);
  }

  public List<DepartmentResponse> list() {
    return departmentRepository.findAll().stream().map(departmentMapper::toResponse).toList();
  }

  @SuppressWarnings("null")
  public DepartmentResponse getById(String id) {
    Department d =
        departmentRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Departamento no encontrado"));
    return departmentMapper.toResponse(d);
  }

  @SuppressWarnings("null")
  public DepartmentResponse update(String id, UpdateDepartmentRequest req) {
    Department d =
        departmentRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Departamento no encontrado"));

    String newName = req.getName().trim();
    if (!newName.equalsIgnoreCase(d.getName()) && departmentRepository.existsByNameIgnoreCase(newName)) {
      throw new BusinessRuleException("Ya existe un departamento con ese nombre");
    }

    d.setName(newName);
    d.setDescription(req.getDescription());
    Department saved = departmentRepository.save(d);
    return departmentMapper.toResponse(saved);
  }

  @SuppressWarnings("null")
  public DepartmentResponse deactivate(String id) {
    Department d =
        departmentRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Departamento no encontrado"));
    d.setStatus(Status.INACTIVE);
    Department saved = departmentRepository.save(d);
    return departmentMapper.toResponse(saved);
  }

  @SuppressWarnings("null")
  public DepartmentResponse activate(String id) {
    Department d =
        departmentRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Departamento no encontrado"));
    d.setStatus(Status.ACTIVE);
    Department saved = departmentRepository.save(d);
    return departmentMapper.toResponse(saved);
  }

  @SuppressWarnings("null")
  public void assertExists(String departmentId) {
    if (!departmentRepository.existsById(departmentId)) {
      throw new BusinessRuleException("departmentId no existe");
    }
  }
}

