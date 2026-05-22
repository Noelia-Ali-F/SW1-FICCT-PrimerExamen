package com.workflow.system.presentation.dto.ai;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AiAssistantChatRequest {
  @NotBlank(message = "message es obligatorio")
  private String message;

  /** Usuario que dispara el chat (para contexto y acciones como «notifícame»). Opcional. */
  private String actorUserId;

  /**
   * Si true (por defecto en el servicio si viene null), el modelo puede devolver acciones ejecutables
   * (p. ej. crear notificaciones en la API).
   */
  private Boolean executeActions;
}

