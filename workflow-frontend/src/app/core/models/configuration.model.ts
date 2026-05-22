import { DiagramValidationErrorDto } from './activity-diagram.model';

export interface UpdateEdgeConditionRequest {
  condition: string;
}

export interface ConfigurationValidationResponse {
  isValid?: boolean;
  valid?: boolean;
  errors?: DiagramValidationErrorDto[];
}
