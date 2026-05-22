package com.workflow.system.business.service;

import com.workflow.system.data.model.ProcessStatus;
import com.workflow.system.data.model.TaskStatus;
import com.workflow.system.data.model.ActivityTask;
import com.workflow.system.data.model.ActivityDiagram;
import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.data.model.User;
import com.workflow.system.data.repository.ActivityTaskRepository;
import com.workflow.system.data.repository.ActivityDiagramRepository;
import com.workflow.system.data.repository.BusinessPolicyRepository;
import com.workflow.system.data.repository.DepartmentRepository;
import com.workflow.system.data.repository.ProcessInstanceRepository;
import com.workflow.system.data.repository.RoleRepository;
import com.workflow.system.data.repository.UserRepository;
import com.workflow.system.presentation.dto.report.BottleneckResponse;
import com.workflow.system.presentation.dto.report.DashboardReportResponse;
import com.workflow.system.presentation.dto.report.MonthlyCountResponse;
import com.workflow.system.presentation.dto.report.RecentItemResponse;
import com.workflow.system.presentation.dto.report.WorkflowActivityDurationDto;
import com.workflow.system.presentation.dto.report.WorkflowBottleneckDto;
import com.workflow.system.presentation.dto.report.WorkflowKpiResponseDto;
import com.workflow.system.presentation.dto.report.WorkflowWorkloadByResponsibleDto;
import java.util.EnumMap;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class ReportService {
  private final ProcessInstanceRepository processRepository;
  private final ActivityTaskRepository taskRepository;
  private final BusinessPolicyRepository policyRepository;
  private final ActivityDiagramRepository diagramRepository;
  private final UserRepository userRepository;
  private final RoleRepository roleRepository;
  private final DepartmentRepository departmentRepository;
  private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

  public DashboardReportResponse dashboard() {
    long totalProcesses = processRepository.count();
    long totalTasks = taskRepository.count();

    Map<ProcessStatus, Long> p = processesByStatus();
    Map<TaskStatus, Long> t = tasksByStatus();

    return DashboardReportResponse.builder()
        .totalProcesses(totalProcesses)
        .processesCreated(p.getOrDefault(ProcessStatus.CREATED, 0L))
        .processesInProgress(p.getOrDefault(ProcessStatus.IN_PROGRESS, 0L))
        .processesCompleted(p.getOrDefault(ProcessStatus.COMPLETED, 0L))
        .processesCancelled(p.getOrDefault(ProcessStatus.CANCELLED, 0L))
        .totalTasks(totalTasks)
        .tasksPending(t.getOrDefault(TaskStatus.PENDING, 0L))
        .tasksInProgress(t.getOrDefault(TaskStatus.IN_PROGRESS, 0L))
        .tasksCompleted(t.getOrDefault(TaskStatus.COMPLETED, 0L))
        .tasksCancelled(t.getOrDefault(TaskStatus.CANCELLED, 0L))
        .build();
  }

  public Map<ProcessStatus, Long> processesByStatus() {
    Map<ProcessStatus, Long> m = new EnumMap<>(ProcessStatus.class);
    for (ProcessStatus s : ProcessStatus.values()) {
      m.put(s, processRepository.countByStatus(s));
    }
    return m;
  }

  public Map<TaskStatus, Long> tasksByStatus() {
    Map<TaskStatus, Long> m = new EnumMap<>(TaskStatus.class);
    for (TaskStatus s : TaskStatus.values()) {
      m.put(s, taskRepository.countByStatus(s));
    }
    return m;
  }

  /** Conteo de trámites por mes (últimos N meses, basado en createdAt). */
  public List<MonthlyCountResponse> processesMonthly(int months) {
    int m = Math.max(1, Math.min(months, 24));
    ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
    ZonedDateTime start = now.minusMonths(m - 1L).withDayOfMonth(1).toLocalDate().atStartOfDay(ZoneOffset.UTC);
    Instant startInstant = start.toInstant();

    Map<String, Long> counts = new HashMap<>();
    processRepository.findAll().stream()
        .filter(p -> p.getCreatedAt() != null && !p.getCreatedAt().isBefore(startInstant))
        .forEach(p -> {
          String key = ZonedDateTime.ofInstant(p.getCreatedAt(), ZoneOffset.UTC).format(MONTH_FMT);
          counts.put(key, counts.getOrDefault(key, 0L) + 1L);
        });

    // Rellenar meses faltantes con 0
    return java.util.stream.IntStream.range(0, m)
        .mapToObj(i -> now.minusMonths(m - 1L - i))
        .map(z -> z.format(MONTH_FMT))
        .map(mon -> MonthlyCountResponse.builder().month(mon).count(counts.getOrDefault(mon, 0L)).build())
        .toList();
  }

  /** Top bottlenecks reales: tareas abiertas agrupadas por activityName con promedio de horas abiertas. */
  public List<BottleneckResponse> bottlenecks(int top) {
    int k = Math.max(1, Math.min(top, 10));
    Instant now = Instant.now();
    List<ActivityTask> open =
        taskRepository.findAll().stream()
            .filter(t -> t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.IN_PROGRESS)
            .toList();

    record Agg(long count, double sumHours) {}
    Map<String, Agg> agg = new HashMap<>();

    for (ActivityTask t : open) {
      String name = (t.getActivityName() == null || t.getActivityName().isBlank()) ? "Sin nombre" : t.getActivityName().trim();
      Instant base = t.getStartedAt() != null ? t.getStartedAt() : (t.getCreatedAt() != null ? t.getCreatedAt() : now);
      double hours = Math.max(0, (now.toEpochMilli() - base.toEpochMilli()) / 3600000.0);
      Agg a = agg.get(name);
      if (a == null) {
        agg.put(name, new Agg(1, hours));
      } else {
        agg.put(name, new Agg(a.count + 1, a.sumHours + hours));
      }
    }

    return agg.entrySet().stream()
        .map(e -> {
          Agg a = e.getValue();
          double avg = a.count == 0 ? 0 : (a.sumHours / a.count);
          return BottleneckResponse.builder()
              .activityName(e.getKey())
              .avgHours(Math.round(avg * 10.0) / 10.0)
              .affectedTasks(a.count)
              .build();
        })
        .sorted(Comparator.comparingDouble(BottleneckResponse::getAvgHours).reversed())
        .limit(k)
        .toList();
  }

  /** Últimos items (procesos/tareas) por updatedAt para alimentar dashboard sin mocks. */
  public List<RecentItemResponse> recent(int limit) {
    int k = Math.max(1, Math.min(limit, 20));
    var policies = policyRepository.findAll();
    Map<String, BusinessPolicy> policyById =
        policies.stream()
            .filter(p -> p.getId() != null)
            .collect(Collectors.toMap(BusinessPolicy::getId, Function.identity(), (a, b) -> a));

    var users = userRepository.findAll();
    Map<String, User> userById =
        users.stream()
            .filter(u -> u.getId() != null)
            .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));

    var recents =
        java.util.stream.Stream.concat(
                processRepository.findAll().stream()
                    .filter(p -> p.getUpdatedAt() != null)
                    .map(
                        p ->
                            {
                              String policyName =
                                  Optional.ofNullable(policyById.get(p.getPolicyId()))
                                      .map(BusinessPolicy::getName)
                                      .filter(n -> !n.isBlank())
                                      .orElse("Política");
                              String requester =
                                  Optional.ofNullable(userById.get(p.getRequestedBy()))
                                      .map(User::getFullName)
                                      .filter(n -> !n.isBlank())
                                      .orElse(p.getRequestedBy() != null ? p.getRequestedBy() : "—");
                              String title = policyName + " · " + requester;
                              return RecentItemResponse.builder()
                                  .type("PROCESS")
                                  .id(p.getId())
                                  .title(title)
                                  .status(String.valueOf(p.getStatus()))
                                  .ts(p.getUpdatedAt())
                                  .build();
                            }),
                taskRepository.findAll().stream()
                    .filter(t -> t.getUpdatedAt() != null)
                    .map(
                        t ->
                            {
                              String policyName =
                                  Optional.ofNullable(policyById.get(t.getPolicyId()))
                                      .map(BusinessPolicy::getName)
                                      .filter(n -> !n.isBlank())
                                      .orElse("Política");
                              String act =
                                  (t.getActivityName() == null || t.getActivityName().isBlank())
                                      ? "Actividad"
                                      : t.getActivityName().trim();
                              String title = act + " · " + policyName;
                              return RecentItemResponse.builder()
                                  .type("TASK")
                                  .id(t.getId())
                                  .title(title)
                                  .status(String.valueOf(t.getStatus()))
                                  .ts(t.getUpdatedAt())
                                  .build();
                            }))
            .sorted(Comparator.comparing(RecentItemResponse::getTs).reversed())
            .limit(k)
            .toList();
    return recents;
  }

  /**
   * KPI/metrics para identificar cuellos de botella.
   *
   * <p>Diseñado para examen: cálculos determinísticos basados en datos reales.
   * No asume dueDate/expectedDuration (no existen en el modelo), por lo tanto usa aging (horas abiertas).
   */
  public WorkflowKpiResponseDto workflowKpis(
      String policyId,
      ProcessStatus status,
      String responsibleId,
      String startDate,
      String endDate) {

    Instant start = parseDateStart(startDate);
    Instant end = parseDateEnd(endDate);

    var policies = policyRepository.findAll();
    Map<String, BusinessPolicy> policyById =
        policies.stream().filter(p -> p.getId() != null).collect(Collectors.toMap(BusinessPolicy::getId, Function.identity(), (a, b) -> a));

    var diagrams = diagramRepository.findAll();
    Map<String, ActivityDiagram> diagramByPolicyId =
        diagrams.stream().filter(d -> d.getPolicyId() != null).collect(Collectors.toMap(ActivityDiagram::getPolicyId, Function.identity(), (a, b) -> a));

    var instances = processRepository.findAll().stream()
        .filter(p -> policyId == null || policyId.isBlank() || Objects.equals(p.getPolicyId(), policyId))
        .filter(p -> status == null || p.getStatus() == status)
        .filter(p -> withinRange(p.getCreatedAt(), start, end))
        .toList();

    var tasks = taskRepository.findAll().stream()
        .filter(t -> policyId == null || policyId.isBlank() || Objects.equals(t.getPolicyId(), policyId))
        .filter(t -> responsibleId == null || responsibleId.isBlank() || matchesResponsible(t, responsibleId))
        .filter(t -> withinRange(t.getCreatedAt(), start, end))
        .toList();

    long totalInstances = instances.size();
    long runningInstances = instances.stream().filter(p -> p.getStatus() == ProcessStatus.IN_PROGRESS || p.getStatus() == ProcessStatus.CREATED).count();
    long completedInstances = instances.stream().filter(p -> p.getStatus() == ProcessStatus.COMPLETED).count();

    long pendingActivities = tasks.stream().filter(t -> t.getStatus() == TaskStatus.PENDING).count();
    long completedActivities = tasks.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();

    // Delayed: determinístico sin dueDate -> consideramos "abierta > 48h" como retrasada.
    Instant now = Instant.now();
    final double delayedHoursThreshold = 48.0;
    long delayedActivities =
        tasks.stream()
            .filter(t -> t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.IN_PROGRESS)
            .filter(t -> hoursBetween(baseOpenInstant(t, now), now) > delayedHoursThreshold)
            .count();

    Double avgProcessHours =
        averageHours(
            instances.stream()
                .filter(p -> p.getStatus() == ProcessStatus.COMPLETED)
                .map(p -> durationHours(p.getStartedAt(), p.getFinishedAt()))
                .filter(Objects::nonNull)
                .toList());

    Double avgActivityHours =
        averageHours(
            tasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.COMPLETED)
                .map(t -> durationHours(t.getStartedAt(), t.getCompletedAt()))
                .filter(Objects::nonNull)
                .toList());

    // Completion rate: % de tareas completadas dentro de 48h desde createdAt (determinístico)
    Double completionRatePct = null;
    var completedDurations =
        tasks.stream()
            .filter(t -> t.getStatus() == TaskStatus.COMPLETED)
            .map(t -> durationHours(t.getCreatedAt(), t.getCompletedAt()))
            .filter(Objects::nonNull)
            .toList();
    if (!completedDurations.isEmpty()) {
      long ok = completedDurations.stream().filter(h -> h <= delayedHoursThreshold).count();
      completionRatePct = round1((ok * 100.0) / completedDurations.size());
    }

    // Workload by responsible
    Map<String, WorkAgg> workAgg = new HashMap<>();
    for (ActivityTask t : tasks) {
      if (!(t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.IN_PROGRESS)) continue;
      String key = responsibleKey(t);
      WorkAgg a = workAgg.getOrDefault(key, new WorkAgg());
      if (t.getStatus() == TaskStatus.PENDING) a.pending++;
      if (t.getStatus() == TaskStatus.IN_PROGRESS) a.inProgress++;
      workAgg.put(key, a);
    }
    List<WorkflowWorkloadByResponsibleDto> workload =
        workAgg.entrySet().stream()
            .map(e -> {
              var ri = parseResponsibleKey(e.getKey());
              var a = e.getValue();
              return WorkflowWorkloadByResponsibleDto.builder()
                  .responsibleType(ri.type)
                  .responsibleId(ri.id)
                  .responsibleName(resolveResponsibleName(ri.type, ri.id))
                  .pendingCount(a.pending)
                  .inProgressCount(a.inProgress)
                  .totalOpen(a.pending + a.inProgress)
                  .build();
            })
            .sorted(Comparator.comparingLong(WorkflowWorkloadByResponsibleDto::getTotalOpen).reversed())
            .limit(10)
            .toList();

    // Activity durations (completed)
    record ActKey(String policyId2, String nodeId, String name) {}
    Map<ActKey, List<Double>> execByAct = new HashMap<>();
    for (ActivityTask t : tasks) {
      if (t.getStatus() != TaskStatus.COMPLETED) continue;
      Double h = durationHours(t.getStartedAt(), t.getCompletedAt());
      if (h == null) continue;
      String pid = t.getPolicyId();
      String nid = t.getActivityNodeId();
      String nm = (t.getActivityName() == null || t.getActivityName().isBlank()) ? "Actividad" : t.getActivityName().trim();
      execByAct.computeIfAbsent(new ActKey(pid, nid, nm), k -> new java.util.ArrayList<>()).add(h);
    }
    List<WorkflowActivityDurationDto> activityDurations =
        execByAct.entrySet().stream()
            .map(e -> {
              ActKey k = e.getKey();
              var list = e.getValue();
              Double avg = averageHours(list);
              BusinessPolicy p = k.policyId2 == null ? null : policyById.get(k.policyId2);
              return WorkflowActivityDurationDto.builder()
                  .policyId(k.policyId2)
                  .policyName(p != null ? p.getName() : null)
                  .activityNodeId(k.nodeId)
                  .activityName(k.name)
                  .avgExecutionHours(avg)
                  .completedCount(list == null ? 0 : list.size())
                  .build();
            })
            .sorted(Comparator.comparingDouble((WorkflowActivityDurationDto x) -> x.getAvgExecutionHours() == null ? -1 : x.getAvgExecutionHours()).reversed())
            .limit(20)
            .toList();

    // Bottlenecks: group by (policyId, activityNodeId)
    Map<String, BottAgg> bn = new HashMap<>();
    for (ActivityTask t : tasks) {
      String pid = t.getPolicyId() == null ? "" : t.getPolicyId();
      String nid = t.getActivityNodeId() == null ? "" : t.getActivityNodeId();
      String k = pid + "||" + nid;
      BottAgg a = bn.getOrDefault(k, new BottAgg());
      if (t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.IN_PROGRESS) {
        a.pending++;
        double openH = hoursBetween(baseOpenInstant(t, now), now);
        a.sumWaitHours += openH; // usamos "waiting" como aging para abiertas
        if (openH > delayedHoursThreshold) a.delayed++;
      }
      if (t.getStatus() == TaskStatus.COMPLETED) {
        a.completed++;
        Double exec = durationHours(t.getStartedAt(), t.getCompletedAt());
        if (exec != null) a.sumExecHours += exec;
      }
      // tomar un ejemplo para nombres/responsable
      if (a.sample == null) a.sample = t;
      bn.put(k, a);
    }

    List<WorkflowBottleneckDto> bottlenecks =
        bn.values().stream()
            .map(a -> buildBottleneckDto(a, policyById, diagramByPolicyId, delayedHoursThreshold))
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingDouble(WorkflowBottleneckDto::getBottleneckScore).reversed())
            .limit(15)
            .toList();

    WorkflowBottleneckDto worst = bottlenecks.isEmpty() ? null : bottlenecks.get(0);

    return WorkflowKpiResponseDto.builder()
        .totalInstances(totalInstances)
        .runningInstances(runningInstances)
        .completedInstances(completedInstances)
        .pendingActivities(pendingActivities)
        .completedActivities(completedActivities)
        .delayedActivities(delayedActivities)
        .averageProcessDurationHours(avgProcessHours)
        .averageActivityDurationHours(avgActivityHours)
        .completionRatePct(completionRatePct)
        .worstBottleneck(worst)
        .bottlenecks(bottlenecks)
        .workloadByResponsible(workload)
        .activityDurations(activityDurations)
        .build();
  }

  private static boolean withinRange(Instant ts, Instant start, Instant end) {
    if (ts == null) return true;
    if (start != null && ts.isBefore(start)) return false;
    if (end != null && ts.isAfter(end)) return false;
    return true;
  }

  private static Instant parseDateStart(String raw) {
    if (raw == null || raw.isBlank()) return null;
    try {
      return LocalDate.parse(raw.trim()).atStartOfDay(ZoneOffset.UTC).toInstant();
    } catch (DateTimeParseException ignored) {
      return null;
    }
  }

  private static Instant parseDateEnd(String raw) {
    if (raw == null || raw.isBlank()) return null;
    try {
      // fin de día inclusivo
      return LocalDate.parse(raw.trim()).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().minusMillis(1);
    } catch (DateTimeParseException ignored) {
      return null;
    }
  }

  private static Instant baseOpenInstant(ActivityTask t, Instant fallback) {
    if (t.getStartedAt() != null) return t.getStartedAt();
    if (t.getCreatedAt() != null) return t.getCreatedAt();
    return fallback;
  }

  private static Double durationHours(Instant a, Instant b) {
    if (a == null || b == null) return null;
    long ms = b.toEpochMilli() - a.toEpochMilli();
    if (ms < 0) return null;
    return ms / 3600000.0;
  }

  private static double hoursBetween(Instant a, Instant b) {
    if (a == null || b == null) return 0.0;
    long ms = b.toEpochMilli() - a.toEpochMilli();
    return Math.max(0.0, ms / 3600000.0);
  }

  private static Double averageHours(List<Double> xs) {
    if (xs == null || xs.isEmpty()) return null;
    double s = 0.0;
    int n = 0;
    for (Double x : xs) {
      if (x == null) continue;
      s += x;
      n++;
    }
    if (n == 0) return null;
    return round1(s / n);
  }

  private static Double round1(double v) {
    return Math.round(v * 10.0) / 10.0;
  }

  private static boolean matchesResponsible(ActivityTask t, String responsibleId) {
    String rid = responsibleId.trim();
    if (rid.isEmpty()) return true;
    return rid.equals(t.getAssignedToUserId()) || rid.equals(t.getAssignedRoleId()) || rid.equals(t.getAssignedDepartmentId());
  }

  private static String responsibleKey(ActivityTask t) {
    if (t.getAssignedToUserId() != null && !t.getAssignedToUserId().isBlank()) return "USER:" + t.getAssignedToUserId();
    if (t.getAssignedRoleId() != null && !t.getAssignedRoleId().isBlank()) return "ROLE:" + t.getAssignedRoleId();
    if (t.getAssignedDepartmentId() != null && !t.getAssignedDepartmentId().isBlank()) return "DEPARTMENT:" + t.getAssignedDepartmentId();
    return "UNASSIGNED:";
  }

  private record ResponsibleInfo(String type, String id) {}

  private static ResponsibleInfo parseResponsibleKey(String key) {
    if (key == null) return new ResponsibleInfo("UNASSIGNED", "");
    int i = key.indexOf(':');
    if (i < 0) return new ResponsibleInfo("UNASSIGNED", "");
    String t = key.substring(0, i);
    String id = key.substring(i + 1);
    return new ResponsibleInfo(t, id);
  }

  private String resolveResponsibleName(String type, String id) {
    if (type == null) return "Sin asignar";
    String t = type.trim().toUpperCase();
    if (t.equals("USER")) {
      return userRepository.findById(id).map(u -> u.getFullName() == null ? id : u.getFullName()).orElse(id);
    }
    if (t.equals("ROLE")) {
      return roleRepository.findById(id).map(r -> r.getName() == null ? id : r.getName()).orElse(id);
    }
    if (t.equals("DEPARTMENT")) {
      return departmentRepository.findById(id).map(d -> d.getName() == null ? id : d.getName()).orElse(id);
    }
    return "Sin asignar";
  }

  private WorkflowBottleneckDto buildBottleneckDto(
      BottAgg a,
      Map<String, BusinessPolicy> policyById,
      Map<String, ActivityDiagram> diagramByPolicyId,
      double delayedHoursThreshold) {
    ActivityTask t = a.sample;
    if (t == null) return null;
    String pid = t.getPolicyId();
    BusinessPolicy p = pid == null ? null : policyById.get(pid);
    String policyName = p != null ? p.getName() : null;
    String nodeId = t.getActivityNodeId();
    String activityName = (t.getActivityName() == null || t.getActivityName().isBlank()) ? "Actividad" : t.getActivityName().trim();

    String responsibleType = null;
    String responsibleId = null;
    if (t.getAssignedToUserId() != null && !t.getAssignedToUserId().isBlank()) {
      responsibleType = "USER";
      responsibleId = t.getAssignedToUserId();
    } else if (t.getAssignedRoleId() != null && !t.getAssignedRoleId().isBlank()) {
      responsibleType = "ROLE";
      responsibleId = t.getAssignedRoleId();
    } else if (t.getAssignedDepartmentId() != null && !t.getAssignedDepartmentId().isBlank()) {
      responsibleType = "DEPARTMENT";
      responsibleId = t.getAssignedDepartmentId();
    } else {
      responsibleType = "UNASSIGNED";
      responsibleId = "";
    }

    String responsibleName = resolveResponsibleName(responsibleType, responsibleId);

    String laneName = null;
    ActivityDiagram d = pid == null ? null : diagramByPolicyId.get(pid);
    if (d != null && nodeId != null && d.getNodes() != null) {
      Optional<ActivityDiagram.DiagramNode> n =
          d.getNodes().stream().filter(x -> nodeId.equals(x.getId())).findFirst();
      if (n.isPresent()) {
        String slId = n.get().getSwimlaneId();
        if (slId != null && d.getSwimlanes() != null) {
          laneName =
              d.getSwimlanes().stream().filter(s -> slId.equals(s.getId())).map(ActivityDiagram.Swimlane::getName).findFirst().orElse(null);
        }
      }
    }

    Double avgWait = a.pending == 0 ? null : round1(a.sumWaitHours / a.pending);
    Double avgExec = a.completed == 0 ? null : round1(a.sumExecHours / a.completed);

    // Score determinístico y defendible:
    // - pendientes pesan mucho (x3)
    // - retrasos pesan mucho (x4)
    // - waiting promedio suma lineal
    // - execution promedio suma suave
    double score = (a.pending * 3.0) + (a.delayed * 4.0) + (avgWait == null ? 0.0 : avgWait) + (avgExec == null ? 0.0 : (avgExec * 0.5));
    String crit;
    if (score >= 30 || a.pending >= 8 || (avgWait != null && avgWait >= delayedHoursThreshold)) crit = "ALTO";
    else if (score >= 15 || a.pending >= 4) crit = "MEDIO";
    else crit = "BAJO";

    return WorkflowBottleneckDto.builder()
        .policyId(pid)
        .policyName(policyName)
        .activityNodeId(nodeId)
        .activityName(activityName)
        .responsibleType(responsibleType)
        .responsibleId(responsibleId)
        .responsibleName(responsibleName)
        .laneName(laneName)
        .pendingCount(a.pending)
        .completedCount(a.completed)
        .delayedCount(a.delayed)
        .averageWaitingTimeHours(avgWait)
        .averageExecutionTimeHours(avgExec)
        .bottleneckScore(round1(score))
        .criticality(crit)
        .build();
  }

  private static class WorkAgg {
    long pending = 0;
    long inProgress = 0;
  }

  private static class BottAgg {
    long pending = 0;
    long completed = 0;
    long delayed = 0;
    double sumWaitHours = 0.0;
    double sumExecHours = 0.0;
    ActivityTask sample = null;
  }
}

