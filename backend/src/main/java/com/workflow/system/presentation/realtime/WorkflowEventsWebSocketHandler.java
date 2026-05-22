package com.workflow.system.presentation.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.workflow.system.presentation.dto.realtime.WorkflowEvent;
import java.io.IOException;
import java.time.Instant;
import java.util.Objects;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Slf4j
@Component
@RequiredArgsConstructor
public class WorkflowEventsWebSocketHandler extends TextWebSocketHandler {
  private final ObjectMapper objectMapper;
  private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
  /** sessionId -> policyId (sala) */
  private final Map<String, String> roomsBySessionId = new ConcurrentHashMap<>();
  /** sessionId -> clientId (para presencia/leave al cerrar) */
  private final Map<String, String> clientIdBySessionId = new ConcurrentHashMap<>();
  /** sessionId -> userName (para presencia/leave al cerrar) */
  private final Map<String, String> userNameBySessionId = new ConcurrentHashMap<>();

  @Override
  public void afterConnectionEstablished(WebSocketSession session) {
    sessions.add(session);
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    // Si estaba en una sala, notificar leave para que el front quite el peer (cierre inesperado).
    String room = roomsBySessionId.get(session.getId());
    String clientId = clientIdBySessionId.get(session.getId());
    String userName = userNameBySessionId.get(session.getId());
    if (room != null && clientId != null) {
      try {
        String leaveJson =
            objectMapper.writeValueAsString(
                Map.of(
                    "type",
                    "DIAGRAM_COLLAB",
                    "action",
                    "leave",
                    "policyId",
                    room,
                    "clientId",
                    clientId,
                    "userName",
                    userName == null ? "" : userName,
                    "ts",
                    Instant.now().toString()));
        relayToRoom(room, session.getId(), new TextMessage(leaveJson));
      } catch (Exception e) {
        log.debug("No se pudo emitir leave al cerrar WS", e);
      }
    }
    sessions.remove(session);
    roomsBySessionId.remove(session.getId());
    clientIdBySessionId.remove(session.getId());
    userNameBySessionId.remove(session.getId());
  }

  /**
   * Colaboración en tiempo real: reenvía únicamente mensajes del editor (DIAGRAM_COLLAB / DIAGRAM_OP).
   * Routing estricto por sala (policyId) para evitar mezclar políticas.
   */
  @Override
  protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    ParsedCollab parsed = parseCollab(message.getPayload());
    if (parsed == null) {
      // Ignorar cualquier cosa que no sea colaboración de diagrama
      return;
    }

    String policyId = parsed.policyId();
    if (policyId == null || policyId.isBlank()) return;

    // Robustez: si llega cualquier mensaje colaborativo (incluye DIAGRAM_OP) y la sesión aún no tiene sala,
    // asignamos la sala implícitamente para evitar "no se refleja" por orden de mensajes.
    if (!Objects.equals(parsed.type(), "DIAGRAM_COLLAB") || !Objects.equals(parsed.action(), "leave")) {
      roomsBySessionId.putIfAbsent(session.getId(), policyId);
    }

    // Gestionar join/leave para estado de sala
    if (Objects.equals(parsed.type(), "DIAGRAM_COLLAB")) {
      if (Objects.equals(parsed.action(), "join")) {
        roomsBySessionId.put(session.getId(), policyId);
        if (parsed.clientId() != null && !parsed.clientId().isBlank()) clientIdBySessionId.put(session.getId(), parsed.clientId());
        if (parsed.userName() != null) userNameBySessionId.put(session.getId(), parsed.userName());
        log.info("WS COLLAB join session={} policyId={} clientId={} userName={}", session.getId(), policyId, parsed.clientId(), parsed.userName());
      } else if (Objects.equals(parsed.action(), "leave")) {
        roomsBySessionId.remove(session.getId());
        clientIdBySessionId.remove(session.getId());
        userNameBySessionId.remove(session.getId());
        log.info("WS COLLAB leave session={} policyId={} clientId={}", session.getId(), policyId, parsed.clientId());
      }
    }

    if (Objects.equals(parsed.type(), "DIAGRAM_OP")) {
      log.info("WS DIAGRAM_OP session={} policyId={} clientId={}", session.getId(), policyId, parsed.clientId());
    }

    // Reenviar al room indicado por policyId, no por "senderRoom" (para que funcione incluso al primer mensaje).
    relayToRoom(policyId, session.getId(), message);
  }

  private ParsedCollab parseCollab(String rawJson) {
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> m = objectMapper.readValue(rawJson, Map.class);
      Object type = m.get("type");
      if (type == null) return null;
      String t = String.valueOf(type);
      // Ruteamos mensajes del editor (presencia + operaciones) por policyId.
      if (!"DIAGRAM_COLLAB".equals(t) && !"DIAGRAM_OP".equals(t)) return null;
      Object pid = m.get("policyId");
      String policyId = pid == null ? null : String.valueOf(pid);
      String action = m.get("action") == null ? null : String.valueOf(m.get("action"));
      String clientId = m.get("clientId") == null ? null : String.valueOf(m.get("clientId"));
      String userName = m.get("userName") == null ? null : String.valueOf(m.get("userName"));
      return new ParsedCollab(t, action, policyId, clientId, userName);
    } catch (Exception e) {
      return null;
    }
  }

  private void relayToRoom(String policyId, String senderSessionId, TextMessage outbound) {
    int relayed = 0;
    for (WebSocketSession s : sessions) {
      if (!s.isOpen() || s.getId().equals(senderSessionId)) continue;
      String targetRoom = roomsBySessionId.get(s.getId());
      if (targetRoom == null || !policyId.equals(targetRoom)) continue;
      try {
        s.sendMessage(outbound);
        relayed++;
      } catch (IOException e) {
        log.debug("Error reenviando mensaje WS", e);
      }
    }
    if (relayed == 0) {
      log.info("WS relay policyId={} senderSession={} relayedTo=0 (sessionsInRoom={})", policyId, senderSessionId, roomsBySessionId.values().stream().filter(policyId::equals).count());
    }
  }

  public void broadcast(WorkflowEvent event) {
    String json;
    try {
      json = objectMapper.writeValueAsString(event);
    } catch (Exception e) {
      log.warn("No se pudo serializar WorkflowEvent", e);
      return;
    }

    TextMessage msg = new TextMessage(json);
    for (WebSocketSession s : sessions) {
      try {
        if (s.isOpen()) s.sendMessage(msg);
      } catch (IOException e) {
        log.debug("Error enviando evento WS", e);
      }
    }
  }

  private record ParsedCollab(String type, String action, String policyId, String clientId, String userName) {}
}

