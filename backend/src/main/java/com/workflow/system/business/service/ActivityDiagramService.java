package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.ActivityDiagramMapper;
import com.workflow.system.data.model.ActivityDiagram;
import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.data.model.NodeType;
import com.workflow.system.data.model.PolicyStatus;
import com.workflow.system.data.repository.ActivityDiagramRepository;
import com.workflow.system.data.repository.BusinessPolicyRepository;
import com.workflow.system.presentation.dto.form.DynamicFormSummaryResponse;
import com.workflow.system.presentation.dto.diagram.ActivityDiagramResponse;
import com.workflow.system.presentation.dto.diagram.DiagramValidationError;
import com.workflow.system.presentation.dto.diagram.DiagramValidationResponse;
import com.workflow.system.presentation.dto.diagram.SaveActivityDiagramRequest;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ActivityDiagramService {
  private final ActivityDiagramRepository diagramRepository;
  private final BusinessPolicyRepository policyRepository;
  private final ActivityDiagramMapper diagramMapper;
  private final DynamicFormService dynamicFormService;
  private final WorkflowEventsPublisher eventsPublisher;

  @SuppressWarnings("null")
  public ActivityDiagramResponse saveDiagram(String policyId, SaveActivityDiagramRequest req) {
    BusinessPolicy policy = getDraftPolicy(policyId);
    if (diagramRepository.existsByPolicyId(policyId)) {
      throw new BusinessRuleException("Ya existe un diagrama para esta política");
    }
    ActivityDiagram saved = diagramRepository.save(toEntity(policy, req));
    eventsPublisher.publish("DIAGRAM_SAVED", Map.of("policyId", policyId));
    return diagramMapper.toResponse(saved);
  }

  public ActivityDiagramResponse getDiagramByPolicy(String policyId) {
    ActivityDiagram d =
        diagramRepository
            .findByPolicyId(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Diagrama no encontrado"));
    List<DynamicFormSummaryResponse> forms = dynamicFormService.listSummariesForPolicy(policyId);
    return diagramMapper.toResponse(d, forms);
  }

  public ActivityDiagramResponse updateDiagram(String policyId, SaveActivityDiagramRequest req) {
    BusinessPolicy policy = getDraftPolicy(policyId);
    ActivityDiagram existing =
        diagramRepository
            .findByPolicyId(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Diagrama no encontrado"));

    ActivityDiagram updated = toEntity(policy, req);
    updated.setId(existing.getId());
    // IMPORTANTE: en updates no debemos perder auditoría de creación
    updated.setCreatedAt(existing.getCreatedAt());
    // createdBy se considera autor del primer guardado del diagrama (no cambia en update)
    if (existing.getCreatedBy() != null && !existing.getCreatedBy().isBlank()) {
      updated.setCreatedBy(existing.getCreatedBy());
    }
    ActivityDiagram saved = diagramRepository.save(updated);
    eventsPublisher.publish("DIAGRAM_SAVED", Map.of("policyId", policyId));
    return diagramMapper.toResponse(saved);
  }

  public DiagramValidationResponse validateDiagram(String policyId) {
    // Validar diagrama se permite en DRAFT o INACTIVE (edición solo en DRAFT).
    getPolicyForValidate(policyId);
    ActivityDiagram d =
        diagramRepository
            .findByPolicyId(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Diagrama no encontrado"));
    return validate(d);
  }

  public DiagramValidationResponse validateDiagramForActivation(String policyId) {
    // Misma validación pero pensado para activación (DRAFT/INACTIVE). ACTIVE no requiere revalidar.
    getPolicyForValidate(policyId);
    ActivityDiagram d =
        diagramRepository
            .findByPolicyId(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Diagrama no encontrado"));
    return validate(d);
  }

  @SuppressWarnings("null")
  private BusinessPolicy getDraftPolicy(String policyId) {
    BusinessPolicy policy =
        policyRepository
            .findById(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Política no encontrada"));
    if (policy.getStatus() != PolicyStatus.DRAFT) {
      throw new BusinessRuleException("Solo se puede modificar diagrama si la política está en DRAFT");
    }
    return policy;
  }

  @SuppressWarnings("null")
  private BusinessPolicy getPolicyForValidate(String policyId) {
    BusinessPolicy policy =
        policyRepository
            .findById(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Política no encontrada"));
    // Validación estructural del diagrama se permite también en ACTIVE:
    // el motor la usa para iniciar/avanzar trámites y la configuración permite validación en DRAFT/ACTIVE.
    if (policy.getStatus() != PolicyStatus.DRAFT
        && policy.getStatus() != PolicyStatus.INACTIVE
        && policy.getStatus() != PolicyStatus.ACTIVE) {
      throw new BusinessRuleException(
          "Solo se puede validar diagrama si la política está en DRAFT, INACTIVE o ACTIVE");
    }
    return policy;
  }

  @SuppressWarnings("null")
  private ActivityDiagram toEntity(BusinessPolicy policy, SaveActivityDiagramRequest req) {
    List<ActivityDiagram.Swimlane> swimlanes =
        req.getSwimlanes() == null
            ? List.of()
            : req.getSwimlanes().stream()
                .map(
                    s ->
                        ActivityDiagram.Swimlane.builder()
                            .id(s.getId())
                            .name(s.getName())
                            .responsibleType(s.getResponsibleType())
                            .responsibleId(s.getResponsibleId())
                            .positionX(s.getPositionX())
                            .positionY(s.getPositionY())
                            .width(s.getWidth())
                            .height(s.getHeight())
                            .build())
                .toList();

    List<ActivityDiagram.DiagramNode> nodes =
        req.getNodes() == null
            ? List.of()
            : req.getNodes().stream()
                .map(
                    n ->
                        ActivityDiagram.DiagramNode.builder()
                            .id(n.getId())
                            .type(n.getType())
                            .name(n.getName())
                            .description(n.getDescription())
                            .swimlaneId(n.getSwimlaneId())
                            .positionX(n.getPositionX())
                            .positionY(n.getPositionY())
                            .formId(n.getFormId())
                            .metadata(n.getMetadata())
                            .build())
                .toList();

    List<ActivityDiagram.DiagramEdge> edges =
        req.getEdges() == null
            ? List.of()
            : req.getEdges().stream()
                .map(
                    e ->
                        ActivityDiagram.DiagramEdge.builder()
                            .id(e.getId())
                            .sourceNodeId(e.getSourceNodeId())
                            .targetNodeId(e.getTargetNodeId())
                            .label(e.getLabel())
                            .condition(e.getCondition())
                            .type(e.getType())
                            .build())
                .toList();

    int version = req.getVersion() != null ? req.getVersion() : (policy.getVersion() == null ? 1 : policy.getVersion());
    return ActivityDiagram.builder()
        .policyId(policy.getId())
        .swimlanes(swimlanes)
        .nodes(nodes)
        .edges(edges)
        .version(version)
        .createdBy(req.getCreatedBy())
        .build();
  }

  private DiagramValidationResponse validate(ActivityDiagram d) {
    List<DiagramValidationError> errors = new ArrayList<>();

    List<ActivityDiagram.DiagramNode> nodes = d.getNodes() == null ? List.of() : d.getNodes();
    List<ActivityDiagram.DiagramEdge> edges = d.getEdges() == null ? List.of() : d.getEdges();
    List<ActivityDiagram.Swimlane> swimlanes = d.getSwimlanes() == null ? List.of() : d.getSwimlanes();

    Map<String, ActivityDiagram.DiagramNode> nodeById = new HashMap<>();
    for (ActivityDiagram.DiagramNode n : nodes) {
      if (n.getId() == null || n.getId().isBlank()) {
        errors.add(err("NODE_ID_REQUIRED", "Nodo sin id", null));
        continue;
      }
      if (nodeById.put(n.getId(), n) != null) {
        errors.add(err("NODE_ID_DUPLICATE", "id de nodo duplicado", n.getId()));
      }
    }

    Set<String> swimlaneIds = new HashSet<>();
    for (ActivityDiagram.Swimlane s : swimlanes) {
      if (s.getId() == null || s.getId().isBlank()) {
        errors.add(err("SWIMLANE_ID_REQUIRED", "Swimlane sin id", null));
        continue;
      }
      if (!swimlaneIds.add(s.getId())) {
        errors.add(err("SWIMLANE_ID_DUPLICATE", "id de swimlane duplicado", s.getId()));
      }
      if (s.getResponsibleType() == null || s.getResponsibleId() == null || s.getResponsibleId().isBlank()) {
        errors.add(err("SWIMLANE_RESPONSIBLE_REQUIRED", "Swimlane sin responsable", s.getId()));
      }
    }

    // START exactamente 1, END al menos 1
    List<ActivityDiagram.DiagramNode> starts =
        nodes.stream().filter(n -> n.getType() == NodeType.START).toList();
    if (starts.size() != 1) {
      errors.add(err("START_COUNT", "Debe existir exactamente un nodo START", null));
    }
    long endCount = nodes.stream().filter(n -> n.getType() == NodeType.END).count();
    if (endCount < 1) {
      errors.add(err("END_REQUIRED", "Debe existir al menos un nodo END", null));
    }

    // Aristas válidas + construir grados/adyacencia
    Map<String, Integer> inDeg = new HashMap<>();
    Map<String, Integer> outDeg = new HashMap<>();
    Map<String, List<String>> adj = new HashMap<>();

    for (ActivityDiagram.DiagramEdge e : edges) {
      String sid = e.getSourceNodeId();
      String tid = e.getTargetNodeId();
      if (sid == null || sid.isBlank() || tid == null || tid.isBlank()) {
        errors.add(err("EDGE_ENDPOINT_REQUIRED", "Arista sin source/target", e.getId()));
        continue;
      }
      if (!nodeById.containsKey(sid)) {
        errors.add(err("EDGE_SOURCE_INVALID", "sourceNodeId no existe", e.getId()));
        continue;
      }
      if (!nodeById.containsKey(tid)) {
        errors.add(err("EDGE_TARGET_INVALID", "targetNodeId no existe", e.getId()));
        continue;
      }

      outDeg.put(sid, outDeg.getOrDefault(sid, 0) + 1);
      inDeg.put(tid, inDeg.getOrDefault(tid, 0) + 1);
      adj.computeIfAbsent(sid, k -> new ArrayList<>()).add(tid);
    }

    // Reglas por nodo (entradas/salidas)
    for (ActivityDiagram.DiagramNode n : nodes) {
      if (n.getType() == null) {
        errors.add(err("NODE_TYPE_REQUIRED", "Nodo sin tipo", n.getId()));
        continue;
      }

      int in = inDeg.getOrDefault(n.getId(), 0);
      int out = outDeg.getOrDefault(n.getId(), 0);

      if (n.getType() != NodeType.START && in < 1) {
        errors.add(err("NODE_IN_REQUIRED", "Nodo sin entrada", n.getId()));
      }
      if (n.getType() != NodeType.END && out < 1) {
        errors.add(err("NODE_OUT_REQUIRED", "Nodo sin salida", n.getId()));
      }

      if (n.getType() == NodeType.ACTIVITY) {
        // UML: los Activity Partitions (swimlanes) son opcionales. Aunque existan calles,
        // una actividad puede estar fuera de ellas; solo validamos que, si viene swimlaneId,
        // éste exista.
        if (n.getSwimlaneId() != null && !n.getSwimlaneId().isBlank() && !swimlaneIds.contains(n.getSwimlaneId())) {
          errors.add(err("ACTIVITY_SWIMLANE_INVALID", "swimlaneId no existe", n.getId()));
        }
      }
      if (n.getType() == NodeType.DECISION && out < 2) {
        errors.add(err("DECISION_OUT_MIN", "DECISION debe tener al menos 2 salidas", n.getId()));
      }
      if (n.getType() == NodeType.FORK) {
        if (in != 1) {
          errors.add(err("FORK_IN_EXACT", "FORK debe tener exactamente 1 entrada", n.getId()));
        }
        if (out < 2) {
          errors.add(err("FORK_OUT_MIN", "FORK debe tener al menos 2 salidas", n.getId()));
        }
      }
      if (n.getType() == NodeType.JOIN) {
        if (in < 2) {
          errors.add(err("JOIN_IN_MIN", "JOIN debe tener al menos 2 entradas", n.getId()));
        }
        if (out != 1) {
          errors.add(err("JOIN_OUT_EXACT", "JOIN debe tener exactamente 1 salida", n.getId()));
        }
      }
    }

    // Reglas de EdgeType.PARALLEL: solo permitido desde FORK o hacia JOIN (UML paralelo mínimo)
    for (ActivityDiagram.DiagramEdge e : edges) {
      if (e.getType() != null && e.getType() == com.workflow.system.data.model.EdgeType.PARALLEL) {
        ActivityDiagram.DiagramNode src = nodeById.get(e.getSourceNodeId());
        ActivityDiagram.DiagramNode dst = nodeById.get(e.getTargetNodeId());
        boolean ok = (src != null && src.getType() == NodeType.FORK) || (dst != null && dst.getType() == NodeType.JOIN);
        if (!ok) {
          errors.add(err("EDGE_PARALLEL_INVALID", "Arista PARALLEL debe salir de FORK o entrar a JOIN", e.getId()));
        }
      }
    }

    // Camino START -> END
    if (starts.size() == 1) {
      String startId = starts.get(0).getId();
      if (startId != null && !startId.isBlank()) {
        Set<String> visited = new HashSet<>();
        ArrayDeque<String> q = new ArrayDeque<>();
        q.add(startId);
        visited.add(startId);

        boolean reachesEnd = false;
        while (!q.isEmpty()) {
          String cur = q.removeFirst();
          ActivityDiagram.DiagramNode node = nodeById.get(cur);
          if (node != null && node.getType() == NodeType.END) {
            reachesEnd = true;
            break;
          }
          for (String nxt : adj.getOrDefault(cur, List.of())) {
            if (visited.add(nxt)) q.addLast(nxt);
          }
        }

        if (!reachesEnd) {
          errors.add(err("NO_PATH_TO_END", "No existe camino desde START hasta algún END", null));
        }
      }
    }

    return DiagramValidationResponse.builder().isValid(errors.isEmpty()).errors(errors).build();
  }

  private static DiagramValidationError err(String code, String message, String elementId) {
    return DiagramValidationError.builder().code(code).message(message).elementId(elementId).build();
  }
}

