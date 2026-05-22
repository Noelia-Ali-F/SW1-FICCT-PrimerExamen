import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { mapHttpError } from '../../shared/utils/http-error.util';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="login-wrap">
      <div class="login-card">
        <div class="brand">
          <div class="mark" aria-hidden="true">WF</div>
          <div>
            <div class="title">Sistema Workflow</div>
            <div class="muted">Iniciar sesión</div>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            Email
            <input formControlName="email" type="email" autocomplete="username" />
          </label>
          <label>
            Contraseña
            <input formControlName="password" type="password" autocomplete="current-password" />
          </label>

          <button type="submit" [disabled]="form.invalid || busy()">Entrar</button>

          <p class="error" *ngIf="error()">{{ error() }}</p>

          <details class="hint">
            <summary>Credenciales de prueba</summary>
            <div class="muted small">
              <div><strong>admin@local.test</strong> o <strong>admin@local.prueba</strong></div>
              <div><strong>Admin123!</strong></div>
            </div>
          </details>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      .login-wrap {
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 20px;
      }
      .login-card {
        width: min(420px, 94vw);
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--panel-solid);
        box-shadow: var(--shadow-md);
        padding: 16px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
      }
      .mark {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        font-weight: 900;
        color: #fff;
        background: linear-gradient(180deg, var(--primary), var(--primary-700));
        box-shadow: 0 12px 26px rgba(37, 99, 235, 0.22);
      }
      .title {
        font-weight: 900;
        letter-spacing: 0.2px;
      }
      form {
        display: grid;
        gap: 10px;
      }
      label {
        display: grid;
        gap: 6px;
        font-weight: 750;
        font-size: 12px;
        color: var(--muted);
      }
      .error {
        margin: 0;
        color: #991b1b;
        font-weight: 750;
        font-size: 13px;
      }
      .hint summary {
        cursor: pointer;
        font-weight: 800;
        color: var(--muted);
      }
      .small {
        font-size: 12px;
      }
    `
  ]
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['admin@local.test', [Validators.required, Validators.email]],
    password: ['Admin123!', [Validators.required]]
  });

  submit() {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.auth.applyLogin(res);
        const next = this.route.snapshot.queryParamMap.get('next') || '/dashboard';
        this.router.navigateByUrl(next);
      },
      error: (e) => {
        this.error.set(mapHttpError(e, 'No se pudo iniciar sesión'));
        this.busy.set(false);
      },
      complete: () => this.busy.set(false)
    });
  }
}

