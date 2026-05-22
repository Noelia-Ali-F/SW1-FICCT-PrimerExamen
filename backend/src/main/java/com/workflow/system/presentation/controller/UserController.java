package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.UserService;
import com.workflow.system.presentation.dto.user.CreateUserRequest;
import com.workflow.system.presentation.dto.user.UpdateUserRequest;
import com.workflow.system.presentation.dto.user.UserResponse;
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
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
  private final UserService userService;

  @PostMapping
  public UserResponse create(@Valid @RequestBody CreateUserRequest req) {
    return userService.create(req);
  }

  @GetMapping
  public List<UserResponse> list() {
    return userService.list();
  }

  @GetMapping("/{id}")
  public UserResponse getById(@PathVariable String id) {
    return userService.getById(id);
  }

  @PutMapping("/{id}")
  public UserResponse update(@PathVariable String id, @Valid @RequestBody UpdateUserRequest req) {
    return userService.update(id, req);
  }

  @PatchMapping("/{id}/deactivate")
  public UserResponse deactivate(@PathVariable String id) {
    return userService.deactivate(id);
  }

  @PatchMapping("/{id}/activate")
  public UserResponse activate(@PathVariable String id) {
    return userService.activate(id);
  }
}

