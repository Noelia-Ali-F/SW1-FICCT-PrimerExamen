package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.AiDiagramEditService;
import com.workflow.system.presentation.dto.ai.ModifyDiagramWithAiRequest;
import com.workflow.system.presentation.dto.ai.ModifyDiagramWithAiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/diagram-edits")
@RequiredArgsConstructor
public class AiDiagramEditController {
  private final AiDiagramEditService service;

  @PostMapping("/apply")
  public ModifyDiagramWithAiResponse apply(@Valid @RequestBody ModifyDiagramWithAiRequest request) {
    return service.apply(request);
  }
}

