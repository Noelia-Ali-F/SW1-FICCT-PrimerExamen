import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ActivityTask } from '../../core/models/activity-task.model';
import { ProcessHistory } from '../../core/models/process-history.model';
import { ProcessInstance } from '../../core/models/process-instance.model';
import { ActivityDiagram, DiagramNode, Swimlane } from '../../core/models/activity-diagram.model';
import { ActivityDiagramService } from '../../core/services/activity-diagram.service';
import { ProcessInstanceService } from '../../core/services/process-instance.service';
import { TaskService } from '../../core/services/task.service';
import { WorkflowRealtimeService } from '../../core/services/workflow-realtime.service';
import { mapHttpError } from '../../shared/utils/http-error.util';
import {
  getDetailStatClass,
  getHistoryItemClass,
  getProcessStatusClass,
  getStatusLabel,
  getTaskStatusClass
} from '../../shared/utils/status-style.util';
import { debounceTime } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Detalle de trámite</h2>
          <p class="muted" *ngIf="processId() as pid">ID: <code>{{ pid }}</code></p>
        </div>
        <div class="actions">
          <button type="button" class="secondary" (click)="reload()" [disabled]="loading()">Actualizar</button>
          <a routerLink="/process-instances" class="link-as-button">Volver</a>
        </div>
      </header>

      <div class="card">
        <div class="toolbar">
          <span class="success" *ngIf="success()">{{ success() }}</span>
          <span class="error" *ngIf="error()">{{ error() }}</span>
        </div>

        <ng-container *ngIf="process() as p; else noData">
          <div class="grid-2">
            <div>
              <h3 class="card-title">Trámite</h3>
              <div class="kv"><span class="k">policyId</span><span class="v">{{ p.policyId }}</span></div>
              <div class="kv">
                <span class="k">status</span>
                <span class="v"><span [class]="processStatusBadgeClass(p.status)">{{ processStatusLabel(p.status) }}</span></span>
              </div>
              <div class="kv"><span class="k">requestedBy</span><span class="v">{{ p.requestedBy }}</span></div>
              <div class="kv">
                <span class="k">currentNodeIds</span>
                <span class="v">{{ p.currentNodeIds.length ? p.currentNodeIds.join(', ') : '-' }}</span>
              </div>
              <div class="kv"><span class="k">Nodo actual</span><span class="v">{{ currentNodeLabel() }}</span></div>
            </div>
            <div>
              <h3 class="card-title">Tiempos</h3>
              <div class="kv">
                <span class="k">startedAt</span>
                <span class="v">{{ p.startedAt ? (p.startedAt | date: 'short') : '-' }}</span>
              </div>
              <div class="kv">
                <span class="k">finishedAt</span>
                <span class="v">{{ p.finishedAt ? (p.finishedAt | date: 'short') : '-' }}</span>
              </div>
              <div class="kv">
                <span class="k">createdAt</span>
                <span class="v">{{ p.createdAt ? (p.createdAt | date: 'short') : '-' }}</span>
              </div>
              <div class="kv">
                <span class="k">updatedAt</span>
                <span class="v">{{ p.updatedAt ? (p.updatedAt | date: 'short') : '-' }}</span>
              </div>
            </div>
          </div>
        </ng-container>
        <ng-template #noData>
          <p class="muted">Cargando o no existe el trámite.</p>
        </ng-template>
      </div>

      <div class="card" *ngIf="process() as p">
        <h3 class="card-title">Avance</h3>
        <div class="stats">
          <div [class]="detailStatClass('total')"><span class="n">{{ totalTasks() }}</span><span class="l">Total</span></div>
          <div [class]="detailStatClass('pending')"><span class="n">{{ pendingTasks() }}</span><span class="l">Pendientes</span></div>
          <div [class]="detailStatClass('inProgress')"><span class="n">{{ inProgressTasks() }}</span><span class="l">En proceso</span></div>
          <div [class]="detailStatClass('completed')"><span class="n">{{ completedTasks() }}</span><span class="l">Completadas</span></div>
          <div [class]="detailStatClass('cancelled')"><span class="n">{{ cancelledTasks() }}</span><span class="l">Canceladas</span></div>
        </div>
      </div>

      <div class="card" *ngIf="process() as p">
        <div class="flow-head">
          <h3 class="card-title" style="margin:0">Flujo (semáforo por actividad)</h3>
          <span class="muted small" *ngIf="!diagram()">Cargando diagrama…</span>
        </div>
        <p class="muted small" style="margin:8px 0 12px">
          Verde: completada · Amarillo: en proceso · Rojo: pendiente · Gris: sin tarea aún.
        </p>
        <ng-container *ngIf="diagram() as d; else noDiagram">
          <div class="lane-grid" *ngIf="orderedSwimlanes(d).length; else noLanes">
            <div class="lane" *ngFor="let s of orderedSwimlanes(d)">
              <div class="lane-title">{{ s.name }}</div>
              <div class="lane-sub muted small">Responsable: {{ s.responsibleType }} {{ s.responsibleId }}</div>
              <div class="chips">
                <div
                  *ngFor="let n of activityNodesForLane(d, s.id)"
                  class="chip"
                  [class.chip-green]="nodeSemaforo(n.id) === 'GREEN'"
                  [class.chip-yellow]="nodeSemaforo(n.id) === 'YELLOW'"
                  [class.chip-red]="nodeSemaforo(n.id) === 'RED'"
                  [class.chip-gray]="nodeSemaforo(n.id) === 'GRAY'"
                >
                  <span class="dot" aria-hidden="true"></span>
                  <span class="chip-text">{{ n.name || n.id }}</span>
                </div>
              </div>
            </div>
          </div>
          <ng-template #noLanes>
            <p class="muted">El diagrama no tiene swimlanes definidas.</p>
          </ng-template>
        </ng-container>
        <ng-template #noDiagram>
          <p class="muted">No hay diagrama asociado a esta política.</p>
        </ng-template>
      </div>

      <div class="card">
        <h3 class="card-title">Tareas del trámite</h3>
        <table class="table" *ngIf="tasks().length; else empty">
          <thead>
            <tr>
              <th>Actividad</th>
              <th>Estado</th>
              <th>Asignación</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let t of tasks()">
              <td>{{ t.activityName }}</td>
              <td><span [class]="taskStatusBadgeClass(t.status)">{{ taskStatusLabel(t.status) }}</span></td>
              <td class="muted">
                <div *ngIf="t.assignedToUserId">USER: {{ t.assignedToUserId }}</div>
                <div *ngIf="t.assignedRoleId">ROLE: {{ t.assignedRoleId }}</div>
                <div *ngIf="t.assignedDepartmentId">DEPT: {{ t.assignedDepartmentId }}</div>
              </td>
              <td class="nowrap">{{ t.startedAt ? (t.startedAt | date: 'short') : '-' }}</td>
              <td class="nowrap">{{ t.completedAt ? (t.completedAt | date: 'short') : '-' }}</td>
              <td>{{ t.observations || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty>
          <p class="muted">No hay tareas asociadas aún.</p>
        </ng-template>
      </div>

      <div class="card">
        <h3 class="card-title">Trazabilidad del proceso</h3>
        <div class="timeline" *ngIf="history().length; else emptyHistory">
          <div [class]="historyItemClass(h)" *ngFor="let h of history()">
            <div class="dot"></div>
            <div class="content">
              <div class="top">
                <div class="when">{{ h.createdAt ? (h.createdAt | date: 'short') : '-' }}</div>
                <div class="action"><code>{{ h.action }}</code></div>
              </div>
              <div class="details">
                <span class="pill" *ngIf="h.activityNodeId">Actividad: {{ h.activityNodeId }}</span>
                <span class="pill" *ngIf="h.userId">Usuario: {{ h.userId }}</span>
                <span class="pill" *ngIf="h.previousStatus">Prev: {{ h.previousStatus }}</span>
                <span class="pill" *ngIf="h.newStatus">Nuevo: {{ h.newStatus }}</span>
              </div>
              <div class="obs" *ngIf="h.observation">{{ h.observation }}</div>
            </div>
          </div>
        </div>
        <ng-template #emptyHistory>
          <p class="muted">No hay eventos de historial aún.</p>
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
        border-radius: 8px;
        border: 1px solid #d1d5db;
        background: #fff;
        color: #111827;
        font-size: 13px;
        text-decoration: none;
      }
      .card-title {
        margin: 0 0 10px;
        font-size: 15px;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      @media (max-width: 900px) {
        .grid-2 {
          grid-template-columns: 1fr;
        }
      }
      .kv {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 8px;
        padding: 4px 0;
        font-size: 13px;
      }
      .k {
        color: #6b7280;
      }
      .v {
        color: #111827;
        word-break: break-word;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 900px) {
        .stats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      td.nowrap {
        white-space: nowrap;
      }
      .timeline {
        display: grid;
        gap: 10px;
      }
      .timeline-item {
        display: grid;
        grid-template-columns: 12px 1fr;
        gap: 10px;
        align-items: start;
      }
      .dot {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        margin-top: 4px;
        background: #64748b;
      }
      .timeline-item-success .dot {
        background: #22c55e;
      }
      .timeline-item-progress .dot {
        background: #f59e0b;
      }
      .timeline-item-cancelled .dot {
        background: #94a3b8;
      }
      .content {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 10px;
        background: #fff;
      }
      .top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        margin-bottom: 6px;
      }
      .when {
        font-size: 12px;
        color: #6b7280;
      }
      .details {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .pill {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        color: #374151;
      }
      .flow-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .lane-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      @media (max-width: 1100px) {
        .lane-grid {
          grid-template-columns: 1fr;
        }
      }
      .lane {
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 12px;
        background: #fff;
      }
      .lane-title {
        font-weight: 900;
        font-size: 13px;
      }
      .lane-sub {
        margin-top: 4px;
      }
      .chips {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        border: 1px solid #e5e7eb;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 750;
        background: #f9fafb;
        color: #111827;
      }
      .chip .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #94a3b8;
      }
      .chip-green {
        border-color: #bbf7d0;
        background: #f0fdf4;
        color: #14532d;
      }
      .chip-green .dot {
        background: #22c55e;
      }
      .chip-yellow {
        border-color: #fde68a;
        background: #fffbeb;
        color: #92400e;
      }
      .chip-yellow .dot {
        background: #f59e0b;
      }
      .chip-red {
        border-color: #fecaca;
        background: #fef2f2;
        color: #7f1d1d;
      }
      .chip-red .dot {
        background: #ef4444;
      }
      .chip-gray {
        opacity: 0.9;
      }
      .obs {
        margin-top: 8px;
        font-size: 13px;
        color: #111827;
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class ProcessDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly processService = inject(ProcessInstanceService);
  private readonly taskService = inject(TaskService);
  private readonly diagramService = inject(ActivityDiagramService);
  private readonly realtime = inject(WorkflowRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly processId = toSignal(this.route.paramMap.pipe(map((pm) => pm.get('id'))), { initialValue: null });

  readonly process = signal<ProcessInstance | null>(null);
  readonly tasks = signal<ActivityTask[]>([]);
  readonly history = signal<ProcessHistory[]>([]);
  readonly diagram = signal<ActivityDiagram | null>(null);

  readonly loading = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly totalTasks = computed(() => this.tasks().length);
  readonly pendingTasks = computed(() => this.tasks().filter((t) => t.status === 'PENDING').length);
  readonly inProgressTasks = computed(() => this.tasks().filter((t) => t.status === 'IN_PROGRESS').length);
  readonly completedTasks = computed(() => this.tasks().filter((t) => t.status === 'COMPLETED').length);
  readonly cancelledTasks = computed(() => this.tasks().filter((t) => t.status === 'CANCELLED').length);

  readonly currentNodeLabel = computed(() => {
    const p = this.process();
    if (!p?.currentNodeIds?.length) return '-';
    return p.currentNodeIds.join(', ');
  });

  readonly nodeStatus = computed(() => this.buildNodeStatus(this.tasks()));

  processStatusBadgeClass(status: ProcessInstance['status']): string {
    return getProcessStatusClass(status);
  }

  processStatusLabel(status: ProcessInstance['status']): string {
    return getStatusLabel(status);
  }

  taskStatusBadgeClass(status: ActivityTask['status']): string {
    return getTaskStatusClass(status);
  }

  taskStatusLabel(status: ActivityTask['status']): string {
    return getStatusLabel(status);
  }

  detailStatClass(kind: 'total' | 'pending' | 'inProgress' | 'completed' | 'cancelled'): string {
    return getDetailStatClass(kind);
  }

  historyItemClass(h: ProcessHistory): string {
    return getHistoryItemClass(h.action);
  }

  ngOnInit() {
    this.reload();

    // tiempo real: si llega un evento para este trámite, recargar
    this.realtime.connect();
    this.realtime.events$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((ev) => {
        const pid = this.processId();
        if (!pid) return;
        const p = (ev.payload?.['processInstanceId'] as string | undefined) ?? '';
        if (p && p === pid && !this.loading()) this.reload();
      });
  }

  reload() {
    const id = this.processId();
    if (!id) return;
    this.loading.set(true);
    this.success.set(null);
    this.error.set(null);

    forkJoin({
      process: this.processService.getById(id),
      tasks: this.taskService.list(),
      history: this.processService.getHistory(id)
    }).subscribe({
      next: ({ process, tasks, history }) => {
        this.process.set(process);
        this.tasks.set(tasks.filter((t) => t.processInstanceId === process.id));
        this.history.set(history);
        this.loadDiagramForProcess(process);
        this.success.set('Actualizado');
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando detalle del trámite')),
      complete: () => this.loading.set(false)
    });
  }

  private loadDiagramForProcess(process: ProcessInstance) {
    const policyId = process.policyId;
    if (!policyId) {
      this.diagram.set(null);
      return;
    }
    this.diagramService.getDiagram(policyId).subscribe({
      next: (d) => this.diagram.set(d),
      error: () => this.diagram.set(null)
    });
  }

  orderedSwimlanes(d: ActivityDiagram): Swimlane[] {
    return (d.swimlanes ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  activityNodesForLane(d: ActivityDiagram, swimlaneId: string): DiagramNode[] {
    const nodes = d.nodes ?? [];
    return nodes
      .filter((n) => n.type === 'ACTIVITY' && n.swimlaneId === swimlaneId)
      .slice()
      .sort((a, b) => (a.positionX ?? 0) - (b.positionX ?? 0));
  }

  nodeSemaforo(nodeId: string): 'GREEN' | 'YELLOW' | 'RED' | 'GRAY' {
    return this.nodeStatus()[nodeId] ?? 'GRAY';
  }

  private buildNodeStatus(tasks: ActivityTask[]): Record<string, 'GREEN' | 'YELLOW' | 'RED'> {
    // Prioridad: COMPLETED > IN_PROGRESS > PENDING. Cancelled no pinta.
    const byNode: Record<string, 'GREEN' | 'YELLOW' | 'RED'> = {};
    for (const t of tasks) {
      const nodeId = t.activityNodeId;
      if (!nodeId) continue;
      if (t.status === 'COMPLETED') {
        byNode[nodeId] = 'GREEN';
        continue;
      }
      if (t.status === 'IN_PROGRESS') {
        if (byNode[nodeId] !== 'GREEN') byNode[nodeId] = 'YELLOW';
        continue;
      }
      if (t.status === 'PENDING') {
        if (!byNode[nodeId]) byNode[nodeId] = 'RED';
      }
    }
    return byNode;
  }
}

