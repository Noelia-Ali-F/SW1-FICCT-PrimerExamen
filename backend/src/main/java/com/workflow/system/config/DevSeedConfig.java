package com.workflow.system.config;

import com.workflow.system.data.model.ActivityDiagram;
import com.workflow.system.data.model.ActivityTask;
import com.workflow.system.data.model.BusinessPolicy;
import com.workflow.system.data.model.Department;
import com.workflow.system.data.model.EdgeType;
import com.workflow.system.data.model.NodeType;
import com.workflow.system.data.model.PolicyStatus;
import com.workflow.system.data.model.ProcessInstance;
import com.workflow.system.data.model.ProcessStatus;
import com.workflow.system.data.model.ResponsibleType;
import com.workflow.system.data.model.Role;
import com.workflow.system.data.model.Status;
import com.workflow.system.data.model.TaskStatus;
import com.workflow.system.data.model.User;
import com.workflow.system.data.repository.ActivityTaskRepository;
import com.workflow.system.data.repository.ActivityDiagramRepository;
import com.workflow.system.data.repository.BusinessPolicyRepository;
import com.workflow.system.data.repository.DepartmentRepository;
import com.workflow.system.data.repository.ProcessInstanceRepository;
import com.workflow.system.data.repository.RoleRepository;
import com.workflow.system.data.repository.UserRepository;
import com.workflow.system.presentation.dto.process.CreateProcessInstanceRequest;
import com.workflow.system.business.service.ProcessInstanceService;
import com.workflow.system.business.service.WorkflowEngineService;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;

@Configuration
@ConditionalOnProperty(name = "app.security.enabled", havingValue = "false", matchIfMissing = true)
@RequiredArgsConstructor
public class DevSeedConfig {
  @Bean
  CommandLineRunner seedAdmin(
      UserRepository users,
      RoleRepository roles,
      DepartmentRepository departments,
      BusinessPolicyRepository policies,
      ActivityDiagramRepository diagrams,
      ProcessInstanceRepository processInstances,
      ActivityTaskRepository tasks,
      ProcessInstanceService processInstanceService,
      WorkflowEngineService engineService,
      PasswordEncoder encoder,
      @Value("${app.seed.realistic:false}") boolean seedRealistic) {
    return args -> {
      // Seed idempotente: garantiza credenciales de prueba aunque ya existan datos.
      Department dep =
          departments
              .findAll()
              .stream()
              .findFirst()
              .orElseGet(
                  () ->
                      departments.save(
                          Department.builder()
                              .name("General")
                              .description("Departamento por defecto")
                              .status(Status.ACTIVE)
                              .build()));

      Role role =
          roles
              .findAll()
              .stream()
              .filter(r -> "ADMIN".equalsIgnoreCase(r.getName()))
              .findFirst()
              .orElseGet(
                  () ->
                      roles.save(
                          Role.builder()
                              .name("ADMIN")
                              .description("Administrador")
                              .permissions(
                                  List.of("ADMIN", "POLICIES_EDIT", "DIAGRAM_EDIT", "REPORTS_VIEW"))
                              .status(Status.ACTIVE)
                              .build()));

      seedUserIfMissing(users, encoder, role.getId(), dep.getId(), "admin@local.test", "Admin");
      seedUserIfMissing(users, encoder, role.getId(), dep.getId(), "admin@local.prueba", "Admin");

      ensureRole(
          roles,
          "SUPERVISOR",
          "Supervisa operaciones y puede ver indicadores (KPI).",
          List.of(
              "POLICIES_VIEW", "DIAGRAM_VIEW", "DIAGRAM_EDIT", "REPORTS_VIEW"));

      // Datos de ejemplo para que el editor de diagramas tenga contenido "humano" y fácil de entender.
      seedDemoData(
          users,
          roles,
          departments,
          policies,
          diagrams,
          processInstances,
          tasks,
          processInstanceService,
          engineService,
          encoder);

      if (seedRealistic) {
        seedRealisticEnterprisePack(
            users,
            roles,
            departments,
            policies,
            diagrams,
            processInstances,
            tasks,
            processInstanceService,
            engineService,
            encoder);
      }
    };
  }

