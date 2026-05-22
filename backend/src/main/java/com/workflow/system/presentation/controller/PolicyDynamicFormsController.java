package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.DynamicFormService;
import com.workflow.system.presentation.dto.form.DynamicFormSummaryResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/policies/{policyId}")
@RequiredArgsConstructor
public class PolicyDynamicFormsController {
  private final DynamicFormService formService;

  @GetMapping("/forms")
  public List<DynamicFormSummaryResponse> listForms(@PathVariable String policyId) {
    return formService.listSummariesForPolicy(policyId);
  }
}
