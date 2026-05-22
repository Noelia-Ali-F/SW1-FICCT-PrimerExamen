import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Configuración</h2>
          <p class="muted">Preferencias locales del navegador (se guardan automáticamente).</p>
        </div>
      </header>

      <div class="card">
        <div class="settings-grid">
          <div class="setting">
            <div>
              <div class="setting-title">Tema</div>
              <div class="muted">Cambiar entre claro y oscuro.</div>
            </div>
            <button type="button" class="secondary" (click)="toggleTheme()">
              {{ theme() === 'dark' ? 'Oscuro' : 'Claro' }}
            </button>
          </div>

          <div class="setting">
            <div>
              <div class="setting-title">Notificaciones en la app</div>
              <div class="muted">Muestra avisos dentro del sistema.</div>
            </div>
            <label class="switch">
              <input type="checkbox" [checked]="inAppNotifications()" (change)="setInApp($any($event.target).checked)" />
              <span class="slider" aria-hidden="true"></span>
            </label>
          </div>

          <div class="setting">
            <div>
              <div class="setting-title">Notificaciones por email</div>
              <div class="muted">Preferencia local (no envía emails en MVP).</div>
            </div>
            <label class="switch">
              <input type="checkbox" [checked]="emailNotifications()" (change)="setEmail($any($event.target).checked)" />
              <span class="slider" aria-hidden="true"></span>
            </label>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .settings-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .setting {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
      }
      .setting-title {
        font-weight: 750;
        letter-spacing: 0.2px;
        margin-bottom: 2px;
      }
      .switch {
        position: relative;
        display: inline-block;
        width: 46px;
        height: 28px;
        flex: 0 0 auto;
      }
      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
        border: 1px solid var(--border);
        border-radius: 999px;
        transition: background 0.15s ease, border-color 0.15s ease;
        box-shadow: var(--shadow-sm);
      }
      .slider:before {
        position: absolute;
        content: '';
        height: 22px;
        width: 22px;
        left: 3px;
        top: 50%;
        transform: translateY(-50%);
        background: var(--panel-solid);
        border: 1px solid var(--border);
        border-radius: 999px;
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .switch input:checked + .slider {
        background: color-mix(in srgb, var(--primary) 26%, var(--panel-solid));
        border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
      }
      .switch input:checked + .slider:before {
        transform: translate(18px, -50%);
        background: color-mix(in srgb, var(--primary) 10%, var(--panel-solid));
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class SettingsPage {
  readonly theme = signal<'light' | 'dark'>(this.read<'light' | 'dark'>('wf_theme', 'light'));
  readonly inAppNotifications = signal<boolean>(this.readBool('wf_notif_inapp', true));
  readonly emailNotifications = signal<boolean>(this.readBool('wf_notif_email', false));

  constructor() {
    this.applyTheme(this.theme());
  }

  toggleTheme() {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    this.write('wf_theme', next);
    this.applyTheme(next);
  }

  setInApp(v: boolean) {
    this.inAppNotifications.set(v);
    this.write('wf_notif_inapp', v ? '1' : '0');
  }

  setEmail(v: boolean) {
    this.emailNotifications.set(v);
    this.write('wf_notif_email', v ? '1' : '0');
  }

  private applyTheme(t: 'light' | 'dark') {
    try {
      document.documentElement.classList.toggle('theme-dark', t === 'dark');
    } catch {
      // noop
    }
  }

  private read<T extends string>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return (v as T) || fallback;
    } catch {
      return fallback;
    }
  }

  private readBool(key: string, fallback: boolean): boolean {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return fallback;
      return v === '1' || v === 'true';
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // noop
    }
  }
}

