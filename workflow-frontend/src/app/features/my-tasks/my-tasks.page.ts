import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UsersService } from '../../core/services/users.service';
import { RolesService } from '../../core/services/roles.service';
import { TaskService } from '../../core/services/task.service';
import { DynamicFormService } from '../../core/services/dynamic-form.service';
import { AiFormNlpService } from '../../core/services/ai-form-nlp.service';
import type { AiFormStructuredAutofillResponse } from '../../core/models/ai-form-nlp.model';
import { SpeechRecognitionService } from '../../core/services/speech-recognition.service';
import { WorkflowRealtimeService } from '../../core/services/workflow-realtime.service';
import { User } from '../../core/models/user.model';
import { Role } from '../../core/models/role.model';
import { ActivityTask } from '../../core/models/activity-task.model';
import { DynamicForm, FormField, FormFieldType } from '../../core/models/dynamic-form.model';
import { mapHttpError } from '../../shared/utils/http-error.util';
import { getStatusLabel, getTaskStatusClass } from '../../shared/utils/status-style.util';
import { forkJoin, of } from 'rxjs';
import { catchError, debounceTime, filter, finalize, map, switchMap, tap } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Mis actividades</h2>
          <p class="muted">Tareas asignadas para tu gestión</p>
          <p class="muted small" style="margin-top:6px">
            Si la lista no se actualiza tras un cambio de código, recompile el front y pulse <strong>Ctrl+F5</strong>.
          </p>
        </div>
      </header>

      <div class="card warn" *ngIf="usingAllTasksFallback()" style="margin-bottom: 12px">
        <p class="warn-text" style="margin: 0">
          No hubo coincidencia por usuario/rol para el filtro «Mis actividades». Mostrando <strong>todas las tareas</strong>
          que existen en la base (modo demostración).
        </p>
      </div>

      <div class="card">
        <div class="row">
          <label>
            Usuario (MVP)
            <select
              [value]="selectedUserId() ?? ''"
              (change)="onUserSelect($any($event.target).value)"
              [disabled]="loading()"
            >
              <option value="">Selecciona un usuario</option>
              <option *ngFor="let u of users()" [value]="u.id">{{ userLabel(u) }}</option>
            </select>
          </label>
          <div class="actions" style="align-items:end">
            <button type="button" (click)="loadMyTasks()" [disabled]="!selectedUserId() || loading()">Recargar</button>
          </div>
        </div>
      </div>

      <div class="summary" *ngIf="selectedUserId()">
        <div class="sum-card sum-card-pending">
          <div class="sum-title">Pendientes</div>
          <div class="sum-value sum-val-pending">{{ pending().length }}</div>
        </div>
        <div class="sum-card sum-card-in-progress">
          <div class="sum-title">En proceso</div>
          <div class="sum-value sum-val-in-progress">{{ inProgress().length }}</div>
        </div>
        <div class="sum-card sum-card-completed">
          <div class="sum-title">Completadas</div>
          <div class="sum-value sum-val-completed">{{ completed().length }}</div>
        </div>
        <div class="sum-card sum-card-cancelled" *ngIf="cancelled().length">
          <div class="sum-title">Canceladas</div>
          <div class="sum-value sum-val-cancelled">{{ cancelled().length }}</div>
        </div>
      </div>

      <div class="content-grid">
        <div class="left">
          <div class="card" *ngIf="success() || error()">
            <p class="success" *ngIf="success()">{{ success() }}</p>
            <p class="error" *ngIf="error()">{{ error() }}</p>
          </div>

          <div class="card task-loading-inline" *ngIf="loading() && selectedUserId()">
            <p class="muted" style="margin:0">Cargando tareas…</p>
          </div>

          <div class="task-list" *ngIf="!loading() && tasks().length">
            <div class="task-item task-row-pending" *ngFor="let t of pending()">
              <div class="task-head">
                <div class="task-title">{{ t.activityName }}</div>
                <span [class]="taskStatusBadgeClass(t.status)">{{ taskStatusLabel(t.status) }}</span>
              </div>
              <div class="task-sub">TR-{{ t.processInstanceId }}</div>
              <div class="task-desc muted">Revisa y ejecuta la actividad asignada.</div>
              <div class="task-assign muted small">{{ taskAssignmentLine(t) }}</div>
              <div class="task-foot">
                <span class="tag">Alta</span>
                <span class="muted small">{{ t.createdAt ? (t.createdAt | date: 'yyyy-MM-dd HH:mm') : '' }}</span>
                <button type="button" class="small-btn" (click)="start(t)" [disabled]="saving() || !selectedUserId()">
                  ▶ Iniciar
                </button>
              </div>
            </div>

            <div class="task-item task-row-in-progress" *ngFor="let t of inProgress()">
              <div class="task-head">
                <div class="task-title">{{ t.activityName }}</div>
                <span [class]="taskStatusBadgeClass(t.status)">{{ taskStatusLabel(t.status) }}</span>
              </div>
              <div class="task-sub">TR-{{ t.processInstanceId }}</div>
              <div class="task-desc muted">Actividad en ejecución.</div>
              <div class="task-assign muted small">{{ taskAssignmentLine(t) }}</div>
              <div class="task-foot">
                <span class="tag tag-red">Urgente</span>
                <span class="muted small">{{ t.startedAt ? (t.startedAt | date: 'yyyy-MM-dd HH:mm') : '' }}</span>
                <button type="button" class="small-btn" (click)="openComplete(t)" [disabled]="saving() || !selectedUserId()">
                  Abrir formulario
                </button>
              </div>
            </div>

            <div class="task-item task-row-completed" *ngFor="let t of completed()">
              <div class="task-head">
                <div class="task-title">{{ t.activityName }}</div>
                <span [class]="taskStatusBadgeClass(t.status)">{{ taskStatusLabel(t.status) }}</span>
              </div>
              <div class="task-sub">TR-{{ t.processInstanceId }}</div>
              <div class="task-desc muted">Actividad finalizada.</div>
              <div class="task-assign muted small">{{ taskAssignmentLine(t) }}</div>
              <div class="task-foot">
                <span class="tag tag-gray">Normal</span>
                <span class="muted small">{{ t.completedAt ? (t.completedAt | date: 'yyyy-MM-dd HH:mm') : '' }}</span>
                <button type="button" class="small-btn secondary" (click)="openComplete(t)" [disabled]="saving() || !selectedUserId()">
                  Ver
                </button>
              </div>
            </div>

            <div class="task-item task-row-cancelled" *ngFor="let t of cancelled()">
              <div class="task-head">
                <div class="task-title">{{ t.activityName }}</div>
                <span [class]="taskStatusBadgeClass(t.status)">{{ taskStatusLabel(t.status) }}</span>
              </div>
              <div class="task-sub">TR-{{ t.processInstanceId }}</div>
              <div class="task-desc muted">Tarea cancelada.</div>
              <div class="task-assign muted small">{{ taskAssignmentLine(t) }}</div>
            </div>
          </div>

          <div class="card empty-tasks-card" *ngIf="!loading() && !tasks().length && selectedUserId()">
            <p style="margin:0 0 8px; font-weight:800">No hay tareas para este usuario</p>
            <p class="muted small" style="margin:0 0 10px; line-height:1.45">
              Las tareas se listan según la <strong>calle del diagrama</strong>: asignación por usuario, rol o departamento.
              Si su usuario no coincide con ninguna tarea abierta, la lista queda vacía aunque existan trámites en el sistema.
            </p>
            <ul class="muted small" style="margin:0 0 12px; padding-left:18px; line-height:1.45">
              <li>Pruebe otro usuario (en datos demo suelen coincidir roles <code>@local.test</code>).</li>
              <li>Cree o consulte instancias en <a routerLink="/process-instances">Procesos / instancias</a>.</li>
            </ul>
            <button type="button" class="secondary" (click)="loadMyTasks()" [disabled]="loading() || !selectedUserId()">
              Recargar tareas
            </button>
          </div>
          <div class="card empty-tasks-card" *ngIf="!loading() && !tasks().length && !selectedUserId()">
            <p class="muted" style="margin:0">Seleccione un usuario arriba para cargar sus tareas.</p>
          </div>
        </div>

        <div class="right">
          <div class="card" *ngIf="selectedTask() as t; else placeholder">
            <h3 class="card-title">Formulario de actividad</h3>
            <div class="form-block">
              <div class="muted small">Actividad:</div>
              <div class="form-activity">{{ t.activityName }}</div>
              <div class="muted small" style="margin-top: 6px">{{ taskAssignmentLine(t) }}</div>
            </div>

            <form [formGroup]="completeForm" (ngSubmit)="completeSelected()">
              <div class="card form-loading-card" *ngIf="dynamicFormLoading()">
                <p class="muted" style="margin:0">Cargando formulario de la actividad…</p>
              </div>

              <div class="card form-missing-card" *ngIf="!dynamicFormLoading() && !dynamicForm()">
                <p class="muted" style="margin:0">
                  No se pudo mostrar el formulario (error de red o permisos). Revise el mensaje arriba o abra la tarea de nuevo.
                </p>
              </div>

              <div class="card" *ngIf="!dynamicFormLoading() && dynamicForm() as df" style="margin:0 0 12px; padding: 12px">
                <div *ngIf="dynamicFormFallback()" class="fallback-banner" role="status">
                  <strong>Modo dinámico (plantilla).</strong> No hay formulario CU4 guardado para esta actividad en el
                  servidor. Esta vista no se edita aquí: créela o edítela en el
                  <a [routerLink]="['/policies', t.policyId, 'diagram']" fragment="cu4-form-designer">editor de diagramas</a>
                  (política en borrador → sección <strong>Diseñador de formulario</strong> abajo del lienzo, misma actividad).
                  Para <strong>eliminar</strong> un formulario ya guardado, use el botón «Eliminar formulario» en ese mismo diseñador.
                </div>
                <div class="muted small" style="font-weight:850">{{ df.name }}</div>
                <div class="muted small" *ngIf="df.description" style="margin-top: 4px">{{ df.description }}</div>

                <p class="form-empty-hint" *ngIf="orderedFields(df.fields).length === 0">
                  Este formulario no tiene campos definidos. En el editor de diagramas, sección CU4, agregue al menos
                  etiquetas (LABEL), campos de datos (TEXT, etc.) o botones (BUTTON) y guarde de nuevo.
                </p>

                <div class="card" *ngIf="!dynamicFormFallback()" style="margin-top: 10px; padding: 12px; background: rgba(15, 23, 42, 0.03)">
                  <div class="muted small" style="font-weight: 800">Asistente IA para formulario</div>
                  <p class="muted small" style="margin: 6px 0 8px">
                    Describa en lenguaje natural los datos; el motor local del backend analiza el texto y propone
                    valores según tipo y etiqueta de cada campo. Revise la vista previa y confirme antes de aplicar.
                  </p>
                  <label class="block-label">
                    Texto libre
                    <textarea
                      rows="3"
                      [value]="formAssistInput()"
                      (input)="formAssistInput.set($any($event.target).value)"
                      placeholder="Ej.: El solicitante Juan Pérez solicita vacaciones del 10 al 15 de mayo por motivos familiares."
                    ></textarea>
                  </label>
                  <div class="toolbar inner" style="margin-top: 8px; justify-content: space-between; gap: 10px; flex-wrap: wrap">
                    <label class="checkbox" style="margin: 0">
                      <input
                        type="checkbox"
                        [checked]="formAssistAllowOverwrite()"
                        (change)="formAssistAllowOverwrite.set($any($event.target).checked)"
                      />
                      Permitir sobrescribir campos ya completos
                    </label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap">
                      <button
                        type="button"
                        class="secondary"
                        (click)="clearFormAssistState()"
                        [disabled]="saving() || aiFilling()"
                      >
                        Cancelar sugerencias
                      </button>
                      <button type="button" (click)="requestFormAssist()" [disabled]="saving() || aiFilling()">
                        {{ aiFilling() ? 'Analizando…' : 'Obtener sugerencias' }}
                      </button>
                      <button
                        type="button"
                        class="secondary"
                        (click)="applyFormAssist()"
                        [disabled]="saving() || aiFilling() || !formAssistPreview()"
                      >
                        Aplicar sugerencias
                      </button>
                    </div>
                  </div>
                  <p class="error" *ngIf="formAssistError()" style="margin-top: 8px">{{ formAssistError() }}</p>
                  <p class="success" *ngIf="formAssistSuccess()" style="margin-top: 8px">{{ formAssistSuccess() }}</p>
                  <div style="overflow: auto; margin-top: 10px" *ngIf="formAssistPreview() as prv">
                    <table class="form-ai-prev" *ngIf="formAssistRows().length">
                      <thead>
                        <tr>
                          <th>Campo</th>
                          <th>Valor sugerido</th>
                          <th>Confianza</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let row of formAssistRows()">
                          <td><code>{{ row.key }}</code></td>
                          <td>{{ row.value }}</td>
                          <td class="muted small">{{ row.confidence }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <ul class="muted small" style="margin: 8px 0 0; padding-left: 18px" *ngIf="prv.warnings.length">
                      <li *ngFor="let w of prv.warnings">{{ w }}</li>
                    </ul>
                  </div>
                </div>

                <div class="dyn-grid" style="margin-top: 10px">
                  <ng-container *ngFor="let f of orderedFields(df.fields)">
                    <ng-container [ngSwitch]="f.type">
                      <div *ngSwitchCase="'LABEL'" class="dyn-label">
                        {{ f.label }}
                      </div>
                      <div *ngSwitchCase="'BUTTON'" class="dyn-btn-row">
                        <button
                          type="button"
                          class="secondary"
                          [disabled]="saving()"
                          (click)="onDynamicButtonClick(f)"
                        >
                          {{ f.label }}
                        </button>
                      </div>

                      <label *ngSwitchCase="'USER'" class="block-label">
                        {{ f.label }} <span class="muted small" *ngIf="f.required">(*)</span>
                        <select [formControlName]="f.name">
                          <option value="">— Seleccionar usuario —</option>
                          <option *ngFor="let u of users()" [value]="u.id">{{ userOptionLabel(u) }}</option>
                        </select>
                        <p class="muted small" *ngIf="f.assignsNextTask" style="margin-top: 6px">
                          Al completar esta actividad, la siguiente quedará asignada al usuario elegido.
                        </p>
                        <p class="muted small" *ngIf="f.helpText" style="margin-top: 6px">{{ f.helpText }}</p>
                      </label>

                      <ng-container *ngSwitchDefault>
                        <label *ngIf="f.name" class="block-label">
                          {{ f.label }} <span class="muted small" *ngIf="f.required">(*)</span>
                          <input *ngIf="isTextLike(f.type)" [formControlName]="f.name" [type]="inputTypeFor(f.type)" />
                          <textarea
                            *ngIf="f.type === 'TEXTAREA'"
                            rows="3"
                            [formControlName]="f.name"
                            placeholder="Escribe aquí…"
                          ></textarea>
                          <select *ngIf="f.type === 'SELECT'" [formControlName]="f.name">
                            <option value="">Seleccionar...</option>
                            <option *ngFor="let o of f.options ?? []" [value]="o">{{ o }}</option>
                          </select>
                          <div *ngIf="f.type === 'RADIO'" class="radio-group" style="margin-top:6px">
                            <label class="radio" *ngFor="let o of f.options ?? []">
                              <input type="radio" [formControlName]="f.name" [value]="o" />
                              <span>{{ o }}</span>
                            </label>
                          </div>
                          <label *ngIf="f.type === 'BOOLEAN'" class="checkbox" style="margin-top: 6px">
                            <input type="checkbox" [formControlName]="f.name" />
                            {{ f.label }}
                          </label>
                          <input *ngIf="f.type === 'FILE'" type="file" class="secondary" disabled />
                        </label>
                        <div *ngIf="!f.name" class="dyn-field-skip muted small">
                          Campo <strong>{{ f.type }}</strong> sin clave interna (name): defina «Clave (interno)» en el diseñador CU4 para
                          «{{ f.label || '(sin etiqueta)' }}».
                        </div>
                      </ng-container>
                    </ng-container>
                  </ng-container>
                </div>
              </div>

              <label class="block-label">
                Resultado de la validación
                <select formControlName="transitionConditionResult">
                  <option value="">Seleccionar...</option>
                  <option value="APROBADA">Aprobada</option>
                  <option value="RECHAZADA">Rechazada</option>
                </select>
              </label>

              <label class="block-label">
                Observaciones
                <textarea rows="4" formControlName="observations" placeholder="Ingresa tus observaciones..."></textarea>
              </label>
              <div class="dictation-row">
                <button
                  type="button"
                  class="secondary dict-btn"
                  (click)="toggleDictateObservations()"
                  [disabled]="saving() || dictationObsBlocked()"
                >
                  {{
                    dictationChannel() === 'observations' && dictationPhase() === 'listening'
                      ? 'Detener dictado'
                      : 'Dictar observaciones'
                  }}
                </button>
              </div>

              <label class="block-label">
                formData (JSON)
                <textarea
                  rows="6"
                  formControlName="formDataJson"
                  placeholder='{"campo":"valor"}'
                  (blur)="syncJsonFromDynamicControls()"
                ></textarea>
              </label>
              <p class="muted small" style="margin: 4px 0 0">
                Si editaste este texto y quedó inválido, al pulsar «Completar tarea» se vuelve a armar desde los campos de arriba; si no hay datos, queda un objeto JSON vacío.
              </p>
              <div class="dictation-row">
                <button
                  type="button"
                  class="secondary dict-btn"
                  (click)="toggleDictateFormData()"
                  [disabled]="saving() || dictationFormBlocked()"
                >
                  {{
                    dictationChannel() === 'formData' && dictationPhase() === 'listening'
                      ? 'Detener dictado'
                      : 'Dictar datos del formulario'
                  }}
                </button>
              </div>

              <p *ngIf="dictationPhase() !== 'idle'" class="dictation-banner" [ngClass]="dictationBannerClass()">
                {{ dictationMessage() }}
              </p>

              <div class="attach">
                <div class="muted small">Documentos adjuntos</div>
                <label class="attach-btn secondary">
                  📎 Adjuntar archivos
                  <input type="file" multiple style="display:none" />
                </label>
              </div>

              <div class="actions form-actions">
                <button type="button" class="secondary" (click)="cancelComplete()" [disabled]="saving()">Cancelar</button>
                <button
                  type="submit"
                  *ngIf="!selectedTaskReadOnly()"
                  [disabled]="completeForm.invalid || saving()"
                  class="complete-btn"
                >
                  Completar tarea
                </button>
                <span *ngIf="selectedTaskReadOnly()" class="muted small" style="align-self:center">
                  Vista de solo lectura (tarea finalizada).
                </span>
              </div>
            </form>
          </div>
          <ng-template #placeholder>
            <div class="card">
              <p class="muted" style="margin:0">Selecciona una actividad para ver el formulario.</p>
            </div>
          </ng-template>
        </div>
      </div>

    </section>
  `,
  styles: [
    `
      .card-title {
        margin: 0 0 10px;
        font-size: 15px;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
      }
      .sum-card {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
        padding: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .sum-title {
        font-size: 12px;
        color: var(--muted);
        font-weight: 650;
      }
      .sum-value {
        font-size: 18px;
        font-weight: 900;
      }
      .sum-val-pending {
        color: #c2410c;
      }
      .sum-val-in-progress {
        color: #b45309;
      }
      .sum-val-completed {
        color: #166534;
      }
      .sum-val-cancelled {
        color: #64748b;
      }
      .content-grid {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 12px;
        align-items: start;
      }
      .task-list {
        display: grid;
        gap: 12px;
      }
      .task-item {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
        padding: 14px;
      }
      .task-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .task-title {
        font-weight: 900;
        font-size: 13px;
        color: var(--text);
      }
      .task-sub {
        margin-top: 4px;
        font-size: 12px;
        color: var(--muted);
      }
      .task-desc {
        margin-top: 8px;
        font-size: 12px;
      }
      .task-assign {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.35;
      }
      .fallback-banner {
        margin: 0 0 12px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid #bae6fd;
        background: #f0f9ff;
        color: #0c4a6e;
        font-size: 13px;
        line-height: 1.45;
      }
      .fallback-banner a {
        color: #0369a1;
        font-weight: 800;
        text-decoration: underline;
      }
      .form-loading-card,
      .form-missing-card {
        margin: 0 0 12px;
        padding: 12px;
        border-style: dashed;
      }
      .form-empty-hint {
        margin: 10px 0 0;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid #fde68a;
        background: #fffbeb;
        color: #92400e;
        font-size: 13px;
        line-height: 1.45;
      }
      .dyn-field-skip {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
      }
      .task-loading-inline,
      .empty-tasks-card {
        margin-bottom: 12px;
      }
      .task-foot {
        margin-top: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .pill-yellow {
        color: #92400e;
        background: #fffbeb;
        border-color: #fde68a;
      }
      .pill-green {
        color: #166534;
        background: #f0fdf4;
        border-color: #bbf7d0;
      }
      .tag {
        font-size: 11px;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid transparent;
        background: #fffbeb;
        color: #92400e;
        border-color: #fde68a;
      }
      .tag-red {
        background: #fef2f2;
        color: #991b1b;
        border-color: #fecaca;
      }
      .tag-gray {
        background: color-mix(in srgb, var(--panel-solid) 75%, transparent);
        color: var(--muted);
        border-color: var(--border);
      }
      .small-btn {
        border-radius: 12px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 750;
      }
      .form-block {
        margin-bottom: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 78%, transparent);
      }
      .form-activity {
        margin-top: 2px;
        font-weight: 850;
      }
      .attach {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px dashed color-mix(in srgb, var(--border) 75%, transparent);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
      }
      .attach-btn {
        margin-top: 8px;
        display: inline-flex;
        gap: 8px;
        align-items: center;
        cursor: pointer;
        padding: 10px 12px;
        border-radius: 12px;
      }
      .form-actions {
        margin-top: 12px;
        justify-content: space-between;
      }
      .complete-btn {
        background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
        box-shadow: 0 10px 22px rgba(34, 197, 94, 0.2);
      }
      .dictation-row {
        margin: 6px 0 12px;
      }
      .dict-btn {
        font-size: 12px;
        padding: 8px 12px;
        border-radius: 12px;
        font-weight: 750;
      }
      .dictation-banner {
        margin: 0 0 12px;
        padding: 10px 12px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 650;
        border: 1px solid var(--border);
      }
      .dictation-banner.listening {
        background: #fffbeb;
        border-color: #fde68a;
        color: #92400e;
      }
      .dictation-banner.finished {
        background: #ecfdf5;
        border-color: #a7f3d0;
        color: #065f46;
      }
      .dictation-banner.unsupported {
        background: #f8fafc;
        border-color: #cbd5e1;
        color: #475569;
      }
      .dictation-banner.error-cap {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }
      @media (max-width: 1100px) {
        .content-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class MyTasksPage implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly taskService = inject(TaskService);
  private readonly dynamicFormService = inject(DynamicFormService);
  private readonly aiFormNlp = inject(AiFormNlpService);
  private readonly speech = inject(SpeechRecognitionService);
  private readonly fb = inject(FormBuilder);
  private readonly realtime = inject(WorkflowRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly users = signal<User[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly selectedUserId = signal<string | null>(null);
  readonly tasks = signal<ActivityTask[]>([]);
  readonly selectedTask = signal<ActivityTask | null>(null);
  readonly dynamicForm = signal<DynamicForm | null>(null);
  /** True cuando no existe formulario en API y se usa plantilla LABEL/campos/BUTTON en ejecución. */
  readonly dynamicFormFallback = signal(false);
  /** Mientras se obtiene el formulario CU4 del servidor (evita pantalla “vacía” sin feedback). */
  readonly dynamicFormLoading = signal(false);

  /** True cuando GET /tasks/my devolvió vacío y se usó GET /tasks como respaldo. */
  readonly usingAllTasksFallback = signal(false);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly aiFilling = signal(false);
  readonly formAssistInput = signal('');
  readonly formAssistPreview = signal<AiFormStructuredAutofillResponse | null>(null);
  readonly formAssistAllowOverwrite = signal(false);
  readonly formAssistError = signal<string | null>(null);
  readonly formAssistSuccess = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  // Usamos FormGroup "abierto" porque agregamos controles dinámicos por campo (UML/CU4).
  readonly completeForm = this.fb.group({
    observations: [''],
    transitionConditionResult: [''],
    formDataJson: ['{}', [Validators.required]]
  });

  /** FormGroup dinámico (campos del formulario por actividad). Se “inyecta” en completeForm como controles sueltos. */
  private activeDynamicFieldNames: string[] = [];

  /** Canal activo del dictado (evita dos sesiones simultáneas). */
  readonly dictationChannel = signal<'none' | 'observations' | 'formData'>('none');
  /** Fase visual del mensaje de dictado. */
  readonly dictationPhase = signal<'idle' | 'listening' | 'finished' | 'unsupported' | 'error'>('idle');
  readonly dictationMessage = signal('');

  readonly dictationObsBlocked = computed(
    () => this.dictationChannel() === 'formData' && this.dictationPhase() === 'listening'
  );
  readonly dictationFormBlocked = computed(
    () => this.dictationChannel() === 'observations' && this.dictationPhase() === 'listening'
  );

  readonly canLoad = computed(() => !!this.selectedUserId());

  readonly pending = computed(() => this.tasks().filter((t) => t.status === 'PENDING'));
  readonly inProgress = computed(() => this.tasks().filter((t) => t.status === 'IN_PROGRESS'));
  readonly completed = computed(() => this.tasks().filter((t) => t.status === 'COMPLETED'));
  readonly cancelled = computed(() => this.tasks().filter((t) => t.status === 'CANCELLED'));

  /** Tareas finalizadas: solo consulta, no re-enviar completado. */
  readonly selectedTaskReadOnly = computed(() => {
    const s = this.selectedTask()?.status;
    return s === 'COMPLETED' || s === 'CANCELLED';
  });

  readonly formAssistRows = computed(() => {
    const p = this.formAssistPreview();
    if (!p?.suggestedValues) return [] as { key: string; value: string; confidence: string }[];
    return Object.entries(p.suggestedValues).map(([k, v]) => {
      const c = p.confidence?.[k];
      let text: string;
      if (v === null || v === undefined) text = '';
      else if (typeof v === 'object') text = JSON.stringify(v);
      else text = String(v);
      const conf =
        typeof c === 'number' && !Number.isNaN(c) ? `${Math.round(Math.min(1, Math.max(0, c)) * 100)}%` : '—';
      return { key: k, value: text, confidence: conf };
    });
  });

  taskStatusBadgeClass(status: ActivityTask['status']): string {
    return getTaskStatusClass(status);
  }

  taskStatusLabel(status: ActivityTask['status']): string {
    return getStatusLabel(status);
  }

  ngOnInit() {
    this.loadUsers();

    // tiempo real (sin polling): al llegar eventos, refrescar si hay usuario seleccionado
    this.realtime.connect();
    this.realtime.events$
      .pipe(
        filter(() => !!this.selectedUserId()),
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        // evita refrescos si está cargando/guardando
        if (!this.loading() && !this.saving()) this.loadMyTasks();
      });
  }

  private static readonly LS_USER_KEY = 'wf_my_tasks_userId';

  loadUsers() {
    this.loading.set(true);
    forkJoin({
      users: this.usersService.list().pipe(catchError(() => of([] as User[]))),
      roles: this.rolesService.list().pipe(catchError(() => of([] as Role[])))
    }).subscribe({
      next: ({ users: u, roles: r }) => {
        this.users.set(u);
        this.roles.set(r);
        const saved = localStorage.getItem(MyTasksPage.LS_USER_KEY)?.trim();
        if (saved && u.some((x) => x.id === saved)) {
          this.selectedUserId.set(saved);
          this.loadMyTasks();
        } else {
          this.loading.set(false);
        }
      },
      error: (e) => {
        this.error.set(mapHttpError(e, 'Error cargando usuarios'));
        this.loading.set(false);
      }
    });
  }

  onUserSelect(id: string) {
    const v = (id || '').trim() || null;
    this.selectedUserId.set(v);
    this.tasks.set([]);
    this.selectedTask.set(null);
    this.dynamicForm.set(null);
    this.dynamicFormFallback.set(false);
    this.success.set(null);
    this.error.set(null);
    this.usingAllTasksFallback.set(false);
    if (v) {
      localStorage.setItem(MyTasksPage.LS_USER_KEY, v);
      this.loadMyTasks();
    } else {
      localStorage.removeItem(MyTasksPage.LS_USER_KEY);
      this.loading.set(false);
    }
  }

  loadMyTasks() {
    const uid = this.selectedUserId();
    if (!uid) return;
    this.loading.set(true);
    this.success.set(null);
    this.error.set(null);
    this.taskService
      .listMyTasks(uid)
      .pipe(
        switchMap((t) => {
          if (t?.length) {
            this.usingAllTasksFallback.set(false);
            return of(t);
          }
          return this.taskService.list().pipe(
            map((all) => {
              const list = all ?? [];
              this.usingAllTasksFallback.set(list.length > 0);
              return list;
            }),
            catchError(() => {
              this.usingAllTasksFallback.set(false);
              return of([] as ActivityTask[]);
            })
          );
        }),
        // Si /tasks/my falla (usuario inexistente, 500, red), intentar lista global como en clase/demo.
        catchError(() =>
          this.taskService.list().pipe(
            tap((all) => this.usingAllTasksFallback.set((all?.length ?? 0) > 0)),
            map((all) => all ?? ([] as ActivityTask[])),
            catchError((e) => {
              this.error.set(mapHttpError(e, 'Error cargando tareas'));
              this.usingAllTasksFallback.set(false);
              return of([] as ActivityTask[]);
            })
          )
        )
      )
      .subscribe({
        next: (t) => this.tasks.set(t ?? []),
        complete: () => this.loading.set(false)
      });
  }

  start(t: ActivityTask) {
    const uid = this.selectedUserId();
    if (!uid) return;
    this.saving.set(true);
    this.success.set(null);
    this.error.set(null);
    this.taskService.start(t.id, { userId: uid }).subscribe({
      next: () => {
        this.success.set('Tarea iniciada');
        this.loadMyTasks();
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error iniciando tarea')),
      complete: () => this.saving.set(false)
    });
  }

  openComplete(t: ActivityTask) {
    this.stopDictationSession();
    this.clearFormAssistState();
    this.dynamicFormFallback.set(false);
    this.selectedTask.set(t);
    this.dynamicForm.set(null);
    this.success.set(null);
    this.error.set(null);
    try {
      this.completeForm.enable({ emitEvent: false });
    } catch {
      // ignore
    }
    this.completeForm.reset({
      observations: '',
      transitionConditionResult: '',
      formDataJson: JSON.stringify(t.formData ?? {}, null, 2)
    });

    // Cargar formulario dinámico configurado para esta actividad (si existe)
    this.loadDynamicFormForTask(t);
  }

  cancelComplete() {
    this.stopDictationSession();
    this.clearFormAssistState();
    this.dynamicFormFallback.set(false);
    this.dynamicFormLoading.set(false);
    this.selectedTask.set(null);
    this.dynamicForm.set(null);
    this.success.set(null);
    this.error.set(null);
    try {
      this.completeForm.enable({ emitEvent: false });
    } catch {
      // ignore
    }
  }

  private loadDynamicFormForTask(t: ActivityTask) {
    // limpiar controles antiguos
    for (const name of this.activeDynamicFieldNames) {
      if ((this.completeForm as any).contains(name)) (this.completeForm as any).removeControl(name);
    }
    this.activeDynamicFieldNames = [];
    this.dynamicFormFallback.set(false);
    this.dynamicForm.set(null);
    this.dynamicFormLoading.set(true);

    this.dynamicFormService
      .getForm(t.policyId, t.activityNodeId)
      .pipe(
        finalize(() => {
          this.dynamicFormLoading.set(false);
          const st = t.status;
          if (st === 'COMPLETED' || st === 'CANCELLED') {
            try {
              this.completeForm.disable({ emitEvent: false });
            } catch {
              // ignore
            }
          } else {
            try {
              this.completeForm.enable({ emitEvent: false });
            } catch {
              // ignore
            }
          }
        })
      )
      .subscribe({
        next: (df) => {
          this.dynamicForm.set(df);
          this.dynamicFormFallback.set(false);
          const dataFields = (df.fields ?? []).filter((f) => f.type !== 'LABEL' && f.type !== 'BUTTON');
          for (const f of dataFields) {
            const key = String(f.name ?? '').trim();
            if (!key) continue;
            const validators = f.required ? [Validators.required] : [];
            let initial = (t.formData ?? {})[key] as any;
            if (
              f.type === 'USER' &&
              (initial === null || initial === undefined || String(initial).trim() === '') &&
              f.defaultValue
            ) {
              initial = f.defaultValue;
            }
            // BOOLEAN: por defecto false
            const value = f.type === 'BOOLEAN' ? Boolean(initial) : (initial ?? '');
            (this.completeForm as any).addControl(key, this.fb.control(value, { validators }));
            this.activeDynamicFieldNames.push(key);
          }
          // Sincronizar el JSON visible con lo que haya en controles
          this.syncJsonFromDynamicControls();
        },
        error: (e) => {
          const is404 = e instanceof HttpErrorResponse && e.status === 404;
          if (is404) {
            this.applyFallbackRuntimeForm(t);
            return;
          }
          this.dynamicForm.set(null);
          this.dynamicFormFallback.set(false);
          const msg = mapHttpError(e, '');
          if (msg && !msg.toLowerCase().includes('404')) {
            this.error.set(mapHttpError(e, 'Error cargando formulario dinámico'));
          }
        }
      });
  }

  /**
   * Si no hay formulario CU4 persistido, igual se muestra UI dinámica (etiquetas, campos, botones)
   * para que el funcionario vea y use el flujo sin depender solo del JSON crudo.
   */
  private applyFallbackRuntimeForm(t: ActivityTask) {
    const fields = this.buildFallbackRuntimeFields(t);
    const df: DynamicForm = {
      id: '__runtime_fallback__',
      policyId: t.policyId,
      activityNodeId: t.activityNodeId,
      name: `Ejecución — ${t.activityName}`,
      description:
        'Plantilla estándar: no se encontró formulario guardado para esta actividad. En el editor de diagramas (sección CU4) puede crear campos LABEL, TEXT, BUTTON, etc., y guardar.',
      fields
    };
    this.dynamicForm.set(df);
    this.dynamicFormFallback.set(true);

    const dataFields = fields.filter((f) => f.type !== 'LABEL' && f.type !== 'BUTTON');
    for (const f of dataFields) {
      const key = String(f.name ?? '').trim();
      if (!key) continue;
      const validators = f.required ? [Validators.required] : [];
      const initial = (t.formData ?? {})[key] as any;
      const value = f.type === 'BOOLEAN' ? Boolean(initial) : (initial ?? '');
      (this.completeForm as any).addControl(key, this.fb.control(value, { validators }));
      this.activeDynamicFieldNames.push(key);
    }
    this.syncJsonFromDynamicControls();
  }

  private buildFallbackRuntimeFields(t: ActivityTask): FormField[] {
    return [
      {
        id: 'fb-h1',
        label: t.activityName,
        name: '_h1',
        type: 'LABEL',
        order: 0
      },
      {
        id: 'fb-h2',
        label:
          'Registro dinámico de la actividad. Los datos se guardan en el JSON del trámite al completar la tarea. Si su calle del diagrama asigna un funcionario (usuario), solo él debería ver esta tarea en «Mis actividades».',
        name: '_h2',
        type: 'LABEL',
        order: 1
      },
      {
        id: 'fb-detalle',
        label: 'Detalle de lo realizado',
        name: 'detalleEjecucion',
        type: 'TEXTAREA',
        required: false,
        order: 2,
        placeholder: 'Describa acciones, resultados o datos relevantes…',
        helpText: 'Opcional: también puede usar «Observaciones» o el JSON inferior.'
      },
      {
        id: 'fb-ref',
        label: 'Referencia / código interno',
        name: 'referenciaInterna',
        type: 'TEXT',
        required: false,
        order: 3,
        placeholder: 'Ej. TR-2026-001'
      },
      {
        id: 'fb-b1',
        label: 'Validar campos obligatorios',
        name: '_bValidate',
        type: 'BUTTON',
        order: 4,
        action: 'VALIDATE'
      },
      {
        id: 'fb-b2',
        label: 'Guardar borrador (JSON)',
        name: '_bDraft',
        type: 'BUTTON',
        order: 5,
        action: 'SAVE_DRAFT'
      },
      {
        id: 'fb-b3',
        label: 'Completar actividad',
        name: '_bComplete',
        type: 'BUTTON',
        order: 6,
        action: 'COMPLETE_ACTIVITY'
      }
    ];
  }

  taskAssignmentLine(t: ActivityTask): string {
    const uid = (t.assignedToUserId ?? '').trim();
    if (uid) {
      const u = this.users().find((x) => x.id === uid);
      return u ? `Funcionario asignado: ${u.fullName}` : `Usuario asignado (ID): ${uid}`;
    }
    const rid = (t.assignedRoleId ?? '').trim();
    if (rid) {
      const rn = this.roles().find((x) => x.id === rid)?.name;
      return rn
        ? `Asignación por rol — cualquier usuario con el rol «${rn}» puede ejecutar`
        : `Asignación por rol — cualquier usuario con ese rol puede ejecutar (rol: ${rid})`;
    }
    const did = (t.assignedDepartmentId ?? '').trim();
    if (did) {
      return `Asignación por departamento (ID: ${did})`;
    }
    return 'Asignación: según carril del diagrama (sin usuario directo en esta tarea)';
  }

  orderedFields(fields: FormField[]): FormField[] {
    return [...(fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async onDynamicButtonClick(f: FormField): Promise<void> {
    const action = String((f as any).action ?? '').trim().toUpperCase();
    if (!action) return;

    if (action === 'SAVE_DRAFT') {
      this.syncJsonFromDynamicControls();
      this.success.set('Borrador guardado (en el JSON del formulario).');
      this.error.set(null);
      return;
    }

    if (action === 'SUBMIT_FORM') {
      (this.completeForm as any).markAllAsTouched?.();
      this.syncJsonFromDynamicControls();
      const invalid = this.activeDynamicFieldNames.some((n) => this.completeForm.get(n)?.invalid);
      if (invalid) {
        this.error.set('No se puede enviar: hay campos obligatorios pendientes.');
        return;
      }
      this.error.set(null);
      this.success.set('Formulario enviado (listo para completar la actividad).');
      return;
    }

    if (action === 'COMPLETE_ACTIVITY') {
      (this.completeForm as any).markAllAsTouched?.();
      this.syncJsonFromDynamicControls();
      const invalid = this.activeDynamicFieldNames.some((n) => this.completeForm.get(n)?.invalid);
      if (invalid) {
        this.error.set('No se puede completar: hay campos obligatorios pendientes.');
        return;
      }
      // Completa la actividad usando el flujo actual existente
      this.completeSelected();
      return;
    }

    if (action === 'VALIDATE') {
      // marca todo como touched para mostrar errores visuales
      (this.completeForm as any).markAllAsTouched?.();
      // asegura que el JSON refleje el estado actual antes de validar
      this.syncJsonFromDynamicControls();
      const invalid = this.activeDynamicFieldNames.some((n) => this.completeForm.get(n)?.invalid);
      if (invalid) {
        this.error.set('Hay campos obligatorios pendientes. Completa el formulario y vuelve a validar.');
      } else {
        this.error.set(null);
        this.success.set('Validación OK: campos obligatorios completos.');
      }
      return;
    }

    if (action === 'AUTOFILL') {
      this.error.set(null);
      this.success.set(null);
      for (const name of this.activeDynamicFieldNames) {
        const ctrl = this.completeForm.get(name);
        if (!ctrl) continue;
        const curr = ctrl.value;
        // no sobreescribir si ya hay valor
        if (curr !== null && curr !== undefined && String(curr).trim() !== '') continue;
        ctrl.patchValue(this.sampleValueForControl(name), { emitEvent: false });
      }
      this.syncJsonFromDynamicControls();
      this.success.set('Autocompletado aplicado.');
      return;
    }

    if (action === 'COPY_JSON') {
      this.syncJsonFromDynamicControls();
      const txt = String(this.completeForm.controls.formDataJson.value ?? '');
      try {
        await navigator.clipboard.writeText(txt);
        this.success.set('JSON copiado al portapapeles.');
        this.error.set(null);
      } catch {
        this.error.set('No se pudo copiar al portapapeles (permiso del navegador).');
      }
      return;
    }
  }

  private sampleValueForControl(name: string): string {
    // heurística simple: valores útiles para demo/examen
    const n = name.toLowerCase();
    if (n.includes('correo') || n.includes('email')) return 'usuario@empresa.com';
    if (n.includes('telefono') || n.includes('tel')) return '3000000000';
    if (n.includes('monto') || n.includes('valor') || n.includes('costo')) return '100';
    if (n.includes('fecha')) return new Date().toISOString().slice(0, 10);
    if (n.includes('nombre')) return 'Juan Pérez';
    if (n.includes('area') || n.includes('depart')) return 'Operaciones';
    return 'OK';
  }

  clearFormAssistState() {
    this.formAssistPreview.set(null);
    this.formAssistError.set(null);
    this.formAssistSuccess.set(null);
    this.formAssistInput.set('');
    this.aiFilling.set(false);
  }

  requestFormAssist() {
    const df = this.dynamicForm();
    const t = this.selectedTask();
    if (!df || !t) {
      this.formAssistError.set('No hay formulario definido para esta actividad.');
      return;
    }
    const text = (this.formAssistInput() ?? '').trim();
    if (text.length < 10) {
      this.formAssistError.set('Amplíe el texto para que el motor pueda extraer suficientes pistas.');
      return;
    }
    const cur: Record<string, unknown> = {};
    for (const name of this.activeDynamicFieldNames) {
      cur[name] = this.completeForm.get(name)?.value ?? null;
    }
    this.aiFilling.set(true);
    this.formAssistError.set(null);
    this.formAssistSuccess.set(null);
    this.formAssistPreview.set(null);
    this.aiFormNlp
      .autofill({
        policyId: t.policyId,
        activityNodeId: t.activityNodeId,
        form: df as unknown,
        currentValues: cur,
        inputText: text
      })
      .subscribe({
        next: (res) => {
          this.formAssistPreview.set(res);
          const cnt = Object.keys(res.suggestedValues ?? {}).length;
          const w = res.warnings?.length ?? 0;
          if (!cnt) {
            this.formAssistError.set(
              w
                ? 'No se generaron nuevos valores. Revise los avisos listados más abajo.'
                : 'No se encontraron coincidencias suficientes con los campos actuales.'
            );
          } else {
            this.formAssistSuccess.set(
              `${cnt} campo(s) con propuesta.${w ? ' Revise ' + w + ' advertencia(s).' : ''}`
            );
          }
        },
        error: (e) => this.formAssistError.set(mapHttpError(e, 'Error del servicio de autocompletado')),
        complete: () => this.aiFilling.set(false)
      });
  }

  applyFormAssist() {
    const prev = this.formAssistPreview();
    if (!prev?.suggestedValues || !Object.keys(prev.suggestedValues).length) {
      this.formAssistError.set('No hay sugerencias para aplicar. Ejecute primero “Obtener sugerencias”.');
      return;
    }
    const allow = this.formAssistAllowOverwrite();
    for (const [key, incoming] of Object.entries(prev.suggestedValues)) {
      if (!this.activeDynamicFieldNames.includes(key)) continue;
      const ctrl = this.completeForm.get(key);
      if (!ctrl) continue;
      const current = ctrl.value;
      const hasText =
        current !== null &&
        current !== undefined &&
        !(typeof current === 'string' && current.trim() === '') &&
        !(typeof current === 'boolean' && current === false);
      if (hasText && !allow) {
        const ok = window.confirm(
          `El campo ${key} ya tiene un valor (“${current}”). ¿Desea sobrescribirlo con "${incoming}" proveniente del análisis?`
        );
        if (!ok) continue;
      }
      ctrl.patchValue(this.coerceFormValue(ctrl.value, incoming), { emitEvent: false });
    }
    this.syncJsonFromDynamicControls();
    this.formAssistSuccess.set('Sugerencias aplicadas sobre el borrador local. Revise campos obligatorios antes de completar.');
  }

  private coerceFormValue(previous: unknown, incoming: unknown): unknown {
    if (typeof previous === 'boolean') return !!incoming;
    if (typeof previous === 'number') {
      const n = Number(incoming as any);
      return Number.isFinite(n) ? n : previous;
    }
    return incoming ?? '';
  }

  isTextLike(t: FormFieldType): boolean {
    return t === 'TEXT' || t === 'NUMBER' || t === 'DATE' || t === 'FILE';
  }

  inputTypeFor(t: FormFieldType): string {
    if (t === 'NUMBER') return 'number';
    if (t === 'DATE') return 'date';
    return 'text';
  }

  /** Sincroniza el textarea JSON con los controles CU4; usable desde plantilla (blur) y antes de completar tarea. */
  syncJsonFromDynamicControls(): void {
    const base: Record<string, unknown> = {};
    for (const name of this.activeDynamicFieldNames) {
      base[name] = this.completeForm.get(name)?.value;
    }
    // merge con lo que ya hubiera en el JSON (para no perder cosas dictadas manualmente)
    let prev: Record<string, unknown> = {};
    try {
      const raw = (this.completeForm.controls.formDataJson.value ?? '').trim();
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) prev = parsed as Record<string, unknown>;
    } catch {
      prev = {};
    }
    const merged = { ...prev, ...base };
    this.completeForm.patchValue({ formDataJson: JSON.stringify(merged, null, 2) }, { emitEvent: false });
  }

  dictationBannerClass(): string {
    const p = this.dictationPhase();
    if (p === 'listening') return 'listening';
    if (p === 'finished') return 'finished';
    if (p === 'unsupported') return 'unsupported';
    if (p === 'error') return 'error-cap';
    return '';
  }

  toggleDictateObservations(): void {
    if (this.dictationChannel() === 'observations' && this.dictationPhase() === 'listening') {
      this.speech.stopListening();
      return;
    }
    if (this.dictationObsBlocked()) return;
    if (!this.speech.isSupported()) {
      this.dictationPhase.set('unsupported');
      this.dictationMessage.set('Reconocimiento de voz no disponible en este navegador');
      this.dictationChannel.set('none');
      return;
    }
    this.startDictation('observations', (chunk) => {
      const obs = this.completeForm.controls.observations.value ?? '';
      const next = obs ? `${obs.trimEnd()} ${chunk}`.trim() : chunk;
      this.completeForm.patchValue({ observations: next });
    });
  }

  toggleDictateFormData(): void {
    if (this.dictationChannel() === 'formData' && this.dictationPhase() === 'listening') {
      this.speech.stopListening();
      return;
    }
    if (this.dictationFormBlocked()) return;
    if (!this.speech.isSupported()) {
      this.dictationPhase.set('unsupported');
      this.dictationMessage.set('Reconocimiento de voz no disponible en este navegador');
      this.dictationChannel.set('none');
      return;
    }
    this.startDictation('formData', (chunk) => this.mergeFormDataDictation(chunk));
  }

  private startDictation(
    channel: 'observations' | 'formData',
    onChunk: (text: string) => void
  ): void {
    if (this.speech.isActive()) return;
    this.dictationPhase.set('listening');
    this.dictationMessage.set('Escuchando...');
    this.dictationChannel.set(channel);
    this.speech
      .startListening({ lang: 'es-ES' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (chunk) => onChunk(chunk),
        error: () => {
          this.dictationChannel.set('none');
          this.dictationPhase.set('error');
          this.dictationMessage.set('Error al capturar audio');
        },
        complete: () => {
          this.dictationChannel.set('none');
          if (this.dictationPhase() === 'listening') {
            this.dictationPhase.set('finished');
            this.dictationMessage.set('Dictado finalizado');
          }
        }
      });
  }

  private mergeFormDataDictation(chunk: string): void {
    const piece = chunk.trim();
    if (!piece) return;
    let base: Record<string, unknown> = {};
    const raw = (this.completeForm.controls.formDataJson.value ?? '').trim();
    try {
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object' && !Array.isArray(p)) {
          base = { ...(p as Record<string, unknown>) };
        }
      }
    } catch {
      base = {};
    }
    const prev = typeof base['textoDictado'] === 'string' ? (base['textoDictado'] as string) : '';
    base['textoDictado'] = prev ? `${prev.trimEnd()} ${piece}`.trim() : piece;
    this.completeForm.patchValue({ formDataJson: JSON.stringify(base, null, 2) });
  }

  private stopDictationSession(): void {
    this.speech.stopListening();
    this.dictationChannel.set('none');
    this.dictationPhase.set('idle');
    this.dictationMessage.set('');
  }

  completeSelected() {
    const uid = this.selectedUserId();
    const t = this.selectedTask();
    if (!uid || !t) return;

    // Arregla JSON corrupto en el textarea (p. ej. "{}e4") y fusiona valores de los campos CU4 antes de validar/enviar.
    this.syncJsonFromDynamicControls();

    if (this.completeForm.invalid) return;

    this.saving.set(true);
    this.success.set(null);
    this.error.set(null);

    const raw = this.completeForm.getRawValue();
    let formData: Record<string, unknown> | undefined = undefined;
    try {
      const json = String((raw as any).formDataJson ?? '').trim();
      const parsed = json ? JSON.parse(json) : {};
      if (parsed && typeof parsed === 'object') formData = parsed as Record<string, unknown>;
    } catch {
      this.saving.set(false);
      this.error.set('formDataJson no es JSON válido. Corrija el área JSON o deje solo {}');
      return;
    }

    const cond = String((raw as any).transitionConditionResult ?? '').trim();
    this.taskService
      .complete(t.id, {
        userId: uid,
        formData,
        observations: String((raw as any).observations ?? '').trim() || undefined,
        transitionConditionResult: cond ? cond : null
      })
      .subscribe({
        next: () => {
          this.success.set('Tarea completada');
          this.selectedTask.set(null);
          this.loadMyTasks();
        },
        error: (e) => this.error.set(mapHttpError(e, 'Error completando tarea')),
        complete: () => this.saving.set(false)
      });
  }

  userLabel(u: User): string {
    const r = this.roleNameForUser(u);
    return r ? `${u.fullName} · ${r} (${u.email})` : `${u.fullName} — ${u.email}`;
  }

  /** Etiqueta para selects de usuario en formularios (nombre + rol). */
  userOptionLabel(u: User): string {
    const r = this.roleNameForUser(u);
    return r ? `${u.fullName} · ${r}` : u.fullName;
  }

  private roleNameForUser(u: User): string {
    const rid = (u.roleId ?? '').trim();
    if (!rid) return '';
    return this.roles().find((x) => x.id === rid)?.name ?? rid;
  }
}

