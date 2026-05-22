import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BusinessPolicy } from '../../core/models/business-policy.model';
import { ProcessInstance } from '../../core/models/process-instance.model';
import { User } from '../../core/models/user.model';
import { PolicyService } from '../../core/services/policy.service';
import { ProcessInstanceService } from '../../core/services/process-instance.service';
import { UsersService } from '../../core/services/users.service';
import { mapHttpError } from '../../shared/utils/http-error.util';
import { getProcessStatusClass, getStatusLabel } from '../../shared/utils/status-style.util';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Gestión de trámites</h2>
          <p class="muted">Crear y administrar trámites basados en políticas activas</p>
        </div>

        <div class="actions" style="align-items:center">
          <button type="button" class="secondary" (click)="reload()" [disabled]="loading()">Recargar</button>
          <button type="button" (click)="openCreateModal()" [disabled]="saving() || loading()">
            + Nuevo trámite
          </button>
        </div>
      </header>

      <div class="card" *ngIf="success() || error()">
        <p class="success" *ngIf="success()">{{ success() }}</p>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </div>

      <div class="list" *ngIf="processes().length; else empty">
        <div class="proc-card" *ngFor="let p of processes()" [ngClass]="processCardAccent(p.status)">
          <div class="proc-top">
            <div class="proc-id">
              <strong>{{ shortId(p.id) }}</strong>
              <span [class]="processStatusBadgeClass(p.status)">{{ processStatusLabel(p.status) }}</span>
            </div>

            <div class="proc-actions">
              <a class="icon-link" [routerLink]="['/process-instances', p.id]" aria-label="Ver detalle">👁</a>
              <a class="icon-link" [routerLink]="['/monitoring', p.id]" aria-label="Monitoreo">📈</a>
              <button
                type="button"
                class="icon-btn danger"
                (click)="cancel(p)"
                [disabled]="saving() || p.status === 'COMPLETED' || p.status === 'CANCELLED'"
                aria-label="Cancelar"
              >
                ✕
              </button>
            </div>
          </div>

          <div class="proc-name">{{ policyTitle(p.policyId) }}</div>

          <div class="proc-meta">
            <div>
              <div class="meta-label">Responsable actual</div>
              <div class="meta-value">{{ userName(p.requestedBy) }}</div>
            </div>
            <div>
              <div class="meta-label">Fecha de inicio</div>
              <div class="meta-value">{{ (p.startedAt || p.createdAt) ? ((p.startedAt || p.createdAt) | date:'yyyy-MM-dd') : '-' }}</div>
            </div>
            <div>
              <div class="meta-label">Actividad actual</div>
              <div class="meta-value">{{ currentActivityLabel(p) }}</div>
            </div>
          </div>

          <div class="progress">
            <div class="meta-label">Progreso</div>
            <div class="bar">
              <div class="bar-fill" [style.width.%]="progressPercent(p)"></div>
            </div>
            <div class="progress-value">{{ progressPercent(p) }}%</div>
          </div>
        </div>
      </div>

      <ng-template #empty>
        <div class="card">
          <p class="muted" style="margin:0">No hay trámites aún.</p>
        </div>
      </ng-template>

      <div class="modal-backdrop" *ngIf="createModalOpen()" (click)="closeCreateModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="modal-title">Crear nuevo trámite</div>
            <button type="button" class="icon-x secondary" (click)="closeCreateModal()" aria-label="Cerrar">✕</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="create()">
            <label class="block-label">
              Seleccionar política activa
              <select formControlName="policyId" [disabled]="saving()">
                <option value="">Seleccionar política...</option>
                <option *ngFor="let p of activePolicies()" [value]="p.id">{{ p.name }} (v{{ p.version }})</option>
              </select>
            </label>

            <label class="block-label">
              Descripción del trámite
              <textarea rows="4" formControlName="description" placeholder="Describe brevemente el trámite a iniciar..." [disabled]="saving()"></textarea>
            </label>

            <label class="block-label">
              Prioridad
              <select formControlName="priority" [disabled]="saving()">
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
              </select>
            </label>

            <label class="block-label">
              Solicitante (usuario)
              <select formControlName="requestedBy" [disabled]="saving()">
                <option value="">Selecciona un usuario</option>
                <option *ngFor="let u of users()" [value]="u.id">{{ userLabel(u) }}</option>
              </select>
            </label>

            <div class="modal-actions">
              <button type="button" class="secondary" (click)="closeCreateModal()" [disabled]="saving()">Cancelar</button>
              <button type="submit" [disabled]="form.invalid || saving()">Crear trámite</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .list {
        display: grid;
        gap: 12px;
      }

      .proc-card {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
        padding: 14px;
      }

      .proc-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .proc-id {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        border: 1px solid transparent;
        color: #92400e;
        background: #fffbeb;
        border-color: #fde68a;
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

      .proc-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .icon-link {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        text-decoration: none;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
      }

      .icon-btn {
        width: 38px;
        height: 38px;
        padding: 0;
        border-radius: 12px;
        display: grid;
        place-items: center;
      }

      .proc-name {
        margin-top: 8px;
        font-weight: 850;
        font-size: 14px;
        color: var(--text);
      }

      .proc-meta {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .meta-label {
        font-size: 12px;
        color: var(--muted);
      }

      .meta-value {
        margin-top: 2px;
        font-size: 13px;
        color: var(--text);
        font-weight: 650;
      }

      .progress {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
      }

      .bar {
        height: 8px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--border) 55%, transparent);
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(37, 99, 235, 0.9), rgba(59, 130, 246, 0.9));
      }

      .progress-value {
        justify-self: end;
        font-size: 12px;
        color: var(--muted);
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(2, 6, 23, 0.48);
        display: grid;
        place-items: center;
        padding: 20px;
        z-index: 50;
      }
      .modal {
        width: min(720px, 96vw);
        border-radius: 16px;
        border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
        background: var(--panel-solid);
        box-shadow: var(--shadow-md);
        padding: 14px;
      }
      .modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .modal-title {
        font-weight: 850;
        letter-spacing: 0.01em;
      }
      .icon-x {
        width: 38px;
        height: 38px;
        padding: 0;
        border-radius: 12px;
        display: grid;
        place-items: center;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 10px;
      }

      @media (max-width: 1100px) {
        .proc-meta {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class ProcessInstancesPage implements OnInit {
  private readonly policyService = inject(PolicyService);
  private readonly processService = inject(ProcessInstanceService);
  private readonly usersService = inject(UsersService);
  private readonly fb = inject(FormBuilder);

  readonly policies = signal<BusinessPolicy[]>([]);
  readonly users = signal<User[]>([]);
  readonly processes = signal<ProcessInstance[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly activePolicies = computed(() => this.policies().filter((p) => p.status === 'ACTIVE'));

  readonly form = this.fb.nonNullable.group({
    policyId: ['', [Validators.required]],
    requestedBy: ['', [Validators.required]],
    description: [''],
    priority: ['NORMAL', [Validators.required]]
  });

  readonly createModalOpen = signal(false);

  processCardAccent(status: ProcessInstance['status']): Record<string, boolean> {
    return {
      'proc-accent-created': status === 'CREATED',
      'proc-accent-in-progress': status === 'IN_PROGRESS',
      'proc-accent-completed': status === 'COMPLETED',
      'proc-accent-cancelled': status === 'CANCELLED'
    };
  }

  processStatusBadgeClass(status: ProcessInstance['status']): string {
    return getProcessStatusClass(status);
  }

  processStatusLabel(status: ProcessInstance['status']): string {
    return getStatusLabel(status);
  }

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.success.set(null);
    this.error.set(null);

    forkJoin({
      policies: this.policyService.getPolicies(),
      users: this.usersService.list(),
      processes: this.processService.list()
    }).subscribe({
      next: ({ policies, users, processes }) => {
        this.policies.set(policies);
        this.users.set(users);
        this.processes.set(processes);
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando trámites')),
      complete: () => this.loading.set(false)
    });
  }

  create() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.success.set(null);
    this.error.set(null);
    const raw = this.form.getRawValue();
    this.processService.create({ policyId: raw.policyId, requestedBy: raw.requestedBy }).subscribe({
      next: (created) => {
        this.success.set(`Trámite creado: ${created.id}`);
        this.form.reset({ policyId: '', requestedBy: '', description: '', priority: 'NORMAL' });
        this.createModalOpen.set(false);
        this.reload();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error creando trámite')),
      complete: () => this.saving.set(false)
    });
  }

  cancel(p: ProcessInstance) {
    this.saving.set(true);
    this.success.set(null);
    this.error.set(null);
    // MVP: usamos requestedBy como usuario que cancela (simulación).
    this.processService.cancel(p.id, p.requestedBy).subscribe({
      next: () => {
        this.success.set('Trámite cancelado');
        this.reload();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error cancelando trámite')),
      complete: () => this.saving.set(false)
    });
  }

  policyName(policyId: string): string {
    const p = this.policies().find((x) => x.id === policyId);
    return p ? `${p.name} (v${p.version})` : policyId;
  }

  userName(userId: string): string {
    const u = this.users().find((x) => x.id === userId);
    return u ? u.fullName : userId;
  }

  userLabel(u: User): string {
    return `${u.fullName} — ${u.email}`;
  }

  openCreateModal() {
    this.createModalOpen.set(true);
  }

  closeCreateModal() {
    this.createModalOpen.set(false);
  }

  shortId(id: string) {
    // TR-001 like UX: usamos los últimos 3 caracteres si existe, sino recortamos.
    const suffix = (id || '').slice(-3).padStart(3, '0');
    return `TR-${suffix}`;
  }

  policyTitle(policyId: string) {
    const p = this.policies().find((x) => x.id === policyId);
    return p ? p.name : policyId;
  }

  currentActivityLabel(p: ProcessInstance) {
    // MVP: si el backend no expone el nombre, mostramos el nodeId actual.
    const ids = p.currentNodeIds || [];
    return ids.length ? ids[0] : '-';
  }

  progressPercent(p: ProcessInstance) {
    switch (p.status) {
      case 'COMPLETED':
        return 100;
      case 'IN_PROGRESS':
        return 60;
      case 'CREATED':
        return 25;
      case 'CANCELLED':
      default:
        return 0;
    }
  }
}

