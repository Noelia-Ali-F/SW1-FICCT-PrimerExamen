package com.workflow.system.business.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Cliente mínimo para Gemini (Google Generative Language API).
 *
 * <p>Se activa solo si existe GEMINI_API_KEY configurada. Si falla, el caller debe hacer fallback.
 */
@Service
public class GeminiChatClient {
  private final ObjectMapper om = new ObjectMapper();
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private final String apiKey;
  private final String model;

  public GeminiChatClient(
      @Value("${app.ai.gemini.apiKey:}") String apiKey,
      @Value("${app.ai.gemini.model:gemini-1.5-flash}") String model) {
    this.apiKey = apiKey == null ? "" : apiKey.trim();
    this.model = model == null ? "" : model.trim();
  }

  public boolean enabled() {
    return !apiKey.isBlank() && !model.isBlank();
  }

  public String chat(String system, String user) throws Exception {
    HttpRequest req = buildRequest(system, user);
    HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
    if (res.statusCode() < 200 || res.statusCode() >= 300) {
      throw new RuntimeException("LLM HTTP " + res.statusCode());
    }
    JsonNode root = om.readTree(new String(res.body(), StandardCharsets.UTF_8));
    // Gemini: candidates[0].content.parts[0].text
    JsonNode text = root.at("/candidates/0/content/parts/0/text");
    if (text.isMissingNode() || text.isNull()) {
      return root.toString();
    }
    return text.asText("");
  }

  private HttpRequest buildRequest(String system, String user) throws Exception {
    String m = model.startsWith("models/") ? model : "models/" + model;
    String url =
        "https://generativelanguage.googleapis.com/v1beta/"
            + m
            + ":generateContent?key="
            + apiKey;

    // request shape:
    // { contents:[{role:"user", parts:[{text:"..."}]}], systemInstruction:{parts:[{text:"..."}]}, generationConfig:{...}}
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put(
        "contents",
        List.of(
            Map.of(
                "role",
                "user",
                "parts",
                List.of(Map.of("text", (user == null ? "" : user))))));
    if (system != null && !system.isBlank()) {
      payload.put("systemInstruction", Map.of("parts", List.of(Map.of("text", system))));
    }
    payload.put(
        "generationConfig",
        Map.of(
            "temperature",
            0.2,
            "maxOutputTokens",
            800));

    String body = om.writeValueAsString(payload);
    return HttpRequest.newBuilder()
        .uri(URI.create(url))
        .timeout(Duration.ofSeconds(25))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
        .build();
  }
}

