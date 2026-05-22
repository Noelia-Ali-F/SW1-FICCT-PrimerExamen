package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.RoleService;
import com.workflow.system.presentation.dto.role.CreateRoleRequest;
import com.workflow.system.presentation.dto.role.RoleResponse;
import com.workflow.system.presentation.dto.role.UpdateRoleRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
public class RoleController {
  private final RoleService roleService;

  @PostMapping
  public RoleResponse create(@Valid @RequestBody CreateRoleRequest req) {
    return roleService.create(req);
  }

  @GetMapping
  public List<RoleResponse> list() {
    return roleService.list();
  }

  @GetMapping("/{id}")
  public RoleResponse getById(@PathVariable String id) {
    return roleService.getById(id);
  }

  @PutMapping("/{id}")
  public RoleResponse update(@PathVariable String id, @Valid @RequestBody UpdateRoleRequest req) {
    return roleService.update(id, req);
  }

  @PatchMapping("/{id}/deactivate")
  public RoleResponse deactivate(@PathVariable String id) {
    return roleService.deactivate(id);
  }

  @PatchMapping("/{id}/activate")
  public RoleResponse activate(@PathVariable String id) {
    return roleService.activate(id);
  }
}