  private static void seedDemoData(
      UserRepository users,
      RoleRepository roles,
      DepartmentRepository departments,
      BusinessPolicyRepository policies,
      ActivityDiagramRepository diagrams,
      ProcessInstanceRepository processInstances,
      ActivityTaskRepository tasks,
      ProcessInstanceService processInstanceService,
      WorkflowEngineService engineService,
      PasswordEncoder encoder) {
    // Roles y departamentos sencillos
    Department rrhh =
        departments
            .findAll()
            .stream()
            .filter(d -> "RRHH".equalsIgnoreCase(d.getName()) || "Recursos Humanos".equalsIgnoreCase(d.getName()))
            .findFirst()
            .orElseGet(
                () ->
                    departments.save(
                        Department.builder()
                            .name("RRHH")
                            .description("Recursos Humanos")
                            .status(Status.ACTIVE)
                            .build()));

    Department ti =
        departments
            .findAll()
            .stream()
            .filter(d -> "TI".equalsIgnoreCase(d.getName()) || "Tecnología".equalsIgnoreCase(d.getName()))
            .findFirst()
            .orElseGet(
                () ->
                    departments.save(
                        Department.builder()
                            .name("TI")
                            .description("Tecnología / Sistemas")
                            .status(Status.ACTIVE)
                            .build()));

    Role solicitante =
        roles
            .findAll()
            .stream()
            .filter(r -> "SOLICITANTE".equalsIgnoreCase(r.getName()))
            .findFirst()
            .orElseGet(
                () ->
                    roles.save(
                        Role.builder()
                            .name("SOLICITANTE")
                            .description("Crea solicitudes")
                            .permissions(List.of("POLICIES_VIEW", "DIAGRAM_VIEW"))
                            .status(Status.ACTIVE)
                            .build()));

    Role aprobador =
        roles
            .findAll()
            .stream()
            .filter(r -> "APROBADOR".equalsIgnoreCase(r.getName()))
            .findFirst()
            .orElseGet(
                () ->
                    roles.save(
                        Role.builder()
                            .name("APROBADOR")
                            .description("Aprueba o rechaza solicitudes")
                            .permissions(List.of("POLICIES_VIEW", "DIAGRAM_VIEW", "DIAGRAM_EDIT"))
                            .status(Status.ACTIVE)
                            .build()));

    seedUserIfMissing(users, encoder, solicitante.getId(), ti.getId(), "ana@local.test", "Ana Solicitante");
    seedUserIfMissing(users, encoder, aprobador.getId(), rrhh.getId(), "carlos@local.test", "Carlos Aprobador");
    // Correo frecuente en pruebas: alinear a rol SOLICITANTE para ver tareas del demo "Solicitud de vacaciones".
    ensureMvpDemoUser(users, encoder, solicitante.getId(), ti.getId(), "usuario@gmail.com");
    // Luis Gómez (capturas/demos): mismo rol/calle que las tareas demo por rol SOLICITANTE.
    ensureMvpDemoUser(users, encoder, solicitante.getId(), ti.getId(), "luis.gomez@local.test");

    // Usuario "creador" para createdBy (cualquiera existente).
    Optional<User> admin =
        users.findByEmailIgnoreCase("admin@local.test").or(() -> users.findByEmailIgnoreCase("admin@local.prueba"));
    String createdBy = admin.map(User::getId).orElse("seed");

    BusinessPolicy vacaciones =
        policies
            .findByNameIgnoreCase("Solicitud de vacaciones")
            .orElseGet(
                () ->
                    policies.save(
                        BusinessPolicy.builder()
                            .name("Solicitud de vacaciones")
                            .description("Flujo simple: solicitar → aprobar/rechazar → notificar.")
                            .version(1)
                            .status(PolicyStatus.DRAFT)
                            .responsibleUserId(createdBy)
                            .createdBy(createdBy)
                            .build()));

    BusinessPolicy compras =
        policies
            .findByNameIgnoreCase("Compra de suministros")
            .orElseGet(
                () ->
                    policies.save(
                        BusinessPolicy.builder()
                            .name("Compra de suministros")
                            .description("Flujo simple: requisición → revisión → aprobación → orden de compra.")
                            .version(1)
                            .status(PolicyStatus.DRAFT)
                            .responsibleUserId(createdBy)
                            .createdBy(createdBy)
                            .build()));

    seedDiagramIfMissing(diagrams, vacaciones, createdBy, solicitante.getId(), aprobador.getId());
    seedDiagramIfMissing(diagrams, compras, createdBy, solicitante.getId(), aprobador.getId());

    // Para que "Trámites" y "Monitoreo" no queden vacíos:
    // - al menos una política debe estar ACTIVE
    // - y deben existir instancias de proceso (process_instances) con tareas/historial.
    BusinessPolicy activePolicy = ensureActive(policies, vacaciones.getId());
    seedProcessInstancesIfMissing(
        processInstances, processInstanceService, engineService, activePolicy.getId(), createdBy);
    makeKpiDataVisible(processInstances, tasks, activePolicy.getId());
    ensureActivityTasksNotEmpty(processInstanceService, activePolicy.getId(), createdBy, tasks);
    materializeFallbackDemoTasks(processInstances, tasks, activePolicy.getId(), solicitante.getId(), createdBy);
  }

  /**
   * Si tras el motor sigue sin haber filas en {@code activity_tasks}, crea un trámite mínimo y una tarea al rol
   * Solicitante para que «Mis actividades» nunca quede en cero en clase/demo.
   */
  private static void materializeFallbackDemoTasks(
      ProcessInstanceRepository processInstances,
      ActivityTaskRepository tasks,
      String policyId,
      String solicitanteRoleId,
      String requestedByUserId) {
    if (tasks.count() > 0) return;
    try {
      ProcessInstance pi =
          processInstances.save(
              ProcessInstance.builder()
                  .policyId(policyId)
                  .status(ProcessStatus.IN_PROGRESS)
                  .requestedBy(requestedByUserId)
                  .currentNodeIds(List.of("n-solicitar"))
                  .startedAt(Instant.now())
                  .build());
      tasks.save(
          ActivityTask.builder()
              .processInstanceId(pi.getId())
              .policyId(policyId)
              .activityNodeId("n-solicitar")
              .activityName("Crear solicitud")
              .status(TaskStatus.PENDING)
              .assignedRoleId(solicitanteRoleId)
              .build());
    } catch (Exception ignored) {
      // no bloquear arranque
    }
  }

