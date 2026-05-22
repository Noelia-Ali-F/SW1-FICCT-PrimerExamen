import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { ContextualAssistantComponent } from './shared/components/contextual-assistant/contextual-assistant.component';
import { NotificationBellComponent } from './shared/components/notification-bell/notification-bell.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, ContextualAssistantComponent, NotificationBellComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('workflow-frontend');

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  /** Normalized URL without query/hash, e.g. `/dashboard` */
  protected readonly currentUrl = signal<string>(this.normalizeUrl(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map((e) => this.normalizeUrl(e.urlAfterRedirects)),
        startWith(this.normalizeUrl(this.router.url)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((url) => this.currentUrl.set(url));
  }

  protected readonly isDashboardActive = computed(() => this.currentUrl() === '/dashboard');
  protected readonly isUsersActive = computed(() => this.currentUrl().startsWith('/users'));
  protected readonly isRolesActive = computed(() => this.currentUrl().startsWith('/roles'));
  protected readonly isDepartmentsActive = computed(() => this.currentUrl().startsWith('/departments'));
  protected readonly isPoliciesActive = computed(() => {
    const url = this.currentUrl();
    if (!url.startsWith('/policies')) return false;
    return !url.includes('/diagram');
  });
  protected readonly isDiagramEditorActive = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/diagram-editor') || url.includes('/policies/') && url.includes('/diagram');
  });
  protected readonly isProcessInstancesActive = computed(() =>
    this.currentUrl().startsWith('/process-instances')
  );
  protected readonly isMyTasksActive = computed(() => this.currentUrl().startsWith('/my-tasks'));
  protected readonly isMonitoringActive = computed(() => this.currentUrl().startsWith('/monitoring'));
  protected readonly isReportsActive = computed(() => this.currentUrl().startsWith('/reports'));
  protected readonly isAiAssistantActive = computed(() => this.currentUrl().startsWith('/ai-assistant'));
  protected readonly isSettingsActive = computed(() => this.currentUrl().startsWith('/settings'));

  protected readonly showShell = computed(() => this.auth.isAuthenticated() && this.currentUrl() !== '/login');

  private normalizeUrl(raw: string): string {
    const path = raw.split('#')[0]?.split('?')[0] ?? raw;
    if (!path) return '/';
    return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  }
}
