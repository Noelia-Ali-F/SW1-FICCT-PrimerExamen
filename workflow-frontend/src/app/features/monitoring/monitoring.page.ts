import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter } from 'rxjs/operators';
import { ActivityTask } from '../../core/models/activity-task.model';
import { ProcessHistory } from '../../core/models/process-history.model';
import { ProcessInstance } from '../../core/models/process-instance.model';
import { ProcessInstanceService } from '../../core/services/process-instance.service';
import { TaskService } from '../../core/services/task.service';
import { WorkflowRealtimeService } from '../../core/services/workflow-realtime.service';
import { mapHttpError } from '../../shared/utils/http-error.util';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Monitoreo y trazabilidad</h2>
          <p class="muted" *ngIf="processId() as pid">Seguimiento detallado del trámite <code>{{ pid }}</code></p>
        </div>
        <div class="actions" style="align-items:center">
          <button type="button" class="secondary" (click)="reload()" [disabled]="loading() || !processId()">
            Actualizar
          </button>
          <a routerLink="/process-instances" class="link-as-button">Volver</a>
        </div>
      </header>

      <div class="card" *ngIf="success() || error()">
        <p class="success" *ngIf="success()">{{ success() }}</p>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </div>

      <div class="summary" *ngIf="process() as p">
        <div class="sum-card">
          <div class="sum-label">Estado actual</div>
          <div
            class="sum-value pill"
            [class.pill-yellow]="p.status === 'IN_PROGRESS'"
            [class.pill-green]="p.status === 'COMPLETED'"
            [class.pill-gray]="p.status === 'CREATED' || p.status === 'CANCELLED'"
          >
            {{ statusLabel(p.status) }}
          </div>
        </div>
        <div class="sum-card">
          <div class="sum-label">Política</div>
          <div class="sum-text">{{ p.policyId }}</div>
        </div>
        <div class="sum-card">
          <div class="sum-label">Responsable actual</div>
          <div class="sum-text">{{ p.requestedBy }}</div>
        </div>
        <div class="sum-card">
          <div class="sum-label">Actividad actual</div>
          <div class="sum-text">{{ currentActivityLabel(p) }}</div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3 class="card-title">Actividades completadas</h3>
          <ng-container *ngIf="completedTasks().length; else noDone">
            <div class="activity-row activity-done" *ngFor="let t of completedTasks()">
              <div class="activity-title">{{ t.activityName }}</div>
              <div class="activity-sub">
                {{ t.assignedToUserId || t.assignedRoleId || t.assignedDepartmentId || '—' }} ·
                {{ t.completedAt ? (t.completedAt | date: 'short') : '' }}
              </div>
            </div>
          </ng-container>
          <ng-template #noDone>
            <p class="muted small" style="margin:0">Aún no hay actividades completadas.</p>
          </ng-template>
        </div>

        <div class="card">
          <h3 class="card-title">Actividades pendientes</h3>
          <ng-container *ngIf="pendingTasks().length; else noPend">
            <div class="activity-row activity-current" *ngFor="let t of pendingTasks()">
              <div class="activity-title">{{ t.activityName }}</div>
              <div class="activity-sub">
                {{ statusLabelTask(t.status) }} ·
                {{ t.assignedToUserId || t.assignedRoleId || t.assignedDepartmentId || '—' }}
              </div>
            </div>
          </ng-container>
          <ng-template #noPend>
            <p class="muted small" style="margin:0">No hay actividades pendientes.</p>
          </ng-template>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">Línea de tiempo del trámite</h3>

        <div class="timeline" *ngIf="history().length; else noHistory">
          <div class="tl-item" *ngFor="let h of history()">
            <div class="tl-dot" [class.tl-green]="isGoodHistory(h.action)" [class.tl-yellow]="!isGoodHistory(h.action)"></div>
            <div class="tl-body">
              <div class="tl-title">{{ historyTitle(h) }}</div>
              <div class="tl-sub muted small">
                <span *ngIf="h.observation">{{ h.observation }}</span>
                <span *ngIf="!h.observation"><code>{{ h.action }}</code></span>
              </div>
            </div>
            <div class="tl-when muted small">{{ h.createdAt ? (h.createdAt | date:'yyyy-MM-dd HH:mm') : '-' }}</div>
          </div>
        </div>
        <ng-template #noHistory>
          <p class="muted" style="margin:0">No hay eventos de historial aún.</p>
        </ng-template>
      </div>
    </section>
  `,
  styles: [
    `
      code {
        font-size: 12px;
      }
      .link-as-button {
        display: inline-block;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
        color: var(--text);
        font-size: 13px;
        text-decoration: none;
        font-weight: 600;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .sum-card {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
        padding: 14px;
        min-width: 0;
      }
      .sum-label {
        font-size: 12px;
        color: var(--muted);
        font-weight: 650;
      }
      .sum-text {
        margin-top: 6px;
        font-size: 13px;
        font-weight: 850;
        color: var(--text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sum-value {
        margin-top: 8px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .pill-yellow {
        color: #92400e;
        background: #fffbeb;
        border-color: #fde68a;
      }
      .pill-green {
        color: #166534;
        background: #f0fdf4;
        border-color: #bbf7d0;
      }
      .pill-gray {
        color: var(--muted);
        background: color-mix(in srgb, var(--panel-solid) 75%, transparent);
        border-color: var(--border);
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        align-items: start;
      }

      .card {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
        padding: 14px;
      }

      .card-title {
        margin: 0 0 10px;
        font-size: 14px;
        letter-spacing: 0.01em;
      }

      .activity-row {
        border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        border-radius: 14px;
        padding: 12px;
        background: color-mix(in srgb, var(--panel-solid) 80%, transparent);
      }
      .activity-row + .activity-row {
        margin-top: 10px;
      }
      .activity-title {
        font-size: 13px;
        font-weight: 900;
        color: var(--text);
      }
      .activity-sub {
        margin-top: 4px;
        font-size: 12px;
        color: var(--muted);
      }
      .activity-done {
        background: #dcfce7;
        border-color: #bbf7d0;
      }
      .activity-current {
        background: #fef9c3;
        border-color: #fde68a;
      }
      .activity-muted {
        opacity: 0.65;
      }

      .timeline {
        display: grid;
        gap: 12px;
      }
      .tl-item {
        display: grid;
        grid-template-columns: 28px 1fr auto;
        gap: 12px;
        align-items: start;
      }
      .tl-dot {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        border: 3px solid #ffffff;
        box-shadow: 0 10px 22px rgba(2, 6, 23, 0.12);
        margin-top: 2px;
      }
      .tl-green {
        background: #22c55e;
      }
      .tl-yellow {
        background: #f59e0b;
      }
      .tl-title {
        font-weight: 900;
        font-size: 13px;
        color: var(--text);
      }
      .tl-when {
        white-space: nowrap;
        padding-top: 2px;
      }

      @media (max-width: 1100px) {
        .summary {
          grid-template-columns: 1fr;
        }
        .grid {
          grid-template-columns: 1fr;
        }
        .tl-item {
          grid-template-columns: 28px 1fr;
        }
        .tl-when {
          grid-column: 2;
        }
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class MonitoringPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly processService = inject(ProcessInstanceService);
  private readonly taskService = inject(TaskService);
  private readonly realtime = inject(WorkflowRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly processId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly process = signal<ProcessInstance | null>(null);
  readonly history = signal<ProcessHistory[]>([]);
  readonly tasks = signal<ActivityTask[]>([]);

  readonly completedTasks = computed(() => this.tasks().filter((t) => t.status === 'COMPLETED'));
  readonly pendingTasks = computed(() =>
    this.tasks().filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS')
  );

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.processId.set(id);
    if (id) this.reload();

    this.realtime.connect();
    this.realtime.events$
      .pipe(
        filter(() => !!this.processId()),
        debounceTime(350),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (!this.loading()) this.reload();
      });
  }

  reload() {
    const id = this.processId();
    if (!id) return;
    this.loading.set(true);
    this.success.set(null);
    this.error.set(null);

    this.processService.getById(id).subscribe({
      next: (p) => this.process.set(p),
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando trámite'))
    });

    this.processService.getHistory(id).subscribe({
      next: (h) => this.history.set([...h].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))),
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando historial'))
    });

    this.taskService.list().subscribe({
      next: (all) => this.tasks.set(all.filter((t) => t.processInstanceId === id)),
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando tareas')),
      complete: () => this.loading.set(false)
    });
  }

  statusLabel(st: ProcessInstance['status']) {
    switch (st) {
      case 'IN_PROGRESS':
        return 'En proceso';
      case 'COMPLETED':
        return 'Completado';
      case 'CANCELLED':
        return 'Cancelado';
      case 'CREATED':
      default:
        return 'Pendiente';
    }
  }

  statusLabelTask(st: ActivityTask['status']) {
    switch (st) {
      case 'IN_PROGRESS':
        return 'En proceso';
      case 'COMPLETED':
        return 'Completado';
      case 'CANCELLED':
        return 'Cancelado';
      case 'PENDING':
      default:
        return 'Pendiente';
    }
  }

  currentActivityLabel(p: ProcessInstance) {
    return p.currentNodeIds?.length ? p.currentNodeIds[0] : '-';
  }

  isGoodHistory(action: ProcessHistory['action']) {
    return action !== 'PROCESS_CANCELLED';
  }

  historyTitle(h: ProcessHistory) {
    switch (h.action) {
      case 'PROCESS_CREATED':
        return 'Trámite creado';
      case 'TASK_CREATED':
        return 'Tarea asignada';
      case 'TASK_STARTED':
        return 'Tarea iniciada';
      case 'TASK_COMPLETED':
        return 'Tarea completada';
      case 'PROCESS_ADVANCED':
        return 'Proceso avanzado';
      case 'PROCESS_COMPLETED':
        return 'Proceso completado';
      case 'PROCESS_CANCELLED':
        return 'Proceso cancelado';
      default:
        return 'Evento';
    }
  }
}

