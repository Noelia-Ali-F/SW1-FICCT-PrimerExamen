export interface AiAssistantChatRequest {
  message: string;
  /** Usuario que ordena la acción (notificaciones «para mí», etc.). */
  actorUserId?: string;
  /** Por defecto true en backend si se omite: ejecutar acciones API cuando el modelo las devuelva. */
  executeActions?: boolean;
}

export interface AiAssistantChatResponse {
  answer: string;
  sources: string[];
  /** Mensajes de lo ejecutado (p. ej. notificación creada). */
  actionsExecuted?: string[];
}

