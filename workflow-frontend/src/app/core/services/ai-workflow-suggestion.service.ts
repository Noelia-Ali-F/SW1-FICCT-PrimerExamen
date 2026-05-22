import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  GenerateWorkflowSuggestionRequest,
  WorkflowSuggestionResponse
} from '../models/ai-workflow-suggestion.model';

@Injectable({ providedIn: 'root' })
export class AiWorkflowSuggestionService {
  private readonly http = inject(HttpClient);

  generateFromText(payload: GenerateWorkflowSuggestionRequest) {
    return this.http.post<WorkflowSuggestionResponse>('/api/ai/workflow-suggestions/text', payload);
  }
}

