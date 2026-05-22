package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.BusinessPolicyService;
import com.workflow.system.presentation.dto.policy.BusinessPolicyResponse;
import com.workflow.system.presentation.dto.policy.CreateBusinessPolicyRequest;
import com.workflow.system.presentation.dto.policy.UpdateBusinessPolicyRequest;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/policies")
@RequiredArgsConstructor
public class BusinessPolicyController {
  private final BusinessPolicyService policyService;

  @PostMapping
  public BusinessPolicyResponse create(@Valid @RequestBody CreateBusinessPolicyRequest req) {
    return policyService.create(req);
  }

  @GetMapping
  public List<BusinessPolicyResponse> list() {
    return policyService.findAll();
  }

  @GetMapping("/{id}")
  public BusinessPolicyResponse getById(@PathVariable String id) {
    return policyService.findById(id);
  }

  @PutMapping("/{id}")
  public BusinessPolicyResponse update(
      @PathVariable String id, @Valid @RequestBody UpdateBusinessPolicyRequest req) {
    return policyService.update(id, req);
  }

  @PatchMapping("/{id}/deactivate")
  public BusinessPolicyResponse deactivate(@PathVariable String id) {
    return policyService.deactivate(id);
  }

  @PostMapping("/{id}/version")
  public BusinessPolicyResponse createVersion(
      @PathVariable String id, @RequestParam(name = "createdBy") String createdBy) {
    return policyService.createVersion(id, createdBy);
  }

  @PatchMapping("/{id}/activate")
  public BusinessPolicyResponse activate(@PathVariable String id) {
    return policyService.activate(id);
  }
}

