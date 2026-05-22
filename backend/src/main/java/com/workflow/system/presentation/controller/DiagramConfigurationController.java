package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.DiagramConfigurationService;
import com.workflow.system.presentation.dto.configuration.ConfigurationValidationResponse;
import com.workflow.system.presentation.dto.configuration.UpdateEdgeConditionRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class DiagramConfigurationController {
  private final DiagramConfigurationService configurationService;

  @PatchMapping("/api/policies/{policyId}/edges/{edgeId}/condition")
  public void updateEdgeCondition(
      @PathVariable String policyId,
      @PathVariable String edgeId,
      @Valid @RequestBody UpdateEdgeConditionRequest req) {
    configurationService.updateEdgeCondition(policyId, edgeId, req);
  }

  @PostMapping("/api/policies/{policyId}/configuration/validate")
  public ConfigurationValidationResponse validateConfiguration(@PathVariable String policyId) {
    return configurationService.validateConfiguration(policyId);
  }
}