  /** Si el motor no materializó ninguna fila en activity_tasks, un intento más para que Mis actividades tenga datos. */
  private static void ensureActivityTasksNotEmpty(
      ProcessInstanceService processInstanceService,
      String policyId,
      String requestedByUserId,
      ActivityTaskRepository tasks) {
    if (tasks.count() > 0) return;
    try {
      CreateProcessInstanceRequest req = new CreateProcessInstanceRequest();
      req.setPolicyId(policyId);
      req.setRequestedBy(requestedByUserId);
      processInstanceService.create(req);
    } catch (Exception ignored) {
      // no bloquear arranque
    }
  }

  private static BusinessPolicy ensureActive(BusinessPolicyRepository policies, String policyId) {
    BusinessPolicy p =
        policies
            .findById(policyId)
            .orElseThrow(() -> new IllegalStateException("Policy faltante en seed: " + policyId));
    if (p.getStatus() != PolicyStatus.ACTIVE) {
      p.setStatus(PolicyStatus.ACTIVE);
      if (p.getVersion() == null) p.setVersion(1);
      policies.save(p);
    }
    return p;
  }

  private static void seedProcessInstancesIfMissing(
      ProcessInstanceRepository processInstances,
      ProcessInstanceService processInstanceService,
      WorkflowEngineService engineService,
      String policyId,
      String requestedByUserId) {
    // 1) Re-intentar iniciar procesos "huérfanos" (CREATED y sin nodo actual)
    var existing = processInstances.findByPolicyId(policyId);
    for (var pi : existing) {
      try {
        if (pi.getStatus() != null
            && "CREATED".equals(pi.getStatus().name())
            && (pi.getCurrentNodeIds() == null || pi.getCurrentNodeIds().isEmpty())) {
          engineService.startProcess(policyId, pi.getId());
        }
      } catch (Exception ignored) {
        // si falla, no bloquear el arranque de la app por demo data
      }
    }

    // 2) Asegurar mínimo 2 trámites de demo
    existing = processInstances.findByPolicyId(policyId);
    int missing = Math.max(0, 2 - existing.size());
    for (int i = 0; i < missing; i++) {
      CreateProcessInstanceRequest req = new CreateProcessInstanceRequest();
      req.setPolicyId(policyId);
      req.setRequestedBy(requestedByUserId);
      try {
        processInstanceService.create(req);
      } catch (Exception ignored) {
        // no bloquear arranque por seed
      }
    }
  }

  /**
   * Genera datos "observables" para KPI:
   * - 1 trámite completado con duración (para promedios),
   * - 1 tarea abierta con startedAt &gt; 48h (para retrasos y cuellos de botella con color).
   *
   * No modifica createdAt/updatedAt (auditoría), solo timestamps de negocio.
   */
  private static void makeKpiDataVisible(
      ProcessInstanceRepository processInstances,
      ActivityTaskRepository tasks,
      String policyId) {
    Instant now = Instant.now();

    var instances = processInstances.findByPolicyId(policyId);
    if (instances.isEmpty()) return;

    // 1) Forzar 1 trámite COMPLETED (si aún no hay ninguno).
    boolean alreadyCompleted =
        instances.stream().anyMatch(pi -> pi.getStatus() != null && "COMPLETED".equals(pi.getStatus().name()));
    if (!alreadyCompleted) {
      var pi = instances.get(0);
      Instant started = now.minus(Duration.ofHours(30));
      Instant finished = now.minus(Duration.ofHours(2));
      pi.setStartedAt(started);
      pi.setFinishedAt(finished);
      pi.setStatus(com.workflow.system.data.model.ProcessStatus.COMPLETED);
      processInstances.save(pi);

      var ts = tasks.findByProcessInstanceId(pi.getId());
      for (var t : ts) {
        t.setStartedAt(started.plus(Duration.ofHours(1)));
        t.setCompletedAt(finished.minus(Duration.ofHours(1)));
        t.setStatus(com.workflow.system.data.model.TaskStatus.COMPLETED);
      }
      tasks.saveAll(ts);
    }

    // 2) Forzar 1 tarea abierta "antigua" para retrasos y bottleneck.
    var open =
        tasks.findAll().stream()
            .filter(t -> policyId.equals(t.getPolicyId()))
            .filter(t -> t.getStatus() == com.workflow.system.data.model.TaskStatus.PENDING
                || t.getStatus() == com.workflow.system.data.model.TaskStatus.IN_PROGRESS)
            .toList();
    if (!open.isEmpty()) {
      var t = open.get(0);
      if (t.getStartedAt() == null) t.setStartedAt(now.minus(Duration.ofHours(72)));
      t.setStatus(com.workflow.system.data.model.TaskStatus.PENDING);
      tasks.save(t);
    }
  }

