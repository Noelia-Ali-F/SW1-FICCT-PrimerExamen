package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.RoleMapper;
import com.workflow.system.data.model.Role;
import com.workflow.system.data.model.Status;
import com.workflow.system.data.repository.RoleRepository;
import com.workflow.system.presentation.dto.role.CreateRoleRequest;
import com.workflow.system.presentation.dto.role.UpdateRoleRequest;
import com.workflow.system.presentation.dto.role.RoleResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RoleService {
  private final RoleRepository roleRepository;
  private final RoleMapper roleMapper;

  @SuppressWarnings("null")
  public RoleResponse create(CreateRoleRequest req) {
    if (roleRepository.existsByNameIgnoreCase(req.getName())) {
      throw new BusinessRuleException("Ya existe un rol con ese nombre");
    }
    Role saved =
        roleRepository.save(
            Role.builder()
                .name(req.getName().trim())
                .description(req.getDescription())
                .permissions(req.getPermissions())
                .status(Status.ACTIVE)
                .build());
    return roleMapper.toResponse(saved);
  }

  public List<RoleResponse> list() {
    return roleRepository.findAll().stream().map(roleMapper::toResponse).toList();
  }

  @SuppressWarnings("null")
  public RoleResponse getById(String id) {
    Role r =
        roleRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Rol no encontrado"));
    return roleMapper.toResponse(r);
  }

  @SuppressWarnings("null")
  public RoleResponse update(String id, UpdateRoleRequest req) {
    Role r =
        roleRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Rol no encontrado"));

    String newName = req.getName().trim();
    if (!newName.equalsIgnoreCase(r.getName()) && roleRepository.existsByNameIgnoreCase(newName)) {
      throw new BusinessRuleException("Ya existe un rol con ese nombre");
    }

    r.setName(newName);
    r.setDescription(req.getDescription());
    r.setPermissions(req.getPermissions());
    Role saved = roleRepository.save(r);
    return roleMapper.toResponse(saved);
  }

  @SuppressWarnings("null")
  public RoleResponse deactivate(String id) {
    Role r =
        roleRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Rol no encontrado"));
    r.setStatus(Status.INACTIVE);
    Role saved = roleRepository.save(r);
    return roleMapper.toResponse(saved);
  }

  @SuppressWarnings("null")
  public RoleResponse activate(String id) {
    Role r =
        roleRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Rol no encontrado"));
    r.setStatus(Status.ACTIVE);
    Role saved = roleRepository.save(r);
    return roleMapper.toResponse(saved);
  }

  @SuppressWarnings("null")
  public void assertExists(String roleId) {
    if (!roleRepository.existsById(roleId)) {
      throw new BusinessRuleException("roleId no existe");
    }
  }
}

