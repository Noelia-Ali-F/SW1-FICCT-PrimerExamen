package com.workflow.system.presentation.dto.auth;

import com.workflow.system.presentation.dto.user.UserResponse;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LoginResponse {
  String accessToken;
  String tokenType; // Bearer
  long expiresInSeconds;
  UserResponse user;
  List<String> permissions;
}