  private static void seedDiagramIfMissing(
      ActivityDiagramRepository diagrams,
      BusinessPolicy policy,
      String createdBy,
      String solicitanteRoleId,
      String aprobadorRoleId) {
    if (diagrams.existsByPolicyId(policy.getId())) return;

    // Swimlanes por rol (el editor las muestra como “calles”).
    ActivityDiagram.Swimlane laneSolic =
        ActivityDiagram.Swimlane.builder()
            .id("lane-solicitante")
            .name("Solicitante")
            .responsibleType(ResponsibleType.ROLE)
            .responsibleId(solicitanteRoleId)
            .build();

    ActivityDiagram.Swimlane laneAprob =
        ActivityDiagram.Swimlane.builder()
            .id("lane-aprobador")
            .name("Aprobador")
            .responsibleType(ResponsibleType.ROLE)
            .responsibleId(aprobadorRoleId)
            .build();

    // Nodos claros y con posiciones para que se vea ordenado.
    ActivityDiagram.DiagramNode nStart =
        ActivityDiagram.DiagramNode.builder()
            .id("n-start")
            .type(NodeType.START)
            .name("Inicio")
            .swimlaneId(laneSolic.getId())
            .positionX(140.0)
            .positionY(140.0)
            .metadata(Map.of("assigneeName", "Sistema"))
            .build();

    ActivityDiagram.DiagramNode nReq =
        ActivityDiagram.DiagramNode.builder()
            .id("n-solicitar")
            .type(NodeType.ACTIVITY)
            .name("Crear solicitud")
            .description("El solicitante completa los datos básicos.")
            .swimlaneId(laneSolic.getId())
            .positionX(320.0)
            .positionY(140.0)
            .metadata(Map.of("assigneeName", "Solicitante"))
            .build();

    ActivityDiagram.DiagramNode nReview =
        ActivityDiagram.DiagramNode.builder()
            .id("n-revisar")
            .type(NodeType.ACTIVITY)
            .name("Revisar solicitud")
            .description("El aprobador revisa y decide.")
            .swimlaneId(laneAprob.getId())
            .positionX(520.0)
            .positionY(290.0)
            .metadata(Map.of("assigneeName", "Aprobador"))
            .build();

    ActivityDiagram.DiagramNode nDecision =
        ActivityDiagram.DiagramNode.builder()
            .id("n-decision")
            .type(NodeType.DECISION)
            .name("¿Aprobar?")
            .swimlaneId(laneAprob.getId())
            .positionX(700.0)
            .positionY(290.0)
            .metadata(Map.of("assigneeName", "Aprobador"))
            .build();

    ActivityDiagram.DiagramNode nApproved =
        ActivityDiagram.DiagramNode.builder()
            .id("n-aprobada")
            .type(NodeType.ACTIVITY)
            .name("Notificar aprobación")
            .description("Se notifica al solicitante.")
            .swimlaneId(laneSolic.getId())
            .positionX(880.0)
            .positionY(200.0)
            .metadata(Map.of("assigneeName", "Sistema"))
            .build();

    ActivityDiagram.DiagramNode nRejected =
        ActivityDiagram.DiagramNode.builder()
            .id("n-rechazada")
            .type(NodeType.ACTIVITY)
            .name("Notificar rechazo")
            .description("Se notifica el motivo.")
            .swimlaneId(laneSolic.getId())
            .positionX(880.0)
            .positionY(380.0)
            .metadata(Map.of("assigneeName", "Sistema"))
            .build();

    ActivityDiagram.DiagramNode nEnd =
        ActivityDiagram.DiagramNode.builder()
            .id("n-end")
            .type(NodeType.END)
            .name("Fin")
            .swimlaneId(laneSolic.getId())
            .positionX(1070.0)
            .positionY(290.0)
            .metadata(Map.of("assigneeName", "Sistema"))
            .build();

    List<ActivityDiagram.DiagramEdge> edges =
        List.of(
            ActivityDiagram.DiagramEdge.builder()
                .id("e-1")
                .sourceNodeId(nStart.getId())
                .targetNodeId(nReq.getId())
                .label("iniciar")
                .type(EdgeType.NORMAL)
                .build(),
            ActivityDiagram.DiagramEdge.builder()
                .id("e-2")
                .sourceNodeId(nReq.getId())
                .targetNodeId(nReview.getId())
                .label("enviar")
                .type(EdgeType.NORMAL)
                .build(),
            ActivityDiagram.DiagramEdge.builder()
                .id("e-3")
                .sourceNodeId(nReview.getId())
                .targetNodeId(nDecision.getId())
                .label("evaluar")
                .type(EdgeType.NORMAL)
                .build(),
            ActivityDiagram.DiagramEdge.builder()
                .id("e-4")
                .sourceNodeId(nDecision.getId())
                .targetNodeId(nApproved.getId())
                .label("Sí")
                .condition("aprobado == true")
                .type(EdgeType.NORMAL)
                .build(),
            ActivityDiagram.DiagramEdge.builder()
                .id("e-5")
                .sourceNodeId(nDecision.getId())
                .targetNodeId(nRejected.getId())
                .label("No")
                .condition("aprobado == false")
                .type(EdgeType.ALTERNATIVE)
                .build(),
            ActivityDiagram.DiagramEdge.builder()
                .id("e-6")
                .sourceNodeId(nApproved.getId())
                .targetNodeId(nEnd.getId())
                .label("cerrar")
                .type(EdgeType.NORMAL)
                .build(),
            ActivityDiagram.DiagramEdge.builder()
                .id("e-7")
                .sourceNodeId(nRejected.getId())
                .targetNodeId(nEnd.getId())
                .label("cerrar")
                .type(EdgeType.NORMAL)
                .build());

    diagrams.save(
        ActivityDiagram.builder()
            .policyId(policy.getId())
            .createdBy(createdBy)
            .version(policy.getVersion() == null ? 1 : policy.getVersion())
            .swimlanes(List.of(laneSolic, laneAprob))
            .nodes(List.of(nStart, nReq, nReview, nDecision, nApproved, nRejected, nEnd))
            .edges(edges)
            .build());
  }

