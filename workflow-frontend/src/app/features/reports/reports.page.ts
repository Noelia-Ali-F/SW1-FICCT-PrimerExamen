import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InsightSeverity, ProcessInsights, RecommendationPriority } from '../../core/models/process-insights.model';
import { DashboardReport, ProcessStatus, TaskStatus } from '../../core/models/dashboard-report.model';
import { WorkflowKpiFilter, WorkflowKpiResponse } from '../../core/models/workflow-kpi.model';
import { AiInsightsService } from '../../core/services/ai-insights.service';
import { Bottleneck, MonthlyCount, RecentItem, ReportService } from '../../core/services/report.service';
import { mapHttpError } from '../../shared/utils/http-error.util';
import {
  getProcessStatusClass,
  getReportKpiToneClass,
  getStatusLabel,
  getTaskStatusClass
} from '../../shared/utils/status-style.util';
import { forkJoin } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Indicadores del Workflow</h2>
          <p class="muted">Métricas para identificar cuellos de botella</p>
        </div>
        <div class="actions" style="align-items:center">
          <button type="button" class="secondary" (click)="reload()" [disabled]="loading()">Actualizar</button>
        </div>
      </header>

      <div class="card" *ngIf="success() || error()">
        <p class="success" *ngIf="success()">{{ success() }}</p>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </div>

      <div class="card" style="padding: 12px">
        <h3 class="card-title">Filtros</h3>
        <div class="grid" style="grid-template-columns: repeat(5, minmax(0, 1fr))">
          <label class="block-label">
            policyId
            <input
              [value]="filter().policyId ?? ''"
              (input)="filter.set({ ...filter(), policyId: $any($event.target).value })"
              placeholder="(opcional)"
            />
          </label>
          <label class="block-label">
            Estado trámite
            <select
              [value]="filter().status ?? ''"
              (change)="filter.set({ ...filter(), status: $any($event.target).value || undefined })"
            >
              <option value="">(todos)</option>
              <option *ngFor="let st of processStatuses" [value]="st">{{ reportStatusLabel(st) }}</option>
            </select>
          </label>
          <label class="block-label">
            responsibleId (user/role/dept)
            <input
              [value]="filter().responsibleId ?? ''"
              (input)="filter.set({ ...filter(), responsibleId: $any($event.target).value })"
              placeholder="(opcional)"
            />
          </label>
          <label class="block-label">
            Desde (yyyy-MM-dd)
            <input
              type="date"
              [value]="filter().startDate ?? ''"
              (input)="filter.set({ ...filter(), startDate: $any($event.target).value })"
            />
          </label>
          <label class="block-label">
            Hasta (yyyy-MM-dd)
            <input
              type="date"
              [value]="filter().endDate ?? ''"
              (input)="filter.set({ ...filter(), endDate: $any($event.target).value })"
            />
          </label>
        </div>
        <div class="toolbar inner" style="justify-content:flex-end; gap:10px; margin-top: 10px">
          <button type="button" class="secondary" (click)="clearFilters()" [disabled]="loading()">Limpiar filtros</button>
          <button type="button" (click)="applyFilters()" [disabled]="loading()">Aplicar filtros</button>
        </div>
      </div>

      <div class="kpi-row" *ngIf="dashboard() as d">
        <div [class]="kpiBlockClass('neutral')">
          <div class="kpi-top">
            <div>
              <div class="kpi-label">Total trámites</div>
              <div class="kpi-value">{{ d.totalProcesses }}</div>
              <div class="kpi-sub">Procesos en el sistema</div>
            </div>
            <div class="kpi-ico kpi-blue">▦</div>
          </div>
        </div>

        <div [class]="kpiBlockClass('success')">
          <div class="kpi-top">
            <div>
              <div class="kpi-label">Tareas totales</div>
              <div class="kpi-value">{{ d.totalTasks }}</div>
              <div class="kpi-sub">Actividades registradas</div>
            </div>
            <div class="kpi-ico kpi-green">⟠</div>
          </div>
        </div>

        <div [class]="kpiBlockClass('progress')">
          <div class="kpi-top">
            <div>
              <div class="kpi-label">Trámites en progreso</div>
              <div class="kpi-value">{{ d.processesInProgress }}</div>
              <div class="kpi-sub">Estado IN_PROGRESS</div>
            </div>
            <div class="kpi-ico kpi-orange">◷</div>
          </div>
        </div>

        <div [class]="kpiBlockClass('danger')">
          <div class="kpi-top">
            <div>
              <div class="kpi-label">Cuellos de botella</div>
              <div class="kpi-value">{{ bottlenecks().length }}</div>
              <div class="kpi-sub">Top por demora promedio</div>
            </div>
            <div class="kpi-ico kpi-red">⟟</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:12px" *ngIf="recent().length">
        <h3 class="card-title">Trámites / tareas recientes</h3>
        <p class="muted small" style="margin:0 0 10px 0">
          Aquí ves los últimos movimientos del sistema. En “PROCESS” puedes abrir el detalle del trámite.
        </p>

        <div class="recent-list">
          <div class="recent-row" *ngFor="let it of recent()">
            <div class="recent-left">
              <div class="recent-title">
                <a *ngIf="it.type === 'PROCESS'" [routerLink]="['/monitoring', it.id]">{{ it.title }}</a>
                <span *ngIf="it.type !== 'PROCESS'">{{ it.title }}</span>
              </div>
              <div class="muted small">
                <span class="pill">{{ it.type }}</span>
                · {{ reportStatusLabel(it.status) }}
                <span *ngIf="it.ts">· {{ it.ts | date: 'short' }}</span>
              </div>
            </div>
            <div class="recent-right">
              <code>{{ it.id }}</code>
            </div>
          </div>
        </div>
      </div>

      <ng-container *ngIf="kpis() as k; else noKpis">
        <div class="kpi-row" style="margin-top: 12px">
          <div [class]="kpiBlockClass('neutral')">
            <div class="kpi-top">
              <div>
                <div class="kpi-label">Tiempo prom. trámite</div>
                <div class="kpi-value">{{ k.averageProcessDurationHours ?? '—' }}</div>
                <div class="kpi-sub">Horas (COMPLETED)</div>
              </div>
              <div class="kpi-ico kpi-blue">⧖</div>
            </div>
          </div>
          <div [class]="kpiBlockClass('success')">
            <div class="kpi-top">
              <div>
                <div class="kpi-label">Tiempo prom. actividad</div>
                <div class="kpi-value">{{ k.averageActivityDurationHours ?? '—' }}</div>
                <div class="kpi-sub">Horas (COMPLETED)</div>
              </div>
              <div class="kpi-ico kpi-green">⟠</div>
            </div>
          </div>
          <div [class]="kpiBlockClass(k.delayedActivities ? 'warning' : 'neutral')">
            <div class="kpi-top">
              <div>
                <div class="kpi-label">Actividades retrasadas</div>
                <div class="kpi-value">{{ k.delayedActivities }}</div>
                <div class="kpi-sub">Abiertas &gt; 48h</div>
              </div>
              <div class="kpi-ico kpi-orange">⚑</div>
            </div>
          </div>
          <div [class]="kpiBlockClass('progress')">
            <div class="kpi-top">
              <div>
                <div class="kpi-label">% cumplimiento</div>
                <div class="kpi-value">{{ k.completionRatePct ?? '—' }}</div>
                <div class="kpi-sub">Completadas ≤ 48h</div>
              </div>
              <div class="kpi-ico kpi-blue">%</div>
            </div>
          </div>
        </div>

        <div class="grid" style="margin-top:12px">
          <div class="card">
            <h3 class="card-title">Cuellos de botella detectados</h3>
            <p class="muted small" style="margin:0 0 10px 0">
              Score determinístico: pendientes*3 + retrasos*4 + esperaProm + ejecuciónProm*0.5. Retraso = abierta &gt; 48h.
            </p>

            <div *ngIf="k.bottlenecks.length; else noBn2" style="overflow:auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>Criticidad</th>
                    <th>Actividad</th>
                    <th>Política</th>
                    <th>Calle</th>
                    <th>Responsable</th>
                    <th>Pendientes</th>
                    <th>Retrasos</th>
                    <th>Espera prom (h)</th>
                    <th>Ejecución prom (h)</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let b of k.bottlenecks">
                    <td><span class="pill" [class.pill-high]="b.criticality==='ALTO'" [class.pill-mid]="b.criticality==='MEDIO'">{{ b.criticality }}</span></td>
                    <td>{{ b.activityName }}</td>
                    <td>{{ b.policyName ?? b.policyId }}</td>
                    <td>{{ b.laneName ?? '—' }}</td>
                    <td>{{ b.responsibleName ?? '—' }}</td>
                    <td><strong>{{ b.pendingCount }}</strong></td>
                    <td>{{ b.delayedCount }}</td>
                    <td>{{ b.averageWaitingTimeHours ?? '—' }}</td>
                    <td>{{ b.averageExecutionTimeHours ?? '—' }}</td>
                    <td>{{ b.bottleneckScore }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ng-template #noBn2>
              <p class="muted">No existen datos suficientes para generar indicadores de cuellos de botella.</p>
            </ng-template>
          </div>

          <div class="card">
            <h3 class="card-title">Carga de trabajo por responsable</h3>
            <p class="muted small" style="margin:0 0 10px 0">Basado en tareas abiertas (PENDING/IN_PROGRESS).</p>
            <ng-container *ngIf="k.workloadByResponsible.length; else noWl">
              <div class="bar-row" *ngFor="let w of k.workloadByResponsible">
                <div class="bar-left">
                  <div class="bar-title">{{ w.responsibleName ?? w.responsibleId ?? 'Sin asignar' }}</div>
                  <div class="muted small">Pend: {{ w.pendingCount }} · Proc: {{ w.inProgressCount }}</div>
                </div>
                <div class="bar-right">
                  <div class="bar">
                    <div class="bar-fill" [style.width.%]="pct(w.totalOpen, maxWorkload(k))"></div>
                  </div>
                  <div class="bar-n">{{ w.totalOpen }}</div>
                </div>
              </div>
            </ng-container>
            <ng-template #noWl>
              <p class="muted">No hay tareas abiertas para calcular carga.</p>
            </ng-template>
          </div>
        </div>

        <div class="card" style="margin-top:12px">
          <h3 class="card-title">Tiempo promedio por actividad</h3>
          <p class="muted small" style="margin:0 0 10px 0">Promedio de ejecución (COMPLETED).</p>
          <ng-container *ngIf="k.activityDurations.length; else noAd">
            <div class="bar-row" *ngFor="let a of k.activityDurations">
              <div class="bar-left">
                <div class="bar-title">{{ a.activityName }}</div>
                <div class="muted small">{{ a.policyName ?? a.policyId ?? '—' }} · completadas: {{ a.completedCount }}</div>
              </div>
              <div class="bar-right">
                <div class="bar">
                  <div class="bar-fill bar-fill-blue" [style.width.%]="pct(a.avgExecutionHours ?? 0, maxActHours(k))"></div>
                </div>
                <div class="bar-n">{{ a.avgExecutionHours ?? '—' }}h</div>
              </div>
            </div>
          </ng-container>
          <ng-template #noAd>
            <p class="muted">No hay suficientes actividades completadas para calcular duraciones.</p>
          </ng-template>
        </div>
      </ng-container>
      <ng-template #noKpis>
        <div class="card" style="margin-top:12px">
          <p class="muted">No existen datos suficientes para generar indicadores.</p>
        </div>
      </ng-template>

      <div class="grid">
        <div class="card" *ngIf="processesByStatus() as ps">
          <h3 class="card-title">Trámites por estado</h3>
          <div class="status-breakdown">
            <div class="breakdown-row" *ngFor="let st of processStatuses">
              <span [class]="reportProcessBadgeClass(st)">{{ reportStatusLabel(st) }}</span>
              <strong>{{ ps[st] }}</strong>
            </div>
          </div>
        </div>
        <div class="card" *ngIf="tasksByStatus() as ts">
          <h3 class="card-title">Tareas por estado</h3>
          <div class="status-breakdown">
            <div class="breakdown-row" *ngFor="let st of taskStatuses">
              <span [class]="reportTaskBadgeClass(st)">{{ reportStatusLabel(st) }}</span>
              <strong>{{ ts[st] }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3 class="card-title">Tendencia mensual de trámites</h3>
          <svg class="line" viewBox="0 0 520 220" role="img" aria-label="Tendencia mensual de trámites">
            <line x1="40" y1="24" x2="40" y2="192" class="axis" />
            <line x1="40" y1="192" x2="500" y2="192" class="axis" />
            <path class="line-path" [attr.d]="trendPath()" />
            <ng-container *ngFor="let p of trendPoints()">
              <circle class="pt" [attr.cx]="p.x" [attr.cy]="p.y" r="4" />
              <text class="lbl" [attr.x]="p.x" y="210" text-anchor="middle">{{ p.label }}</text>
            </ng-container>
          </svg>
        </div>

        <div class="card">
          <h3 class="card-title">Distribución por estado</h3>
          <div class="donut-wrap">
            <svg class="donut" viewBox="0 0 220 220" role="img" aria-label="Distribución por estado">
              <g transform="translate(110,110)">
                <circle r="74" cx="0" cy="0" fill="transparent" stroke-linecap="round" stroke-width="18"
                  stroke="#22c55e" stroke-dasharray="210 465" stroke-dashoffset="0" transform="rotate(-90)" />
                <circle r="74" cx="0" cy="0" fill="transparent" stroke-linecap="round" stroke-width="18"
                  stroke="#f59e0b" stroke-dasharray="95 465" stroke-dashoffset="-215" transform="rotate(-90)" />
                <circle r="74" cx="0" cy="0" fill="transparent" stroke-linecap="round" stroke-width="18"
                  stroke="#94a3b8" stroke-dasharray="30 465" stroke-dashoffset="-318" transform="rotate(-90)" />
              </g>
              <text x="156" y="82" class="donut-n">128</text>
              <text x="162" y="138" class="donut-n">15</text>
              <text x="164" y="118" class="donut-n">68</text>
              <text x="164" y="102" class="donut-n">5</text>
            </svg>
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3 class="card-title">Actividades con mayor demora</h3>
          <ng-container *ngIf="bottlenecks().length; else noBn">
            <div class="bottleneck" *ngFor="let b of bottlenecks()">
              <div class="bn-main">
                <div class="bn-title">{{ b.activityName }}</div>
                <div class="bn-sub">Promedio abierto: {{ b.avgHours }} h · tareas afectadas: {{ b.affectedTasks }}</div>
              </div>
              <div class="bn-badge">{{ b.affectedTasks }}</div>
            </div>
          </ng-container>
          <ng-template #noBn>
            <p class="muted">No hay tareas abiertas para calcular cuellos de botella.</p>
          </ng-template>
        </div>

        <div class="card ai">
          <div class="ai-toolbar">
            <h3 class="card-title">Análisis inteligente de procesos</h3>
            <button
              type="button"
              class="ai-primary"
              (click)="runProcessInsights()"
              [disabled]="insightsLoading()"
            >
              {{ insightsLoading() ? 'Analizando…' : 'Analizar procesos con IA' }}
            </button>
          </div>
          <p class="ai-hint">
            Análisis MVP por reglas (sin modelo externo). Usa trámites y tareas reales del sistema.
          </p>
          <p class="ai-error" *ngIf="insightsError()">{{ insightsError() }}</p>
          <ng-container *ngIf="insights() as ins">
            <p class="ai-summary">{{ ins.summary }}</p>
            <h4 class="ai-section-title">Cuellos de botella</h4>
            <p class="muted small" *ngIf="!ins.bottlenecks.length">Sin hallazgos de este tipo con los datos actuales.</p>
            <div
              *ngFor="let b of ins.bottlenecks"
              class="ai-item"
              [ngClass]="insightSeverityRowClass(b.severity)"
            >
              <div class="ai-sev-pill">{{ bottleneckSeverityLabel(b.severity) }}</div>
              <div>
                <div class="ai-title">{{ b.title }}</div>
                <div class="ai-sub">{{ b.description }}</div>
                <div class="ai-meta" *ngIf="b.count != null">Casos considerados: {{ b.count }}</div>
                <div class="ai-meta" *ngIf="b.relatedActivityName">Actividad: {{ b.relatedActivityName }}</div>
                <div class="ai-action" *ngIf="b.recommendation"><strong>Sugerencia:</strong> {{ b.recommendation }}</div>
              </div>
            </div>

            <h4 class="ai-section-title">Recomendaciones</h4>
            <p class="muted small" *ngIf="!ins.recommendations.length">Sin recomendaciones adicionales.</p>
            <div
              *ngFor="let r of ins.recommendations"
              class="ai-item"
              [ngClass]="recommendationPriorityRowClass(r.priority)"
            >
              <div class="ai-sev-pill">{{ recommendationPriorityLabel(r.priority) }}</div>
              <div>
                <div class="ai-title">{{ r.title }}</div>
                <div class="ai-sub">{{ r.description }}</div>
                <div class="ai-action" *ngIf="r.suggestedAction"><strong>Acción:</strong> {{ r.suggestedAction }}</div>
              </div>
            </div>
          </ng-container>
          <p class="muted small" *ngIf="!insights() && !insightsLoading() && !insightsError()">
            Pulsa el botón para generar el informe.
          </p>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .card-title {
        margin: 0 0 10px;
        font-size: 14px;
        letter-spacing: 0.01em;
      }
      .kpi-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      @media (max-width: 900px) {
        .kpi-row {
          grid-template-columns: 1fr;
        }
      }
      .kpi {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
        padding: 14px;
      }
      .kpi-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .kpi-label {
        font-size: 12px;
        color: var(--muted);
        font-weight: 650;
      }
      .kpi-value {
        margin-top: 4px;
        font-size: 22px;
        font-weight: 900;
        color: var(--text);
      }
      .kpi-sub {
        margin-top: 6px;
        font-size: 12px;
      }
      .kpi-up {
        color: #16a34a;
      }
      .kpi-down {
        color: #ef4444;
      }
      .kpi-ico {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-weight: 900;
        color: #0b1220;
      }
      .kpi-blue {
        background: #60a5fa;
      }
      .kpi-green {
        background: #34d399;
      }
      .kpi-orange {
        background: #fbbf24;
      }
      .kpi-red {
        background: #fb7185;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        align-items: start;
      }
      @media (max-width: 1100px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
      .line {
        width: 100%;
        height: 220px;
      }
      .axis {
        stroke: color-mix(in srgb, var(--border) 70%, transparent);
        stroke-width: 2;
      }
      .line-path {
        fill: none;
        stroke: #2563eb;
        stroke-width: 3;
      }
      .pt {
        fill: #2563eb;
      }
      .lbl {
        fill: var(--muted);
        font-size: 12px;
      }
      .donut-wrap {
        display: grid;
        place-items: center;
      }
      .donut {
        width: 220px;
        height: 220px;
      }
      .donut-n {
        font-size: 12px;
        fill: var(--muted);
        font-weight: 700;
      }

      .bottleneck {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        border-radius: 14px;
        border: 1px solid #fecaca;
        background: #fef2f2;
      }
      .bottleneck + .bottleneck {
        margin-top: 10px;
      }
      .bn-title {
        font-weight: 900;
        font-size: 13px;
        color: #7f1d1d;
      }
      .bn-sub {
        margin-top: 4px;
        font-size: 12px;
        color: #991b1b;
        opacity: 0.85;
      }
      .bn-badge {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: #ef4444;
        color: #ffffff;
        font-weight: 900;
      }

      .ai {
        background: linear-gradient(180deg, rgba(99, 102, 241, 0.85), rgba(79, 70, 229, 0.85));
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.12);
      }
      .ai .card-title {
        color: #ffffff;
        margin: 0;
      }
      .ai-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .ai-primary {
        border: 1px solid rgba(255, 255, 255, 0.22);
        background: rgba(255, 255, 255, 0.95);
        color: #312e81;
        font-weight: 850;
        padding: 10px 14px;
        border-radius: 12px;
        cursor: pointer;
      }
      .ai-primary:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .ai-hint,
      .ai-summary {
        font-size: 12px;
        opacity: 0.92;
        margin: 0 0 10px;
        line-height: 1.45;
      }
      .ai-error {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 700;
        color: #fecaca;
      }
      .ai-section-title {
        margin: 14px 0 8px;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        font-weight: 850;
        opacity: 0.9;
      }
      .ai-item {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 12px;
        padding: 12px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.14);
        border: 1px solid rgba(255, 255, 255, 0.16);
      }
      .ai-item + .ai-item {
        margin-top: 10px;
      }
      .ai-sev-pill {
        align-self: start;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.04em;
        padding: 6px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.35);
        white-space: nowrap;
      }
      .ai-sev-high .ai-sev-pill {
        background: rgba(239, 68, 68, 0.35);
        border-color: rgba(254, 202, 202, 0.55);
      }
      .ai-sev-medium .ai-sev-pill {
        background: rgba(234, 179, 8, 0.35);
        border-color: rgba(253, 230, 138, 0.55);
        color: #fffbeb;
      }
      .ai-sev-low .ai-sev-pill {
        background: rgba(34, 197, 94, 0.28);
        border-color: rgba(187, 247, 208, 0.45);
      }
      .ai-title {
        font-weight: 900;
        font-size: 13px;
      }
      .ai-sub {
        margin-top: 4px;
        font-size: 12px;
        opacity: 0.92;
      }
      .ai-meta {
        margin-top: 6px;
        font-size: 11px;
        opacity: 0.85;
      }
      .ai-action {
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.4;
        opacity: 0.95;
      }
      .pill {
        font-size: 11px;
        font-weight: 900;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
      }
      .pill-high {
        border-color: color-mix(in srgb, #ef4444 45%, var(--border));
        background: color-mix(in srgb, #ef4444 10%, var(--panel-solid));
      }
      .pill-mid {
        border-color: color-mix(in srgb, #f59e0b 45%, var(--border));
        background: color-mix(in srgb, #f59e0b 10%, var(--panel-solid));
      }

      .recent-list {
        display: grid;
        gap: 10px;
      }
      .recent-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: start;
        border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        border-radius: 14px;
        padding: 12px;
        background: color-mix(in srgb, var(--panel-solid) 80%, transparent);
      }
      .recent-title {
        font-weight: 900;
        font-size: 13px;
        color: var(--text);
      }
      .recent-title a {
        color: var(--text);
        text-decoration: none;
      }
      .recent-title a:hover {
        text-decoration: underline;
      }
      .recent-right code {
        font-size: 12px;
      }
      .bar-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
      }
      .bar-row:last-child {
        border-bottom: none;
      }
      .bar-title {
        font-weight: 850;
        font-size: 13px;
      }
      .bar-right {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 220px;
      }
      .bar {
        width: 160px;
        height: 10px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--border) 50%, transparent);
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        width: 0%;
        background: #22c55e;
      }
      .bar-fill-blue {
        background: #2563eb;
      }
      .bar-n {
        width: 56px;
        text-align: right;
        font-weight: 900;
        font-size: 12px;
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class ReportsPage implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly aiInsightsService = inject(AiInsightsService);

  readonly loading = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly insights = signal<ProcessInsights | null>(null);
  readonly insightsLoading = signal(false);
  readonly insightsError = signal<string | null>(null);

  readonly dashboard = signal<DashboardReport | null>(null);
  readonly processesByStatus = signal<Record<ProcessStatus, number> | null>(null);
  readonly tasksByStatus = signal<Record<TaskStatus, number> | null>(null);
  readonly monthly = signal<MonthlyCount[]>([]);
  readonly bottlenecks = signal<Bottleneck[]>([]);
  readonly recent = signal<RecentItem[]>([]);

  readonly kpis = signal<WorkflowKpiResponse | null>(null);
  readonly filter = signal<WorkflowKpiFilter>({
    policyId: '',
    status: undefined,
    responsibleId: '',
    startDate: '',
    endDate: ''
  } as any);

  readonly processStatuses: ProcessStatus[] = ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  readonly taskStatuses: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  readonly hasData = computed(() => !!this.dashboard());

  kpiBlockClass(tone: 'neutral' | 'progress' | 'success' | 'warning' | 'danger'): string {
    return `kpi ${getReportKpiToneClass(tone)}`;
  }

  reportProcessBadgeClass(st: ProcessStatus): string {
    return getProcessStatusClass(st);
  }

  reportTaskBadgeClass(st: TaskStatus): string {
    return getTaskStatusClass(st);
  }

  reportStatusLabel(code: string): string {
    return getStatusLabel(code);
  }

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.success.set(null);
    this.error.set(null);

    forkJoin({
      dashboard: this.reportService.getDashboardReport(),
      processesByStatus: this.reportService.getProcessesByStatus(),
      tasksByStatus: this.reportService.getTasksByStatus(),
      monthly: this.reportService.getProcessesMonthly(4),
      bottlenecks: this.reportService.getBottlenecks(5),
      recent: this.reportService.getRecent(12),
      kpis: this.reportService.getWorkflowKpis(this.normalizeFilter(this.filter()))
    }).subscribe({
      next: ({ dashboard, processesByStatus, tasksByStatus, monthly, bottlenecks, recent, kpis }) => {
        this.dashboard.set(dashboard);
        this.processesByStatus.set(processesByStatus);
        this.tasksByStatus.set(tasksByStatus);
        this.monthly.set(monthly);
        this.bottlenecks.set(bottlenecks);
        this.recent.set(recent);
        this.kpis.set(kpis);
        this.success.set('Actualizado');
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando reportes')),
      complete: () => this.loading.set(false)
    });
  }

  applyFilters() {
    this.reload();
  }

  clearFilters() {
    this.filter.set({ policyId: '', status: undefined, responsibleId: '', startDate: '', endDate: '' } as any);
    this.reload();
  }

  private normalizeFilter(f: WorkflowKpiFilter): WorkflowKpiFilter {
    return {
      policyId: String((f as any).policyId ?? '').trim() || undefined,
      status: (String((f as any).status ?? '').trim() as any) || undefined,
      responsibleId: String((f as any).responsibleId ?? '').trim() || undefined,
      startDate: String((f as any).startDate ?? '').trim() || undefined,
      endDate: String((f as any).endDate ?? '').trim() || undefined
    };
  }

  trendPoints() {
    const m = this.monthly();
    const max = Math.max(1, ...m.map((x) => x.count));
    const xs = [40, 190, 340, 500];
    return m.slice(0, 4).map((it, i) => {
      const x = xs[i] ?? (40 + i * 120);
      const y = 192 - (it.count / max) * 150;
      return { x, y, label: it.month.slice(5) };
    });
  }

  trendPath() {
    const pts = this.trendPoints();
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }

  runProcessInsights() {
    this.insightsLoading.set(true);
    this.insightsError.set(null);
    this.aiInsightsService.getProcessInsights().subscribe({
      next: (data) => this.insights.set(data),
      error: (e) => this.insightsError.set(mapHttpError(e, 'No se pudo cargar el análisis')),
      complete: () => this.insightsLoading.set(false)
    });
  }

  insightSeverityRowClass(sev: InsightSeverity): string {
    if (sev === 'HIGH') return 'ai-sev-high';
    if (sev === 'MEDIUM') return 'ai-sev-medium';
    return 'ai-sev-low';
  }

  recommendationPriorityRowClass(p: RecommendationPriority): string {
    if (p === 'HIGH') return 'ai-sev-high';
    if (p === 'MEDIUM') return 'ai-sev-medium';
    return 'ai-sev-low';
  }

  bottleneckSeverityLabel(sev: InsightSeverity): string {
    if (sev === 'HIGH') return 'Alta';
    if (sev === 'MEDIUM') return 'Media';
    return 'Baja';
  }

  recommendationPriorityLabel(p: RecommendationPriority): string {
    if (p === 'HIGH') return 'Alta';
    if (p === 'MEDIUM') return 'Media';
    return 'Baja';
  }

  maxWorkload(k: WorkflowKpiResponse): number {
    const xs = (k.workloadByResponsible ?? []).map((x) => x.totalOpen ?? 0);
    return Math.max(1, ...xs);
  }

  maxActHours(k: WorkflowKpiResponse): number {
    const xs = (k.activityDurations ?? []).map((x) => x.avgExecutionHours ?? 0);
    return Math.max(1, ...xs);
  }

  pct(v: number, max: number): number {
    const m = max > 0 ? max : 1;
    const p = (v / m) * 100;
    return Math.max(0, Math.min(100, Math.round(p)));
  }
}

