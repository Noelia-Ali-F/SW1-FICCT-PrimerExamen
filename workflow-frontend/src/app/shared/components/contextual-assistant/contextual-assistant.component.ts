import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ContextualAssistantService } from '../../../core/services/contextual-assistant.service';

@Component({
  selector: 'app-contextual-assistant',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ctx-root" aria-live="polite">
      <button
        type="button"
        class="ctx-fab"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        aria-controls="ctx-panel"
        aria-label="Abrir asistente contextual"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <path
            d="M12 3l1.6 4.9H19l-4 2.9 1.5 4.7L12 14.2 8.5 15.5 10 10.8 6 7.9h5.4L12 3Z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <div
        id="ctx-panel"
        class="ctx-panel"
        *ngIf="open()"
        role="dialog"
        aria-modal="false"
        aria-labelledby="ctx-title"
      >
        <div class="ctx-panel-head">
          <div>
            <div id="ctx-title" class="ctx-title">Asistente contextual</div>
            <div class="ctx-route">{{ assistant.currentPath() }}</div>
            <div class="ctx-module">{{ content().moduleLabel }}</div>
          </div>
          <button type="button" class="ctx-close" (click)="close()" aria-label="Cerrar asistente">✕</button>
        </div>

        <p class="ctx-message">{{ content().message }}</p>

        <div class="ctx-suggestions" *ngIf="content().suggestions.length">
          <div class="ctx-suggestions-label">Sugerencias rápidas</div>
          <ul class="ctx-chip-list">
            <li *ngFor="let s of content().suggestions" class="ctx-chip">{{ s }}</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .ctx-root {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 1040;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
        pointer-events: none;
      }
      .ctx-root > * {
        pointer-events: auto;
      }
      .ctx-fab {
        width: 56px;
        height: 56px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        background: linear-gradient(180deg, var(--primary) 0%, var(--primary-700) 100%);
        color: #ffffff;
        box-shadow: 0 14px 34px rgba(37, 99, 235, 0.35), var(--shadow-sm);
        cursor: pointer;
        display: grid;
        place-items: center;
      }
      .ctx-fab:hover {
        filter: brightness(1.05);
      }
      .ctx-fab:focus-visible {
        outline: none;
        box-shadow: var(--focus-ring), 0 14px 34px rgba(37, 99, 235, 0.35);
      }
      .ctx-panel {
        width: min(380px, calc(100vw - 40px));
        max-height: min(72vh, 520px);
        overflow: auto;
        border-radius: 16px;
        border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
        background: var(--panel-solid);
        box-shadow: var(--shadow-md);
        padding: 14px 14px 16px;
      }
      .ctx-panel-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .ctx-title {
        font-weight: 850;
        font-size: 15px;
        letter-spacing: 0.01em;
      }
      .ctx-route {
        margin-top: 4px;
        font-size: 11px;
        font-family: ui-monospace, monospace;
        color: var(--muted);
        word-break: break-all;
      }
      .ctx-module {
        margin-top: 6px;
        font-size: 12px;
        font-weight: 750;
        color: var(--primary);
      }
      .ctx-close {
        flex: 0 0 auto;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        color: var(--muted);
      }
      .ctx-close:hover {
        color: var(--text);
      }
      .ctx-message {
        margin: 0 0 12px;
        font-size: 14px;
        line-height: 1.5;
        color: var(--text);
      }
      .ctx-suggestions-label {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
        margin-bottom: 8px;
      }
      .ctx-chip-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ctx-chip {
        font-size: 13px;
        line-height: 1.4;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
        background: color-mix(in srgb, var(--panel-solid) 88%, var(--primary) 4%);
        color: var(--text);
      }
    `
  ]
})
export class ContextualAssistantComponent {
  protected readonly assistant = inject(ContextualAssistantService);
  protected readonly open = signal(false);

  protected content() {
    return this.assistant.content();
  }

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }
}
