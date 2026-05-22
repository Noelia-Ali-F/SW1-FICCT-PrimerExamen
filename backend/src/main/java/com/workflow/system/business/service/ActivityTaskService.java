package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.ActivityTaskMapper;
import com.workflow.system.data.model.ActivityTask;
import com.workflow.system.data.model.User;
import com.workflow.system.data.model.HistoryAction;
import com.workflow.system.data.model.NotificationType;
import com.workflow.system.data.model.TaskStatus;
import com.workflow.system.data.repository.ActivityTaskRepository;
import com.workflow.system.data.repository.UserRepository;
import com.workflow.system.presentation.dto.task.ActivityTaskResponse;
import com.workflow.system.presentation.dto.task.CompleteTaskRequest;
import com.workflow.system.presentation.dto.task.StartTaskRequest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ActivityTaskService {
  /** Misma semántica que {@link com.workflow.system.config.SecurityConfig}: si falta la propiedad, se asume dev abierto. */
  @Value("${app.security.enabled:false}")
  private boolean securityEnabled;

  /** Si true, lista vacía por filtro de usuario implica fallback global (además de securityEnabled=false). */
  @Value("${app.tasks.lenient-my-tasks:true}")
  private boolean lenientMyTasks;

  private final ActivityTaskRepository taskRepository;
  private final ActivityTaskMapper mapper;
  private final WorkflowEngineService engineService;
  private final ProcessHistoryService historyService;
  private final UserRepository userRepository;
  private final WorkflowEventsPublisher eventsPublisher;
  private final NotificationService notificationService;

  public ActivityTaskService(
      ActivityTaskRepository taskRepository,
      ActivityTaskMapper mapper,
      WorkflowEngineService engineService,
      ProcessHistoryService historyService,
      UserRepository userRepository,
      WorkflowEventsPublisher eventsPublisher,
      NotificationService notificationService) {
    this.taskRepository = taskRepository;
    this.mapper = mapper;
    this.engineService = engineService;
    this.historyService = historyService;
    this.userRepository = userRepository;
    this.eventsPublisher = eventsPublisher;
    this.notificationService = notificationService;
  }

  public List<ActivityTaskResponse> list() {
    return taskRepository.findAll().stream().map(mapper::toResponse).toList();
  }

  public ActivityTaskResponse getById(String id) {
    return mapper.toResponse(getEntity(id));
  }

  @SuppressWarnings("null")
  public List<ActivityTaskResponse> listMyTasks(String userId) {
    Optional<User> optUser = userRepository.findById(userId);
    if (optUser.isEmpty()) {
      if (securityEnabled && !lenientMyTasks) {
        throw new BusinessRuleException("userId no existe");
      }
      // Demo/clase: id inválido o huérfano de localStorage → no romper la pantalla; mostrar cola global.
      return lenientGlobalTaskResponses();
    }

    var u = optUser.get();
    List<ActivityTask> res = new ArrayList<>();
    res.addAll(taskRepository.findByAssignedToUserId(userId));
    if (u.getRoleId() != null && !u.getRoleId().isBlank()) {
      res.addAll(taskRepository.findByAssignedRoleId(u.getRoleId()));
    }
    if (u.getDepartmentId() != null && !u.getDepartmentId().isBlank()) {
      res.addAll(taskRepository.findByAssignedDepartmentId(u.getDepartmentId()));
    }

    List<ActivityTaskResponse> mapped =
        res.stream()
            .collect(Collectors.toMap(ActivityTask::getId, Function.identity(), (a, b) -> a))
            .values()
            .stream()
            .map(mapper::toResponse)
            .toList();

    if (!mapped.isEmpty()) {
      return mapped;
    }
    if (securityEnabled && !lenientMyTasks) {
      return mapped;
    }

    return lenientGlobalTaskResponses();
  }

  /**
   * Cuando no hay coincidencia por usuario/rol/depto (o usuario desconocido en modo tolerante): muestra tareas del
   * sistema para que «Mis actividades» no quede vacío en demo/UAT.
   */
  private List<ActivityTaskResponse> lenientGlobalTaskResponses() {
    Comparator<ActivityTask> byCreatedDesc =
        Comparator.comparing(ActivityTask::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));

    List<ActivityTaskResponse> open =
        taskRepository.findAll().stream()
            .filter(t -> t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.IN_PROGRESS)
            .sorted(byCreatedDesc)
            .limit(40)
            .map(mapper::toResponse)
            .toList();
    if (!open.isEmpty()) {
      return open;
    }

    Comparator<ActivityTask> byUpdatedThenCreated =
        Comparator.comparing(ActivityTask::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(ActivityTask::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));

    return taskRepository.findAll().stream()
        .sorted(byUpdatedThenCreated)
        .limit(40)
        .map(mapper::toResponse)
        .toList();
  }

  public ActivityTaskResponse start(String id, StartTaskRequest req) {
    ActivityTask t = getEntity(id);
    if (t.getStatus() != TaskStatus.PENDING) {
      throw new BusinessRuleException("Solo se puede iniciar una tarea PENDING");
    }
    TaskStatus prev = t.getStatus();
    t.setStatus(TaskStatus.IN_PROGRESS);
    t.setStartedAt(Instant.now());
    ActivityTask saved = taskRepository.save(t);

    String dest = saved.getAssignedToUserId();
    if (dest == null || dest.isBlank()) {
      dest = null;
    }
    notificationService.createNotification(
        dest,
        "Tarea iniciada",
        String.format("La actividad «%s» pasó a en curso.", saved.getActivityName()),
        NotificationType.TASK_STARTED,
        "TASK",
        saved.getId());

    historyService.add(
        saved.getProcessInstanceId(),
        saved.getPolicyId(),
        saved.getActivityNodeId(),
        HistoryAction.TASK_STARTED,
        req.getUserId(),
        prev.name(),
        TaskStatus.IN_PROGRESS.name(),
        "Tarea iniciada");

    eventsPublisher.publish(
        "TASK_STARTED",
        Map.of(
            "taskId", saved.getId(),
            "processInstanceId", saved.getProcessInstanceId(),
            "policyId", saved.getPolicyId(),
            "status", saved.getStatus().name()));

    return mapper.toResponse(saved);
  }

  public ActivityTaskResponse complete(String id, CompleteTaskRequest req) {
    engineService.completeTaskAndAdvance(id, req);
    eventsPublisher.publish(
        "TASK_COMPLETED",
        Map.of("taskId", id, "userId", req.getUserId(), "transitionConditionResult", req.getTransitionConditionResult()));
    return mapper.toResponse(getEntity(id));
  }

  @SuppressWarnings("null")
  private ActivityTask getEntity(String id) {
    return taskRepository
        .findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Tarea no encontrada"));
  }
}
