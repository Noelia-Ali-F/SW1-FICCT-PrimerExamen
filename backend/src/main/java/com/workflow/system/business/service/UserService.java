package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.UserMapper;
import com.workflow.system.data.model.Status;
import com.workflow.system.data.model.User;
import com.workflow.system.data.repository.UserRepository;
import com.workflow.system.presentation.dto.user.CreateUserRequest;
import com.workflow.system.presentation.dto.user.UpdateUserRequest;
import com.workflow.system.presentation.dto.user.UserResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
@RequiredArgsConstructor
public class UserService {
  private final UserRepository userRepository;
  private final RoleService roleService;
  private final DepartmentService departmentService;
  private final UserMapper userMapper;
  private final PasswordEncoder passwordEncoder;

  @SuppressWarnings("null")
  public UserResponse create(CreateUserRequest req) {
    if (userRepository.existsByEmailIgnoreCase(req.getEmail())) {
      throw new BusinessRuleException("Ya existe un usuario con ese email");
    }
    roleService.assertExists(req.getRoleId());
    departmentService.assertExists(req.getDepartmentId());

    User saved =
        userRepository.save(
            User.builder()
                .fullName(req.getFullName().trim())
                .email(req.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(req.getPassword()))
                .roleId(req.getRoleId())
                .departmentId(req.getDepartmentId())
                .status(Status.ACTIVE)
                .build());
    return userMapper.toResponse(saved);
  }

  public List<UserResponse> list() {
    return userRepository.findAll().stream().map(userMapper::toResponse).toList();
  }

  @SuppressWarnings("null")
  public UserResponse getById(String id) {
    User u =
        userRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    return userMapper.toResponse(u);
  }

  @SuppressWarnings("null")
  public UserResponse update(String id, UpdateUserRequest req) {
    User u =
        userRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

    String newEmail = req.getEmail().trim().toLowerCase();
    if (!newEmail.equalsIgnoreCase(u.getEmail()) && userRepository.existsByEmailIgnoreCase(newEmail)) {
      throw new BusinessRuleException("Ya existe un usuario con ese email");
    }

    roleService.assertExists(req.getRoleId());
    departmentService.assertExists(req.getDepartmentId());

    u.setFullName(req.getFullName().trim());
    u.setEmail(newEmail);
    if (req.getPassword() != null && !req.getPassword().isBlank()) {
      u.setPassword(passwordEncoder.encode(req.getPassword()));
    }
    u.setRoleId(req.getRoleId());
    u.setDepartmentId(req.getDepartmentId());

    User saved = userRepository.save(u);
    return userMapper.toResponse(saved);
  }

  @SuppressWarnings("null")
  public UserResponse deactivate(String id) {
    User u =
        userRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    u.setStatus(Status.INACTIVE);
    User saved = userRepository.save(u);
    return userMapper.toResponse(saved);
  }

  @SuppressWarnings("null")
  public UserResponse activate(String id) {
    User u =
        userRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    u.setStatus(Status.ACTIVE);
    User saved = userRepository.save(u);
    return userMapper.toResponse(saved);
  }
}

