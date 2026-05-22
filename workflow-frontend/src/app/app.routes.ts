import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { reportsGuard } from './core/guards/reports.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage)
  },
  {
    path: 'roles',
    canActivate: [authGuard],
    loadComponent: () => import('./features/roles/roles.page').then((m) => m.RolesPage)
  },
  {
    path: 'departments',
    canActivate: [authGuard],
    loadComponent: () => import('./features/departments/departments.page').then((m) => m.DepartmentsPage)
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () => import('./features/users/users.page').then((m) => m.UsersPage)
  },
  {
    path: 'policies',
    canActivate: [authGuard],
    loadComponent: () => import('./features/policies/policies.page').then((m) => m.PoliciesPage)
  },
  {
    path: 'diagram-editor',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/diagram-editor/diagram-editor-picker.page').then(
        (m) => m.DiagramEditorPickerPage
      )
  },
  {
    path: 'policies/:policyId/diagram',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/diagram-editor/diagram-editor.page').then((m) => m.DiagramEditorPage)
  },
  {
    path: 'policies/:policyId/designer',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/diagram-editor/policy-designer-alias.page').then((m) => m.PolicyDesignerAliasPage)
  },
  {
    path: 'process-instances',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/process-instances/process-instances.page').then(
        (m) => m.ProcessInstancesPage
      )
  },
  {
    path: 'process-instances/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/process-detail/process-detail.page').then((m) => m.ProcessDetailPage)
  },
  {
    path: 'my-tasks',
    canActivate: [authGuard],
    loadComponent: () => import('./features/my-tasks/my-tasks.page').then((m) => m.MyTasksPage)
  },
  {
    path: 'reports',
    canActivate: [authGuard, reportsGuard],
    loadComponent: () => import('./features/reports/reports.page').then((m) => m.ReportsPage)
  },
  {
    path: 'monitoring',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/monitoring/monitoring.page').then((m) => m.MonitoringPage)
  },
  {
    path: 'monitoring/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/monitoring/monitoring.page').then((m) => m.MonitoringPage)
  },
  {
    path: 'ai-assistant',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/ai-assistant/ai-assistant.page').then((m) => m.AiAssistantPage)
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage)
  }
];
