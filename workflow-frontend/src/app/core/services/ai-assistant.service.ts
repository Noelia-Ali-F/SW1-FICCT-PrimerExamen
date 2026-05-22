import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AiAssistantChatRequest, AiAssistantChatResponse } from '../models/ai-assistant.model';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly http = inject(HttpClient);

  chat(payload: AiAssistantChatRequest) {
    return this.http.post<AiAssistantChatResponse>('/api/ai/assistant/chat', payload);
  }
}