  private static void seedUserIfMissing(
      UserRepository users,
      PasswordEncoder encoder,
      String roleId,
      String departmentId,
      String email,
      String fullName) {
    if (users.findByEmailIgnoreCase(email).isPresent()) {
      return;
    }
    users.save(
        User.builder()
            .fullName(fullName)
            .email(email)
            .password(encoder.encode("Admin123!"))
            .roleId(roleId)
            .departmentId(departmentId)
            .status(Status.ACTIVE)
            .build());
  }

  /**
   * Crea o actualiza un usuario de prueba para que {@code listMyTasks} devuelva tareas según el rol/depto del carril
   * (muchas pruebas fallan si el usuario existe con otro rol desde Mongo manual).
   */
  private static void ensureMvpDemoUser(
      UserRepository users,
      PasswordEncoder encoder,
      String roleId,
      String departmentId,
      String email) {
    if (email == null || email.isBlank()) {
      return;
    }
    var opt = users.findByEmailIgnoreCase(email.trim());
    if (opt.isEmpty()) {
      seedUserIfMissing(users, encoder, roleId, departmentId, email.trim(), "Usuario demo");
      return;
    }
    User u = opt.get();
    boolean changed = false;
    if (u.getRoleId() == null || !roleId.equals(u.getRoleId())) {
      u.setRoleId(roleId);
      changed = true;
    }
    if (u.getDepartmentId() == null || !departmentId.equals(u.getDepartmentId())) {
      u.setDepartmentId(departmentId);
      changed = true;
    }
    if (u.getStatus() != Status.ACTIVE) {
      u.setStatus(Status.ACTIVE);
      changed = true;
    }
    if (u.getPassword() == null || u.getPassword().isBlank()) {
      u.setPassword(encoder.encode("Admin123!"));
      changed = true;
    }
    if (changed) {
      users.save(u);
    }
  }

