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
 * Cliente mínimo para Chat Completions compatible con OpenAI/Azure OpenAI.
 *
 * <p>Se activa solo si existe API key/endpoint configurado. Si falla, el caller debe hacer fallback.
 */
@Service
public class OpenAiChatClient {
  private final ObjectMapper om = new ObjectMapper();
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private final String provider; // openai | azure
  private final String apiKey;
  private final String baseUrl;
  private final String model;
  private final String azureDeployment;
  private final String azureApiVersion;

  public OpenAiChatClient(
      @Value("${app.ai.provider:}") String provider,
      @Value("${app.ai.openai.apiKey:}") String apiKey,
      @Value("${app.ai.openai.baseUrl:https://api.openai.com/v1}") String baseUrl,
      @Value("${app.ai.openai.model:gpt-4o-mini}") String model,
      @Value("${app.ai.azure.endpoint:}") String azureEndpoint,
      @Value("${app.ai.azure.deployment:}") String azureDeployment,
      @Value("${app.ai.azure.apiVersion:2024-10-01-preview}") String azureApiVersion) {
    this.provider = (provider == null ? "" : provider.trim()).toLowerCase();
    this.apiKey = apiKey == null ? "" : apiKey.trim();
    String computedBaseUrl = baseUrl == null ? "" : baseUrl.trim();
    this.model = model == null ? "" : model.trim();
    this.azureDeployment = azureDeployment == null ? "" : azureDeployment.trim();
    this.azureApiVersion = azureApiVersion == null ? "" : azureApiVersion.trim();

    // Para Azure, baseUrl se deriva del endpoint si se setea.
    if (!azureEndpoint.isBlank()) {
      computedBaseUrl = azureEndpoint.trim();
    }
    this.baseUrl = computedBaseUrl;
  }

  public boolean enabled() {
    if (apiKey.isBlank()) return false;
    if (provider.equals("azure")) {
      return !baseUrl.isBlank() && !azureDeployment.isBlank() && !azureApiVersion.isBlank();
    }
    if (provider.equals("openai")) {
      return !baseUrl.isBlank() && !model.isBlank();
    }
    // auto: si baseUrl parece azure u openai
    if (baseUrl.contains("openai.azure.com")) {
      return !azureDeployment.isBlank() && !azureApiVersion.isBlank();
    }
    return !baseUrl.isBlank() && !model.isBlank();
  }

  public String chat(String system, String user) throws Exception {
    HttpRequest req = buildRequest(system, user);
    HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
    if (res.statusCode() < 200 || res.statusCode() >= 300) {
      throw new RuntimeException("LLM HTTP " + res.statusCode());
    }
    JsonNode root = om.readTree(new String(res.body(), StandardCharsets.UTF_8));
    // OpenAI: choices[0].message.content
    JsonNode content = root.at("/choices/0/message/content");
    if (content.isMissingNode() || content.isNull()) {
      // Azure/otros: mismo shape; si cambia, devolvemos root como fallback.
      return root.toString();
    }
    return content.asText("");
  }

  private HttpRequest buildRequest(String system, String user) throws Exception {
    boolean azure = provider.equals("azure") || baseUrl.contains("openai.azure.com");
    String url;
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put(
        "messages",
        List.of(
            Map.of("role", "system", "content", system == null ? "" : system),
            Map.of("role", "user", "content", user == null ? "" : user)));
    payload.put("temperature", 0.2);

    if (azure) {
      url =
          baseUrl.replaceAll("/$", "")
              + "/openai/deployments/"
              + azureDeployment
              + "/chat/completions?api-version="
              + azureApiVersion;
      // Azure ignora "model" y usa deployment.
    } else {
      url = baseUrl.replaceAll("/$", "") + "/chat/completions";
      payload.put("model", model);
    }

    String body = om.writeValueAsString(payload);
    HttpRequest.Builder b =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(25))
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .header("Content-Type", "application/json");

    if (azure) {
      b.header("api-key", apiKey);
    } else {
      b.header("Authorization", "Bearer " + apiKey);
    }
    return b.build();
  }
}

