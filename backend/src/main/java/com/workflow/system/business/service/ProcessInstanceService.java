package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.ProcessInstanceMapper;
import com.workflow.system.data.model.ActivityTask;
import com.workflow.system.data.model.HistoryAction;
import com.workflow.system.data.model.NotificationType;
import com.workflow.system.data.model.ProcessInstance;
import com.workflow.system.data.model.ProcessStatus;
import com.workflow.system.data.model.TaskStatus;
import com.workflow.system.data.repository.ActivityTaskRepository;
import com.workflow.system.data.repository.ProcessInstanceRepository;
import com.workflow.system.presentation.dto.process.CreateProcessInstanceRequest;
import com.workflow.system.presentation.dto.process.ProcessInstanceResponse;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProcessInstanceService {
  private final ProcessInstanceRepository processRepository;
  private final ActivityTaskRepository taskRepository;
  private final ProcessInstanceMapper mapper;
  private final WorkflowEngineService engineService;
  private final ProcessHistoryService historyService;
  private final NotificationService notificationService;

  @SuppressWarnings("null")
  public ProcessInstanceResponse create(CreateProcessInstanceRequest req) {
    ProcessInstance pi =
        processRepository.save(
            ProcessInstance.builder()
                .policyId(req.getPolicyId())
                .status(ProcessStatus.CREATED)
                .requestedBy(req.getRequestedBy())
                .currentNodeIds(List.of())
                .startedAt(null)
                .finishedAt(null)
                .build());

    String requestedBy = req.getRequestedBy();
    if (requestedBy != null && !requestedBy.isBlank()) {
      notificationService.createNotification(
          requestedBy,
          "Trámite creado",
          String.format("Se registró el trámite %s.", pi.getId()),
          NotificationType.PROCESS_CREATED,
          "PROCESS",
          pi.getId());
    }

    historyService.add(
        pi.getId(),
        pi.getPolicyId(),
        null,
        HistoryAction.PROCESS_CREATED,
        req.getRequestedBy(),
        null,
        ProcessStatus.CREATED.name(),
        "Proceso creado");

    // Iniciar motor (crea primera tarea y cambia a IN_PROGRESS)
    engineService.startProcess(req.getPolicyId(), pi.getId());

    return mapper.toResponse(getEntity(pi.getId()));
  }

  public List<ProcessInstanceResponse> list() {
    return processRepository.findAll().stream().map(mapper::toResponse).toList();
  }

  public ProcessInstanceResponse getById(String id) {
    return mapper.toResponse(getEntity(id));
  }

  @SuppressWarnings("null")
  public ProcessInstanceResponse cancel(String id, String userId) {
    ProcessInstance pi = getEntity(id);
    if (pi.getStatus() == ProcessStatus.COMPLETED) {
      throw new BusinessRuleException("No se puede cancelar un trámite COMPLETED");
    }
    if (pi.getStatus() == ProcessStatus.CANCELLED) {
      return mapper.toResponse(pi);
    }

    ProcessStatus prev = pi.getStatus();
    pi.setStatus(ProcessStatus.CANCELLED);
    pi.setFinishedAt(Instant.now());
    pi.setCurrentNodeIds(List.of());
    processRepository.save(pi);

    // cancelar tareas pendientes
    List<ActivityTask> tasks = taskRepository.findByProcessInstanceId(pi.getId());
    for (ActivityTask t : tasks) {
      if (t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.IN_PROGRESS) {
        t.setStatus(TaskStatus.CANCELLED);
        taskRepository.save(t);
      }
    }

    historyService.add(
        pi.getId(),
        pi.getPolicyId(),
        null,
        HistoryAction.PROCESS_CANCELLED,
        userId,
        prev.name(),
        ProcessStatus.CANCELLED.name(),
        "Proceso cancelado");

    String rb = pi.getRequestedBy();
    if (rb != null && !rb.isBlank()) {
      notificationService.createNotification(
          rb,
          "Trámite cancelado",
          String.format("El trámite %s fue cancelado.", pi.getId()),
          NotificationType.PROCESS_CANCELLED,
          "PROCESS",
          pi.getId());
    }

    return mapper.toResponse(pi);
  }

  @SuppressWarnings("null")
  private ProcessInstance getEntity(String id) {
    return processRepository
        .findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Trámite no encontrado"));
  }
}

