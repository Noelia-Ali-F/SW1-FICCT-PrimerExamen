package com.workflow.system.business.service;

import com.workflow.system.presentation.dto.realtime.WorkflowEvent;
import com.workflow.system.presentation.realtime.WorkflowEventsWebSocketHandler;
import java.time.Instant;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WorkflowEventsPublisher {
  private final WorkflowEventsWebSocketHandler wsHandler;

  public void publish(String type, Map<String, Object> payload) {
    wsHandler.broadcast(WorkflowEvent.builder().type(type).ts(Instant.now()).payload(payload).build());
  }
}

