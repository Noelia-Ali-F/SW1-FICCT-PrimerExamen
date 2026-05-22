package com.workflow.system.business.service;

import com.workflow.system.presentation.dto.ai.AiDiagramStructuredSuggestRequest;
import com.workflow.system.presentation.dto.ai.AiDiagramStructuredSuggestResponse;
import com.workflow.system.presentation.dto.ai.AiDiagramSuggestionItem;
import com.workflow.system.presentation.dto.diagram.SaveActivityDiagramRequest;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Motor NLP local (sin API externa): extrae calles, actividades y transiciones explicables desde texto.
 * Diseñado para ser reemplazado por un proveedor LLM conservando el contrato REST.
 */
@Service
@RequiredArgsConstructor
public class LocalDiagramNlpSuggestionService {

  private static final Pattern VERB_PHRASE =
      Pattern.compile(
          "\\b(registrar|registra|revisar|revisa|aprobar|aprueba|rechazar|rechaza|validar|valida|"
              + "enviar|envía|completar|finalizar|notificar|notifica|tramitar|solicitar|solicita|"
              + "asignar|cargar|cargar|cargar información|devolver|enviar a|pasar a)\\b([^.\\n;]*)",
          Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

  private static final List<String> LANE_HINTS =
      List.of(
          "solicitante",
          "recepción",
          "recepcion",
          "supervisor",
          "supervisión",
          "administración",
          "administracion",
          "administrador",
          "gerencia",
          "gerente",
          "rrhh",
          "recursos humanos",
          "ti",
          "sistemas",
          "operaciones",
          "facturación",
          "facturacion",
          "área",
          "area",
          "departamento",
          "funcionario");

  public AiDiagramStructuredSuggestResponse suggest(AiDiagramStructuredSuggestRequest req) {
    String raw = req.getDescription() == null ? "" : req.getDescription().trim();
    String norm = normalize(raw);
    List<String> warnings = new ArrayList<>();
    if (raw.length() < 8) {
      warnings.add("La descripción es muy breve; las sugerencias pueden ser genéricas.");
    }

    LinkedHashSet<String> laneNamesOrdered = new LinkedHashSet<>();
    for (String h : LANE_HINTS) {
      if (norm.contains(normalize(h))) {
        laneNamesOrdered.add(titleCase(h.replace("á", "á").replace("ó", "ó")));
      }
    }

    // Derivación adicional por contexto (capitalizado en el texto original).
    extractCapitalizedNames(raw, laneNamesOrdered);

    if (laneNamesOrdered.isEmpty()) {
      addFallbackLanesDerivedFromDescription(raw, norm, laneNamesOrdered);
      warnings.add(
          "No se detectaron etiquetas típicas de rol; los nombres de calles se derivaron de fragmentos lexicales únicos de su texto.");
    }

    List<DetectedActivity> activities = extractActivities(norm, raw, laneNamesOrdered, warnings);

    // Orden estable por aparición + peso verbal
    activities.sort(
        Comparator.comparingInt((DetectedActivity a) -> a.orderWeight)
            .thenComparing(a -> a.name, String.CASE_INSENSITIVE_ORDER));

    List<AiDiagramSuggestionItem> items = new ArrayList<>();
    int ord = 1;
    for (String ln : laneNamesOrdered) {
      items.add(
          AiDiagramSuggestionItem.builder()
              .type(AiDiagramSuggestionItem.AiDiagramSuggestionKind.LANE)
              .name(ln)
              .reason("Palabra o rol detectado en la descripción (análisis léxico).")
              .build());
    }

    for (DetectedActivity a : activities) {
      items.add(
          AiDiagramSuggestionItem.builder()
              .type(AiDiagramSuggestionItem.AiDiagramSuggestionKind.ACTIVITY)
              .name(a.name)
              .description(a.description)
              .laneName(a.laneName)
              .order(ord++)
              .reason(a.reason)
              .build());
    }

    List<DetectedActivity> actList = new ArrayList<>(activities);
    items.addAll(buildTransitions(norm, actList, warnings));

    touchWithCurrentDiagram(req.getCurrentDiagram(), warnings);

    AiDiagramStructuredSuggestResponse out = new AiDiagramStructuredSuggestResponse();
    out.setSuggestions(items);
    out.setWarnings(warnings);
    return out;
  }

  private void touchWithCurrentDiagram(SaveActivityDiagramRequest current, List<String> warnings) {
    if (current == null) {
      return;
    }
    int sl = current.getSwimlanes() == null ? 0 : current.getSwimlanes().size();
    int nd = current.getNodes() == null ? 0 : current.getNodes().size();
    if (sl + nd > 0) {
      warnings.add(
          "Diagrama actual con "
              + sl
              + " calle(s) y "
              + nd
              + " nodo(s): al aplicar sugerencias se añadirán elementos sin borrar los existentes.");
    }
  }

  private List<AiDiagramSuggestionItem> buildTransitions(
      String norm, List<DetectedActivity> activities, List<String> warnings) {
    List<AiDiagramSuggestionItem> out = new ArrayList<>();
    if (activities.size() < 2) {
      return out;
    }
    for (int i = 0; i < activities.size() - 1; i++) {
      String a = activities.get(i).name;
      String b = activities.get(i + 1).name;
      String label =
          inferSequentialLabel(norm, i) ? "Si corresponde" : detectConditionLabel(norm, a, b);
      out.add(
          AiDiagramSuggestionItem.builder()
              .type(AiDiagramSuggestionItem.AiDiagramSuggestionKind.TRANSITION)
              .from(a)
              .to(b)
              .label(label == null ? "" : label)
              .reason(
                  label != null && !label.isBlank()
                      ? "Transición inferida entre actividades adyacentes en el texto."
                      : "Flujo principal sugerido en el orden interpretado.")
              .build());
    }

    return out;
  }

  private boolean inferSequentialLabel(String norm, int index) {
    return norm.contains("caso contrario") && index >= 1;
  }

  private String detectConditionLabel(String norm, String fromA, String toB) {
    if (norm.contains("aprob") && norm.contains("correct")) {
      if (normalize(toB).contains(normalize(fromA))) return null;
      return "si está aprobada o correcta";
    }
    if (norm.contains("incomplet")) return "si está incompleta";
    return null;
  }

  private List<DetectedActivity> extractActivities(
      String norm, String raw, Set<String> lanePool, List<String> warnings) {
    List<DetectedActivity> list = new ArrayList<>();
    Matcher m = VERB_PHRASE.matcher(norm);
    int idx = 0;
    LinkedHashMap<String, String> laneByNorm = new LinkedHashMap<>();
    for (String l : lanePool) laneByNorm.put(normalize(l), l);

    while (m.find()) {
      String verb = capitalizeFirst(m.group(1));
      String tail = tidyTail(m.group(2));
      String compound = verb + (tail.isEmpty() ? " solicitud" : " " + tail);
      if (compound.length() > 80) compound = compound.substring(0, 80).trim();

      String lane = pickLaneForClause(m.group(), laneByNorm, lanePool);
      list.add(
          new DetectedActivity(
              shortenTitle(compound),
              "Derivado del verbo \"" + verb + "\" y el fragmento siguiente en la descripción.",
              lane,
              "Heurística verbal + contexto de carril.",
              10 + idx++));
    }

    if (list.isEmpty()) {
      // Fallback: segmentar por puntuación
      String[] segments = raw.split("\\s*(?:\\.|;|\\r?\\n|y\\s+luego|\\s+luego\\s+|después,?\\s*)\\s");
      idx = 0;
      for (String seg : segments) {
        seg = seg.trim();
        if (seg.length() < 6) continue;
        String n = normalize(seg);
        boolean anyVerb =
            n.matches(".*\\b(registrar|revisar|aprobar|validar|notificar)\\b.*");
        if (!anyVerb) continue;
        String lane = pickLaneForClause(n, laneByNorm, lanePool);
        list.add(
            new DetectedActivity(
                shortenTitle(seg.replaceAll("\\s+", " ")),
                "Fragmento de la descripción con acción probable.",
                lane,
                "Segmentación textual del enunciado.",
                500 + idx++));
      }
    }

    // Unicidad de nombres sugeridos sin perder contenido textual
    List<DetectedActivity> dedup = new ArrayList<>();
    Set<String> seen = new LinkedHashSet<>();
    for (DetectedActivity da : list) {
      String k = normalize(da.name);
      if (seen.add(k)) dedup.add(da);
      else warnings.add("Actividad duplicada omitida tras normalización: " + da.name);
    }

    return dedup;
  }

  private static String shortenTitle(String s) {
    String t = capitalizeFirstLetter(s.trim());
    return t.length() > 96 ? t.substring(0, 93).trim() + "…" : t;
  }

  private static String tidyTail(String t) {
    if (t == null) return "";
    String x = t.replaceAll(",", " ").replaceAll("\\s+", " ").trim();
    if (x.startsWith("a ")) x = x.substring(2).trim();
    if (x.startsWith("la ")) x = x.substring(3).trim();
    if (x.startsWith("el ")) x = x.substring(3).trim();
    return x;
  }

  private String pickLaneForClause(
      String clause, Map<String, String> laneByNorm, Set<String> lanePool) {
    String n = normalize(clause);
    for (Map.Entry<String, String> e : laneByNorm.entrySet()) {
      if (n.contains(e.getKey())) return e.getValue();
    }
    // round-robin fallback estable
    String[] arr = lanePool.toArray(new String[0]);
    return arr[Math.floorMod(clause.length(), Math.max(1, arr.length))];
  }

  private void extractCapitalizedNames(String raw, Set<String> out) {
    Pattern p = Pattern.compile("\\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\\s+[a-záéíóúñ]{2,}){0,2})\\b");
    Matcher m = p.matcher(raw);
    while (m.find()) {
      String w = m.group(1).trim();
      if (w.length() < 4) continue;
      if (w.toLowerCase(Locale.ROOT).matches("cuando|si|sí|no|y|o|el|la|los|las")) continue;
      out.add(w);
    }
  }

  private static String normalize(String s) {
    String x = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return x.toLowerCase(Locale.ROOT).trim();
  }

  private static String titleCase(String s) {
    String[] p = s.split("\\s+");
    StringBuilder sb = new StringBuilder();
    for (String w : p) {
      if (w.isEmpty()) continue;
      if (sb.length() > 0) sb.append(' ');
      sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1).toLowerCase(Locale.ROOT));
    }
    return sb.toString();
  }

  private static String capitalizeFirst(String s) {
    if (s == null || s.isEmpty()) return s;
    return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase(Locale.ROOT);
  }

  private static String capitalizeFirstLetter(String s) {
    if (s.isEmpty()) return s;
    return s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
  }

  private record DetectedActivity(
      String name, String description, String laneName, String reason, int orderWeight) {}

  /** Si no hubo hints de rol, las calles se nombran con palabras o fragmentos únicos derivados del propio texto. */
  private static void addFallbackLanesDerivedFromDescription(
      String raw, String norm, LinkedHashSet<String> out) {
    String source =
        raw.isBlank() ? norm.replace('-', ' ').trim() : raw.replace('_', ' ').replace('-', ' ');
    Matcher tokens = Pattern.compile("[A-Za-zÁÉÍÓÚÑáéíóúñ]{5,}").matcher(source);
    Map<String, String> uniq = new LinkedHashMap<>();
    Set<String> stop =
        Set.of(
            "cuando",
            "donde",
            "mientras",
            "porque",
            "entonces",
            "deberá",
            "deberán",
            "solicitud",
            "tramite",
            "trámite");

    while (tokens.find() && uniq.size() < 8) {
      String tk = tokens.group().trim();
      String key = normalize(tk);
      if (key.length() < 5 || stop.contains(key)) continue;
      uniq.putIfAbsent(key, titleCase(tk.toLowerCase(Locale.ROOT)));
    }

    List<String> laneList = new ArrayList<>(uniq.values());
    String first;
    String second;

    if (laneList.size() >= 2) {
      first = laneList.get(0);
      second = laneList.get(1);
    } else if (laneList.size() == 1) {
      first = laneList.get(0);
      second = distinctSliceTitle(norm, first);
    } else {
      first = synopsisFromNorm(norm, "");
      second = distinctSliceTitle(norm, first);
      if (normalize(second).equals(normalize(first))) {
        second = synopsisFromNorm(norm + " proceso ampliado", first);
      }
    }

    if (normalize(second).equals(normalize(first))) {
      second = guaranteedDistinctLaneTitle(norm, first);
    }
    out.add(first);
    out.add(second);
  }

  /** Garantiza un segundo nombre de calle observablemente distinto (evita un solo elemento en LinkedHashSet). */
  private static String guaranteedDistinctLaneTitle(String norm, String first) {
    String n1 = normalize(first);
    String salt = "_" + Integer.toHexString(Math.floorMod(norm == null ? 0 : norm.hashCode(), 1 << 16));
    String bumped = trimNorm((norm != null ? norm : "") + salt, 44);
    if (!normalize(bumped).equals(n1)) {
      return titleCase(bumped.replace('-', ' '));
    }
    String tail =
        norm != null && norm.length() > 12 ? trimNorm(norm.substring(norm.length() / 3), 40) : "segmento proceso";
    return titleCase(tail.replace('-', ' '));
  }

  /** Segmento diferente del texto normalizado como título de calle, si distinto de {@code avoidTitle}. */
  private static String distinctSliceTitle(String norm, String avoidTitle) {
    String target = normalize(avoidTitle == null ? "" : avoidTitle);
    if (norm == null || norm.isBlank()) {
      return guaranteedDistinctLaneTitle("", avoidTitle != null ? avoidTitle : "");
    }
    int pivot = norm.length() / 2;
    String cand = trimNorm(pivot > 4 ? norm.substring(pivot) : norm, 40);
    if (cand.isBlank() || normalize(cand).equals(target)) {
      cand = trimNorm(norm, Math.min(48, norm.length()));
    }
    if (normalize(cand).equals(target)) {
      cand =
          pivot + 8 < norm.length()
              ? trimNorm(norm.substring(pivot + 4), 36)
              : trimNorm(norm, 44) + " etapa";
    }
    String out = cand.isBlank() ? "parte proceso" : cand.replace('-', ' ');
    return titleCase(out);
  }

  /** Frase muy corta a partir del texto normalizado. */
  private static String synopsisFromNorm(String norm, String avoidTitleCase) {
    String t = trimNorm(norm, Math.min(48, norm.length()));
    String half =
        norm.length() > 20 ? trimNorm(norm.substring(norm.length() / 3), 32) : t;
    if (!avoidTitleCase.isBlank() && normalize(half).equals(normalize(avoidTitleCase))) {
      half = trimNorm(norm, Math.min(28, norm.length()));
    }
    return titleCase(half.isBlank() ? "flujo proceso" : half);
  }

  private static String trimNorm(String s, int len) {
    if (s == null) return "";
    String x = normalize(s.replace('\n', ' '));
    if (len <= 4) return "";
    return x.length() <= len ? x : x.substring(0, len).trim();
  }
}
