import { SaveActivityDiagramPayload } from './activity-diagram.model';

export interface ModifyDiagramWithAiRequest {
  policyId: string;
  createdBy: string;
  instruction: string;
  currentDiagram: SaveActivityDiagramPayload;
}

export interface ModifyDiagramWithAiResponse {
  summary: string;
  activityDiagramPayload: SaveActivityDiagramPayload;
  warnings: string[];
}

