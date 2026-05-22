package com.workflow.system.presentation.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateUserRequest {
  @NotBlank(message = "fullName es obligatorio")
  private String fullName;

  @NotBlank(message = "email es obligatorio")
  @Email(message = "email inválido")
  private String email;

  @NotBlank(message = "password es obligatorio")
  private String password;

  @NotBlank(message = "roleId es obligatorio")
  private String roleId;

  @NotBlank(message = "departmentId es obligatorio")
  private String departmentId;
}

