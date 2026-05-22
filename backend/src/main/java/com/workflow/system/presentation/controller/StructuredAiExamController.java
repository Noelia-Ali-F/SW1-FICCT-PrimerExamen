package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.LocalDiagramNlpSuggestionService;
import com.workflow.system.business.service.LocalFormNlpAutofillService;
import com.workflow.system.presentation.dto.ai.AiDiagramStructuredSuggestRequest;
import com.workflow.system.presentation.dto.ai.AiDiagramStructuredSuggestResponse;
import com.workflow.system.presentation.dto.ai.AiFormStructuredAutofillRequest;
import com.workflow.system.presentation.dto.ai.AiFormStructuredAutofillResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class StructuredAiExamController {

  private final LocalDiagramNlpSuggestionService diagramNlpSuggestion;
  private final LocalFormNlpAutofillService formNlpAutofill;

  /** Motor local NLP para diagramas — sustituible por LLM externo. */
  @PostMapping(
      path = "/diagram/suggest",
      consumes = MediaType.APPLICATION_JSON_VALUE,
      produces = MediaType.APPLICATION_JSON_VALUE)
  public AiDiagramStructuredSuggestResponse suggestDiagram(@Valid @RequestBody AiDiagramStructuredSuggestRequest req) {
    return diagramNlpSuggestion.suggest(req);
  }

  /** Extracción de valores para formulario dinámico a partir del texto libre. */
  @PostMapping(
      path = "/form/autofill",
      consumes = MediaType.APPLICATION_JSON_VALUE,
      produces = MediaType.APPLICATION_JSON_VALUE)
  public AiFormStructuredAutofillResponse suggestFormAutofill(
      @Valid @RequestBody AiFormStructuredAutofillRequest req) {
    return formNlpAutofill.autofill(req);
  }
}
