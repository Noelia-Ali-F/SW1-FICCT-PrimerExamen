export type FormFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'FILE'
  | 'BOOLEAN'
  | 'TEXTAREA'
  | 'LABEL'
  | 'BUTTON'
  | 'RADIO'
  | 'USER';

export interface FormField {
  id: string;
  label: string;
  name: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  options?: string[];
  order?: number;
  /** Solo para type=BUTTON: acción simple en ejecución (opcional). */
  action?: string;
  /** Solo type=USER: al completar, el valor asigna la siguiente actividad a ese usuario. */
  assignsNextTask?: boolean;
}

export interface DynamicForm {
  id: string;
  policyId: string;
  activityNodeId: string;
  name: string;
  description?: string;
  fields: FormField[];
  createdAt?: string;
  updatedAt?: string;
}

/** Respuesta de GET /api/policies/:policyId/forms — inventario CU4 por nodo. */
export interface DynamicFormSummary {
  id: string;
  activityNodeId: string;
  name: string;
}

/** Cuerpo para POST y PUT de formulario dinámico (alineado con Create/Update del backend). */
export interface SaveDynamicFormPayload {
  name: string;
  description?: string;
  fields: FormField[];
}
