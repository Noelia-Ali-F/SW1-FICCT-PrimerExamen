/** Request/response POST /api/ai/form/autofill */

export interface AiFormStructuredAutofillRequest {
  policyId?: string;
  activityNodeId?: string;
  form: unknown;
  currentValues: Record<string, unknown>;
  inputText: string;
}

export interface AiFormStructuredAutofillResponse {
  suggestedValues: Record<string, unknown>;
  confidence: Record<string, number>;
  warnings: string[];
}
