import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Department } from '../../core/models/department.model';
import { DepartmentsService } from '../../core/services/departments.service';
import { mapHttpError } from '../../shared/utils/http-error.util';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Departamentos</h2>
          <p class="muted">Gestiona los departamentos responsables de actividades.</p>
        </div>

        <div class="actions" style="align-items:center">
          <button type="button" class="secondary" (click)="load()" [disabled]="loading()">Recargar</button>
          <button type="button" (click)="newDepartment()" [disabled]="saving() || loading()">
            Nuevo departamento
          </button>
        </div>
      </header>

      <form class="card" [formGroup]="form" (ngSubmit)="submit()">
        <div class="row">
          <label>
            Nombre
            <input formControlName="name" placeholder="Ej: TI" />
          </label>
          <label>
            Descripción
            <input formControlName="description" placeholder="Opcional" />
          </label>
        </div>
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

        <table class="table" *ngIf="departments().length; else empty">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of departments()">
              <td>{{ d.name }}</td>
              <td>{{ d.status }}</td>
              <td>{{ d.description || '-' }}</td>
              <td class="actions">
                <button type="button" class="secondary" (click)="startEdit(d)" [disabled]="saving()">
                  Editar
                </button>
                <button
                  type="button"
                  class="danger"
                  (click)="deactivate(d)"
                  [disabled]="saving() || d.status !== 'ACTIVE'"
                >
                  Desactivar
                </button>
                <button
                  type="button"
                  class="secondary"
                  (click)="activate(d)"
                  [disabled]="saving() || d.status === 'ACTIVE'"
                >
                  Reactivar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty>
          <p class="muted">No hay departamentos aún.</p>
        </ng-template>
      </div>
    </section>
  `,
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class DepartmentsPage implements OnInit {
  private readonly departmentsService = inject(DepartmentsService);
  private readonly fb = inject(FormBuilder);

  readonly departments = signal<Department[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly primaryActionLabel = computed(() =>
    this.editingId() ? 'Guardar cambios' : 'Crear departamento'
  );

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
    this.departmentsService.list().subscribe({
      next: (data) => this.departments.set(data),
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando departamentos')),
      complete: () => this.loading.set(false)
    });
  }

  submit() {
    if (this.form.invalid) return;
    const id = this.editingId();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    const payload = {
      name: this.form.getRawValue().name,
      description: this.form.getRawValue().description || undefined
    };

    const req$ = id ? this.departmentsService.update(id, payload) : this.departmentsService.create(payload);
    req$.subscribe({
      next: () => {
        this.resetForm();
        this.success.set(id ? 'Departamento actualizado' : 'Departamento creado');
        this.load();
      },
      error: (e) =>
        this.error.set(mapHttpError(e, id ? 'Error actualizando departamento' : 'Error creando departamento')),
      complete: () => this.saving.set(false)
    });
  }

  startEdit(d: Department) {
    this.editingId.set(d.id);
    this.error.set(null);
    this.success.set(null);
    this.form.patchValue({ name: d.name, description: d.description ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.resetForm();
  }

  newDepartment() {
    this.resetForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deactivate(d: Department) {
    if (d.status !== 'ACTIVE') return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.departmentsService.deactivate(d.id).subscribe({
      next: () => {
        if (this.editingId() === d.id) this.resetForm();
        this.success.set('Departamento desactivado');
        this.load();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error desactivando departamento')),
      complete: () => this.saving.set(false)
    });
  }

  activate(d: Department) {
    if (d.status === 'ACTIVE') return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.departmentsService.activate(d.id).subscribe({
      next: () => {
        this.success.set('Departamento reactivado');
        this.load();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error reactivando departamento')),
      complete: () => this.saving.set(false)
    });
  }

  private resetForm() {
    this.editingId.set(null);
    this.form.reset({ name: '', description: '' });
  }
}
