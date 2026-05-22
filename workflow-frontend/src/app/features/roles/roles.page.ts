import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RolesService } from '../../core/services/roles.service';
import { Role } from '../../core/models/role.model';
import { mapHttpError } from '../../shared/utils/http-error.util';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Roles</h2>
          <p class="muted">Crea, edita y desactiva roles de la organización.</p>
        </div>

        <div class="actions" style="align-items:center">
          <button type="button" class="secondary" (click)="load()" [disabled]="loading()">Recargar</button>
          <button type="button" (click)="newRole()" [disabled]="saving() || loading()">Nuevo rol</button>
        </div>
      </header>

      <form class="card" [formGroup]="form" (ngSubmit)="submit()">
        <div class="row">
          <label>
            Nombre
            <input formControlName="name" placeholder="Ej: Supervisor" />
          </label>
          <label>
            Descripción
            <input formControlName="description" placeholder="Opcional" />
          </label>
        </div>
        <label>
          Permisos (separados por coma)
          <input
            [value]="permissionsText()"
            (input)="permissionsText.set($any($event.target).value)"
            placeholder="Ej: POLICIES_EDIT, TASKS_MANAGE"
          />
        </label>

        <div class="actions">
          <button type="submit" [disabled]="form.invalid || saving()">{{ primaryActionLabel() }}</button>
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
          <span class="success" *ngIf="success()">{{ success() }}</span>
          <span class="error" *ngIf="error()">{{ error() }}</span>
        </div>

        <table class="table" *ngIf="roles().length; else empty">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of roles()">
              <td>{{ r.name }}</td>
              <td>{{ r.status }}</td>
              <td>{{ r.description || '-' }}</td>
              <td class="actions">
                <button type="button" class="secondary" (click)="startEdit(r)" [disabled]="saving()">
                  Editar
                </button>
                <button
                  type="button"
                  class="danger"
                  (click)="deactivate(r)"
                  [disabled]="saving() || r.status !== 'ACTIVE'"
                >
                  Desactivar
                </button>
                <button
                  type="button"
                  class="secondary"
                  (click)="activate(r)"
                  [disabled]="saving() || r.status === 'ACTIVE'"
                >
                  Reactivar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty>
          <p class="muted">No hay roles aún.</p>
        </ng-template>
      </div>
    </section>
  `,
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class RolesPage implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly fb = inject(FormBuilder);

  readonly roles = signal<Role[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly permissionsText = signal('');

  readonly primaryActionLabel = computed(() => (this.editingId() ? 'Guardar cambios' : 'Crear rol'));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: ['']
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.rolesService.list().subscribe({
      next: (data) => this.roles.set(data),
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando roles')),
      complete: () => this.loading.set(false)
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    const permissions = this.permissionsText()
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const id = this.editingId();
    const payload = {
      name: this.form.getRawValue().name,
      description: this.form.getRawValue().description || undefined,
      permissions: permissions.length ? permissions : undefined
    };

    const req$ = id ? this.rolesService.update(id, payload) : this.rolesService.create(payload);
    req$.subscribe({
      next: () => {
        this.resetForm();
        this.success.set(id ? 'Rol actualizado' : 'Rol creado');
        this.load();
      },
      error: (e) => this.error.set(mapHttpError(e, id ? 'Error actualizando rol' : 'Error creando rol')),
      complete: () => this.saving.set(false)
    });
  }

  startEdit(r: Role) {
    this.editingId.set(r.id);
    this.error.set(null);
    this.success.set(null);
    this.form.patchValue({ name: r.name, description: r.description ?? '' });
    this.permissionsText.set((r.permissions ?? []).join(', '));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.resetForm();
  }

  newRole() {
    this.resetForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deactivate(r: Role) {
    if (r.status !== 'ACTIVE') return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.rolesService.deactivate(r.id).subscribe({
      next: () => {
        if (this.editingId() === r.id) this.resetForm();
        this.success.set('Rol desactivado');
        this.load();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error desactivando rol')),
      complete: () => this.saving.set(false)
    });
  }

  activate(r: Role) {
    if (r.status === 'ACTIVE') return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.rolesService.activate(r.id).subscribe({
      next: () => {
        this.success.set('Rol reactivado');
        this.load();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error reactivando rol')),
      complete: () => this.saving.set(false)
    });
  }

  private resetForm() {
    this.editingId.set(null);
    this.permissionsText.set('');
    this.form.reset({ name: '', description: '' });
  }
}

