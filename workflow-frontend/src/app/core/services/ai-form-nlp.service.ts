import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AiFormStructuredAutofillRequest,
  AiFormStructuredAutofillResponse
} from '../models/ai-form-nlp.model';

@Injectable({ providedIn: 'root' })
export class AiFormNlpService {
  private readonly http = inject(HttpClient);

  autofill(payload: AiFormStructuredAutofillRequest) {
    return this.http.post<AiFormStructuredAutofillResponse>('/api/ai/form/autofill', payload);
  }
}
