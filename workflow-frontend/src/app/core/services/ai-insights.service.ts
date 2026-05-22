import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ProcessInsights } from '../models/process-insights.model';

@Injectable({ providedIn: 'root' })
export class AiInsightsService {
  private readonly http = inject(HttpClient);

  getProcessInsights() {
    return this.http.get<ProcessInsights>('/api/ai/process-insights');
  }
}
