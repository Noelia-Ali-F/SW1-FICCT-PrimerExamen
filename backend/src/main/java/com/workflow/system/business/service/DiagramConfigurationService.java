package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.data.model.ActivityDiagram;
import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.data.model.NodeType;
import com.workflow.system.data.model.PolicyStatus;
import com.workflow.system.data.repository.ActivityDiagramRepository;
import com.workflow.system.data.repository.BusinessPolicyRepository;
import com.workflow.system.presentation.dto.configuration.ConfigurationValidationResponse;
import com.workflow.system.presentation.dto.configuration.UpdateEdgeConditionRequest;
import com.workflow.system.presentation.dto.diagram.DiagramValidationError;
import com.workflow.system.presentation.dto.diagram.DiagramValidationResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DiagramConfigurationService {
  private final BusinessPolicyRepository policyRepository;
  private final ActivityDiagramRepository diagramRepository;
  private final ActivityDiagramService diagramService;

  @SuppressWarnings("null")
  public void updateEdgeCondition(String policyId, String edgeId, UpdateEdgeConditionRequest req) {
    getDraftPolicy(policyId);
    ActivityDiagram d = getDiagram(policyId);

    ActivityDiagram.DiagramEdge edge =
        d.getEdges() == null
            ? null
            : d.getEdges().stream().filter(e -> edgeId.equals(e.getId())).findFirst().orElse(null);
    if (edge == null) {
      throw new BusinessRuleException("edgeId no existe en el diagrama");
    }

    Map<String, ActivityDiagram.DiagramNode> nodeById = nodesById(d);
    ActivityDiagram.DiagramNode source = nodeById.get(edge.getSourceNodeId());
    if (source != null && source.getType() == NodeType.DECISION) {
      if (req.getCondition() == null || req.getCondition().isBlank()) {
        throw new BusinessRuleException("Transición desde DECISION requiere condition");
      }
    }

    edge.setCondition(req.getCondition().trim());
    diagramRepository.save(d);
  }

  public ConfigurationValidationResponse validateConfiguration(String policyId) {
    getPolicyForValidation(policyId);

    // 1) Validación estructural del diagrama (CU3)
    DiagramValidationResponse base = diagramService.validateDiagram(policyId);
    List<DiagramValidationError> errors = new ArrayList<>(base.getErrors());
    if (!base.isValid()) {
      return ConfigurationValidationResponse.builder().isValid(false).errors(errors).build();
    }

    // 2) Validaciones de configuración (CU4)
    ActivityDiagram d = getDiagram(policyId);
    Map<String, ActivityDiagram.DiagramNode> nodeById = nodesById(d);

    // Condición obligatoria en salidas de DECISION
    if (d.getEdges() != null) {
      for (ActivityDiagram.DiagramEdge e : d.getEdges()) {
        ActivityDiagram.DiagramNode src = nodeById.get(e.getSourceNodeId());
        if (src != null && src.getType() == NodeType.DECISION) {
          if (e.getCondition() == null || e.getCondition().isBlank()) {
            errors.add(
                DiagramValidationError.builder()
                    .code("DECISION_EDGE_CONDITION_REQUIRED")
                    .message("Transición desde DECISION debe tener condition")
                    .elementId(e.getId())
                    .build());
          }
        }
      }
    }

    // Formulario requerido si node.metadata.requiresForm == true
    if (d.getNodes() != null) {
      for (ActivityDiagram.DiagramNode n : d.getNodes()) {
        if (n.getType() == NodeType.ACTIVITY && n.getMetadata() != null) {
          Object requires = n.getMetadata().get("requiresForm");
          if (requires instanceof Boolean b && b) {
            if (n.getFormId() == null || n.getFormId().isBlank()) {
              errors.add(
                  DiagramValidationError.builder()
                      .code("ACTIVITY_FORM_REQUIRED")
                      .message("ACTIVITY requiere formId (metadata.requiresForm=true)")
                      .elementId(n.getId())
                      .build());
            }
          }
        }
      }
    }

    return ConfigurationValidationResponse.builder().isValid(errors.isEmpty()).errors(errors).build();
  }

  @SuppressWarnings("null")
  private BusinessPolicy getDraftPolicy(String policyId) {
    BusinessPolicy p =
        policyRepository
            .findById(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Política no encontrada"));
    if (p.getStatus() != PolicyStatus.DRAFT) {
      throw new BusinessRuleException("Solo se puede configurar en estado DRAFT");
    }
    return p;
  }

  @SuppressWarnings("null")
  private BusinessPolicy getPolicyForValidation(String policyId) {
    BusinessPolicy p =
        policyRepository
            .findById(policyId)
            .orElseThrow(() -> new ResourceNotFoundException("Política no encontrada"));
    if (p.getStatus() != PolicyStatus.DRAFT && p.getStatus() != PolicyStatus.ACTIVE) {
      throw new BusinessRuleException("Solo se puede validar configuración en estado DRAFT o ACTIVE");
    }
    return p;
  }

  @SuppressWarnings("null")
  private ActivityDiagram getDiagram(String policyId) {
    return diagramRepository
        .findByPolicyId(policyId)
        .orElseThrow(() -> new ResourceNotFoundException("Diagrama no encontrado"));
  }

  private static Map<String, ActivityDiagram.DiagramNode> nodesById(ActivityDiagram d) {
    Map<String, ActivityDiagram.DiagramNode> map = new HashMap<>();
    if (d.getNodes() != null) {
      for (ActivityDiagram.DiagramNode n : d.getNodes()) {
        if (n.getId() != null) map.put(n.getId(), n);
      }
    }
    return map;
  }
}

