import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BusinessPolicy } from '../../core/models/business-policy.model';
import { PolicyService } from '../../core/services/policy.service';
import { mapHttpError } from '../../shared/utils/http-error.util';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Editor de diagramas</h2>
          <p class="muted">Selecciona una política en borrador para abrir el editor UML.</p>
        </div>
      </header>

      <div class="card" *ngIf="success() || error()">
        <p class="success" *ngIf="success()">{{ success() }}</p>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </div>

      <div class="card">
        <div class="toolbar" style="align-items:flex-end">
          <div style="flex:1; min-width: 240px">
            <div class="muted" style="font-size:12px; font-weight:650; margin-bottom:6px">
              Unirme por link/código (colaborativo)
            </div>
            <input
              class="join-input"
              [value]="joinText()"
              (input)="joinText.set($any($event.target).value)"
              placeholder="Pega aquí el link que te compartieron (…/policies/<id>/diagram?collab=1&who=...)"
              [disabled]="loading()"
            />
          </div>
          <div style="display:flex; gap:8px">
            <button type="button" class="secondary" (click)="reload()" [disabled]="loading()">Recargar</button>
            <button type="button" (click)="joinFromText()" [disabled]="loading() || !joinText().trim()">
              Unirme
            </button>
          </div>
        </div>
        <p class="muted small" style="margin:10px 0 0">
          Tip: si solo te pasan el <b>ID</b> de la política, también sirve pegarlo (ej: <code>6620...</code>).
        </p>
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="muted small">Políticas en estado <b>DRAFT</b></div>
        </div>

        <table class="table" *ngIf="draftPolicies().length; else empty">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Versión</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of draftPolicies()">
              <td>{{ p.name }}</td>
              <td>{{ p.version }}</td>
              <td class="actions">
                <a class="link-as-button" [routerLink]="['/policies', p.id, 'diagram']">Abrir editor</a>
              </td>
            </tr>
          </tbody>
        </table>

        <ng-template #empty>
          <p class="muted" style="margin:0">No hay políticas en borrador para editar diagrama.</p>
        </ng-template>
      </div>
    </section>
  `,
  styles: [
    `
      .link-as-button {
        display: inline-block;
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
        color: var(--text);
        font-size: 13px;
        text-decoration: none;
        font-weight: 650;
      }

      .join-input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
        color: var(--text);
        font-size: 13px;
        outline: none;
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class DiagramEditorPickerPage implements OnInit {
  private readonly policyService = inject(PolicyService);
  private readonly router = inject(Router);

  readonly policies = signal<BusinessPolicy[]>([]);
  readonly loading = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly joinText = signal<string>('');

  readonly draftPolicies = () => this.policies().filter((p) => p.status === 'DRAFT');

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.success.set(null);
    this.error.set(null);
    this.policyService.getPolicies().subscribe({
      next: (p) => this.policies.set(p),
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando políticas')),
      complete: () => this.loading.set(false)
    });
  }

  joinFromText() {
    const raw = (this.joinText() ?? '').trim();
    if (!raw) return;

    // Acepta:
    // - ID puro
    // - Ruta relativa /policies/<id>/diagram?...
    // - URL completa https://.../policies/<id>/diagram?...
    let policyId = '';
    let who = '';
    let collab = '1';
    try {
      const hasScheme = raw.startsWith('http://') || raw.startsWith('https://');
      const u = new URL(hasScheme ? raw : `http://local${raw.startsWith('/') ? '' : '/'}${raw}`);
      const m = u.pathname.match(/\/policies\/([^/]+)\/diagram/);
      if (m?.[1]) policyId = m[1];
      who = u.searchParams.get('who') ?? '';
      collab = u.searchParams.get('collab') ?? '1';
    } catch {
      // si no es URL, probamos ID directo
      policyId = raw;
    }

    policyId = (policyId ?? '').trim();
    if (!policyId) {
      this.error.set('No pude detectar el ID de la política en el link/código pegado.');
      return;
    }

    const queryParams: Record<string, string> = { collab: collab || '1' };
    if (who) queryParams['who'] = who;

    this.router.navigate(['/policies', policyId, 'diagram'], { queryParams });
  }
}
