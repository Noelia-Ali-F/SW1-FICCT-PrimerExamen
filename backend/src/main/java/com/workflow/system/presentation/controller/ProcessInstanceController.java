package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.ProcessInstanceService;
import com.workflow.system.business.service.ProcessHistoryService;
import com.workflow.system.presentation.dto.process.CreateProcessInstanceRequest;
import com.workflow.system.presentation.dto.process.ProcessHistoryResponse;
import com.workflow.system.presentation.dto.process.ProcessInstanceResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/process-instances")
@RequiredArgsConstructor
public class ProcessInstanceController {
  private final ProcessInstanceService processService;
  private final ProcessHistoryService historyService;

  @PostMapping
  public ProcessInstanceResponse create(@Valid @RequestBody CreateProcessInstanceRequest req) {
    return processService.create(req);
  }

  @GetMapping
  public List<ProcessInstanceResponse> list() {
    return processService.list();
  }

  @GetMapping("/{id}")
  public ProcessInstanceResponse getById(@PathVariable String id) {
    return processService.getById(id);
  }

  @PatchMapping("/{id}/cancel")
  public ProcessInstanceResponse cancel(
      @PathVariable String id, @RequestParam(name = "userId") String userId) {
    return processService.cancel(id, userId);
  }

  @GetMapping("/{id}/history")
  public List<ProcessHistoryResponse> history(@PathVariable String id) {
    return historyService.getHistoryByProcessInstanceId(id);
  }
}

