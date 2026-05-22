package com.workflow.system.business.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.system.presentation.dto.ai.AiFormStructuredAutofillRequest;
import com.workflow.system.presentation.dto.ai.AiFormStructuredAutofillResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.Month;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LocalFormNlpAutofillService {

  private static final Pattern RE_ISO = Pattern.compile("\\b(\\d{4}-\\d{2}-\\d{2})\\b");
  private static final Pattern RE_DMY = Pattern.compile("\\b(\\d{1,2})[/-](\\d{1,2})[/-](\\d{4})\\b");
  private static final Pattern RE_NUM = Pattern.compile("(-?\\d+(?:[.,]\\d+)?)");
  private static final Pattern RE_MONTH_SPANISH =
      Pattern.compile(
          "\\bdel\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\\b",
          Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

  public AiFormStructuredAutofillResponse autofill(AiFormStructuredAutofillRequest req) {
    String raw = req.getInputText() == null ? "" : req.getInputText();
    String norm = normalizeTxt(raw);

    LinkedHashMap<String, Object> values = new LinkedHashMap<>();
    LinkedHashMap<String, Double> confidence = new LinkedHashMap<>();
    List<String> warnings = new ArrayList<>();

    JsonNode fieldsNode = req.getForm().path("fields");
    if (!fieldsNode.isArray() || fieldsNode.isEmpty()) {
      warnings.add("El formulario no define campos (fields[]) o está vacío.");
      AiFormStructuredAutofillResponse early = new AiFormStructuredAutofillResponse();
      early.setSuggestedValues(values);
      early.setConfidence(confidence);
      early.setWarnings(warnings);
      return early;
    }

    List<LocalDate> datePool = extractAllDates(norm, raw);
    Map<String, Object> cv = req.getCurrentValues();
    Map<String, Object> currentVals = cv == null ? Map.of() : cv;

    for (JsonNode f : fieldsNode) {
      String fname = f.path("name").asText("");
      if (fname.isBlank()) continue;
      String typ = f.path("type").asText("TEXT").trim().toUpperCase(Locale.ROOT);
      boolean required = f.path("required").asBoolean(false);
      if ("LABEL".equals(typ) || "BUTTON".equals(typ)) continue;

      String lab = normalizeTxt(f.path("label").asText(""));
      String key = normalizeTxt(fname.replace('_', ' '));

      switch (typ) {
        case "TEXT":
          {
            Object v = proposeTextKey(fname, key, lab, raw, norm, currentVals);
            maybePut(fname, values, confidence, v, resolveConf(v, lab, norm));
          }
          break;
        case "TEXTAREA":
          {
            String motivo =
                extractBetween(raw, "(?i)(?:motivo|raz[oó]n)\\s*[\\:]*\\s*([^.;\n\r]{5,420})")
                    .orElse("");
            if (motivo.isBlank())
              motivo = extractSentenceContaining(norm, raw, "famili");
            maybePut(fname, values, confidence, motivo.trim(), motivo.trim().length() > 12 ? 0.76 : null);
          }
          break;
        case "NUMBER":
          {
            BigDecimal bd = guessNumber(norm, warnings, fname);
            maybePut(fname, values, confidence, bd, bd == null ? null : 0.78);
          }
          break;
        case "DATE":
          {
            String ds = proposeDate(fname, key, lab, warnings, norm, raw, datePool);
            maybePut(fname, values, confidence, ds, ds == null ? null : 0.85);
          }
          break;
        case "SELECT":
        case "RADIO":
          {
            List<String> options = jsonOptions(f.path("options"));
            String sel = chooseOption(norm, raw, options, warnings, fname);
            maybePut(fname, values, confidence, sel, sel == null ? null : 0.81);
          }
          break;
        case "BOOLEAN":
          {
            boolean yes =
                Pattern.compile("(?i)\\b(si|sí|aprob|correcto|conform|confirm)\\b").matcher(norm).find();
            boolean no =
                Pattern.compile("(?i)\\b(no\\b|rechaz|negativo)\\b").matcher(norm).find();
            if (yes || no) {
              confidence.put(fname, 0.55);
              values.put(fname, yes && !no);
            }
          }
          break;
        case "USER":
          // La lista de usuarios solo existe en ejecución; no se infiere por texto.
          break;
        default:
          if (required)
            warnings.add(
                "Tipo de campo no cubierto en heurísticas locales: " + typ + " (" + fname + ").");
      }

    }

    warnRequiredUnset(fieldsNode, values, warnings);

    AiFormStructuredAutofillResponse resp = new AiFormStructuredAutofillResponse();
    resp.setSuggestedValues(values);
    resp.setConfidence(confidence);
    resp.setWarnings(warnings);
    return resp;
  }

  private void warnRequiredUnset(JsonNode fieldsNode, Map<String, Object> vals, List<String> warnings) {
    for (JsonNode f : fieldsNode) {
      if (!f.path("required").asBoolean(false)) continue;
      String fname = f.path("name").asText("");
      String lab = f.path("label").asText(fname);
      String typ = f.path("type").asText("TEXT");
      if ("LABEL".equalsIgnoreCase(typ) || "BUTTON".equalsIgnoreCase(typ)) continue;
      if (missing(vals.get(fname))) {
        warnings.add(
            "Campo obligatorio sin sugerencia local confiable para \"" + lab + "\" (" + fname + ")");
      }
    }
  }

  private static boolean missing(Object v) {
    return v == null || (v instanceof String s && s.trim().isEmpty());
  }

  private static Object proposeTextKey(
      String fname,
      String key,
      String lab,
      String raw,
      String norm,
      Map<String, Object> currentVals) {
    Matcher solicitorNameMatcher =
        Pattern.compile(
                "(?i)(?:el\\s+)?(?:solicitante|nombre)\\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,6})\\b")
            .matcher(raw);

    boolean nameField =
        key.contains("nombre")
            || key.contains("solicitant")
            || lab.contains("nombre")
            || lab.contains("titular");

    boolean motivoField = key.contains("motivo") || lab.contains("motivo");

    if (nameField && solicitorNameMatcher.find()) return solicitorNameMatcher.group(1).trim();
    Matcher pn =
        Pattern.compile("(?:^|[.\\s])(([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)")
            .matcher(raw);
    if (nameField && pn.find()) return pn.group(1).trim();

    if (motivoField)
      return extractBetween(raw, "(?i)(motivo(?:s)?|porque|debido a)\\s*[\\:]?\\s*([^.;\n\r]{6,460})").orElse("");
    return "";
  }

  private BigDecimal guessNumber(String norm, List<String> warns, String fname) {
    Matcher m = RE_NUM.matcher(norm.replace(',', '.'));
    if (m.find()) {
      try {
        return new BigDecimal(m.group(1).replace(',', '.')).setScale(6, RoundingMode.HALF_UP);
      } catch (NumberFormatException e) {
        warns.add("Número visible pero ilegible para " + fname + ".");
      }
    }
    return null;
  }

  private String proposeDate(
      String fname,
      String key,
      String lab,
      List<String> warnings,
      String norm,
      String raw,
      List<LocalDate> datePool) {
    int idx = 0;
    if (key.contains("inicio") || lab.contains("inicio")) idx = 0;
    else if (key.contains("fin") || lab.contains("fin")) idx = 1;
    else idx = 0;

    if (datePool.size() > idx) return datePool.get(idx).format(DateTimeFormatter.ISO_LOCAL_DATE);

    Matcher iso = RE_ISO.matcher(raw);
    if (iso.find()) return iso.group(1);

    Matcher dmy = RE_DMY.matcher(raw);
    if (dmy.find()) {
      try {
        int d = Integer.parseInt(dmy.group(1));
        int mo = Integer.parseInt(dmy.group(2));
        int y = Integer.parseInt(dmy.group(3));
        return LocalDate.of(y, mo, d).format(DateTimeFormatter.ISO_LOCAL_DATE);
      } catch (Exception e) {
        warnings.add("Fecha con formato ambiguo para " + fname + ".");
      }
    }
    warnings.add("La IA no encontró fecha suficientemente clara para " + fname + ".");
    return null;
  }

  private List<String> jsonOptions(JsonNode n) {
    List<String> o = new ArrayList<>();
    if (n.isArray()) for (JsonNode x : n) o.add(x.asText());
    return o;
  }

  private static String extractSentenceContaining(String norm, String raw, String token) {
    if (!norm.contains(token)) return "";
    for (String s : raw.split("[\\.;\n\r]"))
      if (normalizeTxt(s).contains(token)) return s.trim();
    return "";
  }

  private List<LocalDate> extractAllDates(String norm, String raw) {
    List<LocalDate> out = new ArrayList<>();
    Matcher iso = RE_ISO.matcher(raw);
    while (iso.find()) {
      try {
        out.add(LocalDate.parse(iso.group(1)));
      } catch (DateTimeParseException ignored) {
      }
    }
    Matcher dm = RE_DMY.matcher(raw);
    while (dm.find()) {
      try {
        int dd = Integer.parseInt(dm.group(1));
        int mm = Integer.parseInt(dm.group(2));
        int yy = Integer.parseInt(dm.group(3));
        out.add(LocalDate.of(yy, mm, dd));
      } catch (Exception ignored) {
      }
    }

    Matcher sp = RE_MONTH_SPANISH.matcher(norm);
    if (sp.find()) {
      int d1 = Integer.parseInt(sp.group(1));
      int d2 = Integer.parseInt(sp.group(2));
      Month mo = spanishMonth(sp.group(3));
      try {
        int y = LocalDate.now().getYear();
        out.add(yearMonthDayClamp(y, mo, d1));
        out.add(yearMonthDayClamp(y, mo, d2));
      } catch (Exception ignored) {
      }
    }

    return out;
  }

  private static Month spanishMonth(String name) {
    if (name == null) return Month.JANUARY;
    return switch (name.toLowerCase(Locale.ROOT)) {
      case "enero" -> Month.JANUARY;
      case "febrero" -> Month.FEBRUARY;
      case "marzo" -> Month.MARCH;
      case "abril" -> Month.APRIL;
      case "mayo" -> Month.MAY;
      case "junio" -> Month.JUNE;
      case "julio" -> Month.JULY;
      case "agosto" -> Month.AUGUST;
      case "septiembre" -> Month.SEPTEMBER;
      case "octubre" -> Month.OCTOBER;
      case "noviembre" -> Month.NOVEMBER;
      case "diciembre" -> Month.DECEMBER;
      default -> Month.MAY;
    };
  }

  private static LocalDate yearMonthDayClamp(int year, Month month, int day) {
    int last = month.length(Year.isLeap(year));
    int dd = Math.min(Math.max(day, 1), last);
    return LocalDate.of(year, month, dd);
  }

  private static Double resolveConf(Object v, String labNorm, String normTxt) {
    if (missing(v)) return null;
    if (!(v instanceof String)) return null;
    String s = (String) v;
    double c = Math.min(0.95, 0.52 + Math.min(s.length(), 240) / 800.0);
    if (!labNorm.isBlank() && normTxt.contains(labNorm)) c += 0.12;
    return BigDecimal.valueOf(c).setScale(2, RoundingMode.HALF_UP).doubleValue();
  }

  private static void maybePut(
      String fname,
      LinkedHashMap<String, Object> values,
      LinkedHashMap<String, Double> confidence,
      Object v,
      Double conf) {
    if (missing(v)) return;
    values.put(fname, v);
    if (conf != null) confidence.put(fname, conf);
  }

  private static java.util.Optional<String> extractBetween(String raw, String rx) {
    Matcher m = Pattern.compile(rx).matcher(raw);
    if (m.find() && m.groupCount() >= 1) return java.util.Optional.of(m.group(1).trim());
    return java.util.Optional.empty();
  }

  private String chooseOption(
      String norm,
      String raw,
      List<String> options,
      List<String> warnings,
      String fname) {
    String best = null;
    double bestScore = -1;
    for (String o : options) {
      if (o.isBlank()) continue;
      String on = normalizeTxt(o);
      double sc = 0;
      for (String tok : on.split("\\s+")) if (tok.length() > 2 && norm.contains(tok)) sc += 0.35;
      if (norm.contains(normalizeTxt(o))) sc += 0.5;
      if (raw.contains(o)) sc += 0.25;
      if (sc > bestScore && sc > 0.4) {
        bestScore = sc;
        best = o;
      }
    }
    if (best == null && !options.isEmpty()) {
      warnings.add("No se pudo relacionar opciones disponibles para el campo " + fname + " con el texto libre.");
    }
    return best;
  }

  private static String normalizeTxt(String s) {
    String x = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return x.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
  }
}
