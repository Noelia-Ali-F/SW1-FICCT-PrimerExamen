import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { mapHttpError } from '../../shared/utils/http-error.util';
import { BusinessPolicy } from '../../core/models/business-policy.model';
import { ProcessInstance } from '../../core/models/process-instance.model';
import { DashboardReport } from '../../core/models/dashboard-report.model';
import { PolicyService } from '../../core/services/policy.service';
import { ProcessInstanceService } from '../../core/services/process-instance.service';
import { Bottleneck, RecentItem, ReportService } from '../../core/services/report.service';
import { TaskService } from '../../core/services/task.service';
import { ActivityTask } from '../../core/models/activity-task.model';

type DonutItem = { label: string; value: number; color: string };
type BarItem = { label: string; value: number };

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="dash">
      <header class="dash-head">
        <div>
          <h2>Dashboard</h2>
          <p class="muted">Vista general del sistema</p>
        </div>

        <div class="dash-actions">
          <button type="button" class="secondary" routerLink="/policies">Crear política</button>
          <button type="button" routerLink="/process-instances">Iniciar trámite</button>
        </div>
      </header>

      <div class="card" *ngIf="success() || error()">
        <p class="success" *ngIf="success()">{{ success() }}</p>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </div>

      <div class="kpis">
        <div class="kpi card">
          <div class="kpi-meta">
            <div class="kpi-title">Total de políticas</div>
            <div class="kpi-value">{{ kpiPolicies() }}</div>
            <div class="kpi-delta kpi-up">Actualizado</div>
          </div>
          <div class="kpi-icon kpi-blue" aria-hidden="true">▦</div>
        </div>

        <div class="kpi card">
          <div class="kpi-meta">
            <div class="kpi-title">Trámites activos</div>
            <div class="kpi-value">{{ kpiActiveProcesses() }}</div>
            <div class="kpi-delta kpi-up">En proceso</div>
          </div>
          <div class="kpi-icon kpi-yellow" aria-hidden="true">▣</div>
        </div>

        <div class="kpi card">
          <div class="kpi-meta">
            <div class="kpi-title">Actividades pendientes</div>
            <div class="kpi-value">{{ kpiPendingTasks() }}</div>
            <div class="kpi-delta kpi-down">Pendientes</div>
          </div>
          <div class="kpi-icon kpi-orange" aria-hidden="true">✓</div>
        </div>

        <div class="kpi card">
          <div class="kpi-meta">
            <div class="kpi-title">Actividades completadas</div>
            <div class="kpi-value">{{ kpiCompletedTasks() }}</div>
            <div class="kpi-delta kpi-up">Completadas</div>
          </div>
          <div class="kpi-icon kpi-green" aria-hidden="true">●</div>
        </div>
      </div>

      <div class="grid">
        <div class="card chart">
          <div class="card-top">
            <h3 class="card-title">Actividades por mes</h3>
          </div>
          <div class="chart-area">
            <svg class="bar" viewBox="0 0 520 220" role="img" aria-label="Actividades por mes">
              <line x1="40" y1="24" x2="40" y2="192" class="axis" />
              <line x1="40" y1="192" x2="500" y2="192" class="axis" />
              <g *ngFor="let b of bars(); let i = index" [attr.transform]="'translate(' + (70 + i * 110) + ',0)'">
                <rect
                  class="bar-rect"
                  width="74"
                  [attr.height]="barHeight(b.value)"
                  [attr.x]="0"
                  [attr.y]="192 - barHeight(b.value)"
                  rx="10"
                />
                <text class="bar-label" x="37" y="210" text-anchor="middle">{{ b.label }}</text>
              </g>
            </svg>
          </div>
        </div>

        <div class="card chart">
          <div class="card-top">
            <h3 class="card-title">Trámites por estado</h3>
          </div>
          <div class="donut-wrap">
            <svg class="donut" viewBox="0 0 220 220" role="img" aria-label="Trámites por estado">
              <g transform="translate(110,110)">
                <ng-container *ngFor="let s of donutSegments()">
                  <circle
                    r="74"
                    cx="0"
                    cy="0"
                    fill="transparent"
                    stroke-linecap="round"
                    stroke-width="18"
                    [attr.stroke]="s.color"
                    [attr.stroke-dasharray]="s.dasharray"
                    [attr.stroke-dashoffset]="s.offset"
                    transform="rotate(-90)"
                  />
                </ng-container>
              </g>
            </svg>

            <div class="legend">
              <div class="legend-row" *ngFor="let d of donutData()">
                <span class="dot" [style.background]="d.color"></span>
                <span class="legend-label">{{ d.label }}</span>
                <span class="legend-value">{{ d.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-top">
            <h3 class="card-title">Cuellos de botella detectados</h3>
          </div>

          <ng-container *ngIf="bottlenecks().length; else noBn">
            <div class="alert alert-warn" *ngFor="let b of bottlenecks()">
              <div class="alert-title">Actividad “{{ b.activityName }}” — {{ b.affectedTasks }} tareas abiertas</div>
              <div class="alert-sub">Promedio abierto: {{ b.avgHours }} h</div>
            </div>
          </ng-container>
          <ng-template #noBn>
            <p class="muted">No hay tareas abiertas para cuellos de botella.</p>
          </ng-template>
        </div>

        <div class="card">
          <div class="card-top">
            <h3 class="card-title">Notificaciones recientes</h3>
          </div>

          <ng-container *ngIf="recent().length; else noRecent">
            <div class="notif" *ngFor="let r of recent()">
              <span class="dot" [style.background]="recentDot(r)"></span>
              <div class="notif-body">
                <div class="notif-title">{{ r.title }}</div>
                <div class="notif-sub">{{ r.type }} · {{ r.status }}</div>
              </div>
            </div>
          </ng-container>
          <ng-template #noRecent>
            <p class="muted">Aún no hay actividad reciente.</p>
          </ng-template>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .dash {
        padding: 18px;
        display: grid;
        gap: 14px;
      }

      .dash-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }

      .dash-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      h2 {
        margin: 0;
        font-size: 18px;
        letter-spacing: 0.01em;
      }

      .muted {
        margin: 4px 0 0;
        color: var(--muted);
        font-size: 13px;
      }

      .card {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
        padding: 14px;
      }

      .kpis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .kpi {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px;
      }

      .kpi-title {
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.01em;
      }

      .kpi-value {
        font-size: 22px;
        font-weight: 800;
        margin-top: 4px;
      }

      .kpi-delta {
        margin-top: 6px;
        font-size: 12px;
      }

      .kpi-up {
        color: #16a34a;
      }
      .kpi-down {
        color: #ef4444;
      }

      .kpi-icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        color: #0b1220;
        font-weight: 900;
        opacity: 0.95;
      }
      .kpi-blue {
        background: #60a5fa;
      }
      .kpi-yellow {
        background: #fbbf24;
      }
      .kpi-orange {
        background: #fb923c;
      }
      .kpi-green {
        background: #34d399;
      }

      .grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 12px;
        align-items: start;
      }

      .chart {
        padding: 14px;
      }

      .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .card-title {
        margin: 0;
        font-size: 14px;
        letter-spacing: 0.01em;
      }

      .chart-area {
        width: 100%;
        overflow: hidden;
      }

      .bar {
        width: 100%;
        height: 220px;
      }

      .axis {
        stroke: color-mix(in srgb, var(--border) 70%, transparent);
        stroke-width: 2;
      }

      .bar-rect {
        fill: #f59e0b;
        filter: drop-shadow(0 10px 16px rgba(245, 158, 11, 0.18));
      }

      .bar-label {
        fill: var(--muted);
        font-size: 12px;
      }

      .donut-wrap {
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 10px;
        align-items: center;
      }

      .donut {
        width: 220px;
        height: 220px;
      }

      .legend {
        display: grid;
        gap: 8px;
      }

      .legend-row {
        display: grid;
        grid-template-columns: 12px 1fr auto;
        gap: 10px;
        align-items: center;
        font-size: 13px;
        color: var(--muted);
      }

      .legend-label {
        color: var(--text);
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
      }

      .alert {
        border-radius: 12px;
        padding: 12px;
        border: 1px solid transparent;
        display: grid;
        gap: 4px;
      }

      .alert-title {
        font-weight: 700;
        font-size: 13px;
      }

      .alert-sub {
        font-size: 12px;
        color: var(--muted);
      }

      .alert-warn {
        background: color-mix(in srgb, #fffbeb 82%, transparent);
        border-color: #fde68a;
      }

      .alert-info {
        margin-top: 10px;
        background: color-mix(in srgb, #eff6ff 82%, transparent);
        border-color: #bfdbfe;
      }

      .notif {
        display: grid;
        grid-template-columns: 10px 1fr;
        gap: 10px;
        padding: 10px 0;
        border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        align-items: start;
      }

      .notif:first-of-type {
        border-top: 0;
      }

      .notif-title {
        font-size: 13px;
        font-weight: 650;
      }

      .notif-sub {
        margin-top: 3px;
        font-size: 12px;
        color: var(--muted);
      }

      @media (max-width: 1100px) {
        .kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .grid {
          grid-template-columns: 1fr;
        }
        .donut-wrap {
          grid-template-columns: 1fr;
          justify-items: center;
        }
      }
    `
  ]
})
export class DashboardPage implements OnInit {
  private readonly policyService = inject(PolicyService);
  private readonly processService = inject(ProcessInstanceService);
  private readonly reportService = inject(ReportService);
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly policies = signal<BusinessPolicy[]>([]);
  readonly processes = signal<ProcessInstance[]>([]);
  readonly tasks = signal<ActivityTask[]>([]);
  readonly dashboard = signal<DashboardReport | null>(null);
  readonly bottlenecks = signal<Bottleneck[]>([]);
  readonly recent = signal<RecentItem[]>([]);

  readonly kpiPolicies = computed(() => this.policies().length);
  readonly kpiActiveProcesses = computed(() => this.dashboard()?.processesInProgress ?? 0);
  readonly kpiPendingTasks = computed(() => this.dashboard()?.tasksPending ?? 0);
  readonly kpiCompletedTasks = computed(() => this.dashboard()?.tasksCompleted ?? 0);

  readonly bars = signal<BarItem[]>([
    { label: 'Ene', value: 45 },
    { label: 'Feb', value: 52 },
    { label: 'Mar', value: 60 },
    { label: 'Abr', value: 57 }
  ]);

  readonly donutData = signal<DonutItem[]>([
    { label: 'Pendiente', value: 12, color: '#f59e0b' },
    { label: 'En proceso', value: 28, color: '#22c55e' },
    { label: 'Completado', value: 45, color: '#10b981' },
    { label: 'Cancelado', value: 5, color: '#94a3b8' }
  ]);

  ngOnInit() {
    const forbidden = this.route.snapshot.queryParamMap.get('forbidden');
    const kpiMsg =
      forbidden === 'kpi' ? 'No tiene permisos para acceder a los indicadores.' : null;
    if (forbidden === 'kpi') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    }
    this.reload(kpiMsg);
  }

  reload(kpiForbiddenBanner: string | null = null) {
    this.loading.set(true);
    this.success.set(null);
    if (kpiForbiddenBanner) {
      this.error.set(kpiForbiddenBanner);
    } else {
      this.error.set(null);
    }

    forkJoin({
      dashboard: this.reportService.getDashboardReport(),
      policies: this.policyService.getPolicies(),
      processes: this.processService.list(),
      tasks: this.taskService.list(),
      bottlenecks: this.reportService.getBottlenecks(3),
      recent: this.reportService.getRecent(6)
    }).subscribe({
      next: ({ dashboard, policies, processes, tasks, bottlenecks, recent }) => {
        this.dashboard.set(dashboard);
        this.policies.set(policies);
        this.processes.set(processes);
        this.tasks.set(tasks);
        this.bottlenecks.set(bottlenecks);
        this.recent.set(recent);

        // Donut por estado desde reporte
        this.donutData.set([
          { label: 'Pendiente', value: dashboard.processesCreated, color: '#f59e0b' },
          { label: 'En proceso', value: dashboard.processesInProgress, color: '#22c55e' },
          { label: 'Completado', value: dashboard.processesCompleted, color: '#10b981' },
          { label: 'Cancelado', value: dashboard.processesCancelled, color: '#94a3b8' }
        ]);

        // Bars simples: tareas por estado (MVP sin histórico mensual real)
        this.bars.set([
          { label: 'Pend', value: dashboard.tasksPending },
          { label: 'Proc', value: dashboard.tasksInProgress },
          { label: 'Comp', value: dashboard.tasksCompleted },
          { label: 'Canc', value: dashboard.tasksCancelled }
        ]);

        this.success.set('Actualizado');
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando dashboard')),
      complete: () => this.loading.set(false)
    });
  }

  recentDot(r: RecentItem): string {
    if (r.type === 'TASK') {
      if (r.status === 'PENDING') return '#f59e0b';
      if (r.status === 'IN_PROGRESS') return '#2563eb';
      if (r.status === 'COMPLETED') return '#22c55e';
      return '#94a3b8';
    }
    if (r.status === 'IN_PROGRESS') return '#2563eb';
    if (r.status === 'COMPLETED') return '#22c55e';
    if (r.status === 'CANCELLED') return '#ef4444';
    return '#94a3b8';
  }

  readonly donutSegments = computed(() => {
    const items = this.donutData();
    const total = items.reduce((a, b) => a + b.value, 0) || 1;
    const circumference = 2 * Math.PI * 74;

    let acc = 0;
    return items.map((it) => {
      const frac = it.value / total;
      const seg = circumference * frac;
      const gap = 6;
      const dash = Math.max(0, seg - gap);
      const offset = -(circumference * acc);
      acc += frac;
      return {
        color: it.color,
        dasharray: `${dash} ${circumference - dash}`,
        offset
      };
    });
  });

  barHeight(v: number) {
    const max = Math.max(...this.bars().map((b) => b.value), 1);
    const usable = 152;
    return Math.round((v / max) * usable);
  }
}

