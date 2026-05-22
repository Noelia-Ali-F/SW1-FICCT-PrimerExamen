package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.DynamicFormService;
import com.workflow.system.presentation.dto.form.CreateDynamicFormRequest;
import com.workflow.system.presentation.dto.form.DynamicFormValidationResponse;
import com.workflow.system.presentation.dto.form.DynamicFormResponse;
import com.workflow.system.presentation.dto.form.UpdateDynamicFormRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/policies/{policyId}/activities/{activityNodeId}/form")
@RequiredArgsConstructor
public class DynamicFormController {
  private final DynamicFormService formService;

  @PostMapping
  public DynamicFormResponse create(
      @PathVariable String policyId,
      @PathVariable String activityNodeId,
      @Valid @RequestBody CreateDynamicFormRequest req) {
    return formService.createForm(policyId, activityNodeId, req);
  }

  @GetMapping
  public DynamicFormResponse get(@PathVariable String policyId, @PathVariable String activityNodeId) {
    return formService.getForm(policyId, activityNodeId);
  }

  @PutMapping
  public DynamicFormResponse update(
      @PathVariable String policyId,
      @PathVariable String activityNodeId,
      @Valid @RequestBody UpdateDynamicFormRequest req) {
    return formService.updateForm(policyId, activityNodeId, req);
  }

  @DeleteMapping
  public void delete(@PathVariable String policyId, @PathVariable String activityNodeId) {
    formService.deleteForm(policyId, activityNodeId);
  }

  @PostMapping("/validate")
  public DynamicFormValidationResponse validate(
      @PathVariable String policyId,
      @PathVariable String activityNodeId,
      @Valid @RequestBody UpdateDynamicFormRequest req) {
    return formService.validateForm(policyId, activityNodeId, req);
  }
}