  private static void seedRealisticEnterprisePack(
      UserRepository users,
      RoleRepository roles,
      DepartmentRepository departments,
      BusinessPolicyRepository policies,
      ActivityDiagramRepository diagrams,
      ProcessInstanceRepository processInstances,
      ActivityTaskRepository tasks,
      ProcessInstanceService processInstanceService,
      WorkflowEngineService engineService,
      PasswordEncoder encoder) {
    // Departamentos típicos reales
    Department finanzas = ensureDepartment(departments, "Finanzas", "Pagos, reembolsos, contabilidad y caja.");
    Department compras = ensureDepartment(departments, "Compras", "Proveedores, órdenes de compra y abastecimiento.");
    Department operaciones = ensureDepartment(departments, "Operaciones", "Ejecución diaria, logística y servicios.");
    Department legal = ensureDepartment(departments, "Legal", "Contratos, compliance y revisión legal.");
    Department rrhh = ensureDepartment(departments, "Recursos Humanos", "Contratación, bienestar, vacaciones y nómina.");
    Department ti = ensureDepartment(departments, "Tecnología", "Soporte TI, accesos, equipos, ciberseguridad.");

    // Roles típicos (no “ficticios” raros: son roles de empresa)
    Role empleado = ensureRole(roles, "EMPLEADO", "Solicita y registra trámites operativos.", List.of("POLICIES_VIEW", "DIAGRAM_VIEW"));
    Role jefeArea = ensureRole(roles, "JEFE_AREA", "Aprueba solicitudes del equipo.", List.of("POLICIES_VIEW", "DIAGRAM_VIEW", "DIAGRAM_EDIT"));
    Role analistaFin = ensureRole(roles, "ANALISTA_FINANZAS", "Valida gastos, soportes y pagos.", List.of("POLICIES_VIEW", "DIAGRAM_VIEW"));
    Role analistaCompras = ensureRole(roles, "ANALISTA_COMPRAS", "Gestiona proveedores y órdenes de compra.", List.of("POLICIES_VIEW", "DIAGRAM_VIEW"));
    Role analistaLegal = ensureRole(roles, "ANALISTA_LEGAL", "Revisa contratos y términos.", List.of("POLICIES_VIEW", "DIAGRAM_VIEW"));
    Role soporteTi = ensureRole(roles, "SOPORTE_TI", "Atiende solicitudes TI y asigna equipos.", List.of("POLICIES_VIEW", "DIAGRAM_VIEW"));

    // Usuarios con nombres realistas pero sintéticos (sin PII real).
    seedUserIfMissing(users, encoder, empleado.getId(), operaciones.getId(), "luis.gomez@local.test", "Luis Gómez");
    seedUserIfMissing(users, encoder, empleado.getId(), operaciones.getId(), "valentina.rojas@local.test", "Valentina Rojas");
    seedUserIfMissing(users, encoder, jefeArea.getId(), operaciones.getId(), "andres.martinez@local.test", "Andrés Martínez");
    seedUserIfMissing(users, encoder, analistaFin.getId(), finanzas.getId(), "carolina.sanchez@local.test", "Carolina Sánchez");
    seedUserIfMissing(users, encoder, analistaCompras.getId(), compras.getId(), "diego.pineda@local.test", "Diego Pineda");
    seedUserIfMissing(users, encoder, analistaLegal.getId(), legal.getId(), "paula.herrera@local.test", "Paula Herrera");
    seedUserIfMissing(users, encoder, soporteTi.getId(), ti.getId(), "soporte.ti@local.test", "Soporte TI");
    seedUserIfMissing(users, encoder, empleado.getId(), rrhh.getId(), "gestion.rrhh@local.test", "Gestión RRHH");

    Optional<User> admin =
        users.findByEmailIgnoreCase("admin@local.test").or(() -> users.findByEmailIgnoreCase("admin@local.prueba"));
    String createdBy = admin.map(User::getId).orElseGet(() -> users.findAll().stream().findFirst().map(User::getId).orElse("seed"));

    // Políticas muy comunes en empresas reales
    BusinessPolicy reembolso =
        ensurePolicy(
            policies,
            createdBy,
            "Reembolso de gastos",
            "Gastos de viaje/representación: registrar → aprobar → validar → pagar.",
            PolicyStatus.DRAFT);
    BusinessPolicy altaProveedor =
        ensurePolicy(
            policies,
            createdBy,
            "Alta de proveedor",
            "Registro de proveedor: datos → validación compras → revisión legal → activación.",
            PolicyStatus.DRAFT);
    BusinessPolicy equipo =
        ensurePolicy(
            policies,
            createdBy,
            "Solicitud de equipo de cómputo",
            "Equipo nuevo o reemplazo: solicitud → aprobación → asignación TI → entrega.",
            PolicyStatus.DRAFT);
    BusinessPolicy onboarding =
        ensurePolicy(
            policies,
            createdBy,
            "Onboarding de nuevo ingreso",
            "Ingreso de empleado: datos → contrato → accesos → equipo → inducción.",
            PolicyStatus.DRAFT);

    seedDiagramTemplateIfMissing(diagrams, reembolso, createdBy, empleado.getId(), jefeArea.getId(), analistaFin.getId());
    seedDiagramTemplateIfMissing(diagrams, altaProveedor, createdBy, empleado.getId(), analistaCompras.getId(), analistaLegal.getId());
    seedDiagramTemplateIfMissing(diagrams, equipo, createdBy, empleado.getId(), jefeArea.getId(), soporteTi.getId());
    seedDiagramTemplateIfMissing(diagrams, onboarding, createdBy, rrhh.getId(), analistaLegal.getId(), soporteTi.getId());

    // Activar 1-2 para que “Trámites”/“Monitoreo” tengan movimiento.
    BusinessPolicy active1 = ensureActive(policies, reembolso.getId());
    seedProcessInstancesIfMissing(processInstances, processInstanceService, engineService, active1.getId(), createdBy);
    BusinessPolicy active2 = ensureActive(policies, equipo.getId());
    seedProcessInstancesIfMissing(processInstances, processInstanceService, engineService, active2.getId(), createdBy);

    makeKpiDataVisible(processInstances, tasks, active1.getId());
    makeKpiDataVisible(processInstances, tasks, active2.getId());

    // Con paquete realista activo, las tareas abiertas suelen ir al rol EMPLEADO: mismo usuario de prueba.
    ensureMvpDemoUser(users, encoder, empleado.getId(), operaciones.getId(), "usuario@gmail.com");
  }

  private static Department ensureDepartment(DepartmentRepository departments, String name, String description) {
    return departments
        .findAll()
        .stream()
        .filter(d -> normalize(d.getName()).equals(normalize(name)))
        .findFirst()
        .orElseGet(
            () ->
                departments.save(
                    Department.builder()
                        .name(name)
                        .description(description)
                        .status(Status.ACTIVE)
                        .build()));
  }

  private static Role ensureRole(RoleRepository roles, String name, String description, List<String> permissions) {
    return roles
        .findAll()
        .stream()
        .filter(r -> normalize(r.getName()).equals(normalize(name)))
        .findFirst()
        .orElseGet(
            () ->
                roles.save(
                    Role.builder()
                        .name(name)
                        .description(description)
                        .permissions(permissions)
                        .status(Status.ACTIVE)
                        .build()));
  }

  private static BusinessPolicy ensurePolicy(
      BusinessPolicyRepository policies,
      String createdBy,
      String name,
      String description,
      PolicyStatus status) {
    return policies
        .findByNameIgnoreCase(name)
        .orElseGet(
            () ->
                policies.save(
                    BusinessPolicy.builder()
                        .name(name)
                        .description(description)
                        .version(1)
                        .status(status)
                        .responsibleUserId(createdBy)
                        .createdBy(createdBy)
                        .build()));
  }

