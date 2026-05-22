package com.workflow.system.config;

import com.workflow.system.presentation.realtime.WorkflowEventsWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {
  private final WorkflowEventsWebSocketHandler workflowEventsWebSocketHandler;

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    registry
        .addHandler(workflowEventsWebSocketHandler, "/ws/workflow-events")
        .setAllowedOriginPatterns("*");
  }
}

