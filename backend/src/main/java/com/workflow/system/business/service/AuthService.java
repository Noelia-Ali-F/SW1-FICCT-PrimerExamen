package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.config.JwtService;
import com.workflow.system.data.model.Role;
import com.workflow.system.data.model.Status;
import com.workflow.system.data.model.User;
import com.workflow.system.data.repository.RoleRepository;
import com.workflow.system.data.repository.UserRepository;
import com.workflow.system.presentation.dto.auth.LoginRequest;
import com.workflow.system.presentation.dto.auth.LoginResponse;
import com.workflow.system.presentation.dto.user.UserResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
  private final UserRepository userRepository;
  private final RoleRepository roleRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final com.workflow.system.business.mapper.UserMapper userMapper;

  @SuppressWarnings("null")
  public LoginResponse login(LoginRequest req) {
    String email = req.getEmail().trim().toLowerCase();
    User u =
        userRepository
            .findByEmailIgnoreCase(email)
            .orElseThrow(() -> new ResourceNotFoundException("Credenciales inválidas"));
    if (u.getStatus() != Status.ACTIVE) {
      throw new BusinessRuleException("Usuario inactivo");
    }

    String stored = u.getPassword() == null ? "" : u.getPassword();
    boolean ok;
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
      ok = passwordEncoder.matches(req.getPassword(), stored);
    } else {
      // Migración automática desde texto plano (legacy)
      ok = stored.equals(req.getPassword());
      if (ok) {
        u.setPassword(passwordEncoder.encode(req.getPassword()));
        userRepository.save(u);
      }
    }
    if (!ok) {
      throw new ResourceNotFoundException("Credenciales inválidas");
    }

    Role role =
        roleRepository
            .findById(u.getRoleId())
            .orElseGet(() -> Role.builder().permissions(List.of()).build());
    List<String> perms = role.getPermissions() == null ? List.of() : role.getPermissions();

    String token = jwtService.issueToken(u.getId(), u.getEmail(), perms);
    UserResponse user = userMapper.toResponse(u);
    return LoginResponse.builder()
        .accessToken(token)
        .tokenType("Bearer")
        .expiresInSeconds(jwtService.getTtlSeconds())
        .user(user)
        .permissions(perms)
        .build();
  }
}