  private static void seedDiagramTemplateIfMissing(
      ActivityDiagramRepository diagrams,
      BusinessPolicy policy,
      String createdBy,
      String lane1RoleId,
      String lane2RoleId,
      String lane3RoleId) {
    if (diagrams.existsByPolicyId(policy.getId())) return;

    String pname = normalize(policy.getName());

    // 3 carriles para que parezca “empresa real”
    ActivityDiagram.Swimlane l1 =
        ActivityDiagram.Swimlane.builder()
            .id("lane-1")
            .name(laneNameFor(policy.getName(), 1))
            .responsibleType(ResponsibleType.ROLE)
            .responsibleId(lane1RoleId)
            .build();
    ActivityDiagram.Swimlane l2 =
        ActivityDiagram.Swimlane.builder()
            .id("lane-2")
            .name(laneNameFor(policy.getName(), 2))
            .responsibleType(ResponsibleType.ROLE)
            .responsibleId(lane2RoleId)
            .build();
    ActivityDiagram.Swimlane l3 =
        ActivityDiagram.Swimlane.builder()
            .id("lane-3")
            .name(laneNameFor(policy.getName(), 3))
            .responsibleType(ResponsibleType.ROLE)
            .responsibleId(lane3RoleId)
            .build();

    // Plantillas “vida real” por tipo de proceso
    if (pname.contains("reembolso")) {
      saveDiagram(
          diagrams,
          policy,
          createdBy,
          List.of(l1, l2, l3),
          // Nodos
          List.of(
              node("n-start", NodeType.START, "Inicio", l1.getId(), 120, 140, "Solicitud creada"),
              node("n-reg", NodeType.ACTIVITY, "Registrar gasto", l1.getId(), 320, 140, "Monto, fecha, soporte"),
              node("n-apr", NodeType.ACTIVITY, "Aprobación jefe", l2.getId(), 520, 260, "Validar política y presupuesto"),
              node("n-dec", NodeType.DECISION, "¿Aprobado?", l2.getId(), 700, 260, ""),
              node("n-val", NodeType.ACTIVITY, "Validar soportes", l3.getId(), 880, 160, "Factura/recibo y centro de costo"),
              node("n-pay", NodeType.ACTIVITY, "Programar pago", l3.getId(), 1060, 160, "Tesorería: fecha y medio"),
              node("n-rej", NodeType.ACTIVITY, "Notificar rechazo", l1.getId(), 880, 360, "Motivo y corrección"),
              node("n-end", NodeType.END, "Fin", l1.getId(), 1260, 260, "")),
          // Aristas
          List.of(
              edge("e-1", "n-start", "n-reg", "continuar", "", EdgeType.NORMAL),
              edge("e-2", "n-reg", "n-apr", "enviar", "", EdgeType.NORMAL),
              edge("e-3", "n-apr", "n-dec", "evaluar", "", EdgeType.NORMAL),
              edge("e-4", "n-dec", "n-val", "Sí", "aprobado == true", EdgeType.NORMAL),
              edge("e-5", "n-val", "n-pay", "ok", "", EdgeType.NORMAL),
              edge("e-6", "n-pay", "n-end", "cerrar", "", EdgeType.NORMAL),
              edge("e-7", "n-dec", "n-rej", "No", "aprobado == false", EdgeType.ALTERNATIVE),
              edge("e-8", "n-rej", "n-end", "cerrar", "", EdgeType.NORMAL)));
      return;
    }

    if (pname.contains("proveedor")) {
      saveDiagram(
          diagrams,
          policy,
          createdBy,
          List.of(l1, l2, l3),
          List.of(
              node("n-start", NodeType.START, "Inicio", l1.getId(), 120, 140, ""),
              node("n-datos", NodeType.ACTIVITY, "Cargar datos del proveedor", l1.getId(), 330, 140, "RUT/NIT, cuenta, contacto"),
              node("n-valid", NodeType.ACTIVITY, "Validación Compras", l2.getId(), 540, 260, "Riesgo, categoría, documentación"),
              node("n-legal", NodeType.ACTIVITY, "Revisión Legal", l3.getId(), 760, 260, "Contrato, términos, compliance"),
              node("n-dec", NodeType.DECISION, "¿Apto?", l3.getId(), 960, 260, ""),
              node("n-alta", NodeType.ACTIVITY, "Alta en sistema", l2.getId(), 1160, 160, "Crear proveedor y condiciones"),
              node("n-rech", NodeType.ACTIVITY, "Solicitar correcciones", l1.getId(), 1160, 360, "Faltantes / observaciones"),
              node("n-end", NodeType.END, "Fin", l1.getId(), 1360, 260, "")),
          List.of(
              edge("e-1", "n-start", "n-datos", "continuar", "", EdgeType.NORMAL),
              edge("e-2", "n-datos", "n-valid", "enviar", "", EdgeType.NORMAL),
              edge("e-3", "n-valid", "n-legal", "revisar", "", EdgeType.NORMAL),
              edge("e-4", "n-legal", "n-dec", "decidir", "", EdgeType.NORMAL),
              edge("e-5", "n-dec", "n-alta", "Sí", "apto == true", EdgeType.NORMAL),
              edge("e-6", "n-alta", "n-end", "cerrar", "", EdgeType.NORMAL),
              edge("e-7", "n-dec", "n-rech", "No", "apto == false", EdgeType.ALTERNATIVE),
              edge("e-8", "n-rech", "n-end", "cerrar", "", EdgeType.NORMAL)));
      return;
    }

    if (pname.contains("equipo") || pname.contains("computo") || pname.contains("cómputo")) {
      saveDiagram(
          diagrams,
          policy,
          createdBy,
          List.of(l1, l2, l3),
          List.of(
              node("n-start", NodeType.START, "Inicio", l1.getId(), 120, 140, ""),
              node("n-sol", NodeType.ACTIVITY, "Solicitar equipo", l1.getId(), 330, 140, "Motivo y perfil del cargo"),
              node("n-apr", NodeType.ACTIVITY, "Aprobación jefe", l2.getId(), 540, 260, "Presupuesto / prioridad"),
              node("n-dec", NodeType.DECISION, "¿Aprobado?", l2.getId(), 740, 260, ""),
              node("n-asig", NodeType.ACTIVITY, "Asignar equipo", l3.getId(), 940, 160, "Inventario / configuración"),
              node("n-ent", NodeType.ACTIVITY, "Entregar y firmar", l1.getId(), 1140, 160, "Acta de entrega"),
              node("n-rej", NodeType.ACTIVITY, "Notificar rechazo", l1.getId(), 940, 360, "Motivo"),
              node("n-end", NodeType.END, "Fin", l1.getId(), 1340, 260, "")),
          List.of(
              edge("e-1", "n-start", "n-sol", "continuar", "", EdgeType.NORMAL),
              edge("e-2", "n-sol", "n-apr", "enviar", "", EdgeType.NORMAL),
              edge("e-3", "n-apr", "n-dec", "decidir", "", EdgeType.NORMAL),
              edge("e-4", "n-dec", "n-asig", "Sí", "aprobado == true", EdgeType.NORMAL),
              edge("e-5", "n-asig", "n-ent", "listo", "", EdgeType.NORMAL),
              edge("e-6", "n-ent", "n-end", "cerrar", "", EdgeType.NORMAL),
              edge("e-7", "n-dec", "n-rej", "No", "aprobado == false", EdgeType.ALTERNATIVE),
              edge("e-8", "n-rej", "n-end", "cerrar", "", EdgeType.NORMAL)));
      return;
    }

    // Default (por si agregas más políticas)
    seedDiagramIfMissing(diagrams, policy, createdBy, lane1RoleId, lane2RoleId);
  }

