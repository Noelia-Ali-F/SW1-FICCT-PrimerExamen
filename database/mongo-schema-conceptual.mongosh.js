/**
 * Esquema conceptual + índices — alineado con los @Document del backend (Spring Data MongoDB).
 * Base de datos por defecto (application.yml): exsw1 en localhost:27017
 *
 * Uso (PowerShell / bash):
 *   mongosh mongodb://localhost:27017/exsw1 database/mongo-schema-conceptual.mongosh.js
 *
 * Las colecciones ya se crean al insertar desde la app; este script fija nombres e índices
 * para documentación y despliegues limpios (idempotente: createIndex no duplica igual nombre).
 */

db = db.getSiblingDB("exsw1");

const collections = [
  "users",
  "roles",
  "departments",
  "policies",
  "activity_diagrams",
  "dynamic_forms",
  "process_instances",
  "activity_tasks",
  "process_history",
  "notifications"
];

collections.forEach((c) => {
  db.createCollection(c);
});

/* --- users --- */
db.users.createIndex({ email: 1 }, { unique: true, name: "idx_users_email" });

/* --- roles --- */
db.roles.createIndex({ name: 1 }, { unique: true, name: "idx_roles_name" });

/* --- departments --- */
db.departments.createIndex({ name: 1 }, { unique: true, name: "idx_departments_name" });

/* --- policies (BusinessPolicy) --- */
db.policies.createIndex({ name: 1 }, { unique: true, name: "idx_policies_name" });

/* --- activity_diagrams: un diagrama por política --- */
db.activity_diagrams.createIndex({ policyId: 1 }, { unique: true, name: "idx_diagrams_policyId" });

/* --- dynamic_forms: uno por actividad dentro de una política (lógica de negocio) --- */
db.dynamic_forms.createIndex({ policyId: 1 }, { name: "idx_forms_policyId" });
db.dynamic_forms.createIndex({ activityNodeId: 1 }, { name: "idx_forms_activityNodeId" });
/* Lógica en backend: findByPolicyIdAndActivityNodeId — un formulario por actividad (regla de aplicación, no índice único compound en el modelo Java). */

/* --- process_instances --- */
db.process_instances.createIndex({ policyId: 1 }, { name: "idx_pi_policyId" });

/* --- activity_tasks --- */
db.activity_tasks.createIndex({ processInstanceId: 1 }, { name: "idx_at_processInstanceId" });
db.activity_tasks.createIndex({ policyId: 1 }, { name: "idx_at_policyId" });
db.activity_tasks.createIndex({ assignedToUserId: 1 }, { name: "idx_at_assignedUser" });
db.activity_tasks.createIndex({ assignedRoleId: 1 }, { name: "idx_at_role" });
db.activity_tasks.createIndex({ assignedDepartmentId: 1 }, { name: "idx_at_dept" });

/* --- process_history --- */
db.process_history.createIndex({ processInstanceId: 1 }, { name: "idx_ph_processInstanceId" });
db.process_history.createIndex({ policyId: 1 }, { name: "idx_ph_policyId" });

/* --- notifications --- */
db.notifications.createIndex({ userId: 1 }, { name: "idx_notif_userId" });
db.notifications.createIndex({ type: 1 }, { name: "idx_notif_type" });
db.notifications.createIndex({ read: 1 }, { name: "idx_notif_read" });

print("MongoDB exsw1: colecciones e índices conceptuales aplicados.");
