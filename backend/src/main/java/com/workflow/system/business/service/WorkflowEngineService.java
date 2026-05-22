package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.data.model.ActivityDiagram;
import com.workflow.system.data.model.ActivityTask;
import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.data.model.DynamicForm;
import com.workflow.system.data.model.FormFieldType;
import com.workflow.system.data.model.HistoryAction;
import com.workflow.system.data.model.NodeType;
import com.workflow.system.data.model.PolicyStatus;
import com.workflow.system.data.model.NotificationType;
import com.workflow.system.data.model.ProcessInstance;
import com.workflow.system.data.model.ProcessStatus;
import com.workflow.system.data.model.ResponsibleType;
import com.workflow.system.data.model.TaskStatus;
import com.workflow.system.data.model.User;
import com.workflow.system.data.repository.ActivityDiagramRepository;
import com.workflow.system.data.repository.ActivityTaskRepository;
import com.workflow.system.data.repository.BusinessPolicyRepository;
import com.workflow.system.data.repository.DynamicFormRepository;
import com.workflow.system.data.repository.ProcessInstanceRepository;
import com.workflow.system.data.repository.UserRepository;
import com.workflow.system.presentation.dto.configuration.ConfigurationValidationResponse;
import com.workflow.system.presentation.dto.task.CompleteTaskRequest;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class WorkflowEngineService {

  private final BusinessPolicyRepository policyRepository;
  private final ActivityDiagramRepository diagramRepository;
  private final ProcessInstanceRepository processRepository;
  private final ActivityTaskRepository taskRepository;
  private final UserRepository userRepository;
  private final DynamicFormRepository dynamicFormRepository;
  private final DiagramConfigurationService configurationService;
  private final ProcessHistoryService historyService;
  private final WorkflowEventsPublisher eventsPublisher;
  private final NotificationService notificationService;

  public WorkflowEngineService(
      BusinessPolicyRepository policyRepository,
      ActivityDiagramRepository diagramRepository,
      ProcessInstanceRepository processRepository,
      ActivityTaskRepository taskRepository,
      UserRepository userRepository,
      DynamicFormRepository dynamicFormRepository,
      DiagramConfigurationService configurationService,
      ProcessHistoryService historyService,
      WorkflowEventsPublisher eventsPublisher,
      NotificationService notificationService) {
    this.policyRepository = policyRepository;
    this.diagramRepository = diagramRepository;
    this.processRepository = processRepository;
    this.taskRepository = taskRepository;
    this.userRepository = userRepository;
    this.dynamicFormRepository = dynamicFormRepository;
    this.configurationService = configurationService;
    this.historyService = historyService;
    this.eventsPublisher = eventsPublisher;
    this.notificationService = notificationService;
  }

  public void startProcess(String policyId, String processInstanceId) {
    BusinessPolicy policy = getActivePolicy(policyId);

    ConfigurationValidationResponse validation = configurationService.validateConfiguration(policyId);
    if (!validation.isValid()) {
      throw new BusinessRuleException("No se puede iniciar trámite: configuración inválida");
    }

    ActivityDiagram diagram = getDiagram(policyId);
    Map<String, ActivityDiagram.DiagramNode> nodesById = diagramNodesById(diagram);

    ActivityDiagram.DiagramNode startNode =
        diagram.getNodes() == null
            ? null
            : diagram.getNodes().stream()
                .filter(n -> n.getType() == NodeType.START)
                .findFirst()
                .orElse(null);
    if (startNode == null) {
      throw new BusinessRuleException("Diagrama inválido: no existe nodo START");
    }

    ActivityDiagram.DiagramNode firstActivity =
        advanceFrom(startNode, diagram, nodesById, null);
    if (firstActivity == null || firstActivity.getType() != NodeType.ACTIVITY) {
      throw new BusinessRuleException("No se pudo encontrar la primera actividad ejecutable");
    }

    ProcessInstance processInstance = getProcess(processInstanceId);
    if (processInstance.getStatus() != ProcessStatus.CREATED) {
      throw new BusinessRuleException("El trámite ya fue iniciado");
    }

    ActivityTask task = createTaskForActivity(processInstance, policy, diagram, firstActivity);
    processInstance.setStatus(ProcessStatus.IN_PROGRESS);
    processInstance.setCurrentNodeIds(List.of(firstActivity.getId()));
    if (processInstance.getStartedAt() == null) {
      processInstance.setStartedAt(Instant.now());
    }
    processRepository.save(processInstance);

    historyService.add(
        processInstance.getId(),
        processInstance.getPolicyId(),
        null,
        HistoryAction.PROCESS_CREATED,
        processInstance.getRequestedBy(),
        ProcessStatus.CREATED.name(),
        ProcessStatus.IN_PROGRESS.name(),
        "Proceso creado");
    historyService.add(
        processInstance.getId(),
        processInstance.getPolicyId(),
        task.getActivityNodeId(),
        HistoryAction.TASK_CREATED,
        processInstance.getRequestedBy(),
        null,
        TaskStatus.PENDING.name(),
        "Tarea creada");

    eventsPublisher.publish(
        "PROCESS_CREATED",
        Map.of(
            "processInstanceId",
            processInstance.getId(),
            "policyId",
            processInstance.getPolicyId(),
            "status",
            processInstance.getStatus().name()));
    eventsPublisher.publish(
        "TASK_CREATED",
        Map.of(
            "taskId",
            task.getId(),
            "processInstanceId",
            task.getProcessInstanceId(),
            "policyId",
            task.getPolicyId(),
            "status",
            task.getStatus().name()));
  }

  public ActivityTask createTaskForActivity(
      ProcessInstance processInstance,
      BusinessPolicy policy,
      ActivityDiagram diagram,
      ActivityDiagram.DiagramNode node) {
    ActivityTask built = buildTaskEntityForActivity(processInstance, policy, diagram, node);
    ActivityTask savedTask = taskRepository.save(built);
    notifyTaskAssigned(savedTask, processInstance);
    return savedTask;
  }

  /**
   * Construye la entidad de tarea según el carril del diagrama (sin persistir ni notificar).
   */
  private ActivityTask buildTaskEntityForActivity(
      ProcessInstance processInstance,
      BusinessPolicy policy,
      ActivityDiagram diagram,
      ActivityDiagram.DiagramNode node) {
    if (node.getType() != NodeType.ACTIVITY) {
      throw new BusinessRuleException("Solo se pueden crear tareas para nodos ACTIVITY");
    }
    ActivityDiagram.Swimlane swimlane = swimlaneForNode(diagram, node);
    if (swimlane == null) {
      throw new BusinessRuleException("ACTIVITY sin swimlane válido");
    }

    ActivityTask.ActivityTaskBuilder builder =
        ActivityTask.builder()
            .processInstanceId(processInstance.getId())
            .policyId(policy.getId())
            .activityNodeId(node.getId())
            .activityName(
                node.getName() == null || node.getName().isBlank()
                    ? node.getId()
                    : node.getName().trim())
            .status(TaskStatus.PENDING);

    if (swimlane.getResponsibleType() == ResponsibleType.USER) {
      builder.assignedToUserId(swimlane.getResponsibleId());
    } else if (swimlane.getResponsibleType() == ResponsibleType.ROLE) {
      builder.assignedRoleId(swimlane.getResponsibleId());
    } else if (swimlane.getResponsibleType() == ResponsibleType.DEPARTMENT) {
      builder.assignedDepartmentId(swimlane.getResponsibleId());
    }

    return builder.build();
  }

  /**
   * Si el CU4 de la actividad completada define un campo USER con {@code assignsNextTask}, el valor enviado en
   * {@code formData} asigna la nueva tarea a ese usuario (sustituye la asignación por carril).
   */
  private void applyNextActivityAssigneeFromForm(
      ActivityTask newTask, ActivityTask completedTask, Map<String, Object> formData) {
    if (formData == null || formData.isEmpty()) {
      return;
    }
    Optional<DynamicForm> formOpt =
        dynamicFormRepository.findByPolicyIdAndActivityNodeId(
            completedTask.getPolicyId(), completedTask.getActivityNodeId());
    if (formOpt.isEmpty()) {
      return;
    }
    DynamicForm form = formOpt.get();
    if (form.getFields() == null || form.getFields().isEmpty()) {
      return;
    }
    List<DynamicForm.FormField> sorted =
        form.getFields().stream()
            .sorted(
                Comparator.comparingInt(
                    f -> f.getOrder() == null ? Integer.MAX_VALUE : f.getOrder()))
            .toList();
    for (DynamicForm.FormField field : sorted) {
      if (field.getType() != FormFieldType.USER || !Boolean.TRUE.equals(field.getAssignsNextTask())) {
        continue;
      }
      String key = field.getName();
      if (key == null || key.isBlank()) {
        continue;
      }
      Object raw = formData.get(key);
      if (raw == null) {
        continue;
      }
      String uid = String.valueOf(raw).trim();
      if (uid.isEmpty()) {
        continue;
      }
      userRepository
          .findById(uid)
          .orElseThrow(
              () ->
                  new BusinessRuleException(
                      "El usuario elegido para asignar la siguiente actividad no existe: " + uid));
      newTask.setAssignedToUserId(uid);
      newTask.setAssignedRoleId(null);
      newTask.setAssignedDepartmentId(null);
      return;
    }
  }

  public void completeTaskAndAdvance(String taskId, CompleteTaskRequest req) {
    ActivityTask task = getTask(taskId);
    ProcessInstance processInstance = getProcess(task.getProcessInstanceId());

    if (processInstance.getStatus() == ProcessStatus.CANCELLED
        || processInstance.getStatus() == ProcessStatus.COMPLETED) {
      throw new BusinessRuleException("El trámite está finalizado");
    }

    if (task.getStatus() != TaskStatus.PENDING && task.getStatus() != TaskStatus.IN_PROGRESS) {
      throw new BusinessRuleException("Solo se puede completar una tarea en PENDING o IN_PROGRESS");
    }

    assertUserCanAct(req.getUserId(), task);

    TaskStatus previousStatus = task.getStatus();
    task.setStatus(TaskStatus.COMPLETED);
    task.setFormData(req.getFormData());
    task.setObservations(req.getObservations());
    task.setCompletedAt(Instant.now());
    if (task.getStartedAt() == null) {
      task.setStartedAt(Instant.now());
    }
    taskRepository.save(task);
    notifyTaskCompleted(task, processInstance);

    historyService.add(
        processInstance.getId(),
        processInstance.getPolicyId(),
        task.getActivityNodeId(),
        HistoryAction.TASK_COMPLETED,
        req.getUserId(),
        previousStatus.name(),
        TaskStatus.COMPLETED.name(),
        req.getObservations());

    ActivityDiagram diagram = getDiagram(processInstance.getPolicyId());
    Map<String, ActivityDiagram.DiagramNode> nodesById = diagramNodesById(diagram);
    ActivityDiagram.DiagramNode currentNode = nodesById.get(task.getActivityNodeId());
    if (currentNode == null) {
      throw new BusinessRuleException("activityNodeId no existe en el diagrama");
    }

    ActivityDiagram.DiagramNode nextNode =
        resolveNextNode(currentNode, diagram, nodesById, req.getTransitionConditionResult());

    if (nextNode == null) {
      throw new BusinessRuleException("No se encontró transición válida para avanzar el proceso");
    }

    if (nextNode.getType() == NodeType.END) {
      markProcessCompleted(processInstance, req.getUserId());
      historyService.add(
          processInstance.getId(),
          processInstance.getPolicyId(),
          nextNode.getId(),
          HistoryAction.PROCESS_COMPLETED,
          req.getUserId(),
          ProcessStatus.IN_PROGRESS.name(),
          ProcessStatus.COMPLETED.name(),
          "Proceso completado");
      eventsPublisher.publish(
          "PROCESS_COMPLETED",
          Map.of(
              "processInstanceId",
              processInstance.getId(),
              "policyId",
              processInstance.getPolicyId(),
              "status",
              ProcessStatus.COMPLETED.name()));
      return;
    }

    if (nextNode.getType() != NodeType.ACTIVITY) {
      throw new BusinessRuleException("El siguiente nodo no es ejecutable (no es ACTIVITY ni END)");
    }

    ActivityTask newTask =
        buildTaskEntityForActivity(
            processInstance, getActiveOrDraftPolicy(processInstance.getPolicyId()), diagram, nextNode);
    applyNextActivityAssigneeFromForm(newTask, task, req.getFormData());
    newTask = taskRepository.save(newTask);
    notifyTaskAssigned(newTask, processInstance);
    processInstance.setCurrentNodeIds(List.of(nextNode.getId()));
    processRepository.save(processInstance);

    historyService.add(
        processInstance.getId(),
        processInstance.getPolicyId(),
        nextNode.getId(),
        HistoryAction.PROCESS_ADVANCED,
        req.getUserId(),
        null,
        null,
        "Proceso avanzado");
    historyService.add(
        processInstance.getId(),
        processInstance.getPolicyId(),
        newTask.getActivityNodeId(),
        HistoryAction.TASK_CREATED,
        req.getUserId(),
        null,
        TaskStatus.PENDING.name(),
        "Tarea creada");

    eventsPublisher.publish(
        "PROCESS_ADVANCED",
        Map.of(
            "processInstanceId",
            processInstance.getId(),
            "policyId",
            processInstance.getPolicyId(),
            "currentNodeIds",
            processInstance.getCurrentNodeIds() == null
                ? List.of()
                : processInstance.getCurrentNodeIds()));
    eventsPublisher.publish(
        "TASK_CREATED",
        Map.of(
            "taskId",
            newTask.getId(),
            "processInstanceId",
            newTask.getProcessInstanceId(),
            "policyId",
            newTask.getPolicyId(),
            "status",
            newTask.getStatus().name()));
  }

  /**
   * Tras completar una tarea en un nodo ACTIVITY, hay que seguir la arista saliente hacia el siguiente paso.
   * Antes se pasaba el mismo nodo ACTIVITY a {@link #advanceFrom}, que lo devolvía sin avanzar y rompía el flujo.
   */
  public ActivityDiagram.DiagramNode resolveNextNode(
      ActivityDiagram.DiagramNode completedActivity,
      ActivityDiagram diagram,
      Map<String, ActivityDiagram.DiagramNode> nodesById,
      String transitionConditionResult) {
    if (completedActivity.getType() != NodeType.ACTIVITY) {
      return advanceFrom(completedActivity, diagram, nodesById, transitionConditionResult);
    }
    List<ActivityDiagram.DiagramEdge> outs = outgoing(completedActivity.getId(), diagram);
    if (outs.isEmpty()) {
      return null;
    }
    ActivityDiagram.DiagramNode step = nodesById.get(outs.get(0).getTargetNodeId());
    if (step == null) {
      return null;
    }
    return advanceFrom(step, diagram, nodesById, transitionConditionResult);
  }

  public void markProcessCompleted(ProcessInstance processInstance, String userId) {
    ProcessStatus previous = processInstance.getStatus();
    processInstance.setStatus(ProcessStatus.COMPLETED);
    processInstance.setFinishedAt(Instant.now());
    processInstance.setCurrentNodeIds(List.of());
    processRepository.save(processInstance);
    historyService.add(
        processInstance.getId(),
        processInstance.getPolicyId(),
        null,
        HistoryAction.PROCESS_COMPLETED,
        userId,
        previous.name(),
        ProcessStatus.COMPLETED.name(),
        "Proceso completado");

    List<ActivityTask> tasks = taskRepository.findByProcessInstanceId(processInstance.getId());
    for (ActivityTask activityTask : tasks) {
      if (activityTask.getStatus() == TaskStatus.PENDING
          || activityTask.getStatus() == TaskStatus.IN_PROGRESS) {
        activityTask.setStatus(TaskStatus.CANCELLED);
        taskRepository.save(activityTask);
      }
    }
    notifyProcessCompleted(processInstance);
  }

  private void notifyTaskAssigned(ActivityTask task, ProcessInstance processInstance) {
    String userId = task.getAssignedToUserId();
    if (userId != null && !userId.isBlank()) {
      notificationService.createNotification(
          userId,
          "Tarea asignada",
          String.format(
              "Actividad «%s» en el trámite %s.",
              task.getActivityName(), processInstance.getId()),
          NotificationType.TASK_ASSIGNED,
          "TASK",
          task.getId());
    } else {
      String scope =
          task.getAssignedRoleId() != null && !task.getAssignedRoleId().isBlank()
              ? "Asignación por rol (sin usuario directo)."
              : (task.getAssignedDepartmentId() != null && !task.getAssignedDepartmentId().isBlank()
                  ? "Asignación por departamento (sin usuario directo)."
                  : "Asignación general (sin usuario directo).");
      notificationService.createNotification(
          null,
          "Tarea disponible",
          String.format(
              "Actividad «%s» en el trámite %s. %s",
              task.getActivityName(), processInstance.getId(), scope),
          NotificationType.TASK_ASSIGNED,
          "TASK",
          task.getId());
    }
  }

  private void notifyTaskCompleted(ActivityTask task, ProcessInstance processInstance) {
    String destinationUserId = processInstance.getRequestedBy();
    if (destinationUserId == null || destinationUserId.isBlank()) {
      destinationUserId = task.getAssignedToUserId();
    }
    notificationService.createNotification(
        destinationUserId,
        "Tarea completada",
        String.format(
            "Se completó la actividad «%s» (trámite %s).",
            task.getActivityName(), processInstance.getId()),
        NotificationType.TASK_COMPLETED,
        "TASK",
        task.getId());
  }

  private void notifyProcessCompleted(ProcessInstance processInstance) {
    String requestedBy = processInstance.getRequestedBy();
    if (requestedBy == null || requestedBy.isBlank()) {
      return;
    }
    notificationService.createNotification(
        requestedBy,
        "Trámite completado",
        String.format("El trámite %s finalizó correctamente.", processInstance.getId()),
        NotificationType.PROCESS_COMPLETED,
        "PROCESS",
        processInstance.getId());
  }

  private ActivityDiagram.DiagramNode advanceFrom(
      ActivityDiagram.DiagramNode from,
      ActivityDiagram diagram,
      Map<String, ActivityDiagram.DiagramNode> nodesById,
      String transitionConditionResult) {
    ActivityDiagram.DiagramNode cur = from;
    int guard = 0;
    while (guard++ < 50) {
      if (cur.getType() == NodeType.ACTIVITY || cur.getType() == NodeType.END) {
        return cur;
      }

      List<ActivityDiagram.DiagramEdge> outs = outgoing(cur.getId(), diagram);
      if (outs.isEmpty()) {
        return null;
      }

      ActivityDiagram.DiagramEdge chosen;
      if (cur.getType() == NodeType.DECISION) {
        if (transitionConditionResult == null || transitionConditionResult.isBlank()) {
          throw new BusinessRuleException("DECISION requiere transitionConditionResult para avanzar");
        }
        String wanted = transitionConditionResult.trim();
        chosen =
            outs.stream()
                .filter(
                    e ->
                        e.getCondition() != null
                            && e.getCondition().trim().equalsIgnoreCase(wanted))
                .findFirst()
                .orElse(null);
        if (chosen == null) {
          return null;
        }
      } else {
        chosen = outs.get(0);
      }

      ActivityDiagram.DiagramNode next = nodesById.get(chosen.getTargetNodeId());
      if (next == null) {
        return null;
      }
      cur = next;
    }
    throw new BusinessRuleException("Se detectó un posible ciclo al avanzar el proceso");
  }

  private static List<ActivityDiagram.DiagramEdge> outgoing(String nodeId, ActivityDiagram diagram) {
    if (diagram.getEdges() == null) {
      return List.of();
    }
    return diagram.getEdges().stream().filter(e -> nodeId.equals(e.getSourceNodeId())).toList();
  }

  private static Map<String, ActivityDiagram.DiagramNode> diagramNodesById(ActivityDiagram diagram) {
    Map<String, ActivityDiagram.DiagramNode> map = new HashMap<>();
    if (diagram.getNodes() != null) {
      for (ActivityDiagram.DiagramNode n : diagram.getNodes()) {
        if (n.getId() != null) {
          map.put(n.getId(), n);
        }
      }
    }
    return map;
  }

  private ActivityDiagram getDiagram(String policyId) {
    return diagramRepository
        .findByPolicyId(policyId)
        .orElseThrow(() -> new ResourceNotFoundException("Diagrama no encontrado"));
  }

  private BusinessPolicy getActivePolicy(String policyId) {
    BusinessPolicy policy =
        policyRepository
            .findById(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Política no encontrada"));
    if (policy.getStatus() != PolicyStatus.ACTIVE) {
      throw new BusinessRuleException("Solo se puede crear trámite desde una política ACTIVE");
    }
    return policy;
  }

  private BusinessPolicy getActiveOrDraftPolicy(String policyId) {
    BusinessPolicy policy =
        policyRepository
            .findById(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Política no encontrada"));
    if (policy.getStatus() != PolicyStatus.ACTIVE && policy.getStatus() != PolicyStatus.DRAFT) {
      throw new BusinessRuleException("Política no está disponible para ejecución");
    }
    return policy;
  }

  private ProcessInstance getProcess(String id) {
    return processRepository
        .findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Trámite no encontrado"));
  }

  private ActivityTask getTask(String id) {
    return taskRepository
        .findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Tarea no encontrada"));
  }

  private ActivityDiagram.Swimlane swimlaneForNode(
      ActivityDiagram diagram, ActivityDiagram.DiagramNode node) {
    if (node.getSwimlaneId() == null || node.getSwimlaneId().isBlank()) {
      return null;
    }
    if (diagram.getSwimlanes() == null) {
      return null;
    }
    return diagram.getSwimlanes().stream()
        .filter(s -> node.getSwimlaneId().equals(s.getId()))
        .findFirst()
        .orElse(null);
  }

  private void assertUserCanAct(String userId, ActivityTask task) {
    if (userId == null || userId.isBlank()) {
      throw new BusinessRuleException("userId es obligatorio");
    }
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new BusinessRuleException("userId no existe"));

    if (task.getAssignedToUserId() != null && !task.getAssignedToUserId().isBlank()) {
      if (!task.getAssignedToUserId().equals(userId)) {
        throw new BusinessRuleException("No tienes permisos para esta tarea (asignada a otro usuario)");
      }
      return;
    }

    if (task.getAssignedRoleId() != null && !task.getAssignedRoleId().isBlank()) {
      if (!task.getAssignedRoleId().equals(user.getRoleId())) {
        throw new BusinessRuleException("No tienes permisos para esta tarea (rol distinto)");
      }
      return;
    }

    if (task.getAssignedDepartmentId() != null && !task.getAssignedDepartmentId().isBlank()) {
      if (!task.getAssignedDepartmentId().equals(user.getDepartmentId())) {
        throw new BusinessRuleException("No tienes permisos para esta tarea (departamento distinto)");
      }
    }
  }
}
