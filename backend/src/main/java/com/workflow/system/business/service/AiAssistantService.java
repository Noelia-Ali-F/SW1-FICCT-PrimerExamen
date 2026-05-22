package com.workflow.system.business.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workflow.system.data.model.NotificationType;
import com.workflow.system.data.repository.UserRepository;
import com.workflow.system.presentation.dto.ai.AiAssistantChatRequest;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class AiAssistantService {
  private static final String MANUAL_PATH = "user-manual-es.md";
  private static final Pattern TOKEN_SPLIT = Pattern.compile("[^\\p{L}\\p{N}]+");

  private volatile List<Section> cachedSections;

  private final OpenAiChatClient openAiClient;
  private final GeminiChatClient geminiClient;
  private final NotificationService notificationService;
  private final UserRepository userRepository;
  private final ActivityTaskService activityTaskService;
  private final ObjectMapper jsonMapper;
  private final boolean llmEnabled;
  private final String provider;

  public AiAssistantService(
      OpenAiChatClient openAiClient,
      GeminiChatClient geminiClient,
      NotificationService notificationService,
      UserRepository userRepository,
      ActivityTaskService activityTaskService,
      ObjectMapper jsonMapper,
      @Value("${app.ai.assistant.enabled:true}") boolean llmEnabled,
      @Value("${app.ai.provider:}") String provider) {
    this.openAiClient = openAiClient;
    this.geminiClient = geminiClient;
    this.notificationService = notificationService;
    this.userRepository = userRepository;
    this.activityTaskService = activityTaskService;
    this.jsonMapper = jsonMapper;
    this.llmEnabled = llmEnabled;
    this.provider = provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT);
  }

  /** Chat principal: intenta ejecutar acciones (API) y responde con texto + fuentes. */
  public Answer chat(AiAssistantChatRequest req) {
    String q = safe(req.getMessage());
    String actorId = req.getActorUserId() == null ? "" : req.getActorUserId().trim();
    boolean exec = req.getExecuteActions() == null || Boolean.TRUE.equals(req.getExecuteActions());

    List<String> combinedActions = new ArrayList<>();

    if (exec) {
      Optional<Answer> orch = tryOrchestrate(q, actorId);
      if (orch.isPresent()) {
        Answer a = orch.get();
        combinedActions.addAll(a.actionsExecuted());
        return Answer.of(a.answer(), a.sources(), combinedActions);
      }
      Answer heuristic = tryHeuristicActions(q, actorId);
      if (!heuristic.actionsExecuted().isEmpty()) {
        combinedActions.addAll(heuristic.actionsExecuted());
        return Answer.of(heuristic.answer(), heuristic.sources(), combinedActions);
      }
    }

    Answer manual = answerFromManualLegacy(q);
    return Answer.of(manual.answer(), manual.sources(), manual.actionsExecuted());
  }

  /** Fallback cuando no hay JSON del modelo: detecta pedidos empíricos «notifícame», «aviso», etc. */
  private Answer tryHeuristicActions(String question, String actorId) {
    List<String> actions = new ArrayList<>();
    String m = safe(question).toLowerCase(Locale.ROOT);
    if (actorId.isBlank()) {
      return Answer.of("", List.of(), actions);
    }
    boolean wantsNotify =
        m.contains("notific")
            || m.contains("recordatorio")
            || m.contains("avisame")
            || m.contains("avísame")
            || m.contains("aviso ")
            || m.contains("alerta");
    if (!wantsNotify) {
      return Answer.of("", List.of(), actions);
    }
    String title = "Asistente IA";
    String body = safe(question).trim();
    if (body.length() > 400) {
      body = body.substring(0, 397) + "...";
    }
    notifyUserIfExists(actorId, title, body, actions);
    String reply =
        "Listo: guardé una notificación en tu campana (icono de campana). El texto resume lo que pediste.";
    return Answer.of(reply, List.of("Acción automática (sin JSON del modelo)"), actions);
  }

  private Optional<Answer> tryOrchestrate(String question, String actorId) {
    if (!llmEnabled || question.isBlank()) {
      return Optional.empty();
    }
    try {
      String manualSnippet = truncate(readFullManual(), 6000);
      String ctx = buildActorContext(actorId);
      String system =
          """
Eres el operador del "Workflow System". Responde SIEMPRE en español.

Salida OBLIGATORIA: un único objeto JSON UTF-8 (sin markdown, sin texto antes ni después), con esta forma exacta:
{"respuesta":"texto natural para el usuario","acciones":[]}

Campo "acciones": lista de objetos. Tipos permitidos:
1) {"tipo":"notificar","usuarioDestinoId":"<id mongo>","titulo":"<max 100>","mensaje":"<max 1500>"}
2) {"tipo":"notificar_email","email":"<correo>","titulo":"...","mensaje":"..."}

Reglas:
- Si el usuario dice «notifícame», «avisame», «recordatorio» sin otro destinatario, usa su id de actor (si viene en contexto).
- Solo usa usuarioDestinoId que exista en el sistema; para correos usa notificar_email.
- Si no hay acción concreta, deja "acciones":[].
- La "respuesta" debe resumir lo hecho y guiar con el manual si aplica.

CONTEXTO ACTOR Y API:
"""
              + ctx
              + "\n\nMANUAL (extracto):\n"
              + manualSnippet;

      String raw = completeLlmChat(system, question);
      if (raw == null || raw.isBlank()) {
        return Optional.empty();
      }
      String jsonBlob = extractJsonObject(raw);
      if (jsonBlob == null) {
        return Optional.empty();
      }
      JsonNode root = jsonMapper.readTree(jsonBlob);
      String respuesta = root.path("respuesta").asText("").trim();
      List<String> actionsOut = new ArrayList<>();
      JsonNode arr = root.path("acciones");
      if (arr.isArray()) {
        for (JsonNode a : arr) {
          executeActionNode(a, actorId, actionsOut);
        }
      }
      if (respuesta.isEmpty() && actionsOut.isEmpty()) {
        return Optional.empty();
      }
      if (respuesta.isEmpty()) {
        respuesta = "Listo: ejecuté las acciones solicitadas en la API (notificaciones u otras).";
      }
      List<String> sources = new ArrayList<>();
      sources.add("IA + acciones API");
      if (!actionsOut.isEmpty()) {
        sources.add("Notificaciones / API");
      }
      return Optional.of(Answer.of(respuesta, sources, actionsOut));
    } catch (Exception ignored) {
      return Optional.empty();
    }
  }

  private void executeActionNode(JsonNode a, String actorId, List<String> actionsOut) {
    if (a == null || !a.isObject()) return;
    String tipo = a.path("tipo").asText("").trim().toLowerCase(Locale.ROOT);
    switch (tipo) {
      case "notificar" -> {
        String uid = a.path("usuarioDestinoId").asText("").trim();
        if (uid.isBlank()) {
          uid = actorId;
        }
        String titulo = a.path("titulo").asText("Asistente IA").trim();
        String mensaje = a.path("mensaje").asText("").trim();
        if (mensaje.isBlank()) {
          mensaje = "(sin detalle)";
        }
        notifyUserIfExists(uid, titulo, mensaje, actionsOut);
      }
      case "notificar_email" -> {
        String email = a.path("email").asText("").trim();
        String titulo = a.path("titulo").asText("Asistente IA").trim();
        String mensaje = a.path("mensaje").asText("").trim();
        if (email.isBlank()) {
          actionsOut.add("notificar_email omitido: falta email.");
          return;
        }
        Optional<com.workflow.system.data.model.User> u = userRepository.findByEmailIgnoreCase(email);
        if (u.isEmpty()) {
          actionsOut.add("notificar_email: no hay usuario con correo " + email);
          return;
        }
        notifyUserIfExists(u.get().getId(), titulo, mensaje.isBlank() ? "(sin detalle)" : mensaje, actionsOut);
      }
      default -> {
        // ignorar tipos desconocidos
      }
    }
  }

  private void notifyUserIfExists(String userId, String title, String message, List<String> actionsOut) {
    if (userId == null || userId.isBlank()) {
      actionsOut.add("Notificación omitida: sin usuario destino.");
      return;
    }
    if (userRepository.findById(userId).isEmpty()) {
      actionsOut.add("Notificación omitida: usuario " + userId + " no existe.");
      return;
    }
    notificationService.createNotification(
        userId,
        truncate(title, 120),
        truncate(message, 2000),
        NotificationType.SYSTEM_INFO,
        "AI_ASSISTANT",
        null);
    actionsOut.add("Notificación creada para usuario " + userId);
  }

  private static String truncate(String s, int max) {
    if (s == null) return "";
    return s.length() <= max ? s : s.substring(0, max - 3) + "...";
  }

  private String buildActorContext(String actorId) {
    StringBuilder sb = new StringBuilder();
    if (actorId != null && !actorId.isBlank()) {
      userRepository
          .findById(actorId)
          .ifPresent(
              u ->
                  sb.append("Actor id=")
                      .append(u.getId())
                      .append(" nombre=")
                      .append(safe(u.getFullName()))
                      .append(" email=")
                      .append(safe(u.getEmail()))
                      .append("\n"));
      try {
        int n = activityTaskService.listMyTasks(actorId).size();
        sb.append("Tareas visibles para este actor (filtro Mis actividades / tolerante): ").append(n).append("\n");
      } catch (Exception e) {
        sb.append("(No se pudo contar tareas del actor.)\n");
      }
    } else {
      sb.append("Sin actorUserId: las acciones «notifícame» no tienen destinatario salvo que el JSON ponga id/email.\n");
    }
    return sb.toString();
  }

  private static String extractJsonObject(String raw) {
    String t = raw.trim();
    if (t.contains("```")) {
      int start = t.indexOf('{');
      int end = t.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return t.substring(start, end + 1);
      }
    }
    int start = t.indexOf('{');
    int end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return t.substring(start, end + 1);
    }
    return null;
  }

  private Answer answerFromManualLegacy(String question) {
    String q = safe(question);
    if (q.isBlank()) return Answer.of("Escribe tu pregunta y te ayudo.", List.of());

    if (llmEnabled) {
      try {
        String manual = readFullManual();
        String system =
            """
Eres el asistente de soporte del "Workflow System".
Responde SIEMPRE en español, con instrucciones paso a paso y bullets cortos.
Usa el manual incluido como fuente principal. Si no está en el manual, dilo y propone pasos para investigar dentro de la app.
No inventes pantallas o botones que no existan.

MANUAL:
"""
                + manual;
        String answer = completeLlmChat(system, q);
        if (answer != null && !answer.isBlank()) {
          return Answer.of(answer, List.of("LLM + Manual"));
        }
      } catch (Exception ignored) {
        // fallback manual
      }
    }

    List<Section> sections = loadSections();
    List<String> qTokens = tokens(q);

    var scored =
        sections.stream()
            .map(s -> new ScoredSection(s, score(qTokens, s.tokens)))
            .filter(x -> x.score > 0)
            .sorted(Comparator.comparingInt((ScoredSection x) -> x.score).reversed())
            .toList();

    if (scored.isEmpty()) {
      return Answer.of(
          """
No encontré esa respuesta en el manual aún.

Dime qué pantalla estás usando y qué quieres lograr (paso a paso) y te guío.
""",
          List.of("Manual: sin coincidencias"));
    }

    int topN = Math.min(3, scored.size());
    List<String> sources = new ArrayList<>();
    StringBuilder sb = new StringBuilder();
    sb.append("Según el manual:\n\n");
    for (int i = 0; i < topN; i++) {
      Section s = scored.get(i).section;
      sources.add(s.title);
      sb.append("### ").append(s.title).append("\n");
      sb.append(s.body.trim()).append("\n\n");
    }
    sb.append("Si me dices tu caso exacto (qué intentas hacer), lo aterrizo a tu escenario.");

    return Answer.of(sb.toString().trim(), sources);
  }

  private List<Section> loadSections() {
    List<Section> existing = cachedSections;
    if (existing != null) return existing;
    synchronized (this) {
      if (cachedSections != null) return cachedSections;
      cachedSections = parseManual();
      return cachedSections;
    }
  }

  private List<Section> parseManual() {
    try {
      ClassPathResource res = new ClassPathResource(MANUAL_PATH);
      if (!res.exists()) {
        return List.of(new Section("Manual no encontrado", "No existe el archivo del manual.", List.of()));
      }
      try (BufferedReader br =
          new BufferedReader(new InputStreamReader(res.getInputStream(), StandardCharsets.UTF_8))) {
        List<Section> out = new ArrayList<>();
        String currentTitle = "Inicio";
        StringBuilder body = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
          String t = line.trim();
          if (t.startsWith("## ")) {
            out.add(section(currentTitle, body.toString()));
            currentTitle = t.substring(3).trim();
            body.setLength(0);
            continue;
          }
          if (t.startsWith("# ")) {
            continue;
          }
          body.append(line).append('\n');
        }
        out.add(section(currentTitle, body.toString()));
        return out.stream().filter(s -> !s.body.isBlank()).toList();
      }
    } catch (Exception e) {
      return List.of(new Section("Error leyendo manual", safe(e.getMessage()), List.of()));
    }
  }

  private String readFullManual() {
    try {
      ClassPathResource res = new ClassPathResource(MANUAL_PATH);
      if (!res.exists()) return "";
      try (BufferedReader br =
          new BufferedReader(new InputStreamReader(res.getInputStream(), StandardCharsets.UTF_8))) {
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line).append('\n');
        return sb.toString();
      }
    } catch (Exception e) {
      return "";
    }
  }

  private Section section(String title, String body) {
    String b = safe(body).trim();
    List<String> tks = tokens(title + " " + b);
    return new Section(title.isBlank() ? "Sección" : title, b, tks);
  }

  private static int score(List<String> qTokens, List<String> sectionTokens) {
    if (qTokens.isEmpty() || sectionTokens.isEmpty()) return 0;
    int s = 0;
    for (String qt : qTokens) {
      for (String st : sectionTokens) {
        if (Objects.equals(qt, st)) {
          s += 3;
          break;
        }
        if (qt.length() >= 5 && st.contains(qt)) {
          s += 1;
          break;
        }
      }
    }
    return s;
  }

  private static List<String> tokens(String text) {
    String x = safe(text).toLowerCase(Locale.ROOT);
    String[] parts = TOKEN_SPLIT.split(x);
    List<String> out = new ArrayList<>();
    for (String p : parts) {
      String t = p.trim();
      if (t.length() < 3) continue;
      out.add(t);
    }
    return out;
  }

  private static String safe(String s) {
    return s == null ? "" : s;
  }

  /** Una sola llamada al proveedor LLM (nombre distinto de {@link #chat(AiAssistantChatRequest)} para evitar confusiones del IDE). */
  private String completeLlmChat(String system, String user) throws Exception {
    if (provider.equals("gemini")) {
      if (geminiClient != null && geminiClient.enabled()) return geminiClient.chat(system, user);
      return "";
    }
    if (openAiClient != null && openAiClient.enabled()) return openAiClient.chat(system, user);
    return "";
  }

  public record Answer(String answer, List<String> sources, List<String> actionsExecuted) {
    public static Answer of(String answer, List<String> sources) {
      return new Answer(answer, sources == null ? List.of() : sources, List.of());
    }

    public static Answer of(String answer, List<String> sources, List<String> actionsExecuted) {
      return new Answer(
          answer,
          sources == null ? List.of() : sources,
          actionsExecuted == null ? List.of() : actionsExecuted);
    }
  }

  private record Section(String title, String body, List<String> tokens) {}

  private record ScoredSection(Section section, int score) {}
}
