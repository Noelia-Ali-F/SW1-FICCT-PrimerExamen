import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Department } from '../../core/models/department.model';
import { Role } from '../../core/models/role.model';
import { User } from '../../core/models/user.model';
import { DepartmentsService } from '../../core/services/departments.service';
import { RolesService } from '../../core/services/roles.service';
import { UsersService } from '../../core/services/users.service';
import { mapHttpError } from '../../shared/utils/http-error.util';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Usuarios</h2>
          <p class="muted">Crea, edita y desactiva usuarios. (MVP: selección de rol y departamento.)</p>
        </div>

        <div class="actions" style="align-items:center">
          <button type="button" class="secondary" (click)="reloadAll()" [disabled]="loading()">Recargar</button>
          <button type="button" (click)="newUser()" [disabled]="saving() || loading()">Nuevo usuario</button>
        </div>
      </header>

      <form class="card" [formGroup]="form" (ngSubmit)="submit()">
        <div class="row">
          <label>
            Nombre completo
            <input formControlName="fullName" />
          </label>
          <label>
            Email
            <input formControlName="email" type="email" />
          </label>
        </div>

        <div class="row">
          <label>
            Contraseña
            <input formControlName="password" type="password" [attr.placeholder]="passwordPlaceholder()" />
          </label>
          <div></div>
        </div>

        <div class="row">
          <label>
            Rol
            <select formControlName="roleId">
              <option value="">Selecciona un rol</option>
              <option *ngFor="let r of roles()" [value]="r.id">{{ r.name }}</option>
            </select>
          </label>
          <label>
            Departamento
            <select formControlName="departmentId">
              <option value="">Selecciona un departamento</option>
              <option *ngFor="let d of departments()" [value]="d.id">{{ d.name }}</option>
            </select>
          </label>
        </div>

        <div class="actions">
          <button type="submit" [disabled]="form.invalid || saving()">{{ primaryActionLabel() }}</button>
          <button type="button" class="secondary" *ngIf="editingId()" (click)="cancelEdit()" [disabled]="saving()">
            Cancelar edición
          </button>
        </div>
      </form>

      <div class="card">
        <div class="toolbar">
          <span class="success" *ngIf="success()">{{ success() }}</span>
          <span class="error" *ngIf="error()">{{ error() }}</span>
        </div>

        <table class="table" *ngIf="users().length; else empty">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Departamento</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of users()">
              <td>{{ u.fullName }}</td>
              <td>{{ u.email }}</td>
              <td>{{ roleName(u.roleId) }}</td>
              <td>{{ departmentName(u.departmentId) }}</td>
              <td>{{ u.status }}</td>
              <td class="actions">
                <button type="button" class="secondary" (click)="startEdit(u)">Editar</button>
                <button type="button" class="danger" (click)="deactivate(u)" [disabled]="u.status !== 'ACTIVE'">
                  Desactivar
                </button>
                <button type="button" class="secondary" (click)="activate(u)" [disabled]="u.status === 'ACTIVE'">
                  Reactivar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty>
          <p class="muted">No hay usuarios aún.</p>
        </ng-template>
      </div>
    </section>
  `,
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class UsersPage implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly departmentsService = inject(DepartmentsService);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<User[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly departments = signal<Department[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly primaryActionLabel = computed(() => (this.editingId() ? 'Guardar cambios' : 'Crear usuario'));
  readonly passwordPlaceholder = computed(() =>
    this.editingId() ? 'Dejar vacío para mantener la contraseña' : 'Obligatorio'
  );

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    roleId: ['', [Validators.required]],
    departmentId: ['', [Validators.required]]
  });

  ngOnInit() {
    this.reloadAll();
  }

  reloadAll() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    forkJoin({
      users: this.usersService.list(),
      roles: this.rolesService.list(),
      departments: this.departmentsService.list()
    }).subscribe({
      next: ({ users, roles, departments }) => {
        this.users.set(users);
        this.roles.set(roles);
        this.departments.set(departments);
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando datos')),
      complete: () => this.loading.set(false)
    });
  }

  submit() {
    if (this.form.invalid) return;

    const id = this.editingId();
    if (!id && !this.form.getRawValue().password.trim()) {
      this.error.set('La contraseña es obligatoria al crear un usuario');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    if (!id) {
      this.usersService
        .create({
          fullName: this.form.getRawValue().fullName,
          email: this.form.getRawValue().email,
          password: this.form.getRawValue().password,
          roleId: this.form.getRawValue().roleId,
          departmentId: this.form.getRawValue().departmentId
        })
        .subscribe({
          next: () => {
            this.resetForm();
            this.success.set('Usuario creado');
            this.reloadAll();
          },
          error: (e) => this.error.set(mapHttpError(e, 'Error creando usuario')),
          complete: () => this.saving.set(false)
        });
      return;
    }

    const pwd = this.form.getRawValue().password.trim();
    this.usersService
      .update(id, {
        fullName: this.form.getRawValue().fullName,
        email: this.form.getRawValue().email,
        password: pwd ? pwd : undefined,
        roleId: this.form.getRawValue().roleId,
        departmentId: this.form.getRawValue().departmentId
      })
      .subscribe({
        next: () => {
          this.resetForm();
          this.success.set('Usuario actualizado');
          this.reloadAll();
        },
        error: (e) => this.error.set(mapHttpError(e, 'Error actualizando usuario')),
        complete: () => this.saving.set(false)
      });
  }

  startEdit(u: User) {
    this.editingId.set(u.id);
    this.error.set(null);
    this.success.set(null);
    this.form.patchValue({
      fullName: u.fullName,
      email: u.email,
      password: '',
      roleId: u.roleId,
      departmentId: u.departmentId
    });
  }

  newUser() {
    this.cancelEdit();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.resetForm();
  }

  deactivate(u: User) {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.usersService.deactivate(u.id).subscribe({
      next: () => {
        this.success.set('Usuario desactivado');
        this.reloadAll();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error desactivando usuario')),
      complete: () => this.saving.set(false)
    });
  }

  activate(u: User) {
    if (u.status === 'ACTIVE') return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.usersService.activate(u.id).subscribe({
      next: () => {
        this.success.set('Usuario reactivado');
        this.reloadAll();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error reactivando usuario')),
      complete: () => this.saving.set(false)
    });
  }

  roleName(roleId: string): string {
    return this.roles().find((r) => r.id === roleId)?.name ?? roleId;
  }

  departmentName(departmentId: string): string {
    return this.departments().find((d) => d.id === departmentId)?.name ?? departmentId;
  }

  private resetForm() {
    this.editingId.set(null);
    this.form.reset({
      fullName: '',
      email: '',
      password: '',
      roleId: '',
      departmentId: ''
    });
  }
}
