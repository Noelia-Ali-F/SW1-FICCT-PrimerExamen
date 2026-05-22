/** Respuesta alineada con POST /api/ai/diagram/suggest */

export type AiDiagramSuggestionKind = 'LANE' | 'ACTIVITY' | 'TRANSITION';

export interface AiDiagramSuggestionItem {
  type: AiDiagramSuggestionKind;
  name?: string;
  reason?: string;
  description?: string;
  laneName?: string;
  order?: number;
  from?: string;
  to?: string;
  label?: string;
}

export interface AiDiagramStructuredSuggestRequest {
  policyId?: string | null;
  description: string;
  currentDiagram: unknown;
}

export interface AiDiagramStructuredSuggestResponse {
  suggestions: AiDiagramSuggestionItem[];
  warnings: string[];
}
