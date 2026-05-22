import { SaveActivityDiagramPayload } from './activity-diagram.model';

export interface GenerateWorkflowSuggestionRequest {
  policyId: string;
  promptText: string;
  createdBy: string;
}

export interface WorkflowSuggestionResponse {
  suggestedPolicyName: string;
  summary: string;
  activityDiagramPayload: SaveActivityDiagramPayload;
  detectedActivities: string[];
  detectedRoles: string[];
  detectedDecisions: string[];
  warnings: string[];
}

