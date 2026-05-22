import type { PolicyStatus } from '../../core/models/business-policy.model';
import type { ProcessStatus } from '../../core/models/process-instance.model';
import type { TaskStatus } from '../../core/models/activity-task.model';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
  CREATED: 'Creado',
  IN_PROGRESS: 'En proceso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  PENDING: 'Pendiente'
};

/** Etiqueta legible para cualquier código de estado conocido (política, trámite o tarea). */
export function getStatusLabel(status: string | null | undefined): string {
  if (status == null || status === '') return '—';
  return STATUS_LABELS[status] ?? status;
}

/** Clases para badge de estado de política (DRAFT azul/gris, ACTIVE verde, INACTIVE gris). */
export function getPolicyStatusClass(status: PolicyStatus | string | null | undefined): string {
  const base = 'status-badge';
  switch (status) {
    case 'DRAFT':
      return `${base} status-draft`;
    case 'ACTIVE':
      return `${base} status-active`;
    case 'INACTIVE':
      return `${base} status-inactive`;
    default:
      return `${base} status-inactive`;
  }
}

/** Clases para badge de estado de trámite. */
export function getProcessStatusClass(status: ProcessStatus | string | null | undefined): string {
  const base = 'status-badge';
  switch (status) {
    case 'CREATED':
      return `${base} status-created`;
    case 'IN_PROGRESS':
      return `${base} status-in-progress`;
    case 'COMPLETED':
      return `${base} status-completed`;
    case 'CANCELLED':
      return `${base} status-cancelled`;
    default:
      return `${base} status-cancelled`;
  }
}

/** Clases para badge de estado de tarea. */
export function getTaskStatusClass(status: TaskStatus | string | null | undefined): string {
  const base = 'status-badge';
  switch (status) {
    case 'PENDING':
      return `${base} status-pending`;
    case 'IN_PROGRESS':
      return `${base} status-in-progress`;
    case 'COMPLETED':
      return `${base} status-completed`;
    case 'CANCELLED':
      return `${base} status-cancelled`;
    default:
      return `${base} status-cancelled`;
  }
}

/** Acento de tarjeta/listado para trámites (borde lateral). */
export function getProcessCardAccentClass(status: ProcessStatus | string | null | undefined): string {
  switch (status) {
    case 'CREATED':
      return 'proc-accent-created';
    case 'IN_PROGRESS':
      return 'proc-accent-in-progress';
    case 'COMPLETED':
      return 'proc-accent-completed';
    case 'CANCELLED':
      return 'proc-accent-cancelled';
    default:
      return '';
  }
}

/** Fila de tarea: fondo/borde suave según estado. */
export function getTaskRowHighlightClass(status: TaskStatus | string | null | undefined): string {
  switch (status) {
    case 'PENDING':
      return 'task-row-pending';
    case 'IN_PROGRESS':
      return 'task-row-in-progress';
    case 'COMPLETED':
      return 'task-row-completed';
    case 'CANCELLED':
      return 'task-row-cancelled';
    default:
      return '';
  }
}

/** Tarjeta de métrica en detalle de trámite. */
export function getDetailStatClass(kind: 'total' | 'pending' | 'inProgress' | 'completed' | 'cancelled'): string {
  const base = 'stat-card';
  switch (kind) {
    case 'total':
      return `${base} stat-card-total`;
    case 'pending':
      return `${base} stat-card-pending`;
    case 'inProgress':
      return `${base} stat-card-in-progress`;
    case 'completed':
      return `${base} stat-card-completed`;
    case 'cancelled':
      return `${base} stat-card-cancelled`;
    default:
      return base;
  }
}

/** Línea de historial: acento visual según acción. */
export function getHistoryItemClass(action: string | null | undefined): string {
  const a = (action ?? '').toUpperCase();
  if (a.includes('CANCEL') || a.includes('CANCELLED')) return 'timeline-item timeline-item-cancelled';
  if (a.includes('COMPLETE') || a.includes('COMPLETED')) return 'timeline-item timeline-item-success';
  if (a.includes('START') || a.includes('PROGRESS') || a.includes('ASSIGN')) {
    return 'timeline-item timeline-item-progress';
  }
  return 'timeline-item';
}

/** KPI en reportes según tipo semántico. */
export function getReportKpiToneClass(tone: 'neutral' | 'progress' | 'success' | 'warning' | 'danger'): string {
  return `kpi-tone kpi-tone-${tone}`;
}
