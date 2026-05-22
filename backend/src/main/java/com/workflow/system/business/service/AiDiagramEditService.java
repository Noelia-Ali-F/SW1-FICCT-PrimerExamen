package com.workflow.system.business.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.workflow.system.data.model.EdgeType;
import com.workflow.system.data.model.NodeType;
import com.workflow.system.data.model.ResponsibleType;
import com.workflow.system.presentation.dto.ai.ModifyDiagramWithAiRequest;
import com.workflow.system.presentation.dto.ai.ModifyDiagramWithAiResponse;
import com.workflow.system.presentation.dto.diagram.SaveActivityDiagramRequest;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AiDiagramEditService {
  private final OpenAiChatClient openAi;
  private final GeminiChatClient gemini;
  private final ObjectMapper om = new ObjectMapper();

  @Value("${app.ai.assistant.enabled:true}")
  private boolean enabled;

  @Value("${app.ai.provider:}")
  private String provider;

  public ModifyDiagramWithAiResponse apply(ModifyDiagramWithAiRequest req) {
    String instruction = safe(req.getInstruction());
    SaveActivityDiagramRequest current = req.getCurrentDiagram();

    List<String> warnings = new ArrayList<>();

    // 0) Borrado/ajustes por texto sobre el diagrama enviado por el editor, ANTES del LLM. Si hay clave de API,
    // el modelo a veces devuelve JSON que no refleja el borrado; además el paso previo no depende de la red.
    try {
      SaveActivityDiagramRequest pre = deepCopy(current);
      List<String> preWarnings = new ArrayList<>();
      ensureListsMutable(pre);
      coerceDiagramStructure(pre, preWarnings);
      applyDeletionHeuristics(pre, instruction, preWarnings);
      if (deletionHeuristicSucceeded(preWarnings)) {
        fillBlankCreatedBy(pre, current);
        return ModifyDiagramWithAiResponse.builder()
            .summary("Cambios aplicados al diagrama (instrucción determinística, sin depender del modelo).")
            .activityDiagramPayload(pre)
            .warnings(preWarnings)
            .build();
      }
    } catch (Exception ignored) {
      // continúa con LLM o fallback completo
    }

    // 1) Intentar LLM si está disponible.
    if (enabled && canUseLlm()) {
      try {
        SaveActivityDiagramRequest out = applyWithLlm(current, instruction);
        ensureListsMutable(out);
        fillBlankCreatedBy(out, current);
        coerceDiagramStructure(out, warnings);
        applyDeletionHeuristics(out, instruction, warnings);
        return ModifyDiagramWithAiResponse.builder()
            .summary("Cambios aplicados por IA sobre el diagrama actual.")
            .activityDiagramPayload(out)
            .warnings(warnings)
            .build();
      } catch (Exception e) {
        warnings.add("IA no disponible o respuesta inválida; usando fallback determinístico.");
      }
    } else {
      warnings.add("IA no configurada; usando fallback determinístico.");
    }

    // 2) Fallback determinístico (para examen): aplica cambios comunes por texto.
    SaveActivityDiagramRequest out = applyHeuristic(current, instruction, warnings);
    fillBlankCreatedBy(out, current);
    return ModifyDiagramWithAiResponse.builder()
        .summary("Cambios aplicados (fallback) sobre el diagrama actual.")
        .activityDiagramPayload(out)
        .warnings(warnings)
        .build();
  }

  private boolean canUseLlm() {
    String p = safe(provider).trim().toLowerCase(Locale.ROOT);
    if (p.equals("gemini")) {
      return gemini != null && gemini.enabled();
    }
    if (p.equals("openai") || p.equals("azure")) {
      return openAi != null && openAi.enabled();
    }
    // vacío | auto: usar Google si hay GEMINI_API_KEY; si no, OpenAI/Azure si hay clave
    return (gemini != null && gemini.enabled()) || (openAi != null && openAi.enabled());
  }

  /** Llama al proveedor configurado o al primero disponible (Gemini tiene prioridad si hay clave). */
  private String invokeDiagramLlm(String system, String userMessage) throws Exception {
    String p = safe(provider).trim().toLowerCase(Locale.ROOT);
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
    throw new IllegalStateException("No hay proveedor de IA configurado");
  }

  private SaveActivityDiagramRequest applyWithLlm(SaveActivityDiagramRequest current, String instruction)
      throws Exception {
    String jsonCurrent = om.writeValueAsString(current);
    String system =
        """
Eres un asistente que MODIFICA diagramas de actividades (workflow) en español.

Entrada: JSON actual + instrucción del usuario.
Salida: ÚNICAMENTE un JSON válido con el MISMO shape que SaveActivityDiagramRequest:
- createdBy (string)
- version (number|null)
- swimlanes (array de { id, name, responsibleType: ROLE|DEPARTMENT|USER, responsibleId, positionX, positionY, width, height })
- nodes (array de { id, type: START|END|ACTIVITY|DECISION|FORK|JOIN, name, description?, swimlaneId, positionX, positionY, formId?, metadata? })
- edges (array de { id, sourceNodeId, targetNodeId, label?, condition?, type: NORMAL|ALTERNATIVE|PARALLEL })

Operaciones que debes poder hacer según el texto (ejemplos):
- Agregar / quitar calles (swimlanes, franjas, carriles, columnas): nuevos ids swimlane "ai-lane-…", posición a la derecha de las existentes; copia responsibleType/responsibleId de una calle actual si no se especifica.
- Agregar o eliminar nodos: Inicio (START), Fin (END), actividades (ACTIVITY), decisión (DECISION), bifurcación/join paralelos (FORK/JOIN).
- Renombrar nodos o calles; eliminar por nombre o tipo.
- Conectar nodos con aristas; etiquetas y condiciones en ramas alternativas.
- Reorganizar posiciones (positionX/Y) para que el flujo sea legible de izquierda a derecha.

Reglas estrictas:
- NO incluyas texto fuera del JSON.
- Conserva todo lo que el usuario no pida cambiar.
- Nuevos elementos: ids con prefijo "ai-" y sufijo corto (ej. ai-act-abc12, ai-lane-abc12).
- swimlanes: responsibleId no puede ir vacío; si falta contexto, copia el de la primera calle existente.
- Toda arista debe enlazar ids existentes; FORK suele tener salidas type PARALLEL hacia actividades paralelas; JOIN reúne ramas.
- Debe existir al menos un START y un END coherentes con las aristas al terminar.
- Si el usuario pide eliminar, borrar o quitar nodos, calles o aristas, debes reflejarlo en el JSON (no solo añadir).

Instrucción del usuario:
"""
            + instruction
            + """

Diagrama actual (JSON):
"""
            + jsonCurrent;

    String answer = invokeDiagramLlm(system, "Devuelve el JSON actualizado.");

    // La IA a menudo envuelve el JSON en ```json … ``` — normalizamos antes de parsear.
    String json = stripJsonFence(answer);
    return om.readValue(json, SaveActivityDiagramRequest.class);
  }

  private static String stripJsonFence(String raw) {
    String t = safe(raw).trim();
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

  private static void ensureListsMutable(SaveActivityDiagramRequest d) {
    if (d == null) return;
    if (d.getNodes() == null) {
      d.setNodes(new ArrayList<>());
    } else if (!(d.getNodes() instanceof ArrayList)) {
      d.setNodes(new ArrayList<>(d.getNodes()));
    }
    if (d.getEdges() == null) {
      d.setEdges(new ArrayList<>());
    } else if (!(d.getEdges() instanceof ArrayList)) {
      d.setEdges(new ArrayList<>(d.getEdges()));
    }
    if (d.getSwimlanes() == null) {
      d.setSwimlanes(new ArrayList<>());
    } else if (!(d.getSwimlanes() instanceof ArrayList)) {
      d.setSwimlanes(new ArrayList<>(d.getSwimlanes()));
    }
  }

  /** Si no hay diagrama, crea una calle + Inicio → Fin para poder seguir editando. */
  private void bootstrapMinimalDiagram(SaveActivityDiagramRequest d, List<String> warnings) {
    ensureListsMutable(d);
    String cb = safe(d.getCreatedBy());
    if (cb.isBlank()) {
      cb = "demo";
    }
    d.setCreatedBy(cb);
    SaveActivityDiagramRequest.SwimlaneDto sl = new SaveActivityDiagramRequest.SwimlaneDto();
    sl.setId("ai-lane-" + shortId());
    sl.setName("Principal");
    sl.setResponsibleType(ResponsibleType.ROLE);
    sl.setResponsibleId("role-default");
    sl.setPositionX(0d);
    sl.setPositionY(0d);
    sl.setWidth(520d);
    sl.setHeight(480d);
    d.getSwimlanes().clear();
    d.getSwimlanes().add(sl);

    String sid = "ai-start-" + shortId();
    String eid = "ai-end-" + shortId();
    SaveActivityDiagramRequest.NodeDto start = new SaveActivityDiagramRequest.NodeDto();
    start.setId(sid);
    start.setType(NodeType.START);
    start.setName("Inicio");
    start.setSwimlaneId(sl.getId());
    start.setPositionX(80d);
    start.setPositionY(180d);

    SaveActivityDiagramRequest.NodeDto end = new SaveActivityDiagramRequest.NodeDto();
    end.setId(eid);
    end.setType(NodeType.END);
    end.setName("Fin");
    end.setSwimlaneId(sl.getId());
    end.setPositionX(420d);
    end.setPositionY(180d);

    d.getNodes().clear();
    d.getNodes().add(start);
    d.getNodes().add(end);
    d.getEdges().clear();
    d.getEdges().add(edge("ai-e-" + shortId(), sid, eid, "Continuar", "", EdgeType.NORMAL));
    warnings.add("Se creó un diagrama mínimo (calle + Inicio → Fin).");
  }

  private void bootstrapNodesInFirstLane(SaveActivityDiagramRequest d, List<String> warnings) {
    ensureListsMutable(d);
    if (d.getSwimlanes() == null || d.getSwimlanes().isEmpty()) {
      injectDefaultSwimlaneAndAssignNodes(d, warnings);
    }
    String laneId = d.getSwimlanes().get(0).getId();
    String sid = "ai-start-" + shortId();
    String eid = "ai-end-" + shortId();
    SaveActivityDiagramRequest.NodeDto start = new SaveActivityDiagramRequest.NodeDto();
    start.setId(sid);
    start.setType(NodeType.START);
    start.setName("Inicio");
    start.setSwimlaneId(laneId);
    start.setPositionX(80d);
    start.setPositionY(180d);
    SaveActivityDiagramRequest.NodeDto end = new SaveActivityDiagramRequest.NodeDto();
    end.setId(eid);
    end.setType(NodeType.END);
    end.setName("Fin");
    end.setSwimlaneId(laneId);
    end.setPositionX(420d);
    end.setPositionY(180d);
    d.getNodes().clear();
    d.getNodes().add(start);
    d.getNodes().add(end);
    d.getEdges().clear();
    d.getEdges().add(edge("ai-e-" + shortId(), sid, eid, "Continuar", "", EdgeType.NORMAL));
    warnings.add("Se agregaron Inicio y Fin en la primera calle.");
  }

  /**
   * El editor permite diagramas sin swimlanes (ej. ejemplos locales). No borrar nodos: solo añadir calle o
   * diagrama mínimo si todo está vacío.
   */
  private void coerceDiagramStructure(SaveActivityDiagramRequest d, List<String> warnings) {
    ensureListsMutable(d);
    boolean noLanes = d.getSwimlanes() == null || d.getSwimlanes().isEmpty();
    boolean noNodes = d.getNodes() == null || d.getNodes().isEmpty();

    if (noLanes && noNodes) {
      bootstrapMinimalDiagram(d, warnings);
      return;
    }
    if (noLanes) {
      injectDefaultSwimlaneAndAssignNodes(d, warnings);
      return;
    }
    if (noNodes) {
      bootstrapNodesInFirstLane(d, warnings);
    }
  }

  private void injectDefaultSwimlaneAndAssignNodes(SaveActivityDiagramRequest d, List<String> warnings) {
    ensureListsMutable(d);
    SaveActivityDiagramRequest.SwimlaneDto sl = new SaveActivityDiagramRequest.SwimlaneDto();
    sl.setId("ai-lane-" + shortId());
    sl.setName("Principal");
    sl.setResponsibleType(ResponsibleType.ROLE);
    sl.setResponsibleId("role-default");
    sl.setPositionX(0d);
    sl.setPositionY(0d);
    sl.setWidth(920d);
    sl.setHeight(520d);
    d.setSwimlanes(new ArrayList<>(List.of(sl)));
    String laneId = sl.getId();
    for (SaveActivityDiagramRequest.NodeDto node : d.getNodes()) {
      if (node.getSwimlaneId() == null || safe(node.getSwimlaneId()).isBlank()) {
        node.setSwimlaneId(laneId);
      }
    }
    warnings.add("Se agregó una calle por defecto («Principal») para nodos sin franja asignada.");
  }

  private static void fillBlankCreatedBy(SaveActivityDiagramRequest out, SaveActivityDiagramRequest source) {
    if (out == null) {
      return;
    }
    if (safe(out.getCreatedBy()).isBlank() && source != null && !safe(source.getCreatedBy()).isBlank()) {
      out.setCreatedBy(source.getCreatedBy());
    }
  }

  /**
   * Borrado por palabras clave: calle, inicio/fin, y nodos por nombre. Se aplica también tras el LLM para que
   * «eliminar X» funcione aunque el modelo solo agregue.
   */
  private void applyDeletionHeuristics(
      SaveActivityDiagramRequest d, String instruction, List<String> warnings) {
    String n = normalize(instruction);
    ensureListsMutable(d);

    if (isSwimlaneRemoveIntent(n)) {
      removeSwimlaneByInstruction(d, instruction, warnings);
      ensureListsMutable(d);
    }

    applyRemoveSpecialNodes(d, n, warnings);
    ensureListsMutable(d);

    if (!isNodeDeleteIntent(n)) {
      return;
    }
    // Si solo pidió borrar una calle (sin pedido explícito de nodo/actividad), no borrar nodos por nombre suelto.
    if (isSwimlaneRemoveIntent(n) && !mentionsExplicitNodeDelete(n)) {
      return;
    }
    String needle = extractDeleteNeedle(instruction);
    if (needle.isBlank()) {
      warnings.add(
          "Indicá el nombre del nodo o actividad a eliminar (ej. elimina el nodo \"Revisar solicitud\" o: elimina Revisar solicitud).");
      return;
    }
    int removed = removeNodesByNameContains(d, needle);
    if (removed > 0) {
      warnings.add("Se eliminaron " + removed + " nodo(s) que coincidían con: " + needle);
    } else if (safe(needle).length() >= 2) {
      warnings.add(
          "No encontré nodos con ese nombre. Prueba con comillas (ej. elimina \"Validar solicitud\") o el nombre exacto.");
    }
  }

  /** Formas verbales en español (texto ya sin acentos). */
  private static final Pattern NODE_DELETE_INTENT =
      Pattern.compile(
          "(?U)\\b(eliminar|elimina|elimine|eliminen|eliminad|borrar|borra|borre|borren|quitar|quita|quite|quiten|suprimir|suprime|suprima|retirar|retira|retiren|sacar|saca|sacad|descartar|descarta)\\b");

  private static boolean isNodeDeleteIntent(String nNorm) {
    return NODE_DELETE_INTENT.matcher(nNorm).find();
  }

  /**
   * Verbos de borrado (más largos primero para resolver solapes). Incluye imperativo informal ("eliminá") vía matching
   * sin acento en extract… sobre texto normalizado en paralelo — aquí listamos formas ASCII y típicas.
   */
  private static final List<String> DELETE_VERBS_ORDERED = new ArrayList<>();

  static {
    DELETE_VERBS_ORDERED.addAll(
        Arrays.asList(
            "eliminar",
            "suprimir",
            "descartar",
            "retirar",
            "eliminen",
            "elimine",
            "suprime",
            "borrar",
            "quitar",
            "borren",
            "borre",
            "quite",
            "quiten",
            "suprima",
            "retiren",
            "elimina",
            "descarta",
            "borra",
            "quita",
            "retira",
            "sacar",
            "sacad",
            "saca"));
    DELETE_VERBS_ORDERED.sort((a, b) -> Integer.compare(b.length(), a.length()));
  }

  /** True si el usuario nombra nodo/actividad/paso a borrar (no solo "calle"). */
  private static boolean mentionsExplicitNodeDelete(String nNorm) {
    return containsAny(
            nNorm,
            List.of(
                "nodo",
                "actividad",
                "paso",
                "etapa",
                "tarea",
                "rombo",
                "decision"))
        || Pattern.compile("(?U)\\b(el\\s+)?(inicio|fin|final)\\b").matcher(nNorm).find();
  }

  /** Texto a buscar en nombres de nodo: comillas, o cola tras el verbo de borrado (sin confundir elimina ⊂ eliminar). */
  private static String extractDeleteNeedle(String instruction) {
    String t = normalizeAsciiQuotes(instruction);
    List<String> quoted = extractAllQuoted(t);
    if (!quoted.isEmpty()) {
      return quoted.get(0).trim();
    }
    int leftMost = Integer.MAX_VALUE;
    for (String v : DELETE_VERBS_ORDERED) {
      Matcher m =
          Pattern.compile("(?U)\\b" + Pattern.quote(v) + "\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
              .matcher(t);
      while (m.find()) {
        leftMost = Math.min(leftMost, m.start());
      }
    }
    if (leftMost == Integer.MAX_VALUE) {
      String fb = fallbackNeedleAfterNodoKeyword(t);
      return fb.isBlank() ? "" : fb;
    }
    int bestEnd = -1;
    for (String v : DELETE_VERBS_ORDERED) {
      Matcher m =
          Pattern.compile("(?U)\\b" + Pattern.quote(v) + "\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
              .matcher(t);
      while (m.find()) {
        if (m.start() == leftMost && m.end() > bestEnd) {
          bestEnd = m.end();
        }
      }
    }
    if (bestEnd < 0) {
      String fb = fallbackNeedleAfterNodoKeyword(t);
      return fb.isBlank() ? "" : fb;
    }
    String tail = cleanupDeleteTail(t.substring(bestEnd));
    if (!tail.isBlank()) {
      return tail;
    }
    String fb = fallbackNeedleAfterNodoKeyword(t);
    return fb.isBlank() ? "" : fb;
  }

  private static String cleanupDeleteTail(String tail) {
    String x = normalizeAsciiQuotes(safe(tail));
    x = x.replaceFirst("(?i)^(el|la|los|las|del|al|a)\\s+", "").trim();
    x = x.replaceFirst("(?i)^(por\\s+favor)\\s+", "").trim();
    x = x.replaceFirst("(?i)^(el\\s+)?nodo\\s+", "").trim();
    x = x.replaceFirst("(?i)^(la\\s+)?actividad\\s+", "").trim();
    x = x.replaceFirst("(?i)^(el\\s+)?paso\\s+", "").trim();
    x = x.replaceFirst("(?i)^(la\\s+)?etapa\\s+", "").trim();
    x = x.replaceFirst("(?i)^(denominad[oa]|llamad[oa]|llamado|denominado)\\s+", "").trim();
    if (x.endsWith(".") && x.length() > 1) {
      x = x.substring(0, x.length() - 1).trim();
    }
    // Quitar comillas residuales al inicio/fin (p. ej. cola " \"Revisar solicitud\" ")
    x = x.replaceAll("^[\"'\\s]+", "").replaceAll("[\"'\\s]+$", "").trim();
    if (x.length() >= 2 && x.charAt(0) == '"' && x.charAt(x.length() - 1) == '"') {
      x = x.substring(1, x.length() - 1).trim();
    }
    return x.trim();
  }

  /** Cuando no hay verbo reconocido pero sí "nodo …" / comillas sueltas en prompts tipo IA. */
  private static String fallbackNeedleAfterNodoKeyword(String t) {
    Matcher m =
        Pattern.compile("(?i)(?:el\\s+|la\\s+)?(?:nodo|actividad|paso|etapa)\\s+(.+)$").matcher(t.trim());
    if (m.find()) {
      return cleanupDeleteTail(m.group(1));
    }
    m =
        Pattern.compile(
                "(?i)^(?:eliminar|elimina|elimine|eliminen|borrar|borra|borre|quitar|quita|quite)\\s*:?\\s*(.+)$")
            .matcher(t.trim());
    if (m.find()) {
      return cleanupDeleteTail(m.group(1));
    }
    return "";
  }

  private SaveActivityDiagramRequest applyHeuristic(
      SaveActivityDiagramRequest current, String instruction, List<String> warnings) {
    SaveActivityDiagramRequest out = deepCopy(current);
    ensureListsMutable(out);
    String n = normalize(instruction);

    coerceDiagramStructure(out, warnings);
    ensureListsMutable(out);

    applyRenameNode(out, instruction, warnings);

    applyDeletionHeuristics(out, instruction, warnings);
    ensureListsMutable(out);

    if (isSwimlaneAddIntent(n)) {
      addSwimlaneFromInstruction(out, instruction, warnings);
      ensureListsMutable(out);
    }

    if (isAddStartIntent(n)) {
      addStartIfMissing(out, warnings);
      ensureListsMutable(out);
    }
    if (isAddEndIntent(n)) {
      addEndIfMissing(out, warnings);
      ensureListsMutable(out);
    }

    if (isParallelIntent(n)) {
      ensureParallelForkJoin(out, warnings);
      ensureListsMutable(out);
    }

    if (containsAny(n, List.of("aprob", "rechaz", "condicion", "si aprobado", "si es aprobado", "si es aprobada"))) {
      ensureApprovalDecision(out, warnings);
      ensureListsMutable(out);
    }

    boolean addedNamedActivity = false;
    if (containsAny(n, List.of("nodo", "etapa", "paso", "actividad"))
        && containsAny(
            n,
            List.of(
                "crea",
                "crear",
                "creame",
                "agrega",
                "añade",
                "adiciona",
                "inserta",
                "nuevo",
                "nueva"))) {
      String label = extractNodeLabelFromInstruction(instruction);
      if (!label.isBlank()) {
        addActivityBeforeEnd(out, label, warnings);
        addedNamedActivity = true;
      } else {
        warnings.add(
            "Indica el nombre del nodo. Ej.: Creame un nodo \"Revisar pago\" o: agrega actividad Revisar pago");
      }
    }

    if (!addedNamedActivity && containsAny(n, List.of("agrega", "añade", "adiciona", "inserta"))) {
      if (!looksLikeSwimlaneOnlyAdd(n)) {
        String label = extractQuotedOrAfterKeyword(instruction, List.of("agrega", "añade", "adiciona", "inserta"));
        if (!label.isBlank()) {
          addActivityBeforeEnd(out, label, warnings);
        }
      }
    }

    if (containsAny(n, List.of("conecta", "conectar", "une", "unir", "flecha", "transicion", "transición"))) {
      boolean ok = connectNodesByInstruction(out, instruction, warnings);
      if (!ok) {
        warnings.add(
            "No pude crear la transición: usa comillas para los nombres o las palabras inicio/fin. Ej.: conecta \"Solicitud\" con \"Fin\".");
      }
    }

    return out;
  }

  private static boolean looksLikeSwimlaneOnlyAdd(String nNorm) {
    return containsAny(nNorm, List.of("calle", "franja", "carril", "swimlane", "piscina", "columna", "banda"));
  }

  private static boolean isSwimlaneRemoveIntent(String nNorm) {
    return containsAny(
            nNorm,
            List.of(
                "eliminar",
                "elimina",
                "elimine",
                "eliminen",
                "borrar",
                "borra",
                "borre",
                "quitar",
                "quita",
                "quite",
                "suprimir",
                "suprime",
                "suprima",
                "retirar",
                "retira",
                "sacar",
                "saca"))
        && containsAny(nNorm, List.of("calle", "franja", "carril", "swimlane", "piscina", "columna", "banda"));
  }

  private static boolean isSwimlaneAddIntent(String nNorm) {
    if (!containsAny(nNorm, List.of("agrega", "anade", "adiciona", "crea", "inserta", "nueva", "nuevo"))) {
      return false;
    }
    return containsAny(nNorm, List.of("calle", "franja", "carril", "swimlane", "piscina", "columna", "banda"))
        || containsAny(nNorm, List.of("nueva area", "nueva area", "nueva piscina", "otra area", "otra calle"));
  }

  private static boolean isAddStartIntent(String nNorm) {
    return containsAny(
        nNorm,
        List.of(
            "agrega inicio",
            "anade inicio",
            "crea inicio",
            "nodo inicio",
            "pon inicio",
            "poner inicio",
            "anadir inicio",
            "inserta inicio",
            "agregar inicio",
            "anadir el inicio",
            "pon el inicio"));
  }

  private static boolean isAddEndIntent(String nNorm) {
    return containsAny(
        nNorm,
        List.of(
            "agrega fin",
            "anade fin",
            "crea fin",
            "pon fin",
            "nodo fin",
            "nodo final",
            "inserta fin",
            "agregar fin",
            "anadir fin",
            "pon el fin",
            "final del flujo"));
  }

  private static boolean isParallelIntent(String nNorm) {
    return containsAny(nNorm, List.of("paralel", "fork", "join", "bifurc", "en paralelo", "simultane", "ramas paralelas"));
  }

  private void addSwimlaneFromInstruction(SaveActivityDiagramRequest d, String instruction, List<String> warnings) {
    ensureListsMutable(d);
    if (d.getSwimlanes().isEmpty()) {
      injectDefaultSwimlaneAndAssignNodes(d, warnings);
      ensureListsMutable(d);
    }
    String name = extractSwimlaneNameFromInstruction(instruction);
    if (name.isBlank()) {
      name = "Nueva calle";
    }
    ResponsibleType rt = ResponsibleType.ROLE;
    String rid = "role-default";
    var first = d.getSwimlanes().get(0);
    if (first.getResponsibleType() != null) {
      rt = first.getResponsibleType();
    }
    if (!safe(first.getResponsibleId()).isBlank()) {
      rid = first.getResponsibleId();
    }
    double maxRight = 0d;
    for (SaveActivityDiagramRequest.SwimlaneDto sl : d.getSwimlanes()) {
      double px = sl.getPositionX() == null ? 0d : sl.getPositionX();
      double w = sl.getWidth() == null ? 280d : sl.getWidth();
      maxRight = Math.max(maxRight, px + w);
    }
    SaveActivityDiagramRequest.SwimlaneDto sl = new SaveActivityDiagramRequest.SwimlaneDto();
    sl.setId("ai-lane-" + shortId());
    sl.setName(name.trim());
    sl.setResponsibleType(rt);
    sl.setResponsibleId(rid);
    sl.setPositionX(maxRight + 24d);
    sl.setPositionY(40d);
    sl.setWidth(280d);
    sl.setHeight(420d);
    d.getSwimlanes().add(sl);
    warnings.add("Se agregó la calle: " + name.trim());
  }

  private static String extractSwimlaneNameFromInstruction(String instruction) {
    List<String> q = extractAllQuoted(instruction);
    if (!q.isEmpty()) {
      return q.get(0).trim();
    }
    String low = instruction.toLowerCase(Locale.ROOT);
    for (String marker :
        List.of("calle", "franja", "carril", "piscina", "columna", "swimlane", "banda")) {
      int idx = low.indexOf(marker);
      if (idx >= 0) {
        String tail = instruction.substring(idx + marker.length()).trim();
        tail = tail.replaceFirst("(?i)^(la|el|los|las)\\s+", "").trim();
        tail = tail.replaceFirst("(?i)^(llamada|llamado|denominad[ao]|:)\\s*", "").trim();
        int and = tail.indexOf(" y ");
        if (and > 0) {
          tail = tail.substring(0, and).trim();
        }
        return tail;
      }
    }
    return "";
  }

  private void removeSwimlaneByInstruction(SaveActivityDiagramRequest d, String instruction, List<String> warnings) {
    ensureListsMutable(d);
    if (d.getSwimlanes().size() <= 1) {
      warnings.add("No se puede eliminar la única calle del diagrama.");
      return;
    }
    String needle = extractSwimlaneNameFromInstruction(instruction);
    if (needle.isBlank()) {
      needle = extractQuotedOrAfterKeyword(instruction, List.of("elimina", "borra", "quita", "suprime"));
    }
    if (needle.isBlank()) {
      warnings.add("Indica qué calle eliminar (nombre entre comillas o después de «calle …»).");
      return;
    }
    String nn = normalize(needle);
    Optional<SaveActivityDiagramRequest.SwimlaneDto> victim =
        d.getSwimlanes().stream().filter(sl -> normalize(sl.getName()).contains(nn)).findFirst();
    if (victim.isEmpty()) {
      warnings.add("No encontré una calle cuyo nombre coincida con: " + needle);
      return;
    }
    String victimId = victim.get().getId();
    SaveActivityDiagramRequest.SwimlaneDto fallback =
        d.getSwimlanes().stream().filter(sl -> !sl.getId().equals(victimId)).findFirst().orElse(d.getSwimlanes().get(0));
    for (SaveActivityDiagramRequest.NodeDto node : d.getNodes()) {
      if (victimId.equals(node.getSwimlaneId())) {
        node.setSwimlaneId(fallback.getId());
      }
    }
    d.setSwimlanes(
        new ArrayList<>(d.getSwimlanes().stream().filter(sl -> !sl.getId().equals(victimId)).toList()));
    warnings.add("Se eliminó la calle \"" + victim.get().getName() + "\" (nodos movidos a \"" + fallback.getName() + "\").");
  }

  private void addStartIfMissing(SaveActivityDiagramRequest d, List<String> warnings) {
    ensureListsMutable(d);
    if (d.getSwimlanes().isEmpty()) {
      injectDefaultSwimlaneAndAssignNodes(d, warnings);
    }
    if (d.getNodes().stream().anyMatch(n -> n.getType() == NodeType.START)) {
      warnings.add("Ya existe un nodo Inicio.");
      return;
    }
    String laneId = d.getSwimlanes().get(0).getId();
    double minX =
        d.getNodes().stream()
            .mapToDouble(n -> n.getPositionX() == null ? 0d : n.getPositionX())
            .min()
            .orElse(120d);
    String sid = "ai-start-" + shortId();
    SaveActivityDiagramRequest.NodeDto s = new SaveActivityDiagramRequest.NodeDto();
    s.setId(sid);
    s.setType(NodeType.START);
    s.setName("Inicio");
    s.setSwimlaneId(laneId);
    s.setPositionX(Math.max(40d, minX - 180d));
    s.setPositionY(180d);
    d.getNodes().add(s);
    Optional<SaveActivityDiagramRequest.NodeDto> target =
        d.getNodes().stream()
            .filter(n -> n.getType() != NodeType.START)
            .min(Comparator.comparingDouble(n -> n.getPositionX() == null ? 0d : n.getPositionX()));
    if (target.isPresent()) {
      d.getEdges().add(edge("ai-e-" + shortId(), sid, target.get().getId(), "Continuar", "", EdgeType.NORMAL));
    }
    warnings.add("Se agregó el nodo Inicio.");
  }

  private void addEndIfMissing(SaveActivityDiagramRequest d, List<String> warnings) {
    ensureListsMutable(d);
    if (d.getSwimlanes().isEmpty()) {
      injectDefaultSwimlaneAndAssignNodes(d, warnings);
    }
    if (d.getNodes().stream().anyMatch(n -> n.getType() == NodeType.END)) {
      warnings.add("Ya existe un nodo Fin.");
      return;
    }
    String laneId = d.getSwimlanes().get(0).getId();
    double maxX =
        d.getNodes().stream()
            .mapToDouble(n -> n.getPositionX() == null ? 0d : n.getPositionX())
            .max()
            .orElse(400d);
    String eid = "ai-end-" + shortId();
    SaveActivityDiagramRequest.NodeDto e = new SaveActivityDiagramRequest.NodeDto();
    e.setId(eid);
    e.setType(NodeType.END);
    e.setName("Fin");
    e.setSwimlaneId(laneId);
    e.setPositionX(maxX + 200d);
    e.setPositionY(180d);
    d.getNodes().add(e);
    Optional<SaveActivityDiagramRequest.NodeDto> last =
        d.getNodes().stream()
            .filter(n -> n.getType() != NodeType.END)
            .max(Comparator.comparingDouble(n -> n.getPositionX() == null ? 0d : n.getPositionX()));
    last.ifPresent(
        n -> d.getEdges().add(edge("ai-e-" + shortId(), n.getId(), eid, "Finalizar", "", EdgeType.NORMAL)));
    warnings.add("Se agregó el nodo Fin.");
  }

  private void applyRemoveSpecialNodes(SaveActivityDiagramRequest d, String nNorm, List<String> warnings) {
    if (!containsAny(nNorm, List.of("elimina", "borra", "quita", "suprime"))) {
      return;
    }
    if (isSwimlaneRemoveIntent(nNorm)) {
      return;
    }
    ensureListsMutable(d);
    if ((containsAny(nNorm, List.of("nodo inicio", "el inicio"))
            || (containsAny(nNorm, List.of("inicio")) && !containsAny(nNorm, List.of("actividad", "etapa"))))
        && containsAny(nNorm, List.of("elimina", "borra", "quita", "suprime"))) {
      int k = removeNodesOfType(d, NodeType.START);
      if (k > 0) {
        warnings.add("Se eliminó el nodo Inicio.");
      }
    }
    if (containsAny(nNorm, List.of("nodo fin", "el fin", "nodo final", "elimina fin", "borra fin", "quita fin", "eliminar fin"))
        && !containsAny(nNorm, List.of("actividad"))) {
      int k = removeNodesOfType(d, NodeType.END);
      if (k > 0) {
        warnings.add("Se eliminó el nodo Fin (revisa que el flujo quede cerrado).");
      }
    }
  }

  private int removeNodesOfType(SaveActivityDiagramRequest d, NodeType type) {
    ensureListsMutable(d);
    List<String> ids =
        d.getNodes().stream()
            .filter(n -> n.getType() == type)
            .map(SaveActivityDiagramRequest.NodeDto::getId)
            .filter(id -> id != null && !id.isBlank())
            .toList();
    if (ids.isEmpty()) {
      return 0;
    }
    d.setNodes(
        new ArrayList<>(d.getNodes().stream().filter(n -> n.getType() != type).toList()));
    if (d.getEdges() != null) {
      d.setEdges(
          new ArrayList<>(
              d.getEdges().stream()
                  .filter(e -> !ids.contains(e.getSourceNodeId()) && !ids.contains(e.getTargetNodeId()))
                  .toList()));
    }
    return ids.size();
  }

  private void ensureParallelForkJoin(SaveActivityDiagramRequest d, List<String> warnings) {
    ensureListsMutable(d);
    String endId =
        d.getNodes().stream()
            .filter(n -> n.getType() == NodeType.END)
            .map(SaveActivityDiagramRequest.NodeDto::getId)
            .findFirst()
            .orElse("");
    if (endId.isBlank()) {
      warnings.add("No hay nodo Fin: agrega un fin antes de paralelizar.");
      return;
    }
    SaveActivityDiagramRequest.NodeDto last =
        d.getNodes().stream()
            .filter(
                n ->
                    n.getType() != NodeType.END
                        && n.getType() != NodeType.FORK
                        && n.getType() != NodeType.JOIN)
            .max(Comparator.comparingDouble(n -> n.getPositionX() == null ? 0d : n.getPositionX()))
            .orElse(null);
    if (last == null) {
      return;
    }

    String laneId =
        last.getSwimlaneId() != null && !last.getSwimlaneId().isBlank()
            ? last.getSwimlaneId()
            : d.getSwimlanes().get(0).getId();
    double baseX = (last.getPositionX() == null ? 0d : last.getPositionX()) + 200d;
    double baseY = last.getPositionY() == null ? 160d : last.getPositionY();

    String forkId = "ai-fork-" + shortId();
    String joinId = "ai-join-" + shortId();
    String aId = "ai-par-a-" + shortId();
    String bId = "ai-par-b-" + shortId();

    SaveActivityDiagramRequest.NodeDto fork = new SaveActivityDiagramRequest.NodeDto();
    fork.setId(forkId);
    fork.setType(NodeType.FORK);
    fork.setName("Paralelo");
    fork.setSwimlaneId(laneId);
    fork.setPositionX(baseX);
    fork.setPositionY(baseY);

    SaveActivityDiagramRequest.NodeDto join = new SaveActivityDiagramRequest.NodeDto();
    join.setId(joinId);
    join.setType(NodeType.JOIN);
    join.setName("Unión");
    join.setSwimlaneId(laneId);
    join.setPositionX(baseX + 440d);
    join.setPositionY(baseY);

    SaveActivityDiagramRequest.NodeDto pa = new SaveActivityDiagramRequest.NodeDto();
    pa.setId(aId);
    pa.setType(NodeType.ACTIVITY);
    pa.setName("Rama A");
    pa.setSwimlaneId(laneId);
    pa.setPositionX(baseX + 200d);
    pa.setPositionY(baseY - 85d);
    pa.setMetadata(Map.of("assigneeName", "Equipo"));

    SaveActivityDiagramRequest.NodeDto pb = new SaveActivityDiagramRequest.NodeDto();
    pb.setId(bId);
    pb.setType(NodeType.ACTIVITY);
    pb.setName("Rama B");
    pb.setSwimlaneId(laneId);
    pb.setPositionX(baseX + 200d);
    pb.setPositionY(baseY + 85d);
    pb.setMetadata(Map.of("assigneeName", "Equipo"));

    d.getNodes().add(fork);
    d.getNodes().add(pa);
    d.getNodes().add(pb);
    d.getNodes().add(join);

    boolean rerouted = false;
    for (SaveActivityDiagramRequest.EdgeDto e : d.getEdges()) {
      if (safe(e.getSourceNodeId()).equals(last.getId()) && safe(e.getTargetNodeId()).equals(endId)) {
        e.setTargetNodeId(forkId);
        if (e.getLabel() == null || e.getLabel().isBlank()) {
          e.setLabel("Continuar");
        }
        rerouted = true;
        break;
      }
    }
    if (!rerouted) {
      d.getEdges().add(edge("ai-e-" + shortId(), last.getId(), forkId, "Continuar", "", EdgeType.NORMAL));
    }
    d.getEdges().add(edge("ai-e-" + shortId(), forkId, aId, "A", "", EdgeType.PARALLEL));
    d.getEdges().add(edge("ai-e-" + shortId(), forkId, bId, "B", "", EdgeType.PARALLEL));
    d.getEdges().add(edge("ai-e-" + shortId(), aId, joinId, "Unir", "", EdgeType.NORMAL));
    d.getEdges().add(edge("ai-e-" + shortId(), bId, joinId, "Unir", "", EdgeType.NORMAL));
    d.getEdges().add(edge("ai-e-" + shortId(), joinId, endId, "Continuar", "", EdgeType.NORMAL));
    warnings.add("Se insertó bifurcación paralela (FORK → dos ramas → JOIN → Fin).");
  }

  private void applyRenameNode(SaveActivityDiagramRequest d, String instruction, List<String> warnings) {
    String n = normalize(instruction);
    if (!containsAny(n, List.of("renombra", "renombrar", "cambia el nombre", "llamalo", "llama lo"))) {
      return;
    }
    if (containsAny(n, List.of("calle", "franja", "swimlane", "carril")) && containsAny(n, List.of("renomb"))) {
      renameSwimlane(d, instruction, warnings);
      return;
    }
    List<String> q = extractAllQuoted(instruction);
    if (q.size() >= 2) {
      renameFirstMatchingNode(d, q.get(0), q.get(1), warnings);
      return;
    }
    String low = instruction.toLowerCase(Locale.ROOT);
    int r = low.indexOf("renombra");
    if (r < 0) {
      r = low.indexOf("renombrar");
    }
    if (r >= 0) {
      String tail = instruction.substring(r).replaceFirst("(?i)^renombra(r)?\\s+", "");
      int aIdx = tail.toLowerCase(Locale.ROOT).indexOf(" a ");
      if (aIdx > 0) {
        String from = tail.substring(0, aIdx).trim();
        String to = tail.substring(aIdx + 4).trim();
        if (!from.isBlank() && !to.isBlank()) {
          renameFirstMatchingNode(d, from, to, warnings);
        }
      }
    }
  }

  private void renameSwimlane(SaveActivityDiagramRequest d, String instruction, List<String> warnings) {
    ensureListsMutable(d);
    List<String> q = extractAllQuoted(instruction);
    if (q.size() >= 2) {
      String nn = normalize(q.get(0));
      for (SaveActivityDiagramRequest.SwimlaneDto sl : d.getSwimlanes()) {
        if (normalize(sl.getName()).contains(nn)) {
          sl.setName(q.get(1).trim());
          warnings.add("Calle renombrada a: " + q.get(1).trim());
          return;
        }
      }
    }
  }

  private void renameFirstMatchingNode(
      SaveActivityDiagramRequest d, String fromNeedle, String newName, List<String> warnings) {
    ensureListsMutable(d);
    String nf = normalize(fromNeedle);
    for (SaveActivityDiagramRequest.NodeDto node : d.getNodes()) {
      if (normalize(safe(node.getName())).contains(nf)) {
        node.setName(newName.trim());
        warnings.add("Nodo renombrado a: " + newName.trim());
        return;
      }
    }
  }

  private Optional<SaveActivityDiagramRequest.NodeDto> resolveNodeRef(SaveActivityDiagramRequest d, String refRaw) {
    String ref = safe(refRaw);
    if (ref.isBlank()) {
      return Optional.empty();
    }
    String nr = normalize(ref);
    if (nr.equals("inicio") || nr.equals("comienzo") || nr.equals("start")) {
      return d.getNodes().stream().filter(n -> n.getType() == NodeType.START).findFirst();
    }
    if (nr.equals("fin") || nr.equals("final") || nr.equals("end")) {
      return d.getNodes().stream().filter(n -> n.getType() == NodeType.END).findFirst();
    }
    return d.getNodes().stream()
        .filter(n -> !safe(n.getName()).isBlank())
        .filter(n -> normalize(n.getName()).contains(nr))
        .findFirst();
  }

  private boolean connectNodesByInstruction(
      SaveActivityDiagramRequest d, String instruction, List<String> warnings) {
    ensureListsMutable(d);
    if (d.getNodes() == null || d.getNodes().isEmpty()) return false;
    if (d.getEdges() == null) d.setEdges(new ArrayList<>());

    // Preferido: 2 textos entre comillas.
    List<String> quoted = extractAllQuoted(instruction);
    String a = quoted.size() >= 1 ? quoted.get(0) : "";
    String b = quoted.size() >= 2 ? quoted.get(1) : "";

    // Fallback: "conecta A con B"
    if (b.isBlank()) {
      String low = safe(instruction).toLowerCase(Locale.ROOT);
      int ix = low.indexOf("conecta");
      if (ix < 0) ix = low.indexOf("conectar");
      if (ix < 0) ix = low.indexOf("une");
      if (ix < 0) ix = low.indexOf("unir");
      if (ix >= 0) {
        String tail = safe(instruction).substring(ix);
        String tailLow = tail.toLowerCase(Locale.ROOT);
        int conIx = tailLow.indexOf(" con ");
        if (conIx >= 0) {
          a = safe(tail.substring(0, conIx)).replaceFirst("(?i)^(conecta|conectar|une|unir)\\s+", "").trim();
          b = safe(tail.substring(conIx + 5)).trim();
        }
      }
    }

    if (a.isBlank() || b.isBlank()) return false;

    var fromOpt = resolveNodeRef(d, a);
    var toOpt = resolveNodeRef(d, b);
    if (fromOpt.isEmpty() || toOpt.isEmpty()) return false;

    String fromId = fromOpt.get().getId();
    String toId = toOpt.get().getId();
    if (fromId == null || toId == null || fromId.isBlank() || toId.isBlank()) return false;
    if (fromId.equals(toId)) return false;

    boolean exists =
        d.getEdges().stream()
            .anyMatch(e -> safe(e.getSourceNodeId()).equals(fromId) && safe(e.getTargetNodeId()).equals(toId));
    if (exists) {
      warnings.add("La transición ya existía entre: " + a + " -> " + b);
      return true;
    }

    d.getEdges().add(edge("ai-e-" + shortId(), fromId, toId, "Continuar", "", EdgeType.NORMAL));
    warnings.add("Se creó la transición: " + a + " → " + b);
    return true;
  }

  /**
   * Word, macOS y muchos teclados usan comillas tipográficas (U+201C/U+201D) en lugar de {@code "}. Sin esto,
   * {@link #extractAllQuoted} no detecta el texto y el borrado por nombre falla aunque el nodo exista.
   */
  private static String normalizeAsciiQuotes(String text) {
    String t = safe(text);
    if (t.isEmpty()) {
      return t;
    }
    StringBuilder sb = new StringBuilder(t.length());
    for (int i = 0; i < t.length(); i++) {
      char c = t.charAt(i);
      if (c == '\u201c' || c == '\u201d' || c == '\u201e' || c == '\u00ab' || c == '\u00bb') {
        sb.append('"');
      } else if (c == '\u2018' || c == '\u2019' || c == '\u201a' || c == '\u2032') {
        sb.append('\'');
      } else {
        sb.append(c);
      }
    }
    return sb.toString();
  }

  private static List<String> extractAllQuoted(String text) {
    String t = normalizeAsciiQuotes(text);
    List<String> out = new ArrayList<>();
    int i = 0;
    while (i < t.length()) {
      int q1 = t.indexOf('"', i);
      if (q1 < 0) break;
      int q2 = t.indexOf('"', q1 + 1);
      if (q2 < 0) break;
      String inner = t.substring(q1 + 1, q2).trim();
      if (!inner.isBlank()) out.add(inner);
      i = q2 + 1;
      if (out.size() >= 4) break;
    }
    return out;
  }

  private SaveActivityDiagramRequest deepCopy(SaveActivityDiagramRequest x) {
    try {
      return om.readValue(om.writeValueAsBytes(x), SaveActivityDiagramRequest.class);
    } catch (Exception e) {
      return x;
    }
  }

  private void ensureApprovalDecision(SaveActivityDiagramRequest d, List<String> warnings) {
    ensureListsMutable(d);
    if (d.getNodes() == null || d.getNodes().isEmpty()) return;
    String endId =
        d.getNodes().stream()
            .filter(n -> n.getType() == NodeType.END)
            .findFirst()
            .map(SaveActivityDiagramRequest.NodeDto::getId)
            .orElse("");
    if (endId.isBlank()) return;

    // Última actividad por positionX (si no hay, usar el primer node no-END)
    SaveActivityDiagramRequest.NodeDto last =
        d.getNodes().stream()
            .filter(n -> n.getType() != NodeType.END)
            .max(Comparator.comparingDouble(n -> n.getPositionX() == null ? 0d : n.getPositionX()))
            .orElse(d.getNodes().get(0));

    // Evitar duplicar si ya existe un decision llamado parecido
    boolean already =
        d.getNodes().stream()
            .anyMatch(
                n ->
                    n.getType() == NodeType.DECISION
                        && normalize(safe(n.getName())).contains("aprob"));
    if (already) {
      warnings.add("Ya existe una decisión de aprobación; no se duplicó.");
      return;
    }

    double baseX = (last.getPositionX() == null ? 0d : last.getPositionX()) + 220d;
    double baseY = (last.getPositionY() == null ? 140d : last.getPositionY());

    String laneId =
        last.getSwimlaneId() != null && !last.getSwimlaneId().isBlank()
            ? last.getSwimlaneId()
            : (d.getSwimlanes() != null && !d.getSwimlanes().isEmpty() ? d.getSwimlanes().get(0).getId() : null);

    SaveActivityDiagramRequest.NodeDto decision = new SaveActivityDiagramRequest.NodeDto();
    decision.setId("ai-decision-" + shortId());
    decision.setType(NodeType.DECISION);
    decision.setName("¿Aprobado?");
    decision.setSwimlaneId(laneId);
    decision.setPositionX(baseX);
    decision.setPositionY(baseY);
    decision.setMetadata(Map.of("assigneeName", "Aprobación"));

    SaveActivityDiagramRequest.NodeDto approved = new SaveActivityDiagramRequest.NodeDto();
    approved.setId("ai-aprob-" + shortId());
    approved.setType(NodeType.ACTIVITY);
    approved.setName("Notificar aprobación");
    approved.setDescription("Se notifica al solicitante.");
    approved.setSwimlaneId(laneId);
    approved.setPositionX(baseX + 220d);
    approved.setPositionY(baseY - 90d);
    approved.setMetadata(Map.of("assigneeName", "Sistema"));

    SaveActivityDiagramRequest.NodeDto rejected = new SaveActivityDiagramRequest.NodeDto();
    rejected.setId("ai-rech-" + shortId());
    rejected.setType(NodeType.ACTIVITY);
    rejected.setName("Notificar rechazo");
    rejected.setDescription("Se notifica el motivo.");
    rejected.setSwimlaneId(laneId);
    rejected.setPositionX(baseX + 220d);
    rejected.setPositionY(baseY + 90d);
    rejected.setMetadata(Map.of("assigneeName", "Sistema"));

    d.getNodes().add(decision);
    d.getNodes().add(approved);
    d.getNodes().add(rejected);

    if (d.getEdges() == null) d.setEdges(new ArrayList<>());

    // Re-rutear: cualquier edge que vaya directo a END desde last -> decision
    List<SaveActivityDiagramRequest.EdgeDto> edges = d.getEdges();
    for (SaveActivityDiagramRequest.EdgeDto e : edges) {
      if (safe(e.getSourceNodeId()).equals(safe(last.getId())) && safe(e.getTargetNodeId()).equals(endId)) {
        e.setTargetNodeId(decision.getId());
        if (e.getLabel() == null || e.getLabel().isBlank()) e.setLabel("Evaluar");
      }
    }

    edges.add(edge("ai-e-" + shortId(), last.getId(), decision.getId(), "Evaluar", "", EdgeType.NORMAL));
    edges.add(edge("ai-e-" + shortId(), decision.getId(), approved.getId(), "Sí", "aprobado == true", EdgeType.NORMAL));
    edges.add(
        edge("ai-e-" + shortId(), decision.getId(), rejected.getId(), "No", "aprobado == false", EdgeType.ALTERNATIVE));
    edges.add(edge("ai-e-" + shortId(), approved.getId(), endId, "Cerrar", "", EdgeType.NORMAL));
    edges.add(edge("ai-e-" + shortId(), rejected.getId(), endId, "Cerrar", "", EdgeType.NORMAL));
  }

  private SaveActivityDiagramRequest.EdgeDto edge(
      String id, String source, String target, String label, String condition, EdgeType type) {
    SaveActivityDiagramRequest.EdgeDto e = new SaveActivityDiagramRequest.EdgeDto();
    e.setId(id);
    e.setSourceNodeId(source);
    e.setTargetNodeId(target);
    e.setLabel(label);
    e.setCondition(condition);
    e.setType(type);
    return e;
  }

  private int removeNodesByNameContains(SaveActivityDiagramRequest d, String needleRaw) {
    ensureListsMutable(d);
    String needle = normalize(needleRaw);
    if (needle.isBlank()) return 0;

    List<String> toRemove =
        d.getNodes().stream()
            .filter(n -> nodeMatchesDeleteNeedle(n, needle))
            .map(SaveActivityDiagramRequest.NodeDto::getId)
            .filter(id -> id != null && !id.isBlank())
            .distinct()
            .toList();

    if (toRemove.isEmpty() && needleRaw != null && needleRaw.length() >= 3) {
      String nr = safe(needleRaw).trim().toLowerCase(Locale.ROOT);
      toRemove =
          d.getNodes().stream()
              .filter(n -> safe(n.getId()).toLowerCase(Locale.ROOT).contains(nr))
              .map(SaveActivityDiagramRequest.NodeDto::getId)
              .filter(id -> id != null && !id.isBlank())
              .distinct()
              .toList();
    }

    // Último recurso: nombre muy parecido (ej. «Validar solicitud» vs «Revisar solicitud»).
    if (toRemove.isEmpty() && needle.length() >= 6) {
      int thresh = Math.min(6, Math.max(3, needle.length() / 3 + 1));
      String bestId = null;
      int bestDist = Integer.MAX_VALUE;
      for (SaveActivityDiagramRequest.NodeDto n : d.getNodes()) {
        String nm = safe(n.getName());
        if (nm.isBlank()) continue;
        if (n.getType() != NodeType.ACTIVITY && n.getType() != NodeType.DECISION) {
          continue;
        }
        int dist = levenshteinDistance(needle, normalize(nm));
        if (dist < bestDist) {
          bestDist = dist;
          bestId = n.getId();
        }
      }
      if (bestId != null && bestDist <= thresh) {
        toRemove = List.of(bestId);
      }
    }

    if (toRemove.isEmpty()) return 0;

    final List<String> removedIds = toRemove;
    bridgeEdgesAroundRemovedNodes(d, new HashSet<>(removedIds));
    d.setNodes(
        new ArrayList<>(d.getNodes().stream().filter(n -> !removedIds.contains(n.getId())).toList()));
    if (d.getEdges() != null) {
      d.setEdges(
          new ArrayList<>(
              d.getEdges().stream()
                  .filter(
                      e ->
                          !removedIds.contains(e.getSourceNodeId())
                              && !removedIds.contains(e.getTargetNodeId()))
                  .toList()));
    }
    return removedIds.size();
  }

  private static boolean nodeMatchesDeleteNeedle(SaveActivityDiagramRequest.NodeDto n, String needleNorm) {
    if (needleNorm.isBlank()) return false;
    String idNorm = normalize(safe(n.getId()));
    if (!idNorm.isBlank() && idNorm.contains(needleNorm)) {
      return true;
    }
    String nameNorm = normalize(safe(n.getName()));
    if (!nameNorm.isBlank() && nameNorm.contains(needleNorm)) {
      return true;
    }
    if (!nameNorm.isBlank()) {
      String[] rawParts = needleNorm.split("\\s+");
      List<String> sig = Arrays.stream(rawParts).filter(p -> p.length() >= 4).toList();
      // Varios términos: deben aparecer todos (evita que solo «solicitud» borre todo).
      if (sig.size() >= 2) {
        return sig.stream().allMatch(nameNorm::contains);
      }
      if (sig.size() == 1) {
        return nameNorm.contains(sig.get(0));
      }
      // Needle corto: una sola palabra significativa 3–3 chars
      for (String part : rawParts) {
        if (part.length() >= 3 && nameNorm.contains(part)) {
          return true;
        }
      }
    }
    return false;
  }

  private static int levenshteinDistance(String a, String b) {
    String x = a == null ? "" : a;
    String y = b == null ? "" : b;
    int n = x.length();
    int m = y.length();
    int[] prev = new int[m + 1];
    for (int j = 0; j <= m; j++) {
      prev[j] = j;
    }
    for (int i = 1; i <= n; i++) {
      int[] cur = new int[m + 1];
      cur[0] = i;
      for (int j = 1; j <= m; j++) {
        int cost = x.charAt(i - 1) == y.charAt(j - 1) ? 0 : 1;
        cur[j] =
            Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[m];
  }

  /** Conecta predecesores con sucesores de cada nodo eliminado para no dejar el flujo roto. */
  private void bridgeEdgesAroundRemovedNodes(SaveActivityDiagramRequest d, Set<String> removedIds) {
    if (removedIds == null || removedIds.isEmpty()) return;
    ensureListsMutable(d);
    if (d.getEdges() == null) d.setEdges(new ArrayList<>());

    List<SaveActivityDiagramRequest.EdgeDto> bridge = new ArrayList<>();
    for (String mid : removedIds) {
      List<String> preds =
          d.getEdges().stream()
              .filter(e -> mid.equals(e.getTargetNodeId()))
              .map(SaveActivityDiagramRequest.EdgeDto::getSourceNodeId)
              .filter(pid -> pid != null && !removedIds.contains(pid))
              .distinct()
              .toList();
      List<String> succs =
          d.getEdges().stream()
              .filter(e -> mid.equals(e.getSourceNodeId()))
              .map(SaveActivityDiagramRequest.EdgeDto::getTargetNodeId)
              .filter(sid -> sid != null && !removedIds.contains(sid))
              .distinct()
              .toList();
      for (String p : preds) {
        for (String s : succs) {
          if (p.equals(s)) continue;
          if (edgeExistsBetween(d.getEdges(), bridge, p, s)) continue;
          bridge.add(edge("ai-e-br-" + shortId(), p, s, "Continuar", "", EdgeType.NORMAL));
        }
      }
    }
    d.getEdges().addAll(bridge);
  }

  private static boolean edgeExistsBetween(
      List<SaveActivityDiagramRequest.EdgeDto> existing,
      List<SaveActivityDiagramRequest.EdgeDto> pending,
      String from,
      String to) {
    boolean e1 =
        existing.stream()
            .anyMatch(ed -> safe(ed.getSourceNodeId()).equals(from) && safe(ed.getTargetNodeId()).equals(to));
    boolean e2 =
        pending.stream()
            .anyMatch(ed -> safe(ed.getSourceNodeId()).equals(from) && safe(ed.getTargetNodeId()).equals(to));
    return e1 || e2;
  }

  private void addActivityBeforeEnd(SaveActivityDiagramRequest d, String label, List<String> warnings) {
    ensureListsMutable(d);
    if (d.getNodes() == null || d.getNodes().isEmpty()) return;
    String endId =
        d.getNodes().stream()
            .filter(n -> n.getType() == NodeType.END)
            .findFirst()
            .map(SaveActivityDiagramRequest.NodeDto::getId)
            .orElse("");
    if (endId.isBlank()) return;

    SaveActivityDiagramRequest.NodeDto prev =
        d.getNodes().stream()
            .filter(n -> n.getType() != NodeType.END)
            .max(Comparator.comparingDouble(n -> n.getPositionX() == null ? 0d : n.getPositionX()))
            .orElse(d.getNodes().get(0));

    String laneId =
        prev.getSwimlaneId() != null && !prev.getSwimlaneId().isBlank()
            ? prev.getSwimlaneId()
            : (d.getSwimlanes() != null && !d.getSwimlanes().isEmpty() ? d.getSwimlanes().get(0).getId() : null);

    SaveActivityDiagramRequest.NodeDto n = new SaveActivityDiagramRequest.NodeDto();
    n.setId("ai-act-" + shortId());
    n.setType(NodeType.ACTIVITY);
    n.setName(label.trim());
    n.setSwimlaneId(laneId);
    n.setPositionX((prev.getPositionX() == null ? 0d : prev.getPositionX()) + 220d);
    n.setPositionY(prev.getPositionY());
    n.setMetadata(Map.of("assigneeName", "Operación"));
    d.getNodes().add(n);

    if (d.getEdges() == null) d.setEdges(new ArrayList<>());

    // re-rutear edges prev->end a prev->new
    boolean rerouted = false;
    for (SaveActivityDiagramRequest.EdgeDto e : d.getEdges()) {
      if (safe(e.getSourceNodeId()).equals(prev.getId()) && safe(e.getTargetNodeId()).equals(endId)) {
        e.setTargetNodeId(n.getId());
        rerouted = true;
      }
    }
    if (!rerouted) {
      d.getEdges().add(edge("ai-e-" + shortId(), prev.getId(), n.getId(), "Continuar", "", EdgeType.NORMAL));
    }
    d.getEdges().add(edge("ai-e-" + shortId(), n.getId(), endId, "Finalizar", "", EdgeType.NORMAL));
    warnings.add("Se agregó una actividad antes del FIN: " + label.trim());
  }

  /**
   * Extrae el nombre tras “nodo …”, comillas, o “actividad/paso …”. Ej.: Creame un nodo NO EJECUTADO → NO EJECUTADO
   */
  private static String extractNodeLabelFromInstruction(String instruction) {
    String t = safe(instruction);
    List<String> quoted = extractAllQuoted(t);
    if (!quoted.isEmpty()) {
      return quoted.get(0).trim();
    }
    String low = t.toLowerCase(Locale.ROOT);
    int idx = low.lastIndexOf("nodo");
    if (idx >= 0) {
      String tail = t.substring(idx + 4).trim();
      tail = tail.replaceFirst("(?i)^(un|una|el|la)\\s+", "").trim();
      if (!tail.isBlank()) {
        return tail;
      }
    }
    for (String key : List.of("actividad", "etapa", "paso")) {
      int j = low.indexOf(key);
      if (j >= 0) {
        String tail = t.substring(j + key.length()).trim();
        tail =
            tail.replaceFirst("(?i)^(nueva|nuevo|el|la|un|una|llamada|llamado|denominad[ao])\\s+", "").trim();
        if (tail.length() >= 2) {
          return tail;
        }
      }
    }
    return "";
  }

  private static String extractQuotedOrAfterKeyword(String text, List<String> keywords) {
    String t = safe(text);
    // 1) Si hay comillas, tomar lo primero entre comillas.
    int q1 = t.indexOf('"');
    if (q1 >= 0) {
      int q2 = t.indexOf('"', q1 + 1);
      if (q2 > q1) return t.substring(q1 + 1, q2).trim();
    }
    // 2) Palabras clave más largas primero (evita que «elimina» parta «eliminar» → «r nodo…»).
    String low = t.toLowerCase(Locale.ROOT);
    List<String> sorted = new ArrayList<>(keywords);
    sorted.sort((a, b) -> Integer.compare(b.length(), a.length()));
    for (String k : sorted) {
      int idx = low.indexOf(k);
      if (idx >= 0) {
        return t.substring(idx + k.length()).trim();
      }
    }
    return "";
  }

  private static String shortId() {
    return UUID.randomUUID().toString().substring(0, 8);
  }

  private static boolean containsAny(String normalized, List<String> needles) {
    for (String n : needles) {
      if (normalized.contains(normalize(n))) return true;
    }
    return false;
  }

  private static String normalize(String s) {
    String t = safe(s).toLowerCase(Locale.ROOT);
    String noAccents = Normalizer.normalize(t, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    return noAccents.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim();
  }

  /** True si las heurísticas de borrado/reestructura ya aplicaron un cambio útil (no solo avisos de coerce). */
  private static boolean deletionHeuristicSucceeded(List<String> w) {
    if (w == null || w.isEmpty()) {
      return false;
    }
    return w.stream()
        .anyMatch(
            x ->
                x.startsWith("Se eliminaron")
                    || x.contains("Se eliminó la calle")
                    || x.startsWith("Se eliminó el nodo Inicio")
                    || x.contains("Se eliminó el nodo Fin"));
  }

  private static String safe(String s) {
    return s == null ? "" : s.trim();
  }
}

