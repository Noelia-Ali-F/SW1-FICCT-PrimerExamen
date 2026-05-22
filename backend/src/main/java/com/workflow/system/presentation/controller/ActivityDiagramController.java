package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.ActivityDiagramService;
import com.workflow.system.presentation.dto.diagram.ActivityDiagramResponse;
import com.workflow.system.presentation.dto.diagram.DiagramValidationResponse;
import com.workflow.system.presentation.dto.diagram.SaveActivityDiagramRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/policies/{policyId}/diagram")
@RequiredArgsConstructor
public class ActivityDiagramController {
  private final ActivityDiagramService diagramService;

  @PostMapping
  public ActivityDiagramResponse create(
      @PathVariable String policyId, @Valid @RequestBody SaveActivityDiagramRequest req) {
    return diagramService.saveDiagram(policyId, req);
  }

  @GetMapping
  public ActivityDiagramResponse get(@PathVariable String policyId) {
    return diagramService.getDiagramByPolicy(policyId);
  }

  @PutMapping
  public ActivityDiagramResponse update(
      @PathVariable String policyId, @Valid @RequestBody SaveActivityDiagramRequest req) {
    return diagramService.updateDiagram(policyId, req);
  }

  @PostMapping("/validate")
  public DiagramValidationResponse validate(@PathVariable String policyId) {
    return diagramService.validateDiagram(policyId);
  }
}

