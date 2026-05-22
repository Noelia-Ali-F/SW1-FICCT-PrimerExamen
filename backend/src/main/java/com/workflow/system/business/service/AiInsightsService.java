package com.workflow.system.business.service;

import com.workflow.system.data.model.ActivityTask;
import com.workflow.system.data.model.ProcessStatus;
import com.workflow.system.data.model.TaskStatus;
import com.workflow.system.data.repository.ActivityTaskRepository;
import com.workflow.system.data.repository.ProcessInstanceRepository;
import com.workflow.system.presentation.dto.ai.BottleneckInsight;
import com.workflow.system.presentation.dto.ai.InsightSeverity;
import com.workflow.system.presentation.dto.ai.ProcessInsightsResponse;
import com.workflow.system.presentation.dto.ai.Recommendation;
import com.workflow.system.presentation.dto.ai.RecommendationPriority;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AiInsightsService {

  private static final int VARIAS_TAREAS = 3;

  private final ProcessInstanceRepository processInstanceRepository;
  private final ActivityTaskRepository taskRepository;

  public ProcessInsightsResponse getProcessInsights() {
    long totalProcesses = processInstanceRepository.count();
    long totalTasks = taskRepository.count();
    long pendingTasks = taskRepository.countByStatus(TaskStatus.PENDING);
    long inProgressTasks = taskRepository.countByStatus(TaskStatus.IN_PROGRESS);
    long completedTasks = taskRepository.countByStatus(TaskStatus.COMPLETED);
    long cancelledTasks = taskRepository.countByStatus(TaskStatus.CANCELLED);
    long processesInProgress =
        processInstanceRepository.countByStatus(ProcessStatus.IN_PROGRESS);

    List<BottleneckInsight> bottlenecks = new ArrayList<>();
    List<Recommendation> recommendations = new ArrayList<>();

    if (totalProcesses == 0 && totalTasks == 0) {
      return ProcessInsightsResponse.builder()
          .totalProcesses(0)
          .totalTasks(0)
          .pendingTasks(0)
          .inProgressTasks(0)
          .completedTasks(0)
          .cancelledTasks(0)
          .bottlenecks(List.of())
          .recommendations(List.of())
          .summary(
              "No existen datos suficientes para detectar cuellos de botella ni generar recomendaciones.")
          .build();
    }

    List<ActivityTask> pendingList = taskRepository.findByStatus(TaskStatus.PENDING);

    if (pendingTasks > 0) {
      bottlenecks.add(
          BottleneckInsight.builder()
              .title("Tareas pendientes en cola")
              .description(
                  "Existen tareas en estado PENDING que pueden retrasar el avance del flujo hasta ser atendidas.")
              .severity(severityForVolume(pendingTasks))
              .relatedActivityName(null)
              .relatedUserId(null)
              .relatedRoleId(null)
              .relatedDepartmentId(null)
              .count(pendingTasks)
              .recommendation(
                  "Priorizar la atención de tareas pendientes y revisar swimlanes o asignaciones.")
              .build());
    }

    if (inProgressTasks > 0) {
      recommendations.add(
          Recommendation.builder()
              .title("Actividades en ejecución")
              .description(
                  "Hay tareas en IN_PROGRESS; conviene vigilar tiempos de respuesta y posibles bloqueos operativos.")
              .priority(priorityForVolume(inProgressTasks))
              .suggestedAction(
                  "Revisar actividades en ejecución prolongada y ofrecer soporte a quien las ejecuta.")
              .build());
    }

    Map<String, Long> pendingByUser = new HashMap<>();
    Map<String, Long> pendingByActivity = new HashMap<>();
    for (ActivityTask t : pendingList) {
      if (t.getAssignedToUserId() != null && !t.getAssignedToUserId().isBlank()) {
        String uid = t.getAssignedToUserId();
        pendingByUser.merge(uid, 1L, (a, b) -> (a == null ? 0L : a) + (b == null ? 0L : b));
      }
      String actName =
          t.getActivityName() == null || t.getActivityName().isBlank()
              ? "Sin nombre"
              : t.getActivityName().trim();
      pendingByActivity.merge(actName, 1L, (a, b) -> (a == null ? 0L : a) + (b == null ? 0L : b));
    }

    for (Map.Entry<String, Long> e : pendingByUser.entrySet()) {
      if (e.getValue() >= VARIAS_TAREAS) {
        recommendations.add(
            Recommendation.builder()
                .title("Carga concentrada en un usuario")
                .description(
                    String.format(
                        "El usuario %s acumula %d tareas pendientes, lo que puede convertirse en cuello de botella humano.",
                        e.getKey(), e.getValue()))
                .priority(e.getValue() >= 6 ? RecommendationPriority.HIGH : RecommendationPriority.MEDIUM)
                .suggestedAction(
                    "Redistribuir parte de la carga, delegar o replanificar según roles y departamentos.")
                .build());
      }
    }

    for (Map.Entry<String, Long> e : pendingByActivity.entrySet()) {
      if (e.getValue() >= VARIAS_TAREAS) {
        bottlenecks.add(
            BottleneckInsight.builder()
                .title("Actividad con muchas tareas pendientes")
                .description(
                    String.format(
                        "La actividad «%s» aparece %d veces en PENDING; puede indicar sobrecarga del paso o del responsable.",
                        e.getKey(), e.getValue()))
                .severity(e.getValue() >= 6 ? InsightSeverity.HIGH : InsightSeverity.MEDIUM)
                .relatedActivityName(e.getKey())
                .relatedUserId(null)
                .relatedRoleId(null)
                .relatedDepartmentId(null)
                .count(e.getValue())
                .recommendation(
                    "Revisar el responsable (usuario, rol o departamento) o dividir la actividad en subtareas más pequeñas.")
                .build());
      }
    }

    if (processesInProgress > 0) {
      recommendations.add(
          Recommendation.builder()
              .title("Trámites activos")
              .description(
                  String.format(
                      "Hay %d trámite(s) en IN_PROGRESS; el volumen activo requiere seguimiento continuo.",
                      processesInProgress))
              .priority(
                  processesInProgress >= 5 ? RecommendationPriority.HIGH : RecommendationPriority.MEDIUM)
              .suggestedAction(
                  "Implementar o reforzar el monitoreo de procesos activos (tablero, alertas o revisiones periódicas).")
              .build());
    }

    String summary = buildSummary(pendingTasks, inProgressTasks, processesInProgress, bottlenecks.size());

    return ProcessInsightsResponse.builder()
        .totalProcesses(totalProcesses)
        .totalTasks(totalTasks)
        .pendingTasks(pendingTasks)
        .inProgressTasks(inProgressTasks)
        .completedTasks(completedTasks)
        .cancelledTasks(cancelledTasks)
        .bottlenecks(bottlenecks)
        .recommendations(recommendations)
        .summary(summary)
        .build();
  }

  private static InsightSeverity severityForVolume(long n) {
    if (n >= 15) {
      return InsightSeverity.HIGH;
    }
    if (n >= 5) {
      return InsightSeverity.MEDIUM;
    }
    return InsightSeverity.LOW;
  }

  private static RecommendationPriority priorityForVolume(long n) {
    if (n >= 10) {
      return RecommendationPriority.HIGH;
    }
    if (n >= 4) {
      return RecommendationPriority.MEDIUM;
    }
    return RecommendationPriority.LOW;
  }

  private static String buildSummary(
      long pendingTasks,
      long inProgressTasks,
      long processesInProgress,
      int bottleneckCount) {
    StringBuilder sb = new StringBuilder();
    sb.append("Análisis heurístico (MVP, sin modelo externo): ");
    if (bottleneckCount == 0 && pendingTasks == 0) {
      sb.append("no se detectaron cuellos de botella por tareas pendientes.");
    } else {
      sb.append(String.format("se identificaron %d foco(s) de posible cuello de botella. ", bottleneckCount));
    }
    sb.append(
        String.format(
            "Tareas pendientes: %d; en progreso: %d. Trámites en curso: %d.",
            pendingTasks, inProgressTasks, processesInProgress));
    return sb.toString();
  }
}
