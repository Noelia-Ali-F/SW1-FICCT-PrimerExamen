package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.ActivityTaskService;
import com.workflow.system.presentation.dto.task.ActivityTaskResponse;
import com.workflow.system.presentation.dto.task.CompleteTaskRequest;
import com.workflow.system.presentation.dto.task.StartTaskRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {
  private final ActivityTaskService taskService;

  @GetMapping
  public List<ActivityTaskResponse> list() {
    return taskService.list();
  }

  @GetMapping("/my/{userId}")
  public List<ActivityTaskResponse> my(@PathVariable String userId) {
    return taskService.listMyTasks(userId);
  }

  @GetMapping("/{id}")
  public ActivityTaskResponse getById(@PathVariable String id) {
    return taskService.getById(id);
  }

  @PatchMapping("/{id}/start")
  public ActivityTaskResponse start(@PathVariable String id, @Valid @RequestBody StartTaskRequest req) {
    return taskService.start(id, req);
  }

  @PatchMapping("/{id}/complete")
  public ActivityTaskResponse complete(
      @PathVariable String id, @Valid @RequestBody CompleteTaskRequest req) {
    return taskService.complete(id, req);
  }
}

