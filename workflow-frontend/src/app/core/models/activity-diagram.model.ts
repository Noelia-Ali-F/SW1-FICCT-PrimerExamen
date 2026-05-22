import type { DynamicFormSummary } from './dynamic-form.model';

export type NodeType = 'START' | 'END' | 'ACTIVITY' | 'DECISION' | 'FORK' | 'JOIN';

export type EdgeType = 'NORMAL' | 'ALTERNATIVE' | 'PARALLEL';

export type ResponsibleType = 'ROLE' | 'DEPARTMENT' | 'USER';

export interface Swimlane {
  id: string;
  name: string;
  responsibleType: ResponsibleType;
  responsibleId: string;
  /** Posición y tamaño en coordenadas del diagrama (arrastrable en el lienzo). */
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
}

export interface DiagramNode {
  id: string;
  type: NodeType;
  name?: string;
  description?: string;
  swimlaneId?: string;
  positionX?: number;
  positionY?: number;
  formId?: string;
  metadata?: Record<string, unknown>;
}

export interface DiagramEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  condition?: string;
  type?: EdgeType;
}

export interface SaveActivityDiagramPayload {
  createdBy: string;
  version?: number;
  swimlanes: Swimlane[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface ActivityDiagram {
  id: string;
  policyId: string;
  swimlanes: Swimlane[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  version?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Incluido en GET /diagram: formularios CU4 por nodo (misma respuesta que el backend). */
  dynamicForms?: DynamicFormSummary[];
}

export interface DiagramValidationErrorDto {
  code: string;
  message: string;
  elementId?: string;
}

export interface DiagramValidationResponseDto {
  isValid?: boolean;
  valid?: boolean;
  errors?: DiagramValidationErrorDto[];
}
