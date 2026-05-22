import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ModifyDiagramWithAiRequest,
  ModifyDiagramWithAiResponse
} from '../models/ai-diagram-edit.model';

@Injectable({ providedIn: 'root' })
export class AiDiagramEditService {
  private readonly http = inject(HttpClient);

  apply(payload: ModifyDiagramWithAiRequest) {
    return this.http.post<ModifyDiagramWithAiResponse>('/api/ai/diagram-edits/apply', payload);
  }
}

