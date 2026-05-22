package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.DynamicFormMapper;
import com.workflow.system.data.model.ActivityDiagram;
import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.data.model.DynamicForm;
import com.workflow.system.data.model.FormFieldType;
import com.workflow.system.data.model.NodeType;
import com.workflow.system.data.model.PolicyStatus;
import com.workflow.system.data.repository.ActivityDiagramRepository;
import com.workflow.system.data.repository.BusinessPolicyRepository;
import com.workflow.system.data.repository.DynamicFormRepository;
import com.workflow.system.presentation.dto.form.CreateDynamicFormRequest;
import com.workflow.system.presentation.dto.form.DynamicFormSummaryResponse;
import com.workflow.system.presentation.dto.form.DynamicFormValidationResponse;
import com.workflow.system.presentation.dto.form.DynamicFormResponse;
import com.workflow.system.presentation.dto.form.FormFieldRequest;
import com.workflow.system.presentation.dto.form.FormValidationErrorDto;
import com.workflow.system.presentation.dto.form.UpdateDynamicFormRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DynamicFormService {
  private final BusinessPolicyRepository policyRepository;
  private final ActivityDiagramRepository diagramRepository;
  private final DynamicFormRepository formRepository;
  private final DynamicFormMapper formMapper;

  @SuppressWarnings("null")
  public DynamicFormResponse createForm(
      String policyId, String activityNodeId, CreateDynamicFormRequest req) {
    getDraftPolicy(policyId);
    ActivityDiagram diagram = getDiagram(policyId);

    ActivityDiagram.DiagramNode node = getActivityNodeOrThrow(diagram, activityNodeId);
    if (formRepository.existsByPolicyIdAndActivityNodeId(policyId, activityNodeId)) {
      throw new BusinessRuleException("La actividad ya tiene un formulario asociado");
    }

    validateFields(req.getFields());

    DynamicForm saved =
        formRepository.save(
            DynamicForm.builder()
                .policyId(policyId)
                .activityNodeId(activityNodeId)
                .name(req.getName().trim())
                .description(req.getDescription())
                .fields(toFields(req.getFields()))
                .build());

    // actualizar node.formId en el diagrama
    node.setFormId(saved.getId());
    diagramRepository.save(diagram);

    return formMapper.toResponse(saved);
  }

  public DynamicFormResponse getForm(String policyId, String activityNodeId) {
    DynamicForm f =
        formRepository
            .findByPolicyIdAndActivityNodeId(policyId, activityNodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Formulario no encontrado"));
    return formMapper.toResponse(f);
  }

  /** Catálogo por política (para mostrar en el editor qué nodos tienen CU4 guardado aunque el diagrama no traiga formId). */
  public List<DynamicFormSummaryResponse> listSummariesForPolicy(String policyId) {
    policyRepository
        .findById(policyId)
        .orElseThrow(() -> new ResourceNotFoundException("Política no encontrada"));
    return formRepository.findByPolicyId(policyId).stream()
        .map(
            f ->
                DynamicFormSummaryResponse.builder()
                    .id(f.getId())
                    .activityNodeId(f.getActivityNodeId())
                    .name(f.getName())
                    .build())
        .sorted(
            Comparator.comparing(
                DynamicFormSummaryResponse::getActivityNodeId,
                Comparator.nullsLast(String::compareTo)))
        .toList();
  }

  @SuppressWarnings("null")
  public DynamicFormResponse updateForm(
      String policyId, String activityNodeId, UpdateDynamicFormRequest req) {
    getDraftPolicy(policyId);
    ActivityDiagram diagram = getDiagram(policyId);
    ActivityDiagram.DiagramNode node = getActivityNodeOrThrow(diagram, activityNodeId);

    DynamicForm existing =
        formRepository
            .findByPolicyIdAndActivityNodeId(policyId, activityNodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Formulario no encontrado"));

    validateFields(req.getFields());

    existing.setName(req.getName().trim());
    existing.setDescription(req.getDescription());
    existing.setFields(toFields(req.getFields()));
    DynamicForm saved = formRepository.save(existing);

    // asegurar que el nodo referencia el mismo formId
    if (saved.getId() != null && (node.getFormId() == null || !node.getFormId().equals(saved.getId()))) {
      node.setFormId(saved.getId());
      diagramRepository.save(diagram);
    }

    return formMapper.toResponse(saved);
  }

  public DynamicFormValidationResponse validateForm(
      String policyId, String activityNodeId, UpdateDynamicFormRequest req) {
    // Valida asociación política/actividad (sin guardar)
    getDraftPolicy(policyId);
    ActivityDiagram diagram = getDiagram(policyId);
    getActivityNodeOrThrow(diagram, activityNodeId);

    List<FormValidationErrorDto> errors = validateFormLocal(req);
    return DynamicFormValidationResponse.builder().isValid(errors.isEmpty()).errors(errors).build();
  }

  /** Elimina el formulario dinámico y quita {@code formId} del nodo ACTIVITY en el diagrama. */
  @SuppressWarnings("null")
  public void deleteForm(String policyId, String activityNodeId) {
    getDraftPolicy(policyId);
    ActivityDiagram diagram = getDiagram(policyId);
    ActivityDiagram.DiagramNode node = getActivityNodeOrThrow(diagram, activityNodeId);

    DynamicForm existing =
        formRepository
            .findByPolicyIdAndActivityNodeId(policyId, activityNodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Formulario no encontrado"));

    formRepository.delete(existing);
    node.setFormId(null);
    diagramRepository.save(diagram);
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
  private ActivityDiagram getDiagram(String policyId) {
    return diagramRepository
        .findByPolicyId(policyId)
        .orElseThrow(() -> new ResourceNotFoundException("Diagrama no encontrado"));
  }

  @SuppressWarnings("null")
  private ActivityDiagram.DiagramNode getActivityNodeOrThrow(ActivityDiagram diagram, String nodeId) {
    Map<String, ActivityDiagram.DiagramNode> byId =
        Optional.ofNullable(diagram.getNodes()).orElse(List.of()).stream()
            .filter(n -> n.getId() != null)
            .collect(Collectors.toMap(ActivityDiagram.DiagramNode::getId, Function.identity(), (a, b) -> a));

    ActivityDiagram.DiagramNode node = byId.get(nodeId);
    if (node == null) {
      throw new BusinessRuleException("activityNodeId no existe en el diagrama");
    }
    if (node.getType() != NodeType.ACTIVITY) {
      throw new BusinessRuleException("Solo nodos ACTIVITY pueden tener formulario");
    }
    return node;
  }

  private static void validateFields(List<FormFieldRequest> fields) {
    long assignNextCount =
        fields == null
            ? 0
            : fields.stream()
                .filter(
                    x ->
                        x != null
                            && Boolean.TRUE.equals(x.getAssignsNextTask())
                            && x.getType() == FormFieldType.USER)
                .count();
    if (assignNextCount > 1) {
      throw new BusinessRuleException("Solo un campo USER puede marcar asignación a la siguiente actividad");
    }
    if (fields == null) {
      return;
    }
    for (FormFieldRequest f : fields) {
      if (f.getLabel() == null || f.getLabel().isBlank()) {
        throw new BusinessRuleException("Todos los campos deben tener label");
      }
      if (f.getType() == null) {
        throw new BusinessRuleException("Todos los campos deben tener type");
      }
      // Para LABEL/BUTTON el name es opcional (son componentes de UI).
      if (f.getType() != FormFieldType.LABEL && f.getType() != FormFieldType.BUTTON) {
        if (f.getName() == null || f.getName().isBlank()) {
          throw new BusinessRuleException("Todos los campos de datos deben tener name");
        }
      }
      if (f.getType() == FormFieldType.SELECT || f.getType() == FormFieldType.RADIO) {
        if (f.getOptions() == null || f.getOptions().isEmpty()) {
          throw new BusinessRuleException("Campos SELECT/RADIO deben tener options");
        }
      }
    }
  }

  private static List<FormValidationErrorDto> validateFormLocal(UpdateDynamicFormRequest req) {
    List<FormValidationErrorDto> errors = new ArrayList<>();
    String name = req.getName() == null ? "" : req.getName().trim();
    if (name.isBlank()) {
      errors.add(
          FormValidationErrorDto.builder()
              .code("FORM_NAME_REQUIRED")
              .message("El formulario debe tener nombre.")
              .build());
    }

    List<FormFieldRequest> fields = req.getFields() == null ? List.of() : req.getFields();
    if (fields.isEmpty()) {
      errors.add(
          FormValidationErrorDto.builder()
              .code("FORM_EMPTY")
              .message("No debe existir formulario vacío.")
              .build());
      return errors;
    }

    long assignNextCount =
        fields.stream()
            .filter(
                x ->
                    x != null
                        && Boolean.TRUE.equals(x.getAssignsNextTask())
                        && x.getType() == FormFieldType.USER)
            .count();
    if (assignNextCount > 1) {
      errors.add(
          FormValidationErrorDto.builder()
              .code("ASSIGNS_NEXT_DUP")
              .message("Solo un campo USER puede marcar asignación a la siguiente actividad.")
              .build());
    }

    Set<String> keys = new HashSet<>();
    Set<String> ids = new HashSet<>();
    int idx = 0;
    for (FormFieldRequest f : fields) {
      idx++;
      String id = f.getId() == null ? "" : f.getId().trim();
      if (id.isBlank()) {
        errors.add(
            FormValidationErrorDto.builder()
                .code("FIELD_ID_REQUIRED")
                .message("Todo componente debe tener id único.")
                .elementId("row#" + idx)
                .build());
      } else if (!ids.add(id)) {
        errors.add(
            FormValidationErrorDto.builder()
                .code("FIELD_ID_DUP")
                .message("No deben existir ids duplicados.")
                .elementId(id)
                .build());
      }

      if (f.getType() == null) {
        errors.add(
            FormValidationErrorDto.builder()
                .code("FIELD_TYPE_REQUIRED")
                .message("Todo componente debe tener type.")
                .elementId(id.isBlank() ? ("row#" + idx) : id)
                .build());
        continue;
      }

      String label = f.getLabel() == null ? "" : f.getLabel().trim();
      if (label.isBlank() && f.getType() != FormFieldType.LABEL) {
        errors.add(
            FormValidationErrorDto.builder()
                .code("FIELD_LABEL_REQUIRED")
                .message("Todo componente visible debe tener label/texto.")
                .elementId(id.isBlank() ? ("row#" + idx) : id)
                .build());
      }

      // key: requerido para campos de datos (no LABEL/BUTTON)
      if (f.getType() != FormFieldType.LABEL && f.getType() != FormFieldType.BUTTON) {
        String key = f.getName() == null ? "" : f.getName().trim();
        if (key.isBlank()) {
          errors.add(
              FormValidationErrorDto.builder()
                  .code("FIELD_KEY_REQUIRED")
                  .message("No deben existir componentes sin key (name).")
                  .elementId(id.isBlank() ? ("row#" + idx) : id)
                  .build());
        } else if (!keys.add(key)) {
          errors.add(
              FormValidationErrorDto.builder()
                  .code("FIELD_KEY_DUP")
                  .message("No deben existir keys duplicados.")
                  .elementId(id.isBlank() ? ("row#" + idx) : id)
                  .build());
        }
      }

      if (f.getType() == FormFieldType.SELECT || f.getType() == FormFieldType.RADIO) {
        if (f.getOptions() == null || f.getOptions().isEmpty()) {
          errors.add(
              FormValidationErrorDto.builder()
                  .code("OPTIONS_REQUIRED")
                  .message("SELECT y RADIO deben tener al menos una opción.")
                  .elementId(id.isBlank() ? ("row#" + idx) : id)
                  .build());
        }
      }

      if (Boolean.TRUE.equals(f.getAssignsNextTask()) && f.getType() != FormFieldType.USER) {
        errors.add(
            FormValidationErrorDto.builder()
                .code("ASSIGNS_NEXT_INVALID_TYPE")
                .message("«Asignar siguiente actividad» solo aplica a campos tipo USER.")
                .elementId(id.isBlank() ? ("row#" + idx) : id)
                .build());
      }

      if (f.getType() == FormFieldType.BUTTON) {
        String action = f.getAction() == null ? "" : f.getAction().trim();
        if (label.isBlank()) {
          errors.add(
              FormValidationErrorDto.builder()
                  .code("BUTTON_TEXT_REQUIRED")
                  .message("BUTTON debe tener texto (label).")
                  .elementId(id.isBlank() ? ("row#" + idx) : id)
                  .build());
        }
        if (action.isBlank()) {
          errors.add(
              FormValidationErrorDto.builder()
                  .code("BUTTON_ACTION_REQUIRED")
                  .message("BUTTON debe tener acción.")
                  .elementId(id.isBlank() ? ("row#" + idx) : id)
                  .build());
        }
      }

      Integer order = f.getOrder();
      if (order == null || order < 0) {
        errors.add(
            FormValidationErrorDto.builder()
                .code("FIELD_ORDER_INVALID")
                .message("Los componentes deben tener un orden válido (>=0).")
                .elementId(id.isBlank() ? ("row#" + idx) : id)
                .build());
      }
    }

    return errors;
  }

  private static List<DynamicForm.FormField> toFields(List<FormFieldRequest> fields) {
    return fields.stream()
        .map(
            f ->
                DynamicForm.FormField.builder()
                    .id(f.getId())
                    .label(f.getLabel())
                    .name(
                        (f.getName() == null || f.getName().isBlank())
                            ? ("ui_" + (f.getId() == null ? "field" : f.getId()))
                            : f.getName())
                    .type(f.getType())
                    .required(Boolean.TRUE.equals(f.getRequired()))
                    .placeholder(f.getPlaceholder())
                    .helpText(f.getHelpText())
                    .defaultValue(f.getDefaultValue())
                    .options(f.getOptions())
                    .order(f.getOrder())
                    .action(f.getAction())
                    .assignsNextTask(f.getAssignsNextTask())
                    .build())
        .toList();
  }
}

