import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BusinessPolicy } from '../../core/models/business-policy.model';
import { User } from '../../core/models/user.model';
import { SaveActivityDiagramPayload } from '../../core/models/activity-diagram.model';
import { AiWorkflowSuggestionService } from '../../core/services/ai-workflow-suggestion.service';
import { ActivityDiagramService } from '../../core/services/activity-diagram.service';
import { PolicyService } from '../../core/services/policy.service';
import { UsersService } from '../../core/services/users.service';
import { mapHttpError } from '../../shared/utils/http-error.util';
import { getPolicyStatusClass, getStatusLabel } from '../../shared/utils/status-style.util';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Políticas de negocio</h2>
          <p class="muted">Gestiona las políticas y sus diagramas de workflow</p>
        </div>

        <div class="actions" style="align-items:center">
          <button type="button" class="secondary" (click)="openAiCreate()" [disabled]="saving() || loading()">
            Crear con IA
          </button>
          <button type="button" (click)="scrollToCreate()" [disabled]="saving() || loading()">Nueva política</button>
        </div>
      </header>

      <div class="tabs">
        <button type="button" class="tab" [class.active]="activeTab() === 'ALL'" (click)="activeTab.set('ALL')">
          Todas
        </button>
        <button type="button" class="tab" [class.active]="activeTab() === 'ACTIVE'" (click)="activeTab.set('ACTIVE')">
          Activas
        </button>
        <button type="button" class="tab" [class.active]="activeTab() === 'DRAFT'" (click)="activeTab.set('DRAFT')">
          Borradores
        </button>
        <button type="button" class="tab" [class.active]="activeTab() === 'INACTIVE'" (click)="activeTab.set('INACTIVE')">
          Inactivas
        </button>
      </div>

      <div class="card" *ngIf="versionTarget() as vt">
        <h3 class="card-title">Nueva versión</h3>
        <p class="muted">
          Se creará un borrador a partir de «{{ vt.name }}» (versión actual: {{ vt.version }}).
        </p>
        <form [formGroup]="versionForm" (ngSubmit)="confirmVersion()">
          <div class="row">
            <label>
              Creado por (usuario)
              <select formControlName="createdBy">
                <option value="">Selecciona un usuario</option>
                <option *ngFor="let u of users()" [value]="u.id">{{ userOptionLabel(u) }}</option>
              </select>
            </label>
            <div></div>
          </div>
          <div class="actions">
            <button type="submit" [disabled]="versionForm.invalid || saving()">Crear versión</button>
            <button type="button" class="secondary" (click)="cancelVersion()" [disabled]="saving()">
              Cancelar
            </button>
          </div>
        </form>
      </div>

      <form class="card" id="create-policy" [formGroup]="mainForm" (ngSubmit)="submitMain()">
        <h3 class="card-title">{{ editingId() ? 'Editar política (borrador)' : 'Nueva política de negocio' }}</h3>
        <div class="row">
          <label>
            Nombre
            <input formControlName="name" placeholder="Nombre de la política" />
          </label>
          <label>
            Descripción
            <input formControlName="description" placeholder="Descripción" />
          </label>
        </div>
        <div class="row">
          <label>
            Responsable (usuario)
            <select formControlName="responsibleUserId">
              <option value="">Selecciona un usuario</option>
              <option *ngFor="let u of users()" [value]="u.id">{{ userOptionLabel(u) }}</option>
            </select>
          </label>
          <label *ngIf="!editingId()">
            Creado por (usuario)
            <select formControlName="createdBy">
              <option value="">Selecciona un usuario</option>
              <option *ngFor="let u of users()" [value]="u.id">{{ userOptionLabel(u) }}</option>
            </select>
          </label>
          <div *ngIf="editingId()"></div>
        </div>
        <div class="actions">
          <button type="submit" [disabled]="mainForm.invalid || saving()">
            {{ editingId() ? 'Guardar cambios' : 'Crear política' }}
          </button>
          <button
            type="button"
            class="secondary"
            *ngIf="editingId()"
            (click)="cancelEdit()"
            [disabled]="saving()"
          >
            Cancelar edición
          </button>
        </div>
      </form>

      <div class="card">
        <div class="toolbar">
          <button type="button" (click)="reload()" [disabled]="loading()">Recargar</button>
          <span class="success" *ngIf="success()">{{ success() }}</span>
          <span class="error" *ngIf="error()">{{ error() }}</span>
        </div>

        <table class="table" *ngIf="filteredPolicies().length; else empty">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Versión</th>
              <th>Estado</th>
              <th>Responsable</th>
              <th>Creado por</th>
              <th>Actualización</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of filteredPolicies()" [class.policy-inactive]="p.status === 'INACTIVE'">
              <td>{{ p.name }}</td>
              <td>{{ p.description || '-' }}</td>
              <td>{{ p.version }}</td>
              <td>
                <span [class]="policyStatusClass(p.status)">{{ policyStatusLabel(p.status) }}</span>
              </td>
              <td>{{ userLabel(p.responsibleUserId) }}</td>
              <td>{{ userLabel(p.createdBy) }}</td>
              <td class="nowrap">{{ p.updatedAt | date: 'short' }}</td>
              <td class="actions">
                <a
                  class="link-button"
                  *ngIf="p.status === 'DRAFT'"
                  [routerLink]="['/policies', p.id, 'diagram']"
                  >Diseñar diagrama</a>
                <button
                  type="button"
                  class="secondary"
                  *ngIf="p.status === 'DRAFT'"
                  (click)="startEdit(p)"
                  [disabled]="!!editingId() || !!versionTarget() || saving()"
                >
                  Editar
                </button>
                <button
                  type="button"
                  class="secondary"
                  (click)="openVersion(p)"
                  [disabled]="!!versionTarget() || saving()"
                >
                  Versionar
                </button>
                <button
                  type="button"
                  class="secondary"
                  (click)="activate(p)"
                  *ngIf="p.status !== 'ACTIVE'"
                  [disabled]="saving()"
                >
                  Activar
                </button>
                <button
                  type="button"
                  class="danger"
                  (click)="deactivate(p)"
                  [disabled]="p.status === 'INACTIVE' || saving()"
                >
                  Desactivar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty>
          <p class="muted">No hay políticas aún.</p>
        </ng-template>
      </div>

      <div class="modal-backdrop" *ngIf="aiCreateOpen()" (click)="closeAiCreate()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="modal-title">Crear política con IA</div>
            <button type="button" class="icon-x secondary" (click)="closeAiCreate()" aria-label="Cerrar">✕</button>
          </div>
          <p class="muted small" style="margin:0 0 10px">
            Describe el proceso y generaremos una propuesta de diagrama. Luego puedes crear la política y diseñar el diagrama.
          </p>

          <label class="block-label">
            Creado por (usuario)
            <select [value]="aiCreatedBy() ?? ''" (change)="aiCreatedBy.set($any($event.target).value || null)" [disabled]="aiBusy()">
              <option value="">Selecciona un usuario</option>
              <option *ngFor="let u of users()" [value]="u.id">{{ userOptionLabel(u) }}</option>
            </select>
          </label>

          <label class="block-label">
            Proceso
            <textarea rows="6" [value]="aiPromptText()" (input)="aiPromptText.set($any($event.target).value)" [disabled]="aiBusy()"
              placeholder="Ej: El cliente registra una solicitud, recepción valida, supervisor aprueba o rechaza..."></textarea>
          </label>

          <div class="modal-actions">
            <button type="button" class="secondary" (click)="closeAiCreate()" [disabled]="aiBusy()">Cancelar</button>
            <button type="button" (click)="generateAi()" [disabled]="aiBusy() || !aiCreatedBy() || !aiPromptText().trim()">
              Generar
            </button>
            <button type="button" (click)="applyAiToCreateForm()" class="secondary" [disabled]="aiBusy() || !aiSuggestion()">
              Usar propuesta (crear y abrir)
            </button>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .card-title {
        margin: 0 0 10px;
        font-size: 15px;
      }
      .tabs {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .tab {
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
        color: var(--text);
        font-size: 12px;
        font-weight: 750;
      }
      .tab.active {
        border-color: transparent;
        background: linear-gradient(180deg, var(--primary) 0%, var(--primary-700) 100%);
        color: #fff;
        box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
      }
      .link-button {
        display: inline-block;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        background: #fff;
        color: #111827;
        font-size: 13px;
        text-decoration: none;
        cursor: pointer;
      }
      .link-button:hover {
        background: #f9fafb;
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
        flex-wrap: wrap;
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class PoliciesPage implements OnInit {
  private readonly policyService = inject(PolicyService);
  private readonly usersService = inject(UsersService);
  private readonly aiService = inject(AiWorkflowSuggestionService);
  private readonly diagramService = inject(ActivityDiagramService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly policies = signal<BusinessPolicy[]>([]);
  readonly users = signal<User[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly versionTarget = signal<BusinessPolicy | null>(null);
  readonly activeTab = signal<'ALL' | 'ACTIVE' | 'DRAFT' | 'INACTIVE'>('ALL');

  readonly filteredPolicies = computed(() => {
    const tab = this.activeTab();
    const all = this.policies();
    if (tab === 'ALL') return all;
    return all.filter((p) => p.status === tab);
  });

  policyStatusClass(status: BusinessPolicy['status']): string {
    return getPolicyStatusClass(status);
  }

  policyStatusLabel(status: BusinessPolicy['status']): string {
    return getStatusLabel(status);
  }

  readonly aiCreateOpen = signal(false);
  readonly aiBusy = signal(false);
  readonly aiCreatedBy = signal<string | null>(null);
  readonly aiPromptText = signal('');
  readonly aiSuggestion = signal<{ suggestedPolicyName: string; summary: string; activityDiagramPayload?: SaveActivityDiagramPayload } | null>(null);

  readonly mainForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: ['', [Validators.required]],
    responsibleUserId: ['', [Validators.required]],
    createdBy: ['', [Validators.required]]
  });

  readonly versionForm = this.fb.nonNullable.group({
    createdBy: ['', [Validators.required]]
  });

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    forkJoin({
      policies: this.policyService.getPolicies(),
      users: this.usersService.list()
    }).subscribe({
      next: ({ policies, users }) => {
        this.policies.set(policies);
        this.users.set(users);
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando políticas')),
      complete: () => this.loading.set(false)
    });
  }

  submitMain() {
    if (this.mainForm.invalid) return;
    const id = this.editingId();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    if (id) {
      this.policyService
        .updatePolicy(id, {
          name: this.mainForm.getRawValue().name,
          description: this.mainForm.getRawValue().description,
          responsibleUserId: this.mainForm.getRawValue().responsibleUserId
        })
        .subscribe({
          next: () => {
            this.success.set('Política actualizada');
            this.cancelEdit();
            this.reload();
          },
          error: (e) => this.error.set(mapHttpError(e, 'Error actualizando política')),
          complete: () => this.saving.set(false)
        });
      return;
    }

    this.policyService
      .createPolicy({
        name: this.mainForm.getRawValue().name,
        description: this.mainForm.getRawValue().description,
        responsibleUserId: this.mainForm.getRawValue().responsibleUserId,
        createdBy: this.mainForm.getRawValue().createdBy
      })
      .subscribe({
        next: () => {
          this.success.set('Política creada');
          this.resetCreateForm();
          this.reload();
        },
        error: (e) => this.error.set(mapHttpError(e, 'Error creando política')),
        complete: () => this.saving.set(false)
      });
  }

  startEdit(p: BusinessPolicy) {
    if (p.status !== 'DRAFT') return;
    this.editingId.set(p.id);
    this.error.set(null);
    this.success.set(null);
    this.mainForm.get('createdBy')?.clearValidators();
    this.mainForm.get('createdBy')?.updateValueAndValidity();
    this.mainForm.patchValue({
      name: p.name,
      description: p.description,
      responsibleUserId: p.responsibleUserId,
      createdBy: ''
    });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.mainForm.get('createdBy')?.setValidators([Validators.required]);
    this.mainForm.get('createdBy')?.updateValueAndValidity();
    this.resetCreateForm();
  }

  openVersion(p: BusinessPolicy) {
    this.versionTarget.set(p);
    this.versionForm.reset({ createdBy: '' });
    this.error.set(null);
    this.success.set(null);
  }

  cancelVersion() {
    this.versionTarget.set(null);
    this.versionForm.reset({ createdBy: '' });
  }

  confirmVersion() {
    const p = this.versionTarget();
    if (!p || this.versionForm.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.policyService.versionPolicy(p.id, this.versionForm.getRawValue().createdBy).subscribe({
      next: (created) => {
        this.success.set(`Nueva versión en borrador: ${created.name}`);
        this.cancelVersion();
        this.reload();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error al versionar')),
      complete: () => this.saving.set(false)
    });
  }

  activate(p: BusinessPolicy) {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.policyService.activatePolicy(p.id).subscribe({
      next: () => {
        this.success.set('Política activada');
        this.reload();
      },
      error: (e) => this.error.set(mapHttpError(e, 'No se pudo activar la política')),
      complete: () => this.saving.set(false)
    });
  }

  deactivate(p: BusinessPolicy) {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.policyService.deactivatePolicy(p.id).subscribe({
      next: () => {
        this.success.set('Política desactivada');
        this.reload();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error desactivando política')),
      complete: () => this.saving.set(false)
    });
  }

  userOptionLabel(u: User): string {
    return `${u.fullName} — ${u.email}`;
  }

  userLabel(userId: string): string {
    const u = this.users().find((x) => x.id === userId);
    return u ? `${u.fullName}` : userId;
  }

  scrollToCreate() {
    document.getElementById('create-policy')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  openAiCreate() {
    this.aiCreateOpen.set(true);
    this.aiSuggestion.set(null);
    if (!this.aiCreatedBy()) this.aiCreatedBy.set(this.users()[0]?.id ?? null);
  }

  closeAiCreate() {
    this.aiCreateOpen.set(false);
  }

  generateAi() {
    const createdBy = (this.aiCreatedBy() ?? '').trim();
    const promptText = (this.aiPromptText() ?? '').trim();
    const policyId = 'NEW';
    if (!createdBy || !promptText) return;
    this.aiBusy.set(true);
    this.aiSuggestion.set(null);
    this.error.set(null);
    this.aiService.generateFromText({ policyId, createdBy, promptText }).subscribe({
      next: (res) => {
        this.aiSuggestion.set({
          suggestedPolicyName: res.suggestedPolicyName,
          summary: res.summary,
          activityDiagramPayload: res.activityDiagramPayload
        });
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error generando propuesta con IA')),
      complete: () => this.aiBusy.set(false)
    });
  }

  applyAiToCreateForm() {
    const s = this.aiSuggestion();
    const createdBy = (this.aiCreatedBy() ?? '').trim();
    if (!s || !createdBy) return;

    // Crear política + guardar diagrama + abrir editor.
    const responsibleUserId = this.mainForm.getRawValue().responsibleUserId || createdBy;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.policyService
      .createPolicy({
        name: (s.suggestedPolicyName || 'Política sugerida').trim(),
        description: (s.summary || 'Generada por IA').trim(),
        responsibleUserId,
        createdBy
      })
      .subscribe({
        next: (created) => {
          const payload = s.activityDiagramPayload as SaveActivityDiagramPayload | undefined;
          if (!payload) {
            this.success.set('Política creada (la IA no devolvió diagrama).');
            this.closeAiCreate();
            this.reload();
            this.router.navigate(['/policies', created.id, 'diagram']);
            return;
          }
          const normalized: SaveActivityDiagramPayload = {
            ...payload,
            createdBy: (payload.createdBy ?? '').trim() || createdBy
          };

          this.diagramService.createDiagram(created.id, normalized).subscribe({
            next: () => {
              this.success.set('Política y diagrama creados con IA.');
              this.closeAiCreate();
              this.reload();
              this.router.navigate(['/policies', created.id, 'diagram']);
            },
            error: (e) => {
              this.error.set(mapHttpError(e, 'Política creada, pero falló guardar el diagrama'));
              this.closeAiCreate();
              this.reload();
              this.router.navigate(['/policies', created.id, 'diagram']);
            },
            complete: () => this.saving.set(false)
          });
        },
        error: (e) => {
          this.error.set(mapHttpError(e, 'Error creando política con IA'));
          this.saving.set(false);
        }
      });
  }

  private resetCreateForm() {
    this.mainForm.reset({
      name: '',
      description: '',
      responsibleUserId: '',
      createdBy: ''
    });
  }
}
