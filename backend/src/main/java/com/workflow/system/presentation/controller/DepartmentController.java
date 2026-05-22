package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.DepartmentService;
import com.workflow.system.presentation.dto.department.CreateDepartmentRequest;
import com.workflow.system.presentation.dto.department.DepartmentResponse;
import com.workflow.system.presentation.dto.department.UpdateDepartmentRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {
  private final DepartmentService departmentService;

  public DepartmentController(DepartmentService departmentService) {
    this.departmentService = departmentService;
  }

  @PostMapping
  public DepartmentResponse create(@Valid @RequestBody CreateDepartmentRequest req) {
    return departmentService.create(req);
  }

  @GetMapping
  public List<DepartmentResponse> list() {
    return departmentService.list();
  }

  @GetMapping("/{id}")
  public DepartmentResponse getById(@PathVariable String id) {
    return departmentService.getById(id);
  }

  @PutMapping("/{id}")
  public DepartmentResponse update(
      @PathVariable String id, @Valid @RequestBody UpdateDepartmentRequest req) {
    return departmentService.update(id, req);
  }

  @PatchMapping("/{id}/deactivate")
  public DepartmentResponse deactivate(@PathVariable String id) {
    return departmentService.deactivate(id);
  }

  @PatchMapping("/{id}/activate")
  public DepartmentResponse activate(@PathVariable String id) {
    return departmentService.activate(id);
  }
}

