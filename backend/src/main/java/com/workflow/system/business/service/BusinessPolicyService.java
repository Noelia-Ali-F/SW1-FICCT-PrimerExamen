package com.workflow.system.business.service;

import com.workflow.system.business.exception.BusinessRuleException;
import com.workflow.system.business.exception.DiagramInvalidException;
import com.workflow.system.business.exception.ResourceNotFoundException;
import com.workflow.system.business.mapper.BusinessPolicyMapper;
import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.data.model.PolicyStatus;
import com.workflow.system.data.repository.BusinessPolicyRepository;
import com.workflow.system.data.repository.UserRepository;
import com.workflow.system.presentation.dto.diagram.DiagramValidationResponse;
import com.workflow.system.presentation.dto.policy.BusinessPolicyResponse;
import com.workflow.system.presentation.dto.policy.CreateBusinessPolicyRequest;
import com.workflow.system.presentation.dto.policy.UpdateBusinessPolicyRequest;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class BusinessPolicyService {
  private final BusinessPolicyRepository policyRepository;
  private final UserRepository userRepository;
  private final BusinessPolicyMapper policyMapper;
  private final ActivityDiagramService diagramService;

  @SuppressWarnings("null")
  public BusinessPolicyResponse create(CreateBusinessPolicyRequest req) {
    if (policyRepository.existsByNameIgnoreCase(req.getName())) {
      throw new BusinessRuleException("Ya existe una política con ese nombre");
    }
    assertUserExists(req.getResponsibleUserId(), "responsibleUserId no existe");
    assertUserExists(req.getCreatedBy(), "createdBy no existe");

    BusinessPolicy saved =
        policyRepository.save(
            BusinessPolicy.builder()
                .name(req.getName().trim())
                .description(req.getDescription().trim())
                .version(1)
                .status(PolicyStatus.DRAFT)
                .responsibleUserId(req.getResponsibleUserId())
                .createdBy(req.getCreatedBy())
                .build());
    return policyMapper.toResponse(saved);
  }

  public List<BusinessPolicyResponse> findAll() {
    return policyRepository.findAll().stream().map(policyMapper::toResponse).toList();
  }

  public BusinessPolicyResponse findById(String id) {
    return policyMapper.toResponse(getEntity(id));
  }

  @SuppressWarnings("null")
  public BusinessPolicyResponse update(String id, UpdateBusinessPolicyRequest req) {
    BusinessPolicy p = getEntity(id);
    if (p.getStatus() != PolicyStatus.DRAFT) {
      throw new BusinessRuleException("Solo se puede editar una política en estado DRAFT");
    }

    String newName = req.getName().trim();
    if (!newName.equalsIgnoreCase(p.getName()) && policyRepository.existsByNameIgnoreCase(newName)) {
      throw new BusinessRuleException("Ya existe una política con ese nombre");
    }
    assertUserExists(req.getResponsibleUserId(), "responsibleUserId no existe");

    p.setName(newName);
    p.setDescription(req.getDescription().trim());
    p.setResponsibleUserId(req.getResponsibleUserId());
    BusinessPolicy saved = policyRepository.save(p);
    return policyMapper.toResponse(saved);
  }

  public BusinessPolicyResponse deactivate(String id) {
    BusinessPolicy p = getEntity(id);
    p.setStatus(PolicyStatus.INACTIVE);
    BusinessPolicy saved = policyRepository.save(p);
    return policyMapper.toResponse(saved);
  }

  /**
   * MVP: el versionado crea una nueva política en DRAFT con versión +1.
   *
   * <p>Para mantener la regla "nombre único", se genera un nombre único derivado.
   * Luego, cuando conectemos CU3, se puede mejorar el modelo (por ejemplo: basePolicyId).
   */
  @SuppressWarnings("null")
  public BusinessPolicyResponse createVersion(String id, String createdBy) {
    BusinessPolicy p = getEntity(id);
    assertUserExists(createdBy, "createdBy no existe");

    int nextVersion = (p.getVersion() == null ? 1 : p.getVersion()) + 1;
    String baseName = p.getName().trim();
    String candidateName = baseName + " v" + nextVersion;
    if (policyRepository.existsByNameIgnoreCase(candidateName)) {
      candidateName = baseName + " v" + nextVersion + " (" + System.currentTimeMillis() + ")";
    }

    BusinessPolicy saved =
        policyRepository.save(
            BusinessPolicy.builder()
                .name(candidateName)
                .description(p.getDescription())
                .version(nextVersion)
                .status(PolicyStatus.DRAFT)
                .responsibleUserId(p.getResponsibleUserId())
                .createdBy(createdBy)
                .build());
    return policyMapper.toResponse(saved);
  }

  public BusinessPolicyResponse activate(String id) {
    BusinessPolicy p = getEntity(id);
    if (p.getStatus() == PolicyStatus.ACTIVE) {
      throw new BusinessRuleException("La política ya está ACTIVE");
    }

    // Validación de diagrama (RN-02/RN-03 base). Si falla, devolver lista de errores.
    DiagramValidationResponse validation = diagramService.validateDiagramForActivation(id);
    if (!validation.isValid()) {
      throw new DiagramInvalidException(
          "No se puede activar: el diagrama no es válido", validation.getErrors());
    }

    p.setStatus(PolicyStatus.ACTIVE);
    BusinessPolicy saved = policyRepository.save(p);
    return policyMapper.toResponse(saved);
  }

  @SuppressWarnings("null")
  private BusinessPolicy getEntity(String id) {
    return policyRepository
        .findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Política no encontrada"));
  }

  @SuppressWarnings("null")
  private void assertUserExists(String userId, String msg) {
    if (!userRepository.existsById(userId)) {
      throw new BusinessRuleException(msg);
    }
  }
}

