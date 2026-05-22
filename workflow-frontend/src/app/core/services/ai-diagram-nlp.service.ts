import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AiDiagramStructuredSuggestRequest,
  AiDiagramStructuredSuggestResponse
} from '../models/ai-diagram-nlp.model';

@Injectable({ providedIn: 'root' })
export class AiDiagramNlpService {
  private readonly http = inject(HttpClient);

  suggest(payload: AiDiagramStructuredSuggestRequest) {
    return this.http.post<AiDiagramStructuredSuggestResponse>('/api/ai/diagram/suggest', payload);
  }
}
