package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.AiAssistantService;
import com.workflow.system.business.service.AiAssistantService.Answer;
import com.workflow.system.presentation.dto.ai.AiAssistantChatRequest;
import com.workflow.system.presentation.dto.ai.AiAssistantChatResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/assistant")
@RequiredArgsConstructor
public class AiAssistantController {
  private final AiAssistantService aiAssistantService;

  @PostMapping("/chat")
  public AiAssistantChatResponse chat(@Valid @RequestBody AiAssistantChatRequest req) {
    Answer a = aiAssistantService.chat(req);
    return AiAssistantChatResponse.builder()
        .answer(a.answer())
        .sources(a.sources())
        .actionsExecuted(a.actionsExecuted())
        .build();
  }
}

