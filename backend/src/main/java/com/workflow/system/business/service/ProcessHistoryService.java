package com.workflow.system.business.service;

import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.ProcessHistoryMapper;
import com.workflow.system.data.model.HistoryAction;
import com.workflow.system.data.model.ProcessHistory;
import com.workflow.system.data.repository.ProcessInstanceRepository;
import com.workflow.system.data.repository.ProcessHistoryRepository;
import com.workflow.system.presentation.dto.process.ProcessHistoryResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProcessHistoryService {
  private final ProcessHistoryRepository historyRepository;
  private final ProcessInstanceRepository processRepository;
  private final ProcessHistoryMapper mapper;

  @SuppressWarnings("null")
  public void add(
      String processInstanceId,
      String policyId,
      String activityNodeId,
      HistoryAction action,
      String userId,
      String previousStatus,
      String newStatus,
      String observation) {
    historyRepository.save(
        ProcessHistory.builder()
            .processInstanceId(processInstanceId)
            .policyId(policyId)
            .activityNodeId(activityNodeId)
            .action(action)
            .userId(userId)
            .previousStatus(previousStatus)
            .newStatus(newStatus)
            .observation(observation)
            .build());
  }

  public List<ProcessHistory> listByProcessInstance(String processInstanceId) {
    return historyRepository.findByProcessInstanceIdOrderByCreatedAtAsc(processInstanceId);
  }

  @SuppressWarnings("null")
  public List<ProcessHistoryResponse> getHistoryByProcessInstanceId(String processInstanceId) {
    if (!processRepository.existsById(processInstanceId)) {
      throw new ResourceNotFoundException("Trámite no encontrado");
    }
    return historyRepository.findByProcessInstanceIdOrderByCreatedAtAsc(processInstanceId).stream()
        .map(mapper::toResponse)
        .toList();
  }
}

