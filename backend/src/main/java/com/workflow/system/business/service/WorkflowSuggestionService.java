package com.workflow.system.business.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.data.model.EdgeType;
import com.workflow.system.data.model.NodeType;
import com.workflow.system.data.model.PolicyStatus;
import com.workflow.system.data.model.ResponsibleType;
import com.workflow.system.data.repository.BusinessPolicyRepository;
import com.workflow.system.data.repository.UserRepository;
import com.workflow.system.presentation.dto.ai.GenerateWorkflowSuggestionRequest;
import com.workflow.system.presentation.dto.ai.WorkflowSuggestionResponse;
import com.workflow.system.presentation.dto.diagram.SaveActivityDiagramRequest;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WorkflowSuggestionService {
  private final BusinessPolicyRepository businessPolicyRepository;
  private final UserRepository userRepository;
  private final GeminiChatClient gemini;
  private final OpenAiChatClient openAi;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Value("${app.ai.assistant.enabled:true}")
  private boolean assistantEnabled;

  @Value("${app.ai.provider:}")
  private String aiProvider;

  public WorkflowSuggestionResponse generateFromText(GenerateWorkflowSuggestionRequest request) {
    String policyId = safeTrim(request.getPolicyId());
    String promptText = safeTrim(request.getPromptText());
    String createdBy = safeTrim(request.getCreatedBy());

    if (promptText.isBlank()) {
      throw new BusinessRuleException("promptText no puede estar vacío");
    }

    if (!userRepository.existsById(createdBy)) {
      throw new ResourceNotFoundException("createdBy no existe como usuario");
    }

    BusinessPolicy policy = null;
    if (!isNewPolicyRequest(policyId)) {
      policy =
          businessPolicyRepository
              .findById(policyId)
              .orElseThrow(() -> new ResourceNotFoundException("Política no encontrada"));

      if (policy.getStatus() != PolicyStatus.DRAFT) {
        throw new BusinessRuleException("La política debe estar en DRAFT para generar sugerencias");
      }
    }

    List<String> warnings = new ArrayList<>();

    if (assistantEnabled && llmDiagramAvailable()) {
      try {
        SaveActivityDiagramRequest llmPayload = generateDiagramFromLlm(promptText, createdBy);
        if (llmPayload != null
            && llmPayload.getNodes() != null
            && !llmPayload.getNodes().isEmpty()) {
          List<String> activitiesDetected = extractActivityLabels(llmPayload);
          List<String> detectedDecisionsLlm = new ArrayList<>();
          boolean hasDecision =
              llmPayload.getNodes().stream()
                  .anyMatch(n -> n.getType() == NodeType.DECISION);
          if (hasDecision) {
            detectedDecisionsLlm.add("DECISION en diagrama IA");
          }
          String suggestedName;
          if (policy != null && policy.getName() != null && !policy.getName().isBlank()) {
            suggestedName = "Propuesta para: " + policy.getName().trim();
          } else {
            suggestedName = "Política sugerida: " + suggestPolicyNameFromPrompt(promptText);
          }
          return WorkflowSuggestionResponse.builder()
              .suggestedPolicyName(suggestedName)
              .summary("Diagrama generado por modelo de lenguaje según tu descripción.")
              .activityDiagramPayload(llmPayload)
              .detectedActivities(
                  activitiesDetected.isEmpty()
                      ? List.of("(nodos ACTIVITY en el diagrama)")
                      : activitiesDetected)
              .detectedRoles(List.of())
              .detectedDecisions(detectedDecisionsLlm)
              .warnings(
                  List.of(
                      "Respuesta generada con IA (Gemini u OpenAI, según claves configuradas). Revisá el lienzo."))
              .build();
        }
      } catch (Exception e) {
        warnings.add(
            "No se pudo obtener un diagrama válido desde la IA; se usará la plantilla local de respaldo.");
      }
    }

    boolean decisionDetected = detectDecision(promptText);
    List<String> activities = detectActivities(promptText);

    if (activities.size() < 2) {
      String compact = toActivityName(safeTrim(promptText));
      if (compact.length() >= 4 && compact.length() <= 80) {
        activities =
            List.of(
                compact,
                "Revisar " + compact,
                "Finalizar trámite");
        warnings.add(
            "Texto corto: se tomó «"
                + compact
                + "» como primera actividad y se completó un flujo mínimo de tres pasos.");
      } else {
        warnings.add("No se detectaron actividades suficientes; se usarán actividades genéricas.");
        activities =
            List.of("Registrar solicitud", "Revisar solicitud", "Finalizar trámite"); // 3 para robustez
      }
    }

    List<String> detectedDecisions = new ArrayList<>();
    SaveActivityDiagramRequest payload;
    if (decisionDetected) {
      detectedDecisions.add("DECISION: aprobada/rechazada");
      payload = buildDecisionDiagram(createdBy, activities);
    } else {
      payload = buildSequentialDiagram(createdBy, activities);
    }

    String suggestedName;
    if (policy != null && policy.getName() != null && !policy.getName().isBlank()) {
      suggestedName = "Propuesta para: " + policy.getName().trim();
    } else {
      suggestedName = "Política sugerida: " + suggestPolicyNameFromPrompt(promptText);
    }

    String summary =
        decisionDetected
            ? "Diagrama sugerido con decisión (aprobada/rechazada) y flujo inicial de actividades."
            : "Diagrama sugerido secuencial con flujo inicial de actividades.";

    return WorkflowSuggestionResponse.builder()
        .suggestedPolicyName(suggestedName)
        .summary(summary)
        .activityDiagramPayload(payload)
        .detectedActivities(activities)
        .detectedRoles(List.of())
        .detectedDecisions(detectedDecisions)
        .warnings(warnings)
        .build();
  }

  private boolean llmDiagramAvailable() {
    String p = safeTrim(aiProvider).toLowerCase(Locale.ROOT);
    if (p.equals("gemini")) {
      return gemini != null && gemini.enabled();
    }
    if (p.equals("openai") || p.equals("azure")) {
      return openAi != null && openAi.enabled();
    }
    return (gemini != null && gemini.enabled()) || (openAi != null && openAi.enabled());
  }

  private String invokeWorkflowLlm(String system, String userMessage) throws Exception {
    String p = safeTrim(aiProvider).toLowerCase(Locale.ROOT);
    if (p.equals("gemini")) {
      return gemini.chat(system, userMessage);
    }
    if (p.equals("openai") || p.equals("azure")) {
      return openAi.chat(system, userMessage);
    }
    if (gemini != null && gemini.enabled()) {
      return gemini.chat(system, userMessage);
    }
    if (openAi != null && openAi.enabled()) {
      return openAi.chat(system, userMessage);
    }
    throw new IllegalStateException("Sin proveedor de IA configurado");
  }

  private SaveActivityDiagramRequest generateDiagramFromLlm(String promptText, String createdBy)
      throws Exception {
    String system =
        """
Eres un analista de procesos (BPMN ligero). Devuelve ÚNICAMENTE JSON válido con esta forma:

SaveActivityDiagramRequest:
- createdBy: string (usa exactamente: "%s")
- version: opcional
- swimlanes: array con al menos un elemento {{ id, name, responsibleType (ROLE|DEPARTMENT|USER), responsibleId, positionX?, positionY?, width?, height? }}. Para usuario actual usa responsibleType USER y responsibleId = "%s".
- nodes: array {{ id, type (START|END|ACTIVITY|DECISION|FORK|JOIN), name?, swimlaneId, positionX?, positionY? }}. Debe haber START, actividades con nombres alineados al texto del usuario, END; agrega DECISION solo si el texto pide aprobación/rechazo o bifurcación.
- edges: array {{ id, sourceNodeId, targetNodeId, label?, condition?, type (NORMAL|ALTERNATIVE|PARALLEL) }}

Reglas: ids cortos y únicos; aristas solo entre ids existentes; flujo coherente de izquierda a derecha; sin texto fuera del JSON.

Descripción del proceso de negocio:
"""
            .formatted(createdBy, createdBy)
            + "\n"
            + promptText;

    String answer = invokeWorkflowLlm(system, "Devuelve solo el JSON del diagrama.");
    String json = stripJsonFenceForDiagram(answer);
    SaveActivityDiagramRequest req = objectMapper.readValue(json, SaveActivityDiagramRequest.class);
    if (req.getCreatedBy() == null || req.getCreatedBy().isBlank()) {
      req.setCreatedBy(createdBy);
    }
    ensureMinimalLanes(req, createdBy);
    return req;
  }

  private static void ensureMinimalLanes(SaveActivityDiagramRequest req, String createdBy) {
    if (req.getSwimlanes() != null && !req.getSwimlanes().isEmpty()) {
      return;
    }
    SaveActivityDiagramRequest.SwimlaneDto sl = new SaveActivityDiagramRequest.SwimlaneDto();
    sl.setId("sl-main");
    sl.setName("Carril principal");
    sl.setResponsibleType(ResponsibleType.USER);
    sl.setResponsibleId(createdBy);
    req.setSwimlanes(List.of(sl));
    String laneId = sl.getId();
    if (req.getNodes() != null) {
      for (SaveActivityDiagramRequest.NodeDto n : req.getNodes()) {
        if (n.getSwimlaneId() == null || n.getSwimlaneId().isBlank()) {
          n.setSwimlaneId(laneId);
        }
      }
    }
  }

  private static List<String> extractActivityLabels(SaveActivityDiagramRequest req) {
    if (req.getNodes() == null) {
      return List.of();
    }
    return req.getNodes().stream()
        .filter(n -> n.getType() == NodeType.ACTIVITY)
        .map(SaveActivityDiagramRequest.NodeDto::getName)
        .filter(n -> n != null && !n.isBlank())
        .distinct()
        .toList();
  }

  private static String stripJsonFenceForDiagram(String raw) {
    String t = raw == null ? "" : raw.trim();
    if (t.startsWith("```")) {
      int nl = t.indexOf('\n');
      if (nl > 0) {
        t = t.substring(nl + 1);
      }
      int fence = t.lastIndexOf("```");
      if (fence > 0) {
        t = t.substring(0, fence);
      }
    }
    int a = t.indexOf('{');
    int b = t.lastIndexOf('}');
    if (a >= 0 && b > a) {
      return t.substring(a, b + 1).trim();
    }
    return t.trim();
  }

  public boolean detectDecision(String promptText) {
    String n = normalize(promptText);
    return containsAny(
        n,
        List.of(
            " si ",
            "si:",
            "si,",
            "aprueba",
            "rechaza",
            "aprobado",
            "aprobada",
            "rechazado",
            "rechazada",
            "en caso",
            "de lo contrario",
            "sino",
            "si no"));
  }

  public List<String> detectActivities(String promptText) {
    String raw = promptText == null ? "" : promptText;
    String cleaned =
        raw.replace("\r\n", "\n")
            .replace("\t", " ")
            .replace("•", "\n")
            .replace("-", "\n");

    String[] parts = SPLIT_SENTENCES.split(cleaned);

    Set<String> activities = new LinkedHashSet<>();
    for (String p : parts) {
      String s = normalizeSpaces(stripLeadingBullets(p));
      if (s.isBlank()) continue;
      if (s.length() < 6) continue;

      // Evitar frases típicas de decisión como actividades principales (MVP).
      String sn = normalize(s);
      if (containsAny(sn, List.of("aprobada", "rechazada", "si ", "si:", "si,", "de lo contrario", "en caso"))) {
        continue;
      }

      String name = toActivityName(s);
      if (!name.isBlank()) activities.add(name);
      if (activities.size() >= 8) break; // MVP: límite razonable
    }

    return new ArrayList<>(activities);
  }

  public SaveActivityDiagramRequest buildSequentialDiagram(String createdBy, List<String> activities) {
    SaveActivityDiagramRequest req = new SaveActivityDiagramRequest();
    req.setCreatedBy(createdBy);

    // Swimlane principal: asignamos al creador (existe) para que sea válido.
    SaveActivityDiagramRequest.SwimlaneDto sl = new SaveActivityDiagramRequest.SwimlaneDto();
    sl.setId("sl-main");
    sl.setName("Carril principal");
    sl.setResponsibleType(ResponsibleType.USER);
    sl.setResponsibleId(createdBy);
    req.setSwimlanes(List.of(sl));

    List<SaveActivityDiagramRequest.NodeDto> nodes = new ArrayList<>();
    nodes.add(node("node-start", NodeType.START, "Inicio", null, 60d, 120d));

    double x = 220;
    int count = Math.max(2, Math.min(activities.size(), 6));
    List<String> picked = activities.subList(0, Math.min(activities.size(), count));
    for (int i = 0; i < picked.size(); i++) {
      String id = "act-" + (i + 1);
      nodes.add(node(id, NodeType.ACTIVITY, picked.get(i), "sl-main", x, 120d));
      x += 220;
    }

    nodes.add(node("node-end", NodeType.END, "Fin", null, x, 120d));
    req.setNodes(nodes);

    List<SaveActivityDiagramRequest.EdgeDto> edges = new ArrayList<>();
    String prev = "node-start";
    int edgeNum = 1;
    for (int i = 0; i < picked.size(); i++) {
      String cur = "act-" + (i + 1);
      edges.add(edge("e-" + (edgeNum++), prev, cur, "Continuar", "", EdgeType.NORMAL));
      prev = cur;
    }
    edges.add(edge("e-" + (edgeNum), prev, "node-end", "Finalizar", "", EdgeType.NORMAL));
    req.setEdges(edges);
    return req;
  }

  public SaveActivityDiagramRequest buildDecisionDiagram(String createdBy, List<String> activities) {
    SaveActivityDiagramRequest req = new SaveActivityDiagramRequest();
    req.setCreatedBy(createdBy);

    SaveActivityDiagramRequest.SwimlaneDto sl = new SaveActivityDiagramRequest.SwimlaneDto();
    sl.setId("sl-main");
    sl.setName("Carril principal");
    sl.setResponsibleType(ResponsibleType.USER);
    sl.setResponsibleId(createdBy);
    req.setSwimlanes(List.of(sl));

    // Base: START -> A1 -> A2 -> DECISION -> (aprobada -> A3 -> END) / (rechazada -> Notificar rechazo -> END)
    List<String> base = new ArrayList<>(activities);
    while (base.size() < 3) base.add("Revisar solicitud");
    String a1 = base.get(0);
    String a2 = base.get(1);
    String a3 = base.get(2);

    List<SaveActivityDiagramRequest.NodeDto> nodes = new ArrayList<>();
    nodes.add(node("node-start", NodeType.START, "Inicio", null, 60d, 140d));
    nodes.add(node("act-1", NodeType.ACTIVITY, a1, "sl-main", 240d, 140d));
    nodes.add(node("act-2", NodeType.ACTIVITY, a2, "sl-main", 460d, 140d));
    nodes.add(node("node-decision", NodeType.DECISION, "¿Aprobada?", null, 680d, 140d));
    nodes.add(node("act-3", NodeType.ACTIVITY, a3, "sl-main", 900d, 70d));
    nodes.add(
        node("act-reject", NodeType.ACTIVITY, "Notificar rechazo", "sl-main", 900d, 230d));
    nodes.add(node("node-end", NodeType.END, "Fin", null, 1120d, 140d));
    req.setNodes(nodes);

    List<SaveActivityDiagramRequest.EdgeDto> edges = new ArrayList<>();
    edges.add(edge("e-1", "node-start", "act-1", "Continuar", "", EdgeType.NORMAL));
    edges.add(edge("e-2", "act-1", "act-2", "Continuar", "", EdgeType.NORMAL));
    edges.add(edge("e-3", "act-2", "node-decision", "Evaluar", "", EdgeType.NORMAL));
    edges.add(edge("e-4", "node-decision", "act-3", "Aprobada", "aprobada", EdgeType.ALTERNATIVE));
    edges.add(
        edge("e-5", "node-decision", "act-reject", "Rechazada", "rechazada", EdgeType.ALTERNATIVE));
    edges.add(edge("e-6", "act-3", "node-end", "Finalizar", "", EdgeType.NORMAL));
    edges.add(edge("e-7", "act-reject", "node-end", "Finalizar", "", EdgeType.NORMAL));
    req.setEdges(edges);
    return req;
  }

  // ---------------- helpers ----------------

  private static final Pattern SPLIT_SENTENCES = Pattern.compile("[\\n\\.;:]+");

  private static boolean isNewPolicyRequest(String policyId) {
    String x = safeTrim(policyId).toUpperCase(Locale.ROOT);
    return x.isBlank() || x.equals("NEW") || x.equals("NUEVO");
  }

  private static String suggestPolicyNameFromPrompt(String promptText) {
    String cleaned = normalizeSpaces(stripLeadingBullets(promptText));
    if (cleaned.isBlank()) return "Proceso";
    // toma primeras palabras/frase corta para nombre usable
    String head = cleaned.split("[\\n\\.;:]+", 2)[0].trim();
    if (head.length() > 48) head = head.substring(0, 48).trim();
    if (head.isBlank()) return "Proceso";
    // capitalizar primera letra
    return head.substring(0, 1).toUpperCase(Locale.ROOT) + head.substring(1);
  }

  private static String safeTrim(String s) {
    return s == null ? "" : s.trim();
  }

  private static String normalizeSpaces(String s) {
    return s == null ? "" : s.trim().replaceAll("\\s{2,}", " ");
  }

  private static String stripLeadingBullets(String s) {
    String x = s == null ? "" : s.trim();
    // quita numeración tipo "1)" "1." "- " "* " etc.
    x = x.replaceFirst("^(?:\\d+\\s*[\\).\\-]|[\\-*]+)\\s*", "");
    return x.trim();
  }

  private static String toActivityName(String phrase) {
    String p = normalizeSpaces(phrase);
    if (p.isBlank()) return "";
    // Limitar longitud y capitalizar primera letra (MVP).
    String cut = p.length() > 60 ? p.substring(0, 60).trim() : p;
    if (cut.isBlank()) return "";
    return cut.substring(0, 1).toUpperCase(Locale.ROOT) + cut.substring(1);
  }

  private static String normalize(String s) {
    String t = s == null ? "" : s.toLowerCase(Locale.ROOT);
    // quitar tildes para match de keywords
    String noAccents = Normalizer.normalize(t, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    return " " + noAccents + " ";
  }

  private static boolean containsAny(String normalizedWithSpaces, List<String> needles) {
    for (String n : needles) {
      String nn = normalize(n).trim();
      if (normalizedWithSpaces.contains(nn)) return true;
    }
    return false;
  }

  private static SaveActivityDiagramRequest.NodeDto node(
      String id, NodeType type, String name, String swimlaneId, Double x, Double y) {
    SaveActivityDiagramRequest.NodeDto n = new SaveActivityDiagramRequest.NodeDto();
    n.setId(id);
    n.setType(type);
    n.setName(name);
    n.setSwimlaneId(swimlaneId);
    n.setPositionX(x);
    n.setPositionY(y);
    return n;
  }

  private static SaveActivityDiagramRequest.EdgeDto edge(
      String id,
      String source,
      String target,
      String label,
      String condition,
      EdgeType type) {
    SaveActivityDiagramRequest.EdgeDto e = new SaveActivityDiagramRequest.EdgeDto();
    e.setId(id);
    e.setSourceNodeId(source);
    e.setTargetNodeId(target);
    e.setLabel(label);
    e.setCondition(condition);
    e.setType(type);
    return e;
  }
}