  private static void saveDiagram(
      ActivityDiagramRepository diagrams,
      BusinessPolicy policy,
      String createdBy,
      List<ActivityDiagram.Swimlane> lanes,
      List<ActivityDiagram.DiagramNode> nodes,
      List<ActivityDiagram.DiagramEdge> edges) {
    diagrams.save(
        ActivityDiagram.builder()
            .policyId(policy.getId())
            .createdBy(createdBy)
            .version(policy.getVersion() == null ? 1 : policy.getVersion())
            .swimlanes(lanes)
            .nodes(nodes)
            .edges(edges)
            .build());
  }

  private static ActivityDiagram.DiagramNode node(
      String id,
      NodeType type,
      String name,
      String swimlaneId,
      double x,
      double y,
      String description) {
    return ActivityDiagram.DiagramNode.builder()
        .id(id)
        .type(type)
        .name(name)
        .description(description == null || description.isBlank() ? null : description)
        .swimlaneId(swimlaneId)
        .positionX(x)
        .positionY(y)
        .metadata(Map.of("assigneeName", nameAssigneeFallback(swimlaneId)))
        .build();
  }

  private static ActivityDiagram.DiagramEdge edge(
      String id,
      String source,
      String target,
      String label,
      String condition,
      EdgeType type) {
    return ActivityDiagram.DiagramEdge.builder()
        .id(id)
        .sourceNodeId(source)
        .targetNodeId(target)
        .label(label)
        .condition(condition)
        .type(type)
        .build();
  }

  private static String laneNameFor(String policyName, int idx) {
    String n = normalize(policyName);
    if (n.contains("reembolso")) {
      return idx == 1 ? "Empleado" : (idx == 2 ? "Jefatura" : "Finanzas");
    }
    if (n.contains("proveedor")) {
      return idx == 1 ? "Solicitante" : (idx == 2 ? "Compras" : "Legal");
    }
    if (n.contains("equipo") || n.contains("computo") || n.contains("cómputo")) {
      return idx == 1 ? "Solicitante" : (idx == 2 ? "Jefatura" : "TI");
    }
    if (n.contains("onboarding") || n.contains("ingreso")) {
      return idx == 1 ? "RRHH" : (idx == 2 ? "Legal" : "TI");
    }
    return idx == 1 ? "Solicitante" : (idx == 2 ? "Aprobación" : "Operación");
  }

  private static String nameAssigneeFallback(String swimlaneId) {
    // Solo para que el editor no muestre IDs; el texto real lo editas en UI.
    if (swimlaneId == null) return "Sistema";
    return switch (swimlaneId) {
      case "lane-1" -> "Equipo";
      case "lane-2" -> "Aprobación";
      case "lane-3" -> "Operación";
      default -> "Sistema";
    };
  }

  private static String normalize(String s) {
    String t = s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    return Normalizer.normalize(t, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
  }
}

