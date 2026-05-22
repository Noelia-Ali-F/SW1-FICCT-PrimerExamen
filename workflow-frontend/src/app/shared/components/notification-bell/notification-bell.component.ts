import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UsersService } from '../../../core/services/users.service';
import { Notification } from '../../../core/models/notification.model';
import { User } from '../../../core/models/user.model';
import { mapHttpError } from '../../utils/http-error.util';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="nb-root" #root>
      <button
        type="button"
        class="icon-btn secondary bell"
        [class.nb-open]="panelOpen()"
        (click)="togglePanel($event)"
        [attr.aria-expanded]="panelOpen()"
        aria-controls="nb-panel"
        aria-label="Notificaciones"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            d="M6 16h12v-5a6 6 0 1 0-12 0v5Z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
          <path d="M9 16a3 3 0 0 0 6 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <span class="badge" *ngIf="unreadCount() > 0" aria-hidden="true">{{ unreadBadge() }}</span>
      </button>

      <div
        id="nb-panel"
        class="nb-panel"
        *ngIf="panelOpen()"
        role="region"
        aria-label="Panel de notificaciones"
        (click)="$event.stopPropagation()"
      >
        <div class="nb-head">
          <div class="nb-title">Notificaciones</div>
          <div class="nb-user-row" *ngIf="showUserPicker()">
            <label class="nb-user-label">
              <span class="nb-muted">Usuario (vista)</span>
              <select [value]="selectedUserId() ?? ''" (change)="onUserChange($any($event.target).value)">
                <option value="">—</option>
                <option *ngFor="let u of users()" [value]="u.id">{{ u.fullName }}</option>
              </select>
            </label>
          </div>
          <div class="nb-actions">
            <button type="button" class="nb-btn secondary" (click)="refresh()" [disabled]="loading() || !selectedUserId()">
              Actualizar
            </button>
            <button
              type="button"
              class="nb-btn secondary"
              (click)="markAllRead()"
              [disabled]="loading() || !selectedUserId() || unreadCount() === 0"
            >
              Marcar todas leídas
            </button>
          </div>
        </div>

        <p class="nb-error" *ngIf="error()">{{ error() }}</p>

        <div class="nb-list" *ngIf="selectedUserId(); else pickUser">
          <div *ngIf="loading()" class="nb-muted nb-pad">Cargando…</div>
          <div *ngIf="!loading() && notifications().length === 0" class="nb-muted nb-pad">No hay notificaciones.</div>
          <div *ngFor="let n of notifications()" class="nb-item" [class.nb-item-unread]="!n.read">
            <div class="nb-item-top">
              <span [class]="typeBadgeClass(n.type)">{{ typeLabel(n.type) }}</span>
              <span class="nb-date">{{ n.createdAt ? (n.createdAt | date : 'short') : '—' }}</span>
            </div>
            <div class="nb-item-title">{{ n.title }}</div>
            <div class="nb-item-msg">{{ n.message }}</div>
            <div class="nb-item-foot">
              <span class="nb-read-state">{{ n.read ? 'Leída' : 'No leída' }}</span>
              <button
                type="button"
                class="nb-btn small"
                *ngIf="!n.read"
                (click)="markOneRead(n)"
                [disabled]="loading()"
              >
                Marcar como leída
              </button>
            </div>
          </div>
        </div>
        <ng-template #pickUser>
          <div class="nb-muted nb-pad" *ngIf="!users().length && !usersLoading()">No hay usuarios.</div>
          <div class="nb-muted nb-pad" *ngIf="usersLoading()">Cargando usuarios…</div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [
    `
      .nb-root {
        position: relative;
      }
      .bell {
        position: relative;
      }
      .bell.nb-open {
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent);
      }
      .badge {
        position: absolute;
        top: 6px;
        right: 6px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        background: #ef4444;
        color: #ffffff;
        font-size: 10px;
        font-weight: 900;
        line-height: 16px;
        text-align: center;
        border: 2px solid color-mix(in srgb, var(--panel-solid) 92%, transparent);
      }
      .nb-panel {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: min(400px, 92vw);
        max-height: min(70dvh, 520px);
        overflow: auto;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: var(--panel-solid);
        box-shadow: var(--shadow-md, 0 16px 40px rgba(15, 23, 42, 0.12));
        z-index: 50;
      }
      .nb-head {
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        background: color-mix(in srgb, var(--panel-solid) 96%, transparent);
        backdrop-filter: blur(8px);
      }
      .nb-title {
        font-weight: 900;
        font-size: 14px;
        margin-bottom: 8px;
      }
      .nb-user-row {
        margin-bottom: 8px;
      }
      .nb-user-label {
        display: grid;
        gap: 4px;
        font-size: 11px;
        font-weight: 750;
        color: var(--muted);
      }
      .nb-user-label select {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--border);
        font-size: 13px;
        background: color-mix(in srgb, var(--panel-solid) 88%, transparent);
      }
      .nb-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .nb-btn {
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 750;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 85%, transparent);
        cursor: pointer;
      }
      .nb-btn.secondary {
        background: #fff;
      }
      .nb-btn.small {
        padding: 4px 8px;
        font-size: 11px;
      }
      .nb-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .nb-error {
        margin: 0;
        padding: 8px 14px;
        font-size: 12px;
        color: #991b1b;
        font-weight: 650;
        background: #fef2f2;
        border-bottom: 1px solid #fecaca;
      }
      .nb-list {
        padding: 8px 0 12px;
      }
      .nb-pad {
        padding: 12px 14px;
      }
      .nb-muted {
        color: var(--muted);
        font-size: 13px;
      }
      .nb-item {
        padding: 10px 14px;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      }
      .nb-item-unread {
        background: color-mix(in srgb, var(--primary) 6%, transparent);
      }
      .nb-item-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .nb-type {
        font-size: 11px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid transparent;
      }
      .nb-type-task-assigned {
        background: #eff6ff;
        color: #1d4ed8;
        border-color: #bfdbfe;
      }
      .nb-type-task-started {
        background: #fffbeb;
        color: #b45309;
        border-color: #fde68a;
      }
      .nb-type-task-completed {
        background: #ecfdf5;
        color: #047857;
        border-color: #a7f3d0;
      }
      .nb-type-process-cancelled {
        background: #fef2f2;
        color: #991b1b;
        border-color: #fecaca;
      }
      .nb-type-process-created {
        background: #eff6ff;
        color: #1e40af;
        border-color: #bfdbfe;
      }
      .nb-type-system {
        background: #f8fafc;
        color: #475569;
        border-color: #e2e8f0;
      }
      .nb-date {
        font-size: 11px;
        color: var(--muted);
        white-space: nowrap;
      }
      .nb-item-title {
        font-weight: 850;
        font-size: 13px;
        margin-bottom: 4px;
      }
      .nb-item-msg {
        font-size: 12px;
        color: var(--muted);
        line-height: 1.45;
        margin-bottom: 8px;
      }
      .nb-item-foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .nb-read-state {
        font-size: 11px;
        font-weight: 700;
        color: var(--muted);
      }
    `
  ]
})
export class NotificationBellComponent implements OnInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly notificationsApi = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly users = signal<User[]>([]);
  readonly usersLoading = signal(false);
  readonly selectedUserId = signal<string | null>(null);
  readonly notifications = signal<Notification[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly panelOpen = signal(false);

  ngOnInit(): void {
    const fromAuth = this.auth.user()?.id;
    if (fromAuth) {
      this.selectedUserId.set(fromAuth);
    }
    this.usersLoading.set(true);
    this.usersService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.users.set(list);
          if (!this.selectedUserId() && list.length) {
            this.selectedUserId.set(list[0].id);
          }
          this.usersLoading.set(false);
          this.refreshCountsAndList();
        },
        error: (e) => {
          this.usersLoading.set(false);
          this.error.set(mapHttpError(e, 'Error cargando usuarios'));
        }
      });
  }

  /** Muestra el selector solo si no hay usuario de sesión con id. */
  showUserPicker(): boolean {
    return !this.auth.user()?.id;
  }

  unreadBadge(): string {
    const n = this.unreadCount();
    return n > 99 ? '99+' : String(n);
  }

  togglePanel(ev: Event): void {
    ev.stopPropagation();
    this.panelOpen.update((o) => !o);
    if (this.panelOpen()) {
      this.refresh();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.panelOpen()) return;
    const root = this.host.nativeElement;
    if (!root.contains(ev.target as Node)) {
      this.panelOpen.set(false);
    }
  }

  onUserChange(id: string): void {
    this.selectedUserId.set(id || null);
    this.error.set(null);
    this.refresh();
  }

  refresh(): void {
    const uid = this.selectedUserId();
    if (!uid) return;
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      list: this.notificationsApi.getByUser(uid),
      count: this.notificationsApi.countUnread(uid)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ list, count }) => {
          this.notifications.set(list);
          this.unreadCount.set(typeof count === 'number' ? count : 0);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(mapHttpError(e, 'Error cargando notificaciones'));
        }
      });
  }

  private refreshCountsAndList(): void {
    if (this.selectedUserId()) {
      this.refresh();
    } else {
      this.notifications.set([]);
      this.unreadCount.set(0);
    }
  }

  markOneRead(n: Notification): void {
    if (!this.selectedUserId()) return;
    this.loading.set(true);
    this.error.set(null);
    this.notificationsApi
      .markAsRead(n.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refresh(),
        error: (e) => {
          this.loading.set(false);
          this.error.set(mapHttpError(e, 'Error al marcar notificación'));
        }
      });
  }

  markAllRead(): void {
    const uid = this.selectedUserId();
    if (!uid) return;
    this.loading.set(true);
    this.error.set(null);
    this.notificationsApi
      .markAllAsRead(uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.refresh();
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(mapHttpError(e, 'Error al marcar todas'));
        }
      });
  }

  typeBadgeClass(type: Notification['type']): string {
    const base = 'nb-type ';
    switch (type) {
      case 'TASK_ASSIGNED':
        return base + 'nb-type-task-assigned';
      case 'TASK_STARTED':
        return base + 'nb-type-task-started';
      case 'TASK_COMPLETED':
      case 'PROCESS_COMPLETED':
        return base + 'nb-type-task-completed';
      case 'PROCESS_CANCELLED':
        return base + 'nb-type-process-cancelled';
      case 'PROCESS_CREATED':
        return base + 'nb-type-process-created';
      case 'SYSTEM_INFO':
      default:
        return base + 'nb-type-system';
    }
  }

  typeLabel(type: Notification['type']): string {
    const labels: Record<string, string> = {
      TASK_ASSIGNED: 'Tarea asignada',
      TASK_STARTED: 'Tarea iniciada',
      TASK_COMPLETED: 'Tarea completada',
      PROCESS_CREATED: 'Trámite creado',
      PROCESS_COMPLETED: 'Trámite completado',
      PROCESS_CANCELLED: 'Trámite cancelado',
      SYSTEM_INFO: 'Sistema'
    };
    return labels[type] ?? type;
  }
}
