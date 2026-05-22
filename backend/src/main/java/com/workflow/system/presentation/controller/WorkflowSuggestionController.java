package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.WorkflowSuggestionService;
import com.workflow.system.presentation.dto.ai.GenerateWorkflowSuggestionRequest;
import com.workflow.system.presentation.dto.ai.WorkflowSuggestionResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/workflow-suggestions")
@RequiredArgsConstructor
public class WorkflowSuggestionController {
  private final WorkflowSuggestionService workflowSuggestionService;

  @PostMapping("/text")
  public WorkflowSuggestionResponse generateFromText(@Valid @RequestBody GenerateWorkflowSuggestionRequest request) {
    return workflowSuggestionService.generateFromText(request);
  }
}

