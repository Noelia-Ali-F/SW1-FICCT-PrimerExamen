package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.AiInsightsService;
import com.workflow.system.presentation.dto.ai.ProcessInsightsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiInsightsController {

  private final AiInsightsService aiInsightsService;

  @GetMapping("/process-insights")
  public ProcessInsightsResponse processInsights() {
    return aiInsightsService.getProcessInsights();
  }
}
