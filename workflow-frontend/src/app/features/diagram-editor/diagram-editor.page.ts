import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, fromEvent, of, throwError } from 'rxjs';
import { catchError, distinctUntilChanged, map } from 'rxjs/operators';
import {
  ActivityDiagram,
  DiagramEdge,
  DiagramNode,
  DiagramValidationResponseDto,
  ResponsibleType,
  SaveActivityDiagramPayload,
  Swimlane
} from '../../core/models/activity-diagram.model';
import { BusinessPolicy, PolicyStatus } from '../../core/models/business-policy.model';
import { ConfigurationValidationResponse } from '../../core/models/configuration.model';
import { DynamicFormSummary, FormField, FormFieldType } from '../../core/models/dynamic-form.model';
import {
  GenerateWorkflowSuggestionRequest,
  WorkflowSuggestionResponse
} from '../../core/models/ai-workflow-suggestion.model';
import { Role } from '../../core/models/role.model';
import { User } from '../../core/models/user.model';
import { ActivityDiagramService } from '../../core/services/activity-diagram.service';
import { AiDiagramEditService } from '../../core/services/ai-diagram-edit.service';
import { AiDiagramNlpService } from '../../core/services/ai-diagram-nlp.service';
import { AiWorkflowSuggestionService } from '../../core/services/ai-workflow-suggestion.service';
import type {
  AiDiagramStructuredSuggestResponse,
  AiDiagramSuggestionItem
} from '../../core/models/ai-diagram-nlp.model';
import {
  DiagramCollabMessage,
  DiagramCollabOpMessage,
  DiagramCollabPresenceMessage,
  DiagramCollabService
} from '../../core/services/diagram-collab.service';
import { DiagramConfigurationService } from '../../core/services/diagram-configuration.service';
import { DynamicFormService } from '../../core/services/dynamic-form.service';
import { PolicyService } from '../../core/services/policy.service';
import { RolesService } from '../../core/services/roles.service';
import { UsersService } from '../../core/services/users.service';
import { WorkflowRealtimeService } from '../../core/services/workflow-realtime.service';
import { mapHttpError } from '../../shared/utils/http-error.util';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <section class="page">
      <header class="editor-head">
        <div class="editor-head-brand">
          <h2>Editor de diagramas UML 2.5</h2>
          <p class="muted editor-head-tagline">
            Calles por rol · actividades · formularios CU4
            <span *ngIf="policyId() as pid" class="policy-chip-wrap">
              <span class="policy-chip"><code>{{ pid }}</code></span>
              <span *ngIf="policyStatus() as st" class="policy-status">{{ st }}</span>
            </span>
          </p>
        </div>
        <div class="editor-head-toolbar">
          <div class="who who-compact">
            <span class="who-label">Como</span>
            <select
              *ngIf="users().length"
              [value]="collabUserId()"
              (change)="setCollabUserId($any($event.target).value)"
              [disabled]="busy() || loading()"
            >
              <option value="" disabled>Usuario…</option>
              <option *ngFor="let u of users()" [value]="u.id">{{ u.fullName }}</option>
            </select>
            <input
              *ngIf="!users().length"
              [value]="collabUserNameOverride()"
              (input)="setCollabUserNameOverride($any($event.target).value)"
              placeholder="Nombre"
            />
          </div>
          <div class="editor-head-primary">
            <button
              type="button"
              class="action validate"
              (click)="validateDiagram()"
              [disabled]="busy() || !policyId() || !draftPayload()"
            >
              <span class="action-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path d="M9 11.5 11 14l4-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.6" />
                </svg>
              </span>
              Validar
            </button>
            <button type="button" class="action save" (click)="save()" [disabled]="busy() || !draftPayload() || !policyId()">
              <span class="action-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path d="M5 20h14a1 1 0 0 0 1-1V8l-3-3H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                  <path d="M8 20v-7h8v7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                </svg>
              </span>
              Guardar
            </button>
          </div>
          <details class="editor-more">
            <summary class="editor-more-summary">Más</summary>
            <div class="editor-more-body">
              <button type="button" class="action ai" (click)="openAiModal(); $event.stopPropagation()" [disabled]="aiBusy() || !policyId()">
                <span class="action-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M12 3l1.6 4.9H19l-4 2.9 1.5 4.7L12 14.2 8.5 15.5 10 10.8 6 7.9h5.4L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                  </svg>
                </span>
                Asistente IA
              </button>
              <button type="button" class="action ghost" [class.collab-on]="collabEnabled()" (click)="toggleCollab()" [disabled]="!policyId()">
                <span class="action-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.6" />
                    <path d="M8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.6" />
                    <path d="M2.5 20a6.5 6.5 0 0 1 11.7-3.7M10 20a6.5 6.5 0 0 1 12 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  </svg>
                </span>
                Colaborar
              </button>
              <button type="button" class="action ghost" (click)="copyShareLink()" [disabled]="!policyId()">Compartir</button>
              <button type="button" class="action ghost" (click)="openComments()" [disabled]="!policyId()">Comentarios</button>
            </div>
          </details>
        </div>
      </header>

      <nav class="workspace-nav" *ngIf="draftPayload()" aria-label="Ir a sección del editor">
        <button type="button" class="wn-btn" (click)="scrollToWorkspaceSection('forms')">1 · Formularios y responsables</button>
        <button type="button" class="wn-btn wn-btn-accent" (click)="scrollToWorkspaceSection('diagram')">2 · Lienzo UML</button>
        <button type="button" class="wn-btn" (click)="scrollToWorkspaceSection('nlp')">3 · Asistente NLP</button>
      </nav>

      <div class="card warn" *ngIf="policyLoaded() && policyStatus() != null && policyStatus() !== 'DRAFT'">
        <p class="warn-text">
          Solo se puede configurar formularios dinámicos y condiciones de transición cuando la política está en
          estado <strong>DRAFT</strong>.
        </p>
      </div>

      <details class="card tools">
        <summary class="tools-summary">Herramientas</summary>
        <div class="tools-body">
          <div class="toolbar">
            <button
              type="button"
              class="secondary"
              *ngIf="!hasPersistedDiagram()"
              (click)="loadExampleInMemory()"
              [disabled]="busy() || !policyId() || loading()"
            >
              Cargar ejemplo
            </button>
            <button
              type="button"
              class="secondary"
              *ngIf="!hasPersistedDiagram()"
              (click)="loadDecisionExampleInMemory()"
              [disabled]="busy() || !policyId() || loading()"
            >
              Ejemplo con decisión
            </button>
            <a routerLink="/policies" class="link-as-button">Volver a políticas</a>
          </div>
          <p class="muted" *ngIf="loading()">Cargando diagrama…</p>
          <p class="muted" *ngIf="!loading() && missingDiagramHint()">No existe diagrama para esta política.</p>
          <p class="muted" *ngIf="policyStatus() === 'DRAFT' && !hasPersistedDiagram() && policyLoaded()">
            Guarda el diagrama en el servidor para poder usar la configuración CU4 (formularios y aristas).
          </p>
          <p class="success" *ngIf="success()">{{ success() }}</p>
          <p class="error" *ngIf="error()">{{ error() }}</p>
        </div>
      </details>

      <!-- Ancho completo: si va dentro del grid, en móvil queda debajo de toda la barra lateral y no se ve. -->
      <div class="card form-registry-card form-registry-standalone" *ngIf="draftPayload()" id="form-registry-panel">
        <h3 class="block-title">Formularios CU4 y asignación al funcionario</h3>
        <p class="muted small" style="margin: 0 0 10px">
          Cada fila es una <strong>actividad</strong> del diagrama: calle, quién ejecuta y si el formulario CU4 ya está guardado.
          Use <strong>Crear o editar formulario</strong> para abrir el diseñador (nombre del formulario, campos y guardar). El lienzo UML está más abajo.
        </p>
        <div class="form-reg-wrap" *ngIf="activityFormRegistryRows().length; else noActivityRowsMain">
          <table class="form-reg-table">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Calle</th>
                <th>Quién ejecuta</th>
                <th>Formulario</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of activityFormRegistryRows()" [class.row-selected]="selectedActivityNodeId() === row.nodeId">
                <td><strong>{{ row.activityName }}</strong><br /><code class="muted small">{{ row.nodeId }}</code></td>
                <td>{{ row.laneLabel }}</td>
                <td>{{ row.assigneeLabel }}</td>
                <td>
                  <span *ngIf="row.hasForm" class="fr-pill fr-pill-ok">Guardado</span>
                  <span *ngIf="!row.hasForm" class="fr-pill fr-pill-warn">Pendiente</span>
                  <span *ngIf="row.formTitle" class="form-reg-name" style="display:block;margin-top:4px">{{ row.formTitle }}</span>
                  <span *ngIf="row.formId" class="muted small" style="display:block;margin-top:4px"><code>{{ row.formId }}</code></span>
                </td>
                <td>
                  <button
                    type="button"
                    class="primary mini"
                    (click)="openCu4ForActivity(row.nodeId)"
                    title="Abre el diseñador CU4 de esta actividad: campos, guardar formulario, vista previa"
                  >
                    Crear o editar formulario
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noActivityRowsMain>
          <p class="muted" style="margin:0">No hay actividades en el diagrama. Use la paleta «Actividad» y haga clic en el lienzo.</p>
        </ng-template>
        <p class="muted small" *ngIf="orphanPolicyForms().length" style="margin:10px 0 0">
          <strong>Formularios en servidor sin actividad con ese id en el lienzo:</strong>
          <span *ngFor="let o of orphanPolicyForms(); let last = last"> «{{ o.name }}» (<code>{{ o.activityNodeId }}</code>)<span *ngIf="!last"> ·</span></span>
        </p>
      </div>

      <div class="editor-shell" id="workspace-diagram" *ngIf="draftPayload() as d">
        <aside class="editor-left">
          <div class="panel">
            <div class="panel-title">Elementos UML</div>
            <div class="palette">
              <button type="button" class="palette-item" [class.active]="paletteMode() === 'START'" (click)="setPalette('START')">
                <span class="palette-ico start" aria-hidden="true"></span>
                Inicio
              </button>
              <button type="button" class="palette-item" [class.active]="paletteMode() === 'ACTIVITY'" (click)="setPalette('ACTIVITY')">
                <span class="palette-ico activity" aria-hidden="true"></span>
                Actividad
              </button>
              <button
                type="button"
                class="palette-item"
                [class.active]="paletteMode() === 'SEND'"
                (click)="setPalette('SEND')"
                title="UML: Enviar objeto o señal (se dibuja como flecha/etiqueta)"
              >
                <span class="palette-ico send" aria-hidden="true"></span>
                Enviar señal
              </button>
              <button type="button" class="palette-item" [class.active]="paletteMode() === 'DECISION'" (click)="setPalette('DECISION')">
                <span class="palette-ico decision" aria-hidden="true"></span>
                Decisión
              </button>
              <button type="button" class="palette-item" [class.active]="paletteMode() === 'FORK'" (click)="setPalette('FORK')">
                <span class="palette-ico fork" aria-hidden="true"></span>
                Fork
              </button>
              <button type="button" class="palette-item" [class.active]="paletteMode() === 'JOIN'" (click)="setPalette('JOIN')">
                <span class="palette-ico join" aria-hidden="true"></span>
                Join
              </button>
              <button type="button" class="palette-item" [class.active]="paletteMode() === 'END'" (click)="setPalette('END')">
                <span class="palette-ico end" aria-hidden="true"></span>
                Fin
              </button>
              <button type="button" class="palette-item" [class.active]="paletteMode() === 'EDGE'" (click)="setPalette('EDGE')">
                <span class="palette-ico edge" aria-hidden="true"></span>
                Transición
              </button>
            </div>
            <div class="mini-actions">
              <button type="button" class="secondary mini" (click)="clearSelection()">Cancelar</button>
              <button
                type="button"
                class="danger mini"
                (click)="deleteSelected()"
                [disabled]="!selectedNodeId() && !selectedEdgeId()"
                title="Elimina el nodo o la transición seleccionada"
              >
                Eliminar seleccionado
              </button>
            </div>
          </div>

          <div class="panel" *ngIf="selectedNode() as sn">
            <div class="panel-title">Propiedades de forma</div>
            <button
              type="button"
              class="primary mini"
              style="margin-bottom:10px"
              (click)="openFormDesignerForSelectedNode()"
              [disabled]="busy() || loading() || sn.type !== 'ACTIVITY'"
              title="Abre el diseñador de formulario para esta actividad (misma acción que en la tabla CU4)"
            >
              Crear o editar formulario
            </button>
            <label class="block-label">
              Nombre
              <input
                [value]="sn.name ?? ''"
                (input)="updateSelectedNode({ name: $any($event.target).value })"
                [disabled]="busy() || loading()"
              />
            </label>
            <label class="block-label">
              Descripción
              <textarea
                rows="3"
                [value]="sn.description ?? ''"
                (input)="updateSelectedNode({ description: $any($event.target).value })"
                [disabled]="busy() || loading()"
              ></textarea>
            </label>
            <label class="block-label" *ngIf="sn.type === 'ACTIVITY'">
              Tipo de actividad (UML)
              <select
                [value]="isSendNode(sn) ? 'SEND' : 'NORMAL'"
                (change)="setSelectedActivityKind($any($event.target).value)"
                [disabled]="busy() || loading()"
              >
                <option value="NORMAL">Actividad (normal)</option>
                <option value="SEND">Enviar objeto o señal</option>
              </select>
            </label>
            <p class="muted small" style="margin:0">
              ID: <code>{{ sn.id }}</code> · Tipo: <code>{{ sn.type }}</code>
            </p>
          </div>

          <div class="panel" *ngIf="selectedEdge() as se">
            <div class="panel-title">Propiedades de transición</div>
            <label class="block-label">
              Nombre de la transición
              <input
                [value]="se.label ?? ''"
                (input)="updateSelectedEdge({ label: $any($event.target).value })"
                [disabled]="busy() || loading()"
              />
            </label>
            <label class="block-label">
              Tipo de transición
              <select
                [value]="se.type ?? 'NORMAL'"
                (change)="updateSelectedEdge({ type: $any($event.target).value })"
                [disabled]="busy() || loading()"
              >
                <option value="NORMAL">Normal</option>
                <option value="ALTERNATIVE">Condicional (salida de decisión)</option>
                <option value="PARALLEL">Paralela (fork/join)</option>
              </select>
            </label>
            <label class="block-label">
              Condición (opcional)
              <textarea
                rows="2"
                [value]="se.condition ?? ''"
                (input)="updateSelectedEdge({ condition: $any($event.target).value })"
                [disabled]="busy() || loading()"
                placeholder="Ej: aprobada / rechazada / si_cumple / no_cumple"
              ></textarea>
            </label>
            <p class="muted small" style="margin:0">
              ID: <code>{{ se.id }}</code> · Tipo: <code>{{ se.type }}</code>
            </p>
          </div>

          <div class="panel" *ngIf="draftPayload() as d">
            <div class="panel-toolbar">
              <div class="panel-title" style="margin-bottom: 0">Calles (swimlanes)</div>
              <button type="button" class="btn-lane-add" (click)="addSwimlane()" [disabled]="busy() || loading()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                Agregar calle
              </button>
              <button
                type="button"
                class="btn-lane-add"
                style="margin-left: 8px"
                (click)="reflowSwimlanesToUmlColumns()"
                [disabled]="busy() || loading()"
                title="Reacomoda las calles existentes como columnas verticales (UML típico)"
              >
                Reordenar a columnas (UML)
              </button>
            </div>
            <p class="muted small" *ngIf="!d.swimlanes.length">
              Las calles no aparecen solas: créalas aquí y colócalas en el lienzo arrastrando su barra superior.
            </p>
            <div *ngFor="let s of d.swimlanes; let i = index" class="lane-edit-card">
              <div class="lane-edit-head">
                <span class="lane-dot" [style.background]="laneColor(i)" aria-hidden="true"></span>
                <input class="lane-name-input" placeholder="Nombre" [value]="s.name"
                  (input)="updateSwimlane(s.id, { name: $any($event.target).value })"
                  [disabled]="busy() || loading()" />
                <button type="button" class="btn-lane-remove" (click)="removeSwimlane(s.id)" [disabled]="busy() || loading()"
                  title="Quitar esta calle">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
              <div class="lane-metrics">
                <label>X <input type="number" step="8" [value]="swimlaneNumeric(s.positionX)"
                  (input)="onSwimlaneNumberInput(s.id, 'positionX', $any($event.target).value)"
                  [disabled]="busy() || loading()" /></label>
                <label>Y <input type="number" step="8" [value]="swimlaneNumeric(s.positionY)"
                  (input)="onSwimlaneNumberInput(s.id, 'positionY', $any($event.target).value)"
                  [disabled]="busy() || loading()" /></label>
                <label>Ancho <input type="number" step="40" min="320" [value]="swimlaneNumeric(s.width)"
                  (input)="onSwimlaneNumberInput(s.id, 'width', $any($event.target).value)"
                  [disabled]="busy() || loading()" /></label>
                <label>Alto <input type="number" step="16" min="96" [value]="swimlaneNumeric(s.height)"
                  (input)="onSwimlaneNumberInput(s.id, 'height', $any($event.target).value)"
                  [disabled]="busy() || loading()" /></label>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">Usuarios conectados</div>
            <div class="connected" *ngIf="users().length; else noUsers">
              <div class="user-pill" *ngFor="let u of users().slice(0, 3)">
                <span class="user-avatar" aria-hidden="true">{{ initials(u.fullName) }}</span>
                <span class="user-name">{{ u.fullName }}</span>
              </div>
            </div>
            <ng-template #noUsers>
              <p class="muted small" style="margin:0">Aún no hay usuarios cargados.</p>
            </ng-template>
          </div>

          <div class="panel" *ngIf="collabEnabled()">
            <div class="panel-title">Colaboración en vivo</div>
            <p class="muted small" style="margin:0 0 6px">
              Estado: <strong>{{ collabState()?.connected ? 'Conectado' : 'Desconectado' }}</strong>
              <span *ngIf="collabState()?.receivedCount != null">· Recibidos: {{ collabState()?.receivedCount }}</span>
              <span *ngIf="collabState()?.error">· Error: {{ collabState()?.error }}</span>
            </p>
            <p class="muted small" style="margin:0 0 8px" *ngIf="collabState()?.lastType || collabState()?.lastPolicyId || collabWsUrl()">
              <span *ngIf="collabState()?.lastType">Último: {{ collabState()?.lastType }}</span>
              <span *ngIf="collabState()?.lastPolicyId">· Policy: {{ collabState()?.lastPolicyId }}</span>
              <span *ngIf="collabWsUrl()">· WS: {{ collabWsUrl() }}</span>
            </p>
            <p class="muted small" style="margin:0 0 8px">
              Comparte el mismo WebSocket con otros editores de esta política. Se muestran presencias y cursor aproximado.
            </p>
            <ul class="collab-list" *ngIf="collabPeerEntries().length; else soloTu">
              <li *ngFor="let p of collabPeerEntries()">{{ p }}</li>
            </ul>
            <ng-template #soloTu>
              <p class="muted small" style="margin:0">Aún no hay otros colaboradores conectados.</p>
            </ng-template>
            <p class="muted small" style="margin-top:10px;margin-bottom:0">
              Zoom y vista: use la barra sobre el lienzo (acercar / alejar / Ajustar).
            </p>
          </div>
        </aside>

        <div class="card editor-card">
          <div class="diagram-view-toolbar">
            <div class="dv-zoom" role="group" aria-label="Zoom del lienzo">
              <button type="button" class="dv-icon-btn" (click)="zoomDiagram(0.92)" [disabled]="loading()" title="Alejar (− zoom)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
              <span class="dv-zoom-badge" title="Escala visual del contenido">{{ (zoomScale() * 100) | number: '1.0-0' }}%</span>
              <button type="button" class="dv-icon-btn" (click)="zoomDiagram(1.08)" [disabled]="loading()" title="Acercar (+ zoom)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <button type="button" class="dv-pill-btn" (click)="fitToContent()" [disabled]="loading()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 10V5a1 1 0 0 1 1-1h5M14 19h5a1 1 0 0 0 1-1v-5M19 14v5M5 14v5M14 5h5"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Ajustar
            </button>
            <button type="button" class="dv-pill-btn dv-pill-muted" (click)="resetDiagramView()" [disabled]="loading()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 12a8 8 0 1 1 8 8M12 8v8l4-4"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Inicio
            </button>
            <span class="muted small dv-hint">
              Barras del marco para <strong>mover el lienzo</strong>. <strong>Ctrl + rueda</strong>: zoom.
              Arrastra <strong>nodos</strong> o la <strong>barra superior de cada calle</strong> para colocarlos.
            </span>
          </div>
          <div class="lane-tabs" *ngIf="d.swimlanes.length">
            <button
              type="button"
              class="lane-tab"
              *ngFor="let s of d.swimlanes; let i = index"
              [style.--laneColor]="laneColor(i)"
              disabled
            >
              {{ s.name }}
            </button>
          </div>
          <div
            class="diagram-scroll"
            #diagramScroll
            (pointerup)="onPointerUp()"
            (pointercancel)="onPointerUp()"
          >
            <svg
              #svg
              class="diagram"
              [attr.width]="diagramSvgLayout().widthPx"
              [attr.height]="diagramSvgLayout().heightPx"
              [attr.viewBox]="diagramSvgLayout().viewBoxStr"
              preserveAspectRatio="xMinYMin meet"
              (wheel)="onWheel($event, $any(svg))"
              (pointermove)="onDiagramSvgPointerMove($event, $any(svg))"
              (pointerleave)="onPointerUp()"
              (click)="onCanvasClick($event, $any(svg))"
            >
            <defs>
              <marker
                id="diagramArrowHead"
                viewBox="0 0 12 12"
                refX="10.5"
                refY="6"
                markerWidth="11"
                markerHeight="11"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M 0 0 L 12 6 L 0 12 z" fill="#475569" />
              </marker>
            </defs>

            <!-- cursores remotos (colaborativo) -->
            <ng-container *ngIf="collabEnabled() && remoteCursorEntries().length">
              <ng-container *ngFor="let c of remoteCursorEntries()">
                <g class="remote-cursor" [attr.transform]="'translate(' + c.x + ',' + c.y + ')'">
                  <circle r="6" fill="rgba(37, 99, 235, 0.18)" stroke="rgba(37, 99, 235, 0.95)" stroke-width="2" />
                  <text x="10" y="-10" class="remote-cursor-label">{{ c.userName }}</text>
                </g>
              </ng-container>
            </ng-container>

            <!-- swimlanes (calles; posición/size por swimLaneBox) -->
            <ng-container *ngFor="let s of d.swimlanes; let i = index">
              <g class="swimlane-group">
                <rect
                  class="swimlane"
                  [attr.x]="swimLaneBox(s, i).x"
                  [attr.y]="swimLaneBox(s, i).y"
                  [attr.width]="swimLaneBox(s, i).w"
                  [attr.height]="swimLaneBox(s, i).h"
                  [attr.fill]="laneColor(i)"
                  fill-opacity="0.10"
                  [attr.stroke]="laneColor(i)"
                  stroke-opacity="0.55"
                  stroke-width="1.5"
                  rx="14"
                  ry="14"
                />
                <rect
                  class="swimlane-header"
                  [attr.x]="swimLaneBox(s, i).x"
                  [attr.y]="swimLaneBox(s, i).y"
                  [attr.width]="swimLaneBox(s, i).w"
                  [attr.height]="swimLaneBox(s, i).header"
                  [attr.fill]="laneColor(i)"
                  fill-opacity="0.22"
                  [attr.stroke]="laneColor(i)"
                  stroke-opacity="0.65"
                  stroke-width="1.25"
                  rx="14"
                  ry="14"
                />
                <text class="swimlane-title" [attr.fill]="laneColor(i)" pointer-events="none"
                  [attr.x]="swimLaneBox(s, i).x + 12"
                  [attr.y]="swimLaneBox(s, i).y + swimLaneTitleDy(s, i)"
                >
                  {{ s.name }}
                </text>
              </g>
            </ng-container>

            <!-- nodes (debajo de calles; aristas se pintan encima para ver flechas) -->
            <ng-container *ngFor="let n of d.nodes">
              <g
                class="node"
                [class.node-start]="n.type === 'START'"
                [class.node-end]="n.type === 'END'"
                [class.node-decision]="n.type === 'DECISION'"
                [class.node-activity]="n.type === 'ACTIVITY'"
                [class.node-fork]="n.type === 'FORK'"
                [class.node-join]="n.type === 'JOIN'"
                [class.node-selected]="selectedNodeId() === n.id"
                [attr.transform]="'translate(' + nodeTopLeft(n).x + ',' + nodeTopLeft(n).y + ')'"
                (pointerdown)="onPointerDown($event, n.id, $any(svg))"
                (click)="onNodeClick($event, n.id)"
              >
                <!-- UML: Initial/Final nodes (START/END) como círculo sólido / diana -->
                <circle
                  *ngIf="n.type === 'START'"
                  class="uml-start"
                  [attr.cx]="nodeSize(n).w / 2"
                  [attr.cy]="nodeSize(n).h / 2"
                  [attr.r]="nodeSize(n).w / 2 - 2"
                  fill="#0b1220"
                  stroke="#0b1220"
                  stroke-width="2"
                />
                <g *ngIf="n.type === 'END'" class="uml-end">
                  <circle
                    [attr.cx]="nodeSize(n).w / 2"
                    [attr.cy]="nodeSize(n).h / 2"
                    [attr.r]="nodeSize(n).w / 2 - 2"
                    fill="none"
                    stroke="#0b1220"
                    stroke-width="2.5"
                  />
                  <circle
                    class="uml-end-inner"
                    [attr.cx]="nodeSize(n).w / 2"
                    [attr.cy]="nodeSize(n).h / 2"
                    [attr.r]="nodeSize(n).w / 2 - 10"
                    fill="#0b1220"
                    stroke="#0b1220"
                    stroke-width="2"
                  />
                </g>
                <rect
                  *ngIf="n.type !== 'DECISION' && n.type !== 'START' && n.type !== 'END'"
                  [attr.display]="isSendNode(n) ? 'none' : null"
                  [attr.width]="nodeSize(n).w"
                  [attr.height]="nodeSize(n).h"
                  [attr.rx]="n.type === 'FORK' || n.type === 'JOIN' ? 4 : 10"
                  [attr.ry]="n.type === 'FORK' || n.type === 'JOIN' ? 4 : 10"
                />
                <!-- UML: Enviar objeto/señal (representación tipo flecha) -->
                <polygon
                  *ngIf="isSendNode(n)"
                  [attr.points]="sendSignalPoints(n)"
                  fill="white"
                  stroke="rgba(15,23,42,0.75)"
                  stroke-width="2"
                />
                <polygon
                  *ngIf="n.type === 'DECISION'"
                  [attr.points]="decisionPoints(n)"
                />
                <text
                  *ngIf="n.type !== 'FORK' && n.type !== 'JOIN' && n.type !== 'START' && n.type !== 'END'"
                  class="node-title"
                  [attr.x]="nodeSize(n).w / 2"
                  [attr.y]="nodeSize(n).h / 2 - 2"
                >
                  {{ n.name || n.type }}
                </text>
                <text
                  *ngIf="n.type !== 'FORK' && n.type !== 'JOIN' && n.type !== 'START' && n.type !== 'END'"
                  class="node-sub"
                  [attr.x]="nodeSize(n).w / 2"
                  [attr.y]="nodeSize(n).h / 2 + 14"
                >
                  {{
                    n.type === 'ACTIVITY'
                      ? (n.description ?? n.metadata?.['assigneeName'] ?? '')
                      : (n.description ?? '')
                  }}
                </text>
                <text
                  *ngIf="n.type === 'ACTIVITY' && n.formId"
                  class="node-form-badge"
                  [attr.x]="nodeSize(n).w / 2"
                  [attr.y]="nodeSize(n).h / 2 + 28"
                >
                  CU4 · guardado
                </text>
              </g>
            </ng-container>

            <!-- edges / flechas -->
            <ng-container *ngFor="let e of d.edges">
              <ng-container *ngIf="edgeEndpoints(e) as seg">
                <line
                  class="edge-line"
                  [class.edge-selected]="selectedEdgeId() === e.id"
                  [attr.x1]="seg.x1"
                  [attr.y1]="seg.y1"
                  [attr.x2]="seg.x2"
                  [attr.y2]="seg.y2"
                  [attr.stroke]="
                    e.type === 'ALTERNATIVE' ? '#ea580c' : e.type === 'PARALLEL' ? '#7c3aed' : '#64748b'
                  "
                  [attr.stroke-dasharray]="e.type === 'PARALLEL' ? '6 5' : null"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  marker-end="url(#diagramArrowHead)"
                  (click)="onEdgeClick($event, e.id)"
                />
                <text
                  *ngIf="edgeTextLabel(e) as txt"
                  class="edge-label"
                  [attr.x]="edgeLabelPos(seg).x"
                  [attr.y]="edgeLabelPos(seg).y"
                >
                  {{ txt }}
                </text>
              </ng-container>
            </ng-container>

            <!-- Hit area encima del diagrama para arrastrar cada calle (rectángulo sobre la cabecera). -->
            <ng-container *ngFor="let s of d.swimlanes; let i = index">
              <rect
                class="swimlane-drag-hit"
                [attr.x]="swimLaneBox(s, i).x"
                [attr.y]="swimLaneBox(s, i).y"
                [attr.width]="swimLaneBox(s, i).w"
                [attr.height]="swimLaneBox(s, i).header"
                (pointerdown)="onSwimlaneHeaderPointerDown($event, s.id, i, $any(svg))"
              />
            </ng-container>

            <!-- preview (modo Transición): origen -> cursor -->
            <ng-container *ngIf="paletteMode() === 'EDGE' && connectFromNodeId() as fromId">
              <ng-container *ngIf="hoverSvgPoint() as hp">
                <line
                  class="edge-preview"
                  [attr.x1]="nodeCenter(fromId).x"
                  [attr.y1]="nodeCenter(fromId).y"
                  [attr.x2]="hp.x"
                  [attr.y2]="hp.y"
                  stroke="#94a3b8"
                  stroke-width="2"
                  stroke-dasharray="6 6"
                  stroke-linecap="round"
                />
              </ng-container>
            </ng-container>
            </svg>
          </div>

        <details class="debug">
          <summary class="debug-summary">Detalles</summary>

          <h3 class="block-title">Vista previa (texto)</h3>

          <h4 class="sub-title">Swimlanes</h4>
          <ul class="list">
            <li *ngFor="let s of d.swimlanes">{{ swimlaneLine(s) }}</li>
          </ul>

          <h4 class="sub-title">Nodos por tipo</h4>
          <ng-container *ngFor="let g of groupedNodes()">
            <h5 class="type-heading">{{ g.type }}</h5>
            <ul class="list">
              <li *ngFor="let n of g.nodes">{{ nodeLineWithPosition(n) }}</li>
            </ul>
          </ng-container>

          <h4 class="sub-title">Transiciones</h4>
          <ul class="list">
            <li *ngFor="let t of transitionLines()">{{ t }}</li>
          </ul>

          <h4 class="sub-title">Estado de validación del diagrama (última ejecución)</h4>
          <ng-container *ngIf="validationState() as v; else noValidation">
            <p>
              <strong>isValid:</strong>
              {{ isDiagramValidationValid(v) }}
            </p>
            <ul class="list" *ngIf="v.errors?.length">
              <li *ngFor="let e of v.errors"><code>{{ e.code }}</code> — {{ e.message }}</li>
            </ul>
            <p class="muted" *ngIf="!v.errors?.length && isDiagramValidationValid(v) === true">
              Sin errores reportados.
            </p>
          </ng-container>
          <ng-template #noValidation>
            <p class="muted">Aún no se ha validado el diagrama contra el backend.</p>
          </ng-template>
        </details>
        </div>
      </div>

      <!-- NLP al final del flujo (1 tabla formularios → 2 lienzo → 3 NLP). Colapsable por defecto. -->
      <details class="card asst-nlp nlp-details" *ngIf="draftPayload()" id="nlp-assistant-panel">
        <summary class="nlp-summary">
          <span class="nlp-summary-title">Asistente NLP del workflow</span>
          <span class="nlp-summary-hint muted small">Texto natural → sugerencias de calles y actividades</span>
        </summary>
        <div class="nlp-details-body">
          <p class="muted small">
            Describe el proceso en español. La IA propone calles, actividades y transiciones. Revisa la vista previa
            antes de aplicar; no se eliminan elementos ya creados.
          </p>
          <label class="block-label">
            Texto para analizar
            <textarea rows="5" [value]="nlpAssistText()" (input)="nlpAssistText.set($any($event.target).value)"
              placeholder="Ej.: cuando llega una solicitud, recepción la revisa, luego el supervisor aprueba..."></textarea>
          </label>
          <div class="toolbar inner nlp-toolbar">
            <button type="button" class="secondary" [disabled]="nlpBusy() || !policyId()" (click)="clearNlpAssist()">
              Limpiar
            </button>
            <button type="button" (click)="runStructuredDiagramNlp()" [disabled]="nlpBusy() || !policyId()">
              {{ nlpBusy() ? 'Generando…' : 'Generar sugerencias' }}
            </button>
            <button
              type="button"
              class="secondary"
              (click)="applyStructuredDiagramNlp()"
              [disabled]="nlpBusy() || !nlpPreview()?.suggestions?.length || policyStatus() !== 'DRAFT'"
            >
              Aplicar al diagrama
            </button>
          </div>
          <p class="error" *ngIf="nlpError()" style="margin-top:10px">{{ nlpError() }}</p>
          <p class="muted" *ngIf="!nlpBusy() && !nlpPreview() && !nlpError()">
            Ejecute “Generar sugerencias” para la vista previa (motor de reglas en backend).
          </p>
          <div class="muted small" style="margin-top: 8px" *ngIf="nlpPreview()?.warnings?.length">
            <strong>Avisos:</strong> {{ nlpPreview()!.warnings!.join(' · ') }}
          </div>
          <div class="nlp-prev-wrap" *ngIf="nlpPreview()?.suggestions?.length">
            <table class="nlp-prev">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>Razón / nota</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of nlpPreview()!.suggestions">
                  <td><code>{{ r.type }}</code></td>
                  <td>{{ nlpRowDetail(r) }}</td>
                  <td class="muted small">{{ r.reason }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <div class="modal-backdrop" *ngIf="aiModalOpen()" (click)="closeAiModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="modal-title">Asistente IA – Generador de diagramas</div>
            <button type="button" class="icon-x secondary" (click)="closeAiModal()" aria-label="Cerrar">✕</button>
          </div>
          <p class="muted small" style="margin:0 0 10px">
            Describe el proceso de negocio que quieres automatizar.
          </p>

          <label class="block-label">
            Usuario creador (createdBy)
            <select
              [value]="aiCreatedBy() ?? ''"
              (change)="aiCreatedBy.set($any($event.target).value || null)"
              [disabled]="aiBusy()"
            >
              <option value="">Selecciona un usuario</option>
              <option *ngFor="let u of users()" [value]="u.id">{{ u.fullName }} ({{ u.email }})</option>
            </select>
          </label>

          <label class="block-label">
            Proceso
            <textarea
              rows="6"
              [value]="aiPromptText()"
              (input)="aiPromptText.set($any($event.target).value)"
              [disabled]="aiBusy()"
              placeholder="Describe el proceso aquí…"
            ></textarea>
          </label>

          <div class="card" style="margin-top: 12px; padding: 12px">
            <div class="panel-title" style="margin-bottom: 6px">Modificar diagrama actual (IA)</div>
            <p class="muted small" style="margin: 0 0 8px">
              Frases reales: <strong>Creame un nodo “Revisar pago”</strong>, <strong>agrega actividad Enviar correo</strong>,
              <strong>quita “Finalizar”</strong>, <strong>conecta “A” con “B”</strong>. Con IA apagada, un motor de reglas
              aplica lo mismo.
            </p>
            <textarea
              rows="3"
              class="ai-edit"
              [value]="aiEditInstruction()"
              (input)="aiEditInstruction.set($any($event.target).value)"
              [disabled]="aiBusy()"
              placeholder='Ej: "Agrega una condición: si es aprobado va a Notificar aprobación, si no va a Notificar rechazo"'
            ></textarea>
            <div class="toolbar" style="margin-top: 10px; justify-content:flex-end; gap:10px">
              <button
                type="button"
                class="secondary"
                (click)="applyAiEdit(false)"
                [disabled]="aiBusy() || !draftPayload() || !aiEditInstruction().trim()"
              >
                Aplicar al editor
              </button>
              <button
                type="button"
                (click)="applyAiEdit(true)"
                [disabled]="aiBusy() || !draftPayload() || !aiEditInstruction().trim() || !policyId()"
                title="Aplica la modificación y la guarda en el servidor"
              >
                Aplicar y guardar
              </button>
            </div>
          </div>

          <div class="card" *ngIf="aiSuggestion() as sug" style="margin-top: 12px; padding: 12px">
            <div class="panel-title" style="margin-bottom: 6px">Resultado (innovación)</div>
            <p class="muted small" style="margin: 0 0 6px">{{ sug.summary }}</p>
            <p class="muted small" *ngIf="sug.warnings.length" style="margin: 0">
              <strong>Avisos:</strong> {{ sug.warnings.join(' · ') }}
            </p>
            <p class="muted small" *ngIf="sug.detectedActivities.length" style="margin: 6px 0 0">
              <strong>Actividades detectadas:</strong> {{ sug.detectedActivities.join(', ') }}
            </p>
          </div>

          <p class="muted small" style="margin: 12px 0 0">
            Si pedís <strong>eliminar</strong>, <strong>conectar</strong> o <strong>agregar un nodo</strong>, «Generar diagrama»
            aplica la modificación al diagrama actual (no inventa uno nuevo).
          </p>
          <div class="modal-actions">
            <button type="button" class="secondary" (click)="closeAiModal()" [disabled]="aiBusy()">Cancelar</button>
            <button type="button" (click)="generateAiProposal()" [disabled]="aiBusy() || !policyId()">
              Generar diagrama
            </button>
            <button
              type="button"
              class="secondary"
              (click)="generateAiAndSave()"
              [disabled]="aiBusy() || !policyId()"
              title="Genera la propuesta y la guarda en el servidor automáticamente"
            >
              Generar y guardar
            </button>
          </div>

          <div class="toolbar" style="margin-top: 10px">
            <button type="button" class="secondary" (click)="startVoice()" [disabled]="aiBusy() || voiceRecording()">
              Grabar audio
            </button>
            <button type="button" class="secondary" (click)="stopVoice()" [disabled]="!voiceRecording()">
              Detener
            </button>
            <button
              type="button"
              class="secondary"
              (click)="useAiProposal()"
              [disabled]="aiBusy() || !aiSuggestion()"
            >
              Usar propuesta
            </button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" *ngIf="commentsOpen()" (click)="closeComments()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="modal-title">Comentarios</div>
            <button type="button" class="icon-x secondary" (click)="closeComments()" aria-label="Cerrar">✕</button>
          </div>
          <p class="muted small" style="margin:0 0 10px">
            Comentarios colaborativos por política. Se envían por WebSocket (no se guardan en BD en MVP).
          </p>

          <label class="block-label">
            Comentario {{ selectedNodeId() ? '(sobre nodo seleccionado)' : '' }}
            <textarea
              rows="3"
              [value]="commentText()"
              (input)="commentText.set($any($event.target).value)"
              placeholder="Escribe una nota o duda..."
            ></textarea>
          </label>

          <div class="modal-actions">
            <button type="button" class="secondary" (click)="closeComments()">Cerrar</button>
            <button type="button" (click)="sendComment()" [disabled]="!commentText().trim()">Enviar</button>
          </div>

          <div class="card" style="margin-top: 12px; padding: 12px" *ngIf="comments().length; else noComments">
            <div class="panel-title" style="margin-bottom: 8px">Historial</div>
            <div class="muted small" *ngFor="let c of comments().slice(0, 12)" style="margin: 0 0 8px">
              <strong>{{ c.userName }}</strong>
              <span class="muted">· {{ c.ts | date: 'short' }}</span>
              <span class="muted" *ngIf="c.nodeId">· nodo: <code>{{ c.nodeId }}</code></span>
              <div style="margin-top: 4px; white-space: pre-wrap">{{ c.text }}</div>
            </div>
          </div>
          <ng-template #noComments>
            <p class="muted small" style="margin: 8px 0 0">Aún no hay comentarios.</p>
          </ng-template>
        </div>
      </div>

      <div class="card" id="cu4-form-designer" *ngIf="!!draftPayload()">
        <h3 class="block-title">Diseñador de formulario CU4 (ejecución)</h3>
        <div
          class="card"
          style="margin-top: 10px; padding: 12px 14px; background: var(--panel-muted-bg, #f1f5f9); border: 1px solid var(--hairline, #e2e8f0)"
          *ngIf="!selectedActivityNodeId()"
        >
          <p style="margin: 0 0 8px 0; font-weight: 600">Empiece aquí: elija una actividad</p>
          <p class="muted small" style="margin: 0">
            Despliegue <strong>Paso 1 — Actividad</strong> abajo y seleccione una actividad, o pulse
            <strong>Crear o editar formulario</strong> en la tabla de arriba. Sin actividad no se muestran los campos ni «Agregar campo».
          </p>
        </div>
        <div class="card warn" *ngIf="!canConfigureCu4()" style="margin-top: 10px">
          <p class="warn-text" style="margin:0">
            Para crear/guardar formularios debes: (1) estar en <strong>DRAFT</strong> y (2) <strong>Guardar el diagrama</strong> al servidor.
            Cuando lo hagas, se habilitan los botones de guardado.
          </p>
        </div>
        <div class="cu4-help">
          <div class="cu4-help-title">Guía rápida</div>
          <ol class="cu4-help-list">
            <li><strong>Paso 1:</strong> elige una <strong>actividad</strong> (desplegable de abajo o botón en la tabla).</li>
            <li><strong>Paso 2:</strong> escribe el <strong>nombre</strong> del formulario (ej. “Solicitud”).</li>
            <li><strong>Paso 3:</strong> agrega <strong>campos</strong> (etiquetas, textos, botones).</li>
            <li><strong>Paso 4:</strong> pulsa <strong>Guardar formulario</strong> y revisa la <strong>Vista previa</strong>.</li>
          </ol>
          <div class="muted small">Tip: <strong>Etiqueta (LABEL)</strong> es solo texto. <strong>Botón (BUTTON)</strong> ejecuta una acción.</div>
        </div>

        <div class="config-grid">
          <div>
            <h4 class="sub-title">Paso 1 — Actividad</h4>
            <label class="block-label">
              Selecciona la actividad del proceso
              <select
                [value]="selectedActivityNodeId() ?? ''"
                (change)="onActivitySelect($any($event.target).value)"
                [disabled]="loadingForm() || cfgBusy()"
              >
                <option value="">— Selecciona una actividad —</option>
                <option *ngFor="let n of activityNodes()" [value]="n.id">
                  {{ n.name || n.id }} ({{ n.id }})
                </option>
              </select>
            </label>

            <p class="muted" *ngIf="!selectedActivityNodeId()">
              Primero elige una actividad. Luego podrás crear el formulario que verá el usuario cuando ejecute esa actividad.
            </p>

            <form *ngIf="selectedActivityNodeId()" [formGroup]="activityForm" (ngSubmit)="saveActivityForm()">
              <h4 class="sub-title">Paso 2 — Datos del formulario</h4>
              <div class="row">
                <label>
                  Nombre (lo ve el usuario)
                  <input formControlName="name" placeholder="Ej: Solicitud de vacaciones" />
                </label>
                <label>
                  Descripción (opcional)
                  <input formControlName="description" placeholder="Ej: Complete los datos y presione Enviar" />
                </label>
              </div>

              <p class="muted small" *ngIf="!dynamicFormExists()">
                Este formulario aún no existe. Al guardar se creará automáticamente.
              </p>
              <p class="muted small" *ngIf="dynamicFormExists()">
                Este formulario ya existe. Al guardar, se actualizarán los cambios.
              </p>

              <div class="toolbar inner" style="margin-top: 10px; justify-content:flex-end; gap:10px">
                <button
                  type="button"
                  class="secondary"
                  (click)="validateActivityForm()"
                [disabled]="!canConfigureCu4() || loadingForm() || cfgBusy()"
                >
                  Revisar (validar)
                </button>
                <button
                  type="button"
                  class="secondary"
                  (click)="previewOpen.set(!previewOpen())"
                  [disabled]="loadingForm() || cfgBusy()"
                >
                  {{ previewOpen() ? 'Ocultar vista previa' : 'Ver vista previa' }}
                </button>
              </div>

              <div class="fields-head">
                <div>
                  <h4 class="sub-title" style="margin:0">Paso 3 — Campos del formulario</h4>
                  <p class="muted small" style="margin: 6px 0 0 0">
                    Agrega los campos en el orden que quieras. Ejemplos: <strong>LABEL</strong> para títulos, <strong>TEXT</strong> para escribir,
                    <strong>BUTTON</strong> para botones de acción.
                  </p>
                </div>
                <div class="fields-actions">
                  <button
                    type="button"
                    class="cu4-add-field"
                    (click)="addFieldRow()"
                    [disabled]="!canConfigureCu4() || cfgBusy()"
                    title="Añade una fila de campo (TEXT, LABEL, USER, etc.). Requiere política en borrador y diagrama guardado."
                  >
                    + Agregar campo al formulario
                  </button>
                  <button
                    type="button"
                    class="danger mini"
                    *ngIf="dynamicFormExists()"
                    (click)="deleteActivityForm()"
                    [disabled]="!canConfigureCu4() || loadingForm() || cfgBusy()"
                    title="Elimina el formulario en el servidor y quita formId del nodo"
                  >
                    Eliminar formulario
                  </button>
                  <button type="submit" [disabled]="!canConfigureCu4() || activityForm.invalid || loadingForm() || cfgBusy()">
                    Guardar formulario
                  </button>
                </div>
              </div>

              <div class="field-card" *ngFor="let g of fields.controls; let i = index" [formGroup]="$any(g)">
                <input type="hidden" formControlName="id" />
                <div class="field-card-head">
                  <div class="field-card-title">
                    <span class="field-chip">Campo {{ i + 1 }}</span>
                  <span class="muted small">Pon el texto y el tipo de dato.</span>
                  </div>
                  <button
                    type="button"
                    class="btn-field-remove"
                    (click)="removeFieldRow(i)"
                    [disabled]="cfgBusy()"
                    title="Quitar este campo"
                    aria-label="Quitar este campo"
                  >
                    Quitar
                  </button>
                </div>
                <div class="field-grid">
                <label>
                  Texto (lo ve el usuario)
                  <input formControlName="label" placeholder="Ej: Nombre completo" />
                </label>
                <label>
                  Clave (interno)
                  <input formControlName="name" placeholder="Ej: nombreCompleto" />
                </label>
                <label>
                  Tipo
                  <select formControlName="type">
                    <option *ngFor="let ft of fieldTypes" [value]="ft">{{ ft }}</option>
                  </select>
                </label>
                <label *ngIf="['TEXT','NUMBER','DATE','TEXTAREA','SELECT','RADIO','FILE'].includes($any(g).get('type')?.value)">
                  Ejemplo / guía
                  <input formControlName="placeholder" placeholder="Ej: Escriba aquí..." />
                </label>
                <label *ngIf="['TEXT','NUMBER','DATE','TEXTAREA','SELECT','RADIO','BOOLEAN','USER'].includes($any(g).get('type')?.value)">
                  Valor inicial (opcional)
                  <input formControlName="defaultValue" placeholder="Ej: 0 / Hoy / Sí / id de usuario" />
                </label>
                <label class="checkbox" *ngIf="$any(g).get('type')?.value === 'USER'">
                  <input type="checkbox" formControlName="assignsNextTask" />
                  Asignar la siguiente actividad al usuario elegido (desde este campo)
                </label>
                <label *ngIf="$any(g).get('type')?.value !== 'LABEL'">
                  Ayuda (opcional)
                  <input formControlName="helpText" placeholder="Ej: Revise que esté correcto" />
                </label>
                <label *ngIf="$any(g).get('type')?.value === 'BUTTON'">
                  Acción del botón
                  <select formControlName="action">
                    <option value="">(sin acción)</option>
                    <option value="SAVE_DRAFT">Guardar borrador</option>
                    <option value="SUBMIT_FORM">Enviar formulario</option>
                    <option value="COMPLETE_ACTIVITY">Completar actividad</option>
                    <option value="AUTOFILL">Autocompletar</option>
                    <option value="VALIDATE">Validar requeridos</option>
                    <option value="COPY_JSON">Copiar JSON</option>
                  </select>
                  <span class="muted small" style="margin-top:4px; display:block">
                    Recomendado: <strong>Completar actividad</strong>.
                  </span>
                </label>
                <label class="checkbox">
                  <input type="checkbox" formControlName="required" />
                  Obligatorio
                </label>
                <label>
                  Opciones (si es lista)
                  <input formControlName="optionsText" placeholder="Ej: Aprobado, Rechazado" />
                </label>
                <label>
                  Orden (0, 1, 2…)
                  <input type="number" min="0" step="1" formControlName="order" />
                </label>
                </div>
              </div>

              <div class="muted small" style="margin-top: 10px">
                Consejo: usa <strong>Vista previa</strong> para revisar cómo lo verá la secretaria durante la ejecución.
              </div>

              <div class="card" *ngIf="formValidation() as fv" style="margin-top:12px; padding: 12px">
                <div class="muted small" style="font-weight:850">Validación del formulario</div>
                <p style="margin:8px 0 0 0">
                  <strong>isValid:</strong> {{ isDiagramValidationValid(fv) }}
                </p>
                <ul class="list" *ngIf="fv.errors?.length">
                  <li *ngFor="let e of fv.errors"><code>{{ e.code }}</code> — {{ e.message }}</li>
                </ul>
                <p class="muted" *ngIf="!fv.errors?.length && isDiagramValidationValid(fv) === true">
                  El formulario es válido.
                </p>
              </div>

              <div class="card" *ngIf="previewOpen()" style="margin-top:12px; padding: 12px">
                <div class="muted small" style="font-weight:850">Vista previa</div>
                <p class="muted small" style="margin:6px 0 10px 0">
                  Así se verá el formulario durante la ejecución de la actividad.
                </p>
                <div class="dyn-grid">
                  <ng-container *ngFor="let f of previewFields()">
                    <ng-container [ngSwitch]="f.type">
                      <div *ngSwitchCase="'LABEL'" class="dyn-label">
                        {{ f.label }}
                      </div>
                      <div *ngSwitchCase="'BUTTON'" class="dyn-btn-row">
                        <button type="button" class="secondary" disabled>
                          {{ f.label || 'Botón' }}
                        </button>
                      </div>
                      <label *ngSwitchCase="'USER'" class="block-label">
                        {{ f.label }}
                        <span class="muted small" *ngIf="f.required">(*)</span>
                        <select disabled style="margin-top: 6px">
                          <option>Nombre completo · Rol (lista en ejecución)</option>
                        </select>
                        <p class="muted small" *ngIf="f.helpText" style="margin: 6px 0 0 0">
                          {{ f.helpText }}
                        </p>
                      </label>
                      <label *ngSwitchDefault class="block-label">
                        {{ f.label }}
                        <span class="muted small" *ngIf="f.required">(*)</span>

                        <input
                          *ngIf="f.type === 'TEXT' || f.type === 'NUMBER' || f.type === 'DATE'"
                          [type]="f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'"
                          [placeholder]="f.placeholder ?? ''"
                          [value]="f.defaultValue ?? ''"
                          disabled
                        />
                        <textarea
                          *ngIf="f.type === 'TEXTAREA'"
                          rows="3"
                          [placeholder]="f.placeholder ?? ''"
                          [value]="f.defaultValue ?? ''"
                          disabled
                        ></textarea>
                        <select *ngIf="f.type === 'SELECT'" disabled>
                          <option value="">Seleccionar...</option>
                          <option *ngFor="let o of f.options ?? []" [value]="o">{{ o }}</option>
                        </select>
                        <div *ngIf="f.type === 'RADIO'" class="radio-group" style="margin-top:6px">
                          <label class="radio" *ngFor="let o of f.options ?? []">
                            <input type="radio" [checked]="(f.defaultValue ?? '') === o" disabled />
                            <span>{{ o }}</span>
                          </label>
                        </div>
                        <label *ngIf="f.type === 'BOOLEAN'" class="checkbox" style="margin-top: 6px">
                          <input type="checkbox" [checked]="(toText(f.defaultValue).toLowerCase() === 'true')" disabled />
                          {{ f.label }}
                        </label>
                        <p class="muted small" *ngIf="f.helpText" style="margin:6px 0 0 0">
                          {{ f.helpText }}
                        </p>
                      </label>
                    </ng-container>
                  </ng-container>
                </div>
              </div>
            </form>
          </div>

          <div>
            <h4 class="sub-title">Paso 4 — Condición de transición (opcional)</h4>
            <p class="muted small" style="margin: 0 0 10px 0">
              Si tu flecha necesita una condición (ej. “aprobada / rechazada”), escríbela aquí.
            </p>
            <label class="block-label">
              Transición del diagrama (flujo)
              <select
                [value]="selectedEdgeId() ?? ''"
                (change)="onEdgeSelect($any($event.target).value)"
                [disabled]="cfgBusy()"
              >
                <option value="">— Selecciona una flecha —</option>
                <option *ngFor="let e of draftEdges()" [value]="e.id">{{ edgeSummary(e) }}</option>
              </select>
            </label>

            <div *ngIf="selectedEdgeId()">
              <label class="block-label">
                Condición
                <textarea rows="3" [value]="edgeCondition()" (input)="onEdgeConditionInput($event)" [disabled]="cfgBusy()"></textarea>
              </label>
              <p class="muted small">El backend exige texto no vacío en la petición de actualización.</p>
              <button type="button" (click)="saveEdgeCondition()" [disabled]="cfgBusy() || !edgeCondition().trim()">
                Guardar condición
              </button>
            </div>

            <h4 class="sub-title" style="margin-top: 16px">Validación de configuración</h4>
            <button type="button" class="secondary" (click)="validateConfiguration()" [disabled]="cfgBusy()">
              Validar configuración
            </button>

            <ng-container *ngIf="configValidation() as cv">
              <p class="sub-title" style="margin-top: 10px">Resultado</p>
              <p>
                <strong>isValid:</strong>
                {{ isConfigValidationValid(cv) }}
              </p>
              <ul class="list" *ngIf="cv.errors?.length">
                <li *ngFor="let e of cv.errors"><code>{{ e.code }}</code> — {{ e.message }}</li>
              </ul>
            </ng-container>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      code {
        font-size: 12px;
      }
      .editor-head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px 20px;
        padding: 14px 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
      }
      .editor-head-brand {
        flex: 1 1 220px;
        min-width: 0;
      }
      .editor-head h2 {
        margin: 0;
        font-size: 17px;
        letter-spacing: 0.01em;
        font-weight: 850;
      }
      .editor-head-tagline {
        margin: 6px 0 0;
        font-size: 13px;
        line-height: 1.45;
      }
      .policy-chip-wrap {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-left: 6px;
        vertical-align: middle;
      }
      .policy-chip {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 90%, transparent);
      }
      .policy-status {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted);
      }
      .editor-head-toolbar {
        flex: 2 1 360px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
      }
      .who {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .who-compact select,
      .who-compact input {
        min-width: 160px;
        max-width: 220px;
      }
      .who-label {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
        white-space: nowrap;
      }
      .who select,
      .who input {
        height: 40px;
      }
      .editor-head-primary {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .editor-more {
        position: relative;
      }
      .editor-more-summary {
        cursor: pointer;
        list-style: none;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid var(--border);
        font-weight: 800;
        font-size: 13px;
        background: color-mix(in srgb, var(--panel-solid) 92%, transparent);
        color: var(--text);
      }
      .editor-more-summary::-webkit-details-marker {
        display: none;
      }
      .editor-more[open] .editor-more-summary {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }
      .editor-more-body {
        position: absolute;
        right: 0;
        top: 100%;
        z-index: 30;
        min-width: 240px;
        max-width: min(320px, 92vw);
        display: grid;
        gap: 8px;
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 0 0 12px 12px;
        background: var(--panel-solid);
        box-shadow: 0 16px 40px rgba(2, 6, 23, 0.14);
      }
      .editor-more-body .action {
        width: 100%;
        justify-content: flex-start;
      }
      .workspace-nav {
        position: sticky;
        top: 0;
        z-index: 12;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--panel-solid) 96%, transparent);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
      }
      .wn-btn {
        flex: 1 1 auto;
        min-width: 140px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        background: color-mix(in srgb, var(--panel-solid) 88%, transparent);
        color: var(--text);
        font-weight: 800;
        font-size: 12px;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: box-shadow 0.15s ease, border-color 0.15s ease;
      }
      .wn-btn:hover {
        border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.1);
      }
      .wn-btn-accent {
        border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
        background: color-mix(in srgb, var(--primary) 10%, var(--panel-solid));
      }
      .action {
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 88%, transparent);
        color: var(--text);
        box-shadow: var(--shadow-sm);
        padding: 10px 14px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-weight: 750;
        cursor: pointer;
      }
      .action:hover:not([disabled]) {
        box-shadow: var(--shadow-sm), 0 16px 32px rgba(2, 6, 23, 0.10);
      }
      .action:focus-visible {
        outline: none;
        box-shadow: var(--focus-ring), 0 16px 32px rgba(2, 6, 23, 0.10);
      }
      .action-ico {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .action svg {
        display: block;
      }
      .action.ai {
        background: linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%);
        border-color: rgba(255, 255, 255, 0.12);
        color: #ffffff;
        box-shadow: 0 12px 26px rgba(124, 58, 237, 0.20);
      }
      .action.validate {
        background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
        border-color: rgba(255, 255, 255, 0.14);
        color: #ffffff;
        box-shadow: 0 12px 26px rgba(245, 158, 11, 0.20);
      }
      .action.save {
        background: linear-gradient(180deg, #10b981 0%, #059669 100%);
        border-color: rgba(255, 255, 255, 0.14);
        color: #ffffff;
        box-shadow: 0 12px 26px rgba(16, 185, 129, 0.20);
      }
      .action.ghost {
        background: color-mix(in srgb, var(--panel-solid) 92%, transparent);
        color: var(--text);
      }
      .editor-shell {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 12px;
        align-items: start;
      }
      .editor-left {
        display: grid;
        gap: 12px;
      }
      .editor-card {
        min-width: 0;
      }
      .panel {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow-sm);
        padding: 12px;
      }
      .panel-title {
        font-weight: 800;
        font-size: 12px;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 10px;
      }
      .palette {
        display: grid;
        gap: 8px;
      }
      .palette-item {
        width: 100%;
        justify-content: flex-start;
        border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        background: color-mix(in srgb, var(--panel-solid) 92%, transparent);
        color: var(--text);
        box-shadow: var(--shadow-sm);
        padding: 10px 12px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 750;
        cursor: pointer;
      }
      .palette-item.active {
        outline: none;
        box-shadow: var(--focus-ring), var(--shadow-sm);
        border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
      }
      .palette-ico {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        display: inline-block;
        border: 2px solid color-mix(in srgb, var(--text) 55%, transparent);
        background: #ffffff;
        flex: 0 0 auto;
      }
      .palette-ico.start {
        border-color: #10b981;
      }
      .palette-ico.activity {
        border-radius: 6px;
        border-color: #111827;
      }
      .palette-ico.send {
        border-radius: 6px;
        border-color: #0ea5e9;
      }
      .palette-ico.decision {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        transform: rotate(45deg);
        border-color: #f59e0b;
        margin-left: 2px;
      }
      .palette-ico.fork {
        border-color: #7c3aed;
      }
      .palette-ico.join {
        border-color: #7c3aed;
        background: rgba(124, 58, 237, 0.12);
      }
      .palette-ico.end {
        border-color: #ef4444;
      }
      .palette-ico.edge {
        border-radius: 6px;
        border-color: #64748b;
        background: rgba(100, 116, 139, 0.10);
      }
      .mini-actions {
        margin-top: 10px;
        display: grid;
        gap: 8px;
      }
      button.mini {
        width: 100%;
        padding: 9px 12px;
        border-radius: 12px;
        font-weight: 800;
      }
      .connected {
        display: grid;
        gap: 8px;
      }
      .user-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        background: color-mix(in srgb, var(--panel-solid) 74%, transparent);
      }
      .user-avatar {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-weight: 900;
        font-size: 11px;
        color: #ffffff;
        background: linear-gradient(180deg, rgba(37, 99, 235, 0.92), rgba(29, 78, 216, 0.92));
        flex: 0 0 auto;
      }
      .user-name {
        font-size: 13px;
        color: var(--text);
        font-weight: 650;
      }
      .tools {
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .tools-summary {
        cursor: pointer;
        list-style: none;
        padding: 12px 14px;
        font-weight: 850;
        color: var(--text);
      }
      .tools-summary::-webkit-details-marker {
        display: none;
      }
      .tools-body {
        padding: 0 14px 14px;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(2, 6, 23, 0.48);
        display: grid;
        place-items: center;
        padding: 20px;
        z-index: 50;
      }
      .modal {
        width: min(720px, 96vw);
        border-radius: 16px;
        border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
        background: var(--panel-solid);
        box-shadow: var(--shadow-md);
        padding: 14px;
      }
      .modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }
      .modal-title {
        font-weight: 850;
        letter-spacing: 0.01em;
      }
      .icon-x {
        width: 38px;
        height: 38px;
        padding: 0;
        border-radius: 12px;
        display: grid;
        place-items: center;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 10px;
      }
      .link-as-button {
        display: inline-block;
        font-weight: 600;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
        color: var(--text);
        font-size: 13px;
        text-decoration: none;
      }
      .link-as-button:focus-visible {
        outline: none;
        box-shadow: var(--focus-ring);
      }
      .block-title {
        margin: 0 0 10px;
        font-size: 15px;
        letter-spacing: 0.01em;
      }
      .sub-title {
        margin: 12px 0 6px;
        font-size: 13px;
        color: var(--muted);
      }
      .list {
        margin: 0;
        padding-left: 18px;
        font-size: 13px;
      }
      .warn {
        border-color: #f59e0b;
        background: #fffbeb;
      }
      .warn-text {
        margin: 0;
        font-size: 14px;
        color: #92400e;
      }
      .form-registry-card {
        margin-top: 12px;
      }
      .form-registry-standalone {
        margin-top: 12px;
        border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--border));
        box-shadow: 0 8px 24px rgba(37, 99, 235, 0.08);
      }
      .form-reg-wrap {
        overflow: auto;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      }
      .form-reg-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .form-reg-table th,
      .form-reg-table td {
        border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
      }
      .form-reg-table th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
        font-weight: 900;
        background: color-mix(in srgb, var(--panel-solid) 94%, transparent);
      }
      .form-reg-table tr.row-selected td {
        background: color-mix(in srgb, var(--primary) 8%, transparent);
      }
      .fr-pill {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
      }
      .fr-pill-ok {
        background: color-mix(in srgb, #16a34a 14%, #fff);
        color: #166534;
        border: 1px solid color-mix(in srgb, #16a34a 35%, transparent);
      }
      .fr-pill-warn {
        background: color-mix(in srgb, #f59e0b 16%, #fff);
        color: #92400e;
        border: 1px solid color-mix(in srgb, #f59e0b 40%, transparent);
      }
      /* Botón principal: crear/editar formulario (tabla y panel de nodo) */
      button.primary.mini {
        border: 1px solid color-mix(in srgb, var(--primary) 50%, #1d4ed8);
        background: linear-gradient(180deg, #2563eb, #1d4ed8);
        color: #fff;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
      }
      button.primary.mini:hover:not([disabled]) {
        filter: brightness(1.06);
      }
      button.primary.mini[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
        filter: none;
        box-shadow: none;
      }
      .fields-actions button.cu4-add-field {
        border: 1px solid color-mix(in srgb, var(--primary) 45%, #1d4ed8);
        background: linear-gradient(180deg, #2563eb, #1d4ed8);
        color: #fff;
        font-weight: 800;
        padding: 10px 14px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.22);
      }
      .fields-actions button.cu4-add-field:hover:not([disabled]) {
        filter: brightness(1.05);
      }
      .fields-actions button.cu4-add-field[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
        box-shadow: none;
      }
      .config-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
      @media (max-width: 900px) {
        .config-grid {
          grid-template-columns: 1fr;
        }
      }
      .block-label {
        display: grid;
        gap: 6px;
        font-size: 13px;
        margin-bottom: 10px;
      }
      .fields-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        background: color-mix(in srgb, var(--panel-solid) 92%, transparent);
      }
      .fields-actions {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .field-card {
        margin-top: 12px;
        border-radius: 16px;
        border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        background: var(--panel);
        box-shadow: var(--shadow-sm);
        padding: 12px;
      }
      .field-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .field-card-title {
        display: grid;
        gap: 2px;
        min-width: 0;
      }
      .field-chip {
        width: fit-content;
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        color: color-mix(in srgb, var(--primary) 80%, #0b1220);
        background: color-mix(in srgb, var(--primary) 14%, #ffffff);
        border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border));
      }
      .btn-field-remove {
        border: 1px solid color-mix(in srgb, #ef4444 32%, var(--border));
        background: color-mix(in srgb, #ef4444 10%, #ffffff);
        color: #991b1b;
        font-weight: 850;
        padding: 8px 12px;
        border-radius: 12px;
        cursor: pointer;
      }
      .btn-field-remove[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .field-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 12px;
        align-items: end;
      }
      .field-grid label {
        min-width: 0;
      }
      .field-grid input,
      .field-grid select,
      .field-grid textarea {
        min-width: 0;
      }
      .field-grid .checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
      @media (max-width: 900px) {
        .fields-head {
          flex-direction: column;
        }
        .fields-actions {
          justify-content: flex-start;
        }
        .field-grid {
          grid-template-columns: 1fr;
        }
      }
      .toolbar.inner {
        margin-top: 10px;
      }
      .danger-text {
        color: #b91c1c;
        border-color: #fecaca;
      }
      .cu4-help {
        margin: 10px 0 14px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 10%, #ffffff), var(--panel));
      }
      .cu4-help-title {
        font-weight: 900;
        letter-spacing: 0.02em;
        font-size: 12px;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--primary) 80%, var(--text));
        margin-bottom: 8px;
      }
      .cu4-help-list {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 6px;
        font-size: 13px;
        color: var(--text);
      }
      .small {
        font-size: 12px;
      }
      .type-heading {
        margin: 8px 0 4px;
        font-size: 12px;
        font-weight: 600;
        color: #4b5563;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .diagram-view-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
        margin-bottom: 12px;
        padding: 10px 12px;
        border-radius: var(--radius-md);
        border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        background: color-mix(in srgb, var(--panel-solid) 94%, transparent);
      }
      .dv-zoom {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        background: color-mix(in srgb, var(--panel-solid) 88%, transparent);
      }
      .dv-icon-btn {
        border: none;
        background: color-mix(in srgb, var(--panel-solid) 95%, #fff);
        width: 34px;
        height: 34px;
        padding: 0;
        border-radius: 10px;
        display: grid;
        place-items: center;
        cursor: pointer;
        color: var(--text);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
      }
      .dv-icon-btn:hover:not([disabled]) {
        background: color-mix(in srgb, var(--primary) 14%, #fff);
        color: color-mix(in srgb, var(--primary) 94%, #000);
      }
      .dv-icon-btn[disabled] {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .dv-zoom-badge {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.02em;
        color: var(--text);
        min-width: 5rem;
        text-align: center;
      }
      .dv-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 14px;
        border-radius: 999px;
        font-weight: 750;
        font-size: 13px;
        border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
        background: linear-gradient(180deg, color-mix(in srgb, var(--panel-solid) 96%, #fff), var(--panel-solid));
        cursor: pointer;
      }
      .dv-pill-btn:hover:not([disabled]) {
        border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
      }
      .dv-pill-btn.dv-pill-muted {
        font-weight: 680;
        background: color-mix(in srgb, var(--panel-solid) 94%, transparent);
      }
      .dv-hint {
        flex: 1 1 220px;
        line-height: 1.35;
      }
      /** Contenedor con barras de desplazamiento nativas (vertical + horizontal). */
      .diagram-scroll {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--panel-solid) 92%, transparent);
        box-shadow: var(--shadow-sm);
        overflow: auto;
        overscroll-behavior: contain;
        max-height: min(78vh, 880px);
        position: relative;
      }
      .diagram-scroll::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 10px 10px, rgba(15, 23, 42, 0.14) 1.2px, transparent 1.3px);
        background-size: 18px 18px;
        opacity: 0.22;
        pointer-events: none;
      }
      /** Tamaño = atributos width/height del SVG (según zoom) para que el scroll use el alto/ancho real del lienzo. */
      .diagram {
        display: block;
        background: transparent;
        touch-action: pan-x pan-y pinch-zoom;
        user-select: none;
      }
      .swimlane-drag-hit {
        fill: transparent;
        stroke: none;
        cursor: grab;
      }
      .swimlane-drag-hit:hover {
        fill: rgba(59, 130, 246, 0.06);
      }
      .swimlane-drag-hit:active {
        cursor: grabbing;
      }
      .swimlane {
        stroke-width: 0;
      }
      .swimlane-title {
        font-size: 13px;
        font-weight: 800;
        paint-order: stroke;
        stroke: rgba(255, 255, 255, 0.85);
        stroke-width: 3px;
      }
      .lane-tabs {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 12px;
      }
      .lane-tab {
        width: 100%;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        background: color-mix(in srgb, var(--laneColor) 22%, #ffffff);
        color: color-mix(in srgb, var(--laneColor) 42%, var(--text));
        font-weight: 850;
        font-size: 13px;
        padding: 10px 12px;
        cursor: default;
        box-shadow: var(--shadow-sm);
        opacity: 1;
      }
      .debug {
        margin-top: 12px;
      }
      .debug-summary {
        cursor: pointer;
        list-style: none;
        color: var(--muted);
        font-weight: 800;
        font-size: 13px;
      }
      .debug-summary::-webkit-details-marker {
        display: none;
      }
      .edge-label {
        font-size: 12px;
        fill: var(--muted);
      }
      .node {
        cursor: grab;
      }
      .node:active {
        cursor: grabbing;
      }
      .node rect,
      .node polygon {
        fill: var(--panel-solid);
        stroke: color-mix(in srgb, var(--text) 70%, transparent);
        stroke-width: 2;
      }
      .node.node-selected rect,
      .node.node-selected polygon {
        stroke: var(--primary);
        box-shadow: none;
      }
      .node.node-decision polygon {
        stroke: #b45309;
      }
      .node.node-activity rect {
        stroke: #1f2937;
      }
      .node.node-fork rect,
      .node.node-join rect {
        stroke: #7c3aed;
      }
      .node-title {
        font-size: 12px;
        font-weight: 600;
        fill: var(--text);
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
      }
      .node-sub {
        font-size: 10px;
        fill: var(--muted);
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
      }
      .node-form-badge {
        font-size: 9px;
        font-weight: 800;
        fill: #047857;
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
      }
      .edge-line {
        filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.35));
      }
      .edge-line.edge-selected {
        stroke: var(--primary) !important;
      }
      .edge-preview {
        pointer-events: none;
      }
      .remote-cursor {
        pointer-events: none;
      }
      .remote-cursor-label {
        font-size: 11px;
        font-weight: 800;
        fill: rgba(15, 23, 42, 0.86);
        paint-order: stroke;
        stroke: rgba(255, 255, 255, 0.92);
        stroke-width: 4px;
        stroke-linejoin: round;
      }
      .collab-on {
        outline: 2px solid rgba(37, 99, 235, 0.55);
        outline-offset: 2px;
      }
      .collab-list {
        margin: 0;
        padding-left: 18px;
        font-size: 13px;
        color: var(--text);
      }
      textarea {
        width: 100%;
        padding: 10px;
        border-radius: 12px;
      }
      .panel-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }
      .btn-lane-add {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 10px;
        font-weight: 800;
        font-size: 13px;
        border: 1px solid color-mix(in srgb, var(--primary) 40%, var(--border));
        background: linear-gradient(180deg, rgba(37, 99, 235, 0.12), rgba(37, 99, 235, 0.04));
        color: color-mix(in srgb, var(--primary) 90%, #000);
        cursor: pointer;
      }
      .btn-lane-add:hover:not([disabled]) {
        box-shadow: var(--shadow-sm);
      }
      .lane-edit-card {
        border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        border-radius: 12px;
        padding: 10px 12px;
        margin-bottom: 10px;
        background: color-mix(in srgb, var(--panel-solid) 95%, transparent);
      }
      .lane-edit-head {
        display: grid;
        grid-template-columns: 14px 1fr 36px;
        align-items: center;
        gap: 10px;
      }
      .lane-name-input {
        padding: 9px 11px;
        border-radius: 10px;
      }
      .btn-lane-remove {
        border: none;
        border-radius: 10px;
        height: 34px;
        width: 34px;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, #ef4444 8%, transparent);
        color: #b91c1c;
        cursor: pointer;
      }
      .lane-metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin-top: 10px;
        font-size: 11px;
        font-weight: 700;
        color: var(--muted);
      }
      .lane-metrics input {
        margin-top: 4px;
        width: 100%;
        padding: 6px 8px;
        border-radius: 8px;
      }
      .lane-edit {
        display: grid;
        grid-template-columns: 14px 1fr;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .lane-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);
      }
      .json {
        margin: 0;
        padding: 10px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: #0b1220;
        color: #e5e7eb;
        overflow: auto;
        font-size: 12px;
        line-height: 1.4;
      }
      .nlp-prev {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .nlp-prev th,
      .nlp-prev td {
        border: 1px solid var(--border);
        padding: 6px 8px;
        vertical-align: top;
      }
      .asst-nlp {
        margin-top: 12px;
      }
      .nlp-details > summary {
        list-style: none;
      }
      .nlp-details > summary::-webkit-details-marker {
        display: none;
      }
      .nlp-summary {
        cursor: pointer;
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px 16px;
        padding: 4px 2px 12px;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      }
      .nlp-summary-title {
        font-weight: 850;
        font-size: 15px;
        letter-spacing: 0.01em;
      }
      .nlp-details-body {
        padding-top: 12px;
      }
      .nlp-toolbar {
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }
      .nlp-prev-wrap {
        overflow: auto;
        margin-top: 10px;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      }
      @media (max-width: 1100px) {
        .editor-shell {
          grid-template-columns: 1fr;
        }
        .lane-tabs {
          grid-template-columns: 1fr 1fr;
        }
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class DiagramEditorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly diagramService = inject(ActivityDiagramService);
  private readonly policyService = inject(PolicyService);
  private readonly dynamicFormService = inject(DynamicFormService);
  private readonly diagramConfigService = inject(DiagramConfigurationService);
  private readonly rolesService = inject(RolesService);
  private readonly usersService = inject(UsersService);
  private readonly aiSuggestionService = inject(AiWorkflowSuggestionService);
  private readonly aiDiagramEditService = inject(AiDiagramEditService);
  private readonly aiDiagramNlpService = inject(AiDiagramNlpService);
  private readonly collabService = inject(DiagramCollabService);
  private readonly realtime = inject(WorkflowRealtimeService);

  /** Contenedor con scroll nativo (barras horizontal/vertical) sobre el lienzo. */
  @ViewChild('diagramScroll') diagramScroll?: ElementRef<HTMLElement>;

  /** Colaboración en tiempo real (WebSocket broadcast). */
  readonly collabEnabled = signal(false);
  readonly collabPeers = signal<Record<string, string>>({});
  readonly collabPeerCursors = signal<
    Record<string, { userName: string; x: number; y: number; ts: string }>
  >({});
  readonly collabClientId = `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  private lastCollabSendMs = 0;
  readonly collabState = signal<{
    connected: boolean;
    ts: string;
    lastType?: string;
    lastPolicyId?: string;
    receivedCount?: number;
    error?: string;
  } | null>(null);
  readonly collabWsUrl = signal<string | null>(null);

  readonly collabPeerEntries = computed(() => {
    const peers = this.collabPeers();
    return Object.entries(peers)
      .filter(([cid]) => cid !== this.collabClientId)
      .map(([, name]) => String(name || 'Colaborador'));
  });

  readonly remoteCursorEntries = computed(() => {
    const now = Date.now();
    const cursors = this.collabPeerCursors();
    return Object.entries(cursors)
      .filter(([cid]) => cid !== this.collabClientId)
      .map(([clientId, c]) => ({ clientId, ...c }))
      .filter((c) => {
        const t = Date.parse(c.ts);
        return Number.isFinite(t) && now - t < 12_000; // mostrar últimos 12s
      });
  });

  readonly fieldTypes: FormFieldType[] = [
    'TEXT',
    'NUMBER',
    'DATE',
    'SELECT',
    'FILE',
    'BOOLEAN',
    'TEXTAREA',
    'LABEL',
    'BUTTON',
    'RADIO',
    'USER'
  ];

  readonly activityForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    fields: this.fb.array<FormGroup>([], { validators: [Validators.minLength(1)] })
  });

  readonly policyId = signal<string | null>(null);
  readonly policyStatus = signal<PolicyStatus | null>(null);
  readonly policyLoaded = signal(false);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly hasPersistedDiagram = signal(false);
  readonly missingDiagramHint = signal(false);
  readonly draftPayload = signal<SaveActivityDiagramPayload | null>(null);
  /** CU4 guardados en servidor (GET /api/policies/:id/forms); fusiona con nodos del lienzo por si falta formId en el JSON). */
  readonly policyFormSummaries = signal<DynamicFormSummary[]>([]);
  readonly validationState = signal<DiagramValidationResponseDto | null>(null);
  readonly roles = signal<Role[]>([]);
  readonly users = signal<User[]>([]);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly selectedActivityNodeId = signal<string | null>(null);
  readonly dynamicFormExists = signal(false);
  readonly loadingForm = signal(false);
  readonly cfgBusy = signal(false);
  readonly formValidation = signal<DiagramValidationResponseDto | null>(null);
  readonly previewOpen = signal(false);
  readonly selectedEdgeId = signal<string | null>(null);
  readonly edgeCondition = signal('');
  readonly configValidation = signal<ConfigurationValidationResponse | null>(null);

  readonly selectedNode = computed(() => {
    const id = this.selectedNodeId();
    const d = this.draftPayload();
    if (!id || !d) return null;
    return d.nodes.find((n) => n.id === id) ?? null;
  });

  readonly selectedEdge = computed(() => {
    const eid = this.selectedEdgeId();
    const d = this.draftPayload();
    if (!eid || !d) return null;
    return d.edges.find((e) => e.id === eid) ?? null;
  });

  // --- Asistente inteligente (innovación) ---
  readonly aiPromptText = signal('');
  readonly aiCreatedBy = signal<string | null>(null);
  readonly aiBusy = signal(false);
  readonly aiSuggestion = signal<WorkflowSuggestionResponse | null>(null);
  readonly aiModalOpen = signal(false);
  readonly aiEditInstruction = signal('');
  readonly nlpAssistText = signal('');
  readonly nlpBusy = signal(false);
  readonly nlpError = signal<string | null>(null);
  readonly nlpPreview = signal<AiDiagramStructuredSuggestResponse | null>(null);

  // --- Identidad (sin login) para colaboración ---
  readonly collabUserId = signal<string>(this.readLocal('wf_collab_userId', ''));
  readonly collabUserNameOverride = signal<string>(this.readLocal('wf_collab_userName', ''));

  // --- Comentarios colaborativos (MVP) ---
  readonly commentsOpen = signal(false);
  readonly commentText = signal('');
  readonly comments = signal<
    {
      id: string;
      userName: string;
      text: string;
      nodeId?: string;
      ts: string;
    }[]
  >([]);

  openComments() {
    this.commentsOpen.set(true);
  }

  closeComments() {
    this.commentsOpen.set(false);
    this.commentText.set('');
  }

  sendComment() {
    const pid = this.policyId();
    if (!pid) return;
    const text = (this.commentText() ?? '').trim();
    if (!text) return;
    const nodeId = this.selectedNodeId() ?? undefined;
    const ts = new Date().toISOString();
    const userName = this.localCollabName();
    const id = `c-${this.collabClientId}-${Date.now()}`;

    // Guardar local
    this.comments.set([{ id, userName, text, nodeId, ts }, ...this.comments()]);
    this.commentText.set('');

    // Broadcast por WS (si está habilitado, lo encola y reconecta si hace falta)
    this.collabService.send({
      type: 'DIAGRAM_COLLAB',
      action: 'comment',
      policyId: pid,
      clientId: this.collabClientId,
      userName,
      text,
      nodeId
    });
  }

  openAiModal() {
    this.aiModalOpen.set(true);
  }

  closeAiModal() {
    this.aiModalOpen.set(false);
  }

  toggleCollab() {
    const pid = this.policyId();
    if (!pid) return;
    if (!this.collabEnabled()) {
      this.collabService.connect();
      this.collabEnabled.set(true);
      this.collabService.send({
        type: 'DIAGRAM_COLLAB',
        action: 'join',
        policyId: pid,
        clientId: this.collabClientId,
        userName: this.localCollabName()
      });
      this.success.set('Colaboración activa: presencia compartida en esta política.');
      setTimeout(() => this.success.set(null), 1600);
      return;
    }
    this.collabService.send({
      type: 'DIAGRAM_COLLAB',
      action: 'leave',
      policyId: pid,
      clientId: this.collabClientId,
      userName: this.localCollabName()
    });
    this.collabEnabled.set(false);
    this.collabPeers.set({});
    this.collabPeerCursors.set({});
    this.collabService.disconnect();
    this.success.set('Colaboración desactivada.');
    setTimeout(() => this.success.set(null), 1200);
  }

  /** Asegura colaboración ON + join para la policy actual (UX examen). */
  private ensureCollabOnForCurrentPolicy() {
    const pid = this.policyId();
    if (!pid) return;
    if (!this.collabEnabled()) {
      this.toggleCollab();
      return;
    }
    // Si ya está ON, re-join por si se reconectó o cambió nombre/usuario
    this.collabService.send({
      type: 'DIAGRAM_COLLAB',
      action: 'join',
      policyId: pid,
      clientId: this.collabClientId,
      userName: this.localCollabName()
    });
  }

  private localCollabName(): string {
    const id = this.collabUserId();
    const u = this.users().find((x) => x.id === id);
    const byId = (u?.fullName ?? '').trim();
    const byOverride = (this.collabUserNameOverride() ?? '').trim();
    return byId || byOverride || 'Usuario';
  }

  setCollabUserId(id: string) {
    const v = (id ?? '').trim();
    this.collabUserId.set(v);
    this.writeLocal('wf_collab_userId', v);
    const u = this.users().find((x) => x.id === v);
    if (u?.fullName) {
      this.collabUserNameOverride.set(u.fullName);
      this.writeLocal('wf_collab_userName', u.fullName);
    }
    if (this.collabEnabled() && this.policyId()) {
      this.collabService.send({
        type: 'DIAGRAM_COLLAB',
        action: 'join',
        policyId: this.policyId()!,
        clientId: this.collabClientId,
        userName: this.localCollabName()
      });
    }
  }

  setCollabUserNameOverride(name: string) {
    const v = (name ?? '').trim();
    this.collabUserNameOverride.set(v);
    this.writeLocal('wf_collab_userName', v);
    if (this.collabEnabled() && this.policyId()) {
      this.collabService.send({
        type: 'DIAGRAM_COLLAB',
        action: 'join',
        policyId: this.policyId()!,
        clientId: this.collabClientId,
        userName: this.localCollabName()
      });
    }
  }

  private readLocal(key: string, fallback: string): string {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  private writeLocal(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }

  private onRemoteCollab(m: DiagramCollabMessage) {
    if (!this.collabEnabled()) return;
    const pid = this.policyId();
    if (!pid || (m as any).policyId !== pid) return;
    if ((m as any).clientId === this.collabClientId) return;

    if (m.type === 'DIAGRAM_COLLAB') {
      const msg = m as DiagramCollabPresenceMessage;
      const name = (msg.userName ?? 'Colaborador').trim() || 'Colaborador';
      const peers = { ...this.collabPeers() };
      if (msg.action === 'leave') {
        delete peers[msg.clientId];
        const cursors = { ...this.collabPeerCursors() };
        delete cursors[msg.clientId];
        this.collabPeerCursors.set(cursors);
      } else if (msg.action === 'join' || msg.action === 'cursor' || msg.action === 'ping') {
        peers[msg.clientId] = name;
        if (msg.action === 'cursor' && typeof (msg as any).x === 'number' && typeof (msg as any).y === 'number') {
          const cursors = { ...this.collabPeerCursors() };
          cursors[msg.clientId] = {
            userName: name,
            x: Number((msg as any).x),
            y: Number((msg as any).y),
            ts: (msg as any).ts ? String((msg as any).ts) : new Date().toISOString()
          };
          this.collabPeerCursors.set(cursors);
        }
      } else if (msg.action === 'comment') {
        const text = (msg as any).text ? String((msg as any).text) : '';
        if (text.trim()) {
          const ts = (msg as any).ts ? String((msg as any).ts) : new Date().toISOString();
          const nodeId = (msg as any).nodeId ? String((msg as any).nodeId) : undefined;
          const id = `rc-${msg.clientId}-${ts}`;
          this.comments.set([{ id, userName: name, text: text.trim(), nodeId, ts }, ...this.comments()]);
          if (!this.commentsOpen()) {
            this.success.set('Nuevo comentario recibido.');
            setTimeout(() => this.success.set(null), 1200);
          }
        }
      }
      this.collabPeers.set(peers);

      // SYNC: si alguien entra (join), le enviamos el estado actual del diagrama.
      if (msg.action === 'join') {
        const d = this.draftPayload();
        if (d) {
          this.collabService.send({
            type: 'DIAGRAM_OP',
            policyId: pid,
            clientId: this.collabClientId,
            userName: this.localCollabName(),
            targetClientId: msg.clientId,
            op: { op: 'SYNC_STATE', diagram: d }
          });
        }
      }
      return;
    }

    if (m.type === 'DIAGRAM_OP') {
      this.applyRemoteOp(m as DiagramCollabOpMessage);
    }
  }

  private readonly pendingRemoteOps: DiagramCollabOpMessage[] = [];

  private applyRemoteOp(m: DiagramCollabOpMessage) {
    // Si el mensaje es dirigido a otro cliente, ignorar.
    const tgt = (m as any).targetClientId ? String((m as any).targetClientId) : '';
    if (tgt && tgt !== this.collabClientId) return;

    const d = this.draftPayload();
    if (!d) {
      // Bufferizar ops hasta que el diagrama esté cargado/aplicado
      this.pendingRemoteOps.push(m);
      return;
    }
    const op = m.op;
    if (!op) return;

    if (op.op === 'SYNC_STATE') {
      const diagram = (op as any).diagram as SaveActivityDiagramPayload | null;
      if (diagram?.nodes) {
        const merged: SaveActivityDiagramPayload = {
          ...diagram,
          createdBy: (diagram.createdBy ?? d.createdBy ?? '').trim() || d.createdBy || '',
          swimlanes: diagram.swimlanes ?? [],
          edges: diagram.edges ?? []
        };
        this.draftPayload.set(merged);
        // aplicar cualquier op pendiente que haya llegado antes del sync
        this.flushPendingRemoteOps();
        return;
      }
      return;
    }

    if (op.op === 'ADD_NODE') {
      const node = op.node as DiagramNode;
      if (!node?.id) return;
      if (d.nodes.some((n) => n.id === node.id)) return;
      this.draftPayload.set({ ...d, nodes: [...d.nodes, node] });
      return;
    }

    if (op.op === 'MOVE_NODE') {
      const { nodeId, x, y } = op;
      const nodes = d.nodes.map((n) => (n.id === nodeId ? { ...n, positionX: x, positionY: y } : n));
      this.draftPayload.set({ ...d, nodes });
      return;
    }

    if (op.op === 'UPDATE_NODE') {
      const { nodeId, patch } = op as any;
      if (!nodeId || !patch) return;
      const nodes = d.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n));
      this.draftPayload.set({ ...d, nodes });
      return;
    }

    if (op.op === 'DELETE_NODE') {
      const { nodeId } = op;
      const nodes = d.nodes.filter((n) => n.id !== nodeId);
      const edges = d.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId);
      this.draftPayload.set({ ...d, nodes, edges });
      return;
    }

    if (op.op === 'ADD_EDGE') {
      const edge = op.edge as DiagramEdge;
      if (!edge?.id) return;
      if (d.edges.some((e) => e.id === edge.id)) return;
      // Solo agregar si existen ambos nodos
      if (!d.nodes.some((n) => n.id === edge.sourceNodeId) || !d.nodes.some((n) => n.id === edge.targetNodeId)) {
        return;
      }
      this.draftPayload.set({ ...d, edges: [...d.edges, edge] });
      return;
    }

    if (op.op === 'UPDATE_EDGE') {
      const { edgeId, patch } = op as any;
      if (!edgeId || !patch) return;
      const edges = d.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e));
      this.draftPayload.set({ ...d, edges });
      return;
    }

    if (op.op === 'DELETE_EDGE') {
      const { edgeId } = op;
      const edges = d.edges.filter((e) => e.id !== edgeId);
      this.draftPayload.set({ ...d, edges });
      return;
    }

    if (op.op === 'UPDATE_SWIMLANE') {
      const ext = op as { swimlaneId?: string; name?: string; patch?: Partial<Swimlane> };
      const swimlaneId = ext.swimlaneId;
      if (!swimlaneId) return;
      const merge: Partial<Swimlane> = { ...(ext.patch ?? {}) };
      if (ext.name != null) merge.name = String(ext.name);
      const swimlanes = d.swimlanes.map((s) => (s.id === swimlaneId ? { ...s, ...merge } : s));
      this.draftPayload.set({ ...d, swimlanes });
      return;
    }

    if (op.op === 'ADD_SWIMLANE') {
      const sl = op.swimlane as Swimlane;
      if (!sl?.id) return;
      if (d.swimlanes.some((s) => s.id === sl.id)) return;
      this.draftPayload.set({ ...d, swimlanes: [...d.swimlanes, sl] });
      return;
    }

    if (op.op === 'DELETE_SWIMLANE') {
      const swimlaneId = (op as { swimlaneId?: string }).swimlaneId;
      if (!swimlaneId) return;
      const swimlanes = d.swimlanes.filter((sx) => sx.id !== swimlaneId);
      const nodes = d.nodes.map((n) =>
        n.swimlaneId === swimlaneId ? { ...n, swimlaneId: undefined } : n
      );
      this.draftPayload.set({ ...d, swimlanes, nodes });
      return;
    }

    if (op.op === 'SET_SWIMLANES') {
      const list = (op as { swimlanes?: Swimlane[] }).swimlanes;
      if (!Array.isArray(list)) return;
      this.draftPayload.set({ ...d, swimlanes: list });
    }
  }

  private flushPendingRemoteOps() {
    if (!this.pendingRemoteOps.length) return;
    const ops = this.pendingRemoteOps.splice(0, this.pendingRemoteOps.length);
    for (const m of ops) {
      // volver a intentar aplicar (ya debería existir draftPayload)
      this.applyRemoteOp(m);
    }
  }

  /**
   * Propaga el diagrama completo a la sala (mismo criterio que SYNC al hacer join).
   * Usar tras reemplazos masivos: ejemplos, IA, NLP, guardar, recarga desde API.
   */
  private broadcastCollabFullDiagramSync(): void {
    if (!this.collabEnabled()) return;
    const pid = this.policyId();
    const raw = this.draftPayload();
    if (!pid || !raw?.nodes) return;
    const diagram: SaveActivityDiagramPayload = {
      ...raw,
      swimlanes: raw.swimlanes ?? [],
      edges: raw.edges ?? []
    };
    this.collabService.send({
      type: 'DIAGRAM_OP',
      policyId: pid,
      clientId: this.collabClientId,
      userName: this.localCollabName(),
      op: { op: 'SYNC_STATE', diagram }
    });
  }

  private sendCollabCursor(x: number, y: number) {
    if (!this.collabEnabled()) return;
    const pid = this.policyId();
    if (!pid) return;
    const now = Date.now();
    if (now - this.lastCollabSendMs < 120) return;
    this.lastCollabSendMs = now;
    this.collabService.send({
      type: 'DIAGRAM_COLLAB',
      action: 'cursor',
      policyId: pid,
      clientId: this.collabClientId,
      userName: this.localCollabName(),
      x,
      y
    });
  }

  private lastCollabMoveMs = 0;
  private lastCollabMoveByNode = new Map<string, { x: number; y: number }>();
  private sendCollabMoveNode(nodeId: string, x: number, y: number) {
    if (!this.collabEnabled()) return;
    const pid = this.policyId();
    if (!pid) return;
    const now = Date.now();
    if (now - this.lastCollabMoveMs < 80) return; // throttle (real-time pero estable)
    this.lastCollabMoveMs = now;
    const prev = this.lastCollabMoveByNode.get(nodeId);
    if (prev && prev.x === x && prev.y === y) return;
    this.lastCollabMoveByNode.set(nodeId, { x, y });
    this.collabService.send({
      type: 'DIAGRAM_OP',
      policyId: pid,
      clientId: this.collabClientId,
      userName: this.localCollabName(),
      op: { op: 'MOVE_NODE', nodeId, x, y }
    });
  }

  private lastCollabSwimMs = 0;
  private lastCollabSwimById = new Map<string, { x: number; y: number }>();
  private sendCollabMoveSwimlane(swimlaneId: string, x: number, y: number) {
    if (!this.collabEnabled()) return;
    const pid = this.policyId();
    if (!pid) return;
    const now = Date.now();
    if (now - this.lastCollabSwimMs < 90) return; // throttle
    this.lastCollabSwimMs = now;
    const prev = this.lastCollabSwimById.get(swimlaneId);
    if (prev && prev.x === x && prev.y === y) return;
    this.lastCollabSwimById.set(swimlaneId, { x, y });
    this.collabService.send({
      type: 'DIAGRAM_OP',
      policyId: pid,
      clientId: this.collabClientId,
      userName: this.localCollabName(),
      op: { op: 'UPDATE_SWIMLANE', swimlaneId, patch: { positionX: x, positionY: y } }
    });
  }

  readonly paletteMode = signal<
    'START' | 'ACTIVITY' | 'SEND' | 'DECISION' | 'FORK' | 'JOIN' | 'END' | 'EDGE' | null
  >(null);
  readonly selectedNodeId = signal<string | null>(null);
  readonly connectFromNodeId = signal<string | null>(null);
  readonly hoverSvgPoint = signal<{ x: number; y: number } | null>(null);

  laneColor(i: number): string {
    const palette = ['#60a5fa', '#fbbf24', '#34d399', '#c4b5fd', '#fca5a5', '#67e8f9'];
    return palette[i % palette.length]!;
  }

  initials(fullName: string): string {
    const parts = String(fullName ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const a = parts[0]?.[0] ?? 'U';
    const b = parts.length > 1 ? parts[parts.length - 1]![0] : '';
    return (a + b).toUpperCase();
  }

  private uid(prefix: string): string {
    const c = (globalThis as any).crypto;
    const base =
      typeof c?.randomUUID === 'function'
        ? c.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${base}`;
  }

  private svgPoint(ev: MouseEvent | PointerEvent, svg?: SVGSVGElement): { x: number; y: number } {
    // Conversión robusta: intenta CTM; si falla usa viewBox+boundingClientRect.
    const resolved =
      svg ??
      ((ev.currentTarget as any) as SVGSVGElement) ??
      (((ev.target as any) as Element | null)?.closest?.('svg') as SVGSVGElement | null) ??
      null;
    if (resolved && typeof (resolved as any).createSVGPoint === 'function') {
      try {
        const pt = resolved.createSVGPoint();
        pt.x = (ev as MouseEvent).clientX;
        pt.y = (ev as MouseEvent).clientY;
        const ctm = resolved.getScreenCTM?.();
        if (ctm) {
          const sp = pt.matrixTransform(ctm.inverse());
          return { x: sp.x, y: sp.y };
        }
      } catch {
        // fallback below
      }
    }

    const vb = resolved?.viewBox?.baseVal;
    if (resolved && vb) {
      const rect = resolved.getBoundingClientRect();
      const scaleX = vb.width / rect.width;
      const scaleY = vb.height / rect.height;
      const x = vb.x + ((ev as MouseEvent).clientX - rect.left) * scaleX;
      const y = vb.y + ((ev as MouseEvent).clientY - rect.top) * scaleY;
      return { x, y };
    }

    const me = ev as any;
    return { x: me?.offsetX ?? 0, y: me?.offsetY ?? 0 };
  }

  /**
   * Calle bajo el punto (coords diagrama). Devuelve null si el punto no cae en ninguna calle.
   */
  private laneIndexContainingPoint(x: number, y: number): number | null {
    const d = this.draftPayload();
    const lanes = d?.swimlanes ?? [];
    if (!lanes.length) return null;
    for (let i = 0; i < lanes.length; i++) {
      const b = this.swimLaneBox(lanes[i]!, i);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
    }
    return null;
  }

  private defaultNodeName(type: DiagramNode['type']): string {
    switch (type) {
      case 'START':
        return 'Inicio';
      case 'END':
        return 'Fin';
      case 'DECISION':
        return '¿Condición?';
      case 'FORK':
        return 'Fork';
      case 'JOIN':
        return 'Join';
      case 'ACTIVITY':
      default:
        return 'Nueva actividad';
    }
  }

  isSendNode(n: DiagramNode): boolean {
    return n.type === 'ACTIVITY' && (n as any)?.metadata?.umlKind === 'SEND';
  }

  sendSignalPoints(n: DiagramNode): string {
    const s = this.nodeSize(n);
    const w = s.w;
    const h = s.h;
    // Forma tipo "etiqueta/flecha" (UML send signal/object) hacia la derecha.
    const tip = Math.max(18, Math.round(w * 0.18));
    const a = `${0},${0}`;
    const b = `${w - tip},${0}`;
    const c = `${w},${Math.round(h / 2)}`;
    const d = `${w - tip},${h}`;
    const e = `${0},${h}`;
    return `${a} ${b} ${c} ${d} ${e}`;
  }

  setSelectedActivityKind(kind: 'NORMAL' | 'SEND') {
    const sn = this.selectedNode();
    if (!sn || sn.type !== 'ACTIVITY') return;
    const baseMeta = ((sn as any).metadata ?? {}) as Record<string, any>;
    const nextMeta =
      kind === 'SEND'
        ? { ...baseMeta, umlKind: 'SEND' }
        : (() => {
            const { umlKind, ...rest } = baseMeta;
            return rest;
          })();
    this.updateSelectedNode({ metadata: Object.keys(nextMeta).length ? (nextMeta as any) : undefined });
  }

  onCanvasClick(evt: MouseEvent, svg: SVGSVGElement) {
    const d = this.draftPayload();
    if (!d) return;
    const mode = this.paletteMode();
    const p = this.svgPoint(evt, svg);

    // Si hay una herramienta seleccionada, se crea el nodo al click.
    if (mode && mode !== 'EDGE') {
      const li = this.laneIndexContainingPoint(p.x, p.y);
      const lane = li != null ? d.swimlanes[li] : undefined;
      const nodeType: DiagramNode['type'] = mode === 'SEND' ? 'ACTIVITY' : mode;
      const node: DiagramNode = {
        id: this.uid('node'),
        type: nodeType,
        name: this.defaultNodeName(nodeType),
        swimlaneId: lane?.id,
        positionX: Math.round(p.x),
        positionY: Math.round(p.y),
        metadata: mode === 'SEND' ? ({ umlKind: 'SEND' } as any) : undefined
      };
      const next: SaveActivityDiagramPayload = {
        ...d,
        nodes: [...d.nodes, node]
      };
      this.draftPayload.set(next);
      this.selectedNodeId.set(node.id);
      this.selectedEdgeId.set(null);
      this.connectFromNodeId.set(null);
      if (this.collabEnabled()) {
        this.collabService.send({
          type: 'DIAGRAM_OP',
          policyId: this.policyId()!,
          clientId: this.collabClientId,
          userName: this.localCollabName(),
          op: { op: 'ADD_NODE', node }
        });
      }
      return;
    }

    // Click en canvas sin herramienta: limpia selección / modo conexión
    this.selectedNodeId.set(null);
    this.selectedEdgeId.set(null);
    this.connectFromNodeId.set(null);
  }

  onNodeClick(evt: MouseEvent, nodeId: string) {
    evt.stopPropagation();
    const d = this.draftPayload();
    if (!d) return;
    this.selectedEdgeId.set(null);

    const tool = this.paletteMode();
    // Si estamos en modo Transición, conectamos por click origen->destino.
    if (tool === 'EDGE') {
      const from = this.connectFromNodeId();
      if (from && from !== nodeId) {
        const type = this.edgeTypeFor(from, nodeId, d);
        const edge: DiagramEdge = {
          id: this.uid('edge'),
          sourceNodeId: from,
          targetNodeId: nodeId,
          type,
          label: ''
        };
        this.draftPayload.set({ ...d, edges: [...d.edges, edge] });
        if (this.collabEnabled()) {
          this.collabService.send({
            type: 'DIAGRAM_OP',
            policyId: this.policyId()!,
            clientId: this.collabClientId,
            userName: this.localCollabName(),
            op: { op: 'ADD_EDGE', edge }
          });
        }
        this.selectedNodeId.set(nodeId);
        this.selectedEdgeId.set(null);
        this.connectFromNodeId.set(null);
        this.success.set('Transición creada');
        setTimeout(() => this.success.set(null), 900);
        return;
      }
      this.selectedNodeId.set(nodeId);
      this.selectedEdgeId.set(null);
      this.connectFromNodeId.set(nodeId);
      this.success.set('Selecciona el nodo destino para crear la flecha');
      setTimeout(() => this.success.set(null), 900);
      return;
    }

    // Con otras herramientas seleccionadas, solo seleccionamos el nodo.
    if (tool) {
      this.selectedNodeId.set(nodeId);
      this.selectedEdgeId.set(null);
      return;
    }

    const from = this.connectFromNodeId();
    if (from && from !== nodeId) {
      const type = this.edgeTypeFor(from, nodeId, d);
      const edge: DiagramEdge = {
        id: this.uid('edge'),
        sourceNodeId: from,
        targetNodeId: nodeId,
        type,
        label: 'Sin etiqueta'
      };
      const next: SaveActivityDiagramPayload = {
        ...d,
        edges: [...d.edges, edge]
      };
      this.draftPayload.set(next);
      if (this.collabEnabled() && this.policyId()) {
        this.collabService.send({
          type: 'DIAGRAM_OP',
          policyId: this.policyId()!,
          clientId: this.collabClientId,
          userName: this.localCollabName(),
          op: { op: 'ADD_EDGE', edge }
        });
      }
      this.selectedNodeId.set(nodeId);
      this.selectedEdgeId.set(null);
      this.connectFromNodeId.set(null);
      this.success.set('Transición creada');
      setTimeout(() => this.success.set(null), 900);
      return;
    }

    // Primer click: marcar origen de conexión
    this.selectedNodeId.set(nodeId);
    this.selectedEdgeId.set(null);
    this.connectFromNodeId.set(nodeId);
    this.success.set('Selecciona el nodo destino para crear transición');
    setTimeout(() => this.success.set(null), 900);
  }

  clearSelection() {
    this.paletteMode.set(null);
    this.selectedNodeId.set(null);
    this.selectedEdgeId.set(null);
    this.connectFromNodeId.set(null);
    this.hoverSvgPoint.set(null);
  }

  onEdgeClick(evt: MouseEvent, edgeId: string) {
    evt.stopPropagation();
    this.selectedEdgeId.set(edgeId);
    this.selectedNodeId.set(null);
    this.connectFromNodeId.set(null);
  }

  updateSelectedNode(patch: Partial<DiagramNode>) {
    const d = this.draftPayload();
    const id = this.selectedNodeId();
    if (!d || !id) return;
    const nodes = d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    this.draftPayload.set({ ...d, nodes });
    if (this.collabEnabled() && this.policyId()) {
      this.collabService.send({
        type: 'DIAGRAM_OP',
        policyId: this.policyId()!,
        clientId: this.collabClientId,
        userName: this.localCollabName(),
        op: { op: 'UPDATE_NODE', nodeId: id, patch }
      });
    }
  }

  updateSelectedEdge(patch: Partial<DiagramEdge>) {
    const d = this.draftPayload();
    const eid = this.selectedEdgeId();
    if (!d || !eid) return;
    const edges = d.edges.map((e) => (e.id === eid ? { ...e, ...patch } : e));
    this.draftPayload.set({ ...d, edges });
    if (this.collabEnabled() && this.policyId()) {
      this.collabService.send({
        type: 'DIAGRAM_OP',
        policyId: this.policyId()!,
        clientId: this.collabClientId,
        userName: this.localCollabName(),
        op: { op: 'UPDATE_EDGE', edgeId: eid, patch }
      });
    }
  }

  deleteSelected() {
    const d = this.draftPayload();
    if (!d) return;

    const nodeId = this.selectedNodeId();
    const edgeId = this.selectedEdgeId();

    // 1) Si hay transición seleccionada, se elimina solo esa transición.
    if (edgeId) {
      const edges = d.edges.filter((e) => e.id !== edgeId);
      this.draftPayload.set({ ...d, edges });
      if (this.collabEnabled() && this.policyId()) {
        this.collabService.send({
          type: 'DIAGRAM_OP',
          policyId: this.policyId()!,
          clientId: this.collabClientId,
          userName: this.localCollabName(),
          op: { op: 'DELETE_EDGE', edgeId }
        });
      }
      this.clearSelection();
      this.success.set('Transición eliminada');
      setTimeout(() => this.success.set(null), 900);
      return;
    }

    // 2) Si hay nodo seleccionado, se elimina el nodo y sus transiciones asociadas.
    if (!nodeId) return;
    const nodes = d.nodes.filter((n) => n.id !== nodeId);
    const edges = d.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId);
    this.draftPayload.set({ ...d, nodes, edges });
    if (this.collabEnabled() && this.policyId()) {
      this.collabService.send({
        type: 'DIAGRAM_OP',
        policyId: this.policyId()!,
        clientId: this.collabClientId,
        userName: this.localCollabName(),
        op: { op: 'DELETE_NODE', nodeId }
      });
    }
    this.clearSelection();
    this.success.set('Elemento eliminado');
    setTimeout(() => this.success.set(null), 900);
  }

  /** Movimiento sobre el lienzo SVG: arrastres, preview de arista y cursor colaborativo. */
  onDiagramSvgPointerMove(ev: PointerEvent, svg: SVGSVGElement) {
    if (this.draggingSwimlaneId()) {
      this.applySwimlaneDrag(ev, svg);
      return;
    }
    const dragId = this.draggingNodeId();
    if (dragId && this.draftPayload()) {
      const p = this.svgPoint(ev, svg);
      const d = this.draftPayload();
      const n = d!.nodes.find((x) => x.id === dragId);
      if (n) {
        const nx = Math.round(p.x + this.dragOffset.dx);
        const ny = Math.round(p.y + this.dragOffset.dy);
        const nodes = d!.nodes.map((node) =>
          node.id === dragId ? { ...node, positionX: nx, positionY: ny } : node
        );
        this.draftPayload.set({ ...d!, nodes });
        // Real-time: enviar movimiento durante el drag (no esperar a pointerup)
        if (this.collabEnabled()) {
          this.sendCollabMoveNode(dragId, nx, ny);
        }
      }
    }

    if (this.paletteMode() === 'EDGE') {
      this.hoverSvgPoint.set(this.svgPoint(ev, svg));
    }

    if (this.collabEnabled()) {
      const p = this.svgPoint(ev, svg);
      this.sendCollabCursor(Math.round(p.x), Math.round(p.y));
    }
  }

  setPalette(mode: 'START' | 'ACTIVITY' | 'SEND' | 'DECISION' | 'FORK' | 'JOIN' | 'END' | 'EDGE') {
    this.paletteMode.set(mode);
    this.success.set(`Elemento seleccionado: ${mode}`);
    setTimeout(() => this.success.set(null), 900);
  }

  readonly aiPayloadJson = computed(() => {
    const p = this.aiSuggestion()?.activityDiagramPayload;
    if (!p) return '';
    try {
      return JSON.stringify(p, null, 2);
    } catch {
      return String(p);
    }
  });

  // Voz (Web Speech API)
  private speechRecognition: any | null = null;
  readonly voiceNotSupported = signal(false);
  readonly voiceRecording = signal(false);

  readonly groupedNodes = computed(() => {
    const d = this.draftPayload();
    if (!d?.nodes?.length) return [] as { type: DiagramNode['type']; nodes: DiagramNode[] }[];
    const order: DiagramNode['type'][] = ['START', 'ACTIVITY', 'DECISION', 'FORK', 'JOIN', 'END'];
    return order
      .map((type) => ({ type, nodes: d.nodes.filter((n) => n.type === type) }))
      .filter((g) => g.nodes.length > 0);
  });

  readonly transitionLines = computed(() => {
    const d = this.draftPayload();
    if (!d?.edges?.length) return [];
    const byId = new Map(d.nodes.map((n) => [n.id, n]));
    return d.edges.map((e) => {
      const a = byId.get(e.sourceNodeId);
      const b = byId.get(e.targetNodeId);
      const an = a ? `${a.type}${a.name ? ' «' + a.name + '»' : ''} (${a.id})` : e.sourceNodeId;
      const bn = b ? `${b.type}${b.name ? ' «' + b.name + '»' : ''} (${b.id})` : e.targetNodeId;
      const cond = this.edgeConditionLabel(e.condition);
      const lbl =
        e.label != null && String(e.label).trim() !== '' ? String(e.label).trim() : 'Sin etiqueta';
      const typ = e.type ?? 'NORMAL';
      return `${e.id} [${typ}] ${an} → ${bn} | etiqueta: ${lbl} | condición: ${cond}`;
    });
  });

  // --- Vista gráfica (drag & drop básico) ---
  readonly draggingNodeId = signal<string | null>(null);
  private dragOffset = { dx: 0, dy: 0 };

  readonly draggingSwimlaneId = signal<string | null>(null);
  /** Origen local del último drag de calle (coords diagrama SVG). */
  private swimlaneDragBase: {
    downX: number;
    downY: number;
    origX: number;
    origY: number;
  } | null = null;

  // UML Activity Partitions (swimlanes): por defecto se muestran como columnas (verticales),
  // que es el estilo más común para roles/áreas en exámenes y documentación.
  private readonly defLaneX = -80;
  private readonly defLaneW = 380;
  private readonly defLaneH = 760;

  /**
   * Caja calculada para cada swimlane en el lienzo (posición y tamaño editables por panel o drag).
   */
  swimLaneBox(
    s: Swimlane,
    index: number
  ): { x: number; y: number; w: number; h: number; header: number } {
    const w = Math.max(320, s.width ?? this.defLaneW);
    const h = Math.max(96, s.height ?? this.defLaneH);
    const header = Math.min(48, Math.max(22, Math.round(h * 0.2)));
    const x =
      s.positionX != null
        ? Number(s.positionX)
        : this.defLaneX + index * (w + 16); // columnas (verticales) por defecto
    const y = s.positionY != null ? Number(s.positionY) : 20;
    return { x, y, w, h, header };
  }

  swimLaneTitleDy(_s: Swimlane, index: number): number {
    return Math.round(this.swimLaneBox(_s, index).header * 0.56);
  }

  /** Zoom del lienzo (el paneo usa las barras de desplazamiento nativas de `.diagram-scroll`). */
  readonly userDiagramViewDirty = signal(false);
  /** 1 = 100%. Agranda/reduce el tamaño en píxeles del SVG manteniendo el mismo sistema de coords. */
  readonly zoomScale = signal(1);

  readonly diagramSvgLayout = computed(() => {
    const b = this.computeContentBounds();
    const z = Math.max(0.22, Math.min(4.2, this.zoomScale()));
    return {
      viewBoxStr: `${Math.round(b.x)} ${Math.round(b.y)} ${Math.round(b.w)} ${Math.round(b.h)}`,
      widthPx: Math.max(1, Math.round(b.w * z)),
      heightPx: Math.max(1, Math.round(b.h * z))
    };
  });

  private computeContentBounds(): { x: number; y: number; w: number; h: number } {
    let minX = 0;
    let minY = 0;
    let maxX = 1200;
    let maxY = 520;

    const d = this.draftPayload();
    if (d?.swimlanes?.length) {
      d.swimlanes.forEach((s, i) => {
        const b = this.swimLaneBox(s, i);
        minX = Math.min(minX, b.x - 120);
        minY = Math.min(minY, b.y - 40);
        maxX = Math.max(maxX, b.x + b.w + 120);
        maxY = Math.max(maxY, b.y + b.h + 100);
      });
    }

    if (d?.nodes?.length) {
      for (const n of d.nodes) {
        const nx = n.positionX ?? 0;
        const ny = n.positionY ?? 0;
        minX = Math.min(minX, nx - 220);
        minY = Math.min(minY, ny - 180);
        maxX = Math.max(maxX, nx + 340);
        maxY = Math.max(maxY, ny + 260);
      }
    }

    minY = Math.min(minY, -40);
    return {
      x: minX,
      y: minY,
      w: Math.max(800, maxX - minX),
      h: Math.max(520, maxY - minY)
    };
  }

  fitToContent() {
    this.zoomScale.set(1);
    this.userDiagramViewDirty.set(false);
    queueMicrotask(() => {
      const el = this.diagramScroll?.nativeElement;
      if (!el) return;
      const maxL = Math.max(0, el.scrollWidth - el.clientWidth);
      const maxT = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollLeft = maxL / 2;
      el.scrollTop = maxT / 2;
    });
  }

  /** factor &gt; 1 acerca (imagen más grande), &lt; 1 aleja. */
  zoomDiagram(factor: number) {
    this.zoomScale.update((z) => Math.max(0.22, Math.min(4.2, z * factor)));
    this.userDiagramViewDirty.set(true);
  }

  resetDiagramView() {
    this.zoomScale.set(1);
    this.userDiagramViewDirty.set(true);
    queueMicrotask(() => {
      const el = this.diagramScroll?.nativeElement;
      if (el) {
        el.scrollLeft = 0;
        el.scrollTop = 0;
      }
    });
  }

  onWheel(ev: WheelEvent, svg: SVGSVGElement) {
    if (ev.ctrlKey || ev.metaKey) {
      ev.preventDefault();
      const dir = ev.deltaY < 0 ? 1.06 : 0.94;
      this.zoomDiagram(dir);
      return;
    }
    // Sin Ctrl: la rueda puede desplazar el contenedor con barras nativas (evitar capturar el scroll).
  }

  addSwimlane() {
    const d = this.draftPayload();
    if (!d) return;
    const rt: ResponsibleType = this.roles().length ? 'ROLE' : 'USER';
    const rid = this.roles()[0]?.id ?? this.users()[0]?.id;
    if (!rid) {
      this.error.set('Necesitas al menos un rol o usuario para asignar la calle.');
      return;
    }
    const n = d.swimlanes.length;
    const last = d.swimlanes[n - 1];
    const positionY = 20;
    let positionX = this.defLaneX;
    if (last) {
      const lb = this.swimLaneBox(last, n - 1);
      positionX = lb.x + lb.w + 16;
    }
    const sl: Swimlane = {
      id: this.uid('lane'),
      name: `Calle ${n + 1}`,
      responsibleType: rt,
      responsibleId: rid,
      positionX,
      positionY,
      width: this.defLaneW,
      height: this.defLaneH
    };
    this.draftPayload.set({ ...d, swimlanes: [...d.swimlanes, sl] });
    if (this.collabEnabled() && this.policyId()) {
      this.collabService.send({
        type: 'DIAGRAM_OP',
        policyId: this.policyId()!,
        clientId: this.collabClientId,
        userName: this.localCollabName(),
        op: { op: 'ADD_SWIMLANE', swimlane: sl }
      });
    }
    this.success.set('Calle añadida: arrastra su barra superior en el lienzo o ajusta posición aquí.');
    setTimeout(() => this.success.set(null), 1500);
  }

  /** Reacomoda calles existentes a columnas verticales (UML típico). */
  reflowSwimlanesToUmlColumns() {
    const d = this.draftPayload();
    if (!d || !d.swimlanes?.length) return;
    const lanes = d.swimlanes.map((s, i) => {
      const w = Math.max(320, s.width ?? this.defLaneW);
      const x = this.defLaneX + i * (w + 16);
      return {
        ...s,
        positionX: x,
        positionY: 20,
        width: s.width ?? this.defLaneW,
        height: s.height ?? this.defLaneH
      } as Swimlane;
    });
    this.draftPayload.set({ ...d, swimlanes: lanes });
    if (this.collabEnabled() && this.policyId()) {
      this.collabService.send({
        type: 'DIAGRAM_OP',
        policyId: this.policyId()!,
        clientId: this.collabClientId,
        userName: this.localCollabName(),
        op: { op: 'SET_SWIMLANES', swimlanes: lanes }
      });
    }
    this.success.set('Calles reordenadas a columnas (UML).');
    setTimeout(() => this.success.set(null), 1500);
    queueMicrotask(() => this.fitToContent());
  }

  swimlaneNumeric(v: number | undefined): number | '' {
    if (v == null || Number.isNaN(Number(v))) return '';
    return Number(v);
  }

  onSwimlaneNumberInput(
    swimlaneId: string,
    key: 'positionX' | 'positionY' | 'width' | 'height',
    raw: string
  ): void {
    const v = parseFloat(String(raw).trim().replace(',', '.'));
    if (!Number.isFinite(v)) return;
    const rounded = Math.round(v);
    if (key === 'width') {
      this.updateSwimlane(swimlaneId, { width: Math.max(280, rounded) });
      return;
    }
    if (key === 'height') {
      this.updateSwimlane(swimlaneId, { height: Math.max(96, rounded) });
      return;
    }
    const partial =
      key === 'positionX' ? { positionX: rounded } : key === 'positionY' ? { positionY: rounded } : {};
    if (Object.keys(partial).length) {
      this.updateSwimlane(swimlaneId, partial as Partial<Swimlane>);
    }
  }

  updateSwimlane(swimlaneId: string, patch: Partial<Swimlane>, skipCollab = false) {
    const d = this.draftPayload();
    if (!d) return;
    const swimlanes = d.swimlanes.map((sx) => (sx.id === swimlaneId ? { ...sx, ...patch } : sx));
    this.draftPayload.set({ ...d, swimlanes });
    if (!skipCollab && this.collabEnabled() && this.policyId()) {
      this.collabService.send({
        type: 'DIAGRAM_OP',
        policyId: this.policyId()!,
        clientId: this.collabClientId,
        userName: this.localCollabName(),
        op: {
          op: 'UPDATE_SWIMLANE',
          swimlaneId,
          patch: patch as Record<string, unknown>
        }
      });
    }
  }

  removeSwimlane(swimlaneId: string) {
    const d = this.draftPayload();
    if (!d) return;
    const swimlanes = d.swimlanes.filter((sx) => sx.id !== swimlaneId);
    const nodes = d.nodes.map((n) =>
      n.swimlaneId === swimlaneId ? { ...n, swimlaneId: undefined } : n
    );
    this.draftPayload.set({ ...d, swimlanes, nodes });
    if (this.collabEnabled() && this.policyId()) {
      this.collabService.send({
        type: 'DIAGRAM_OP',
        policyId: this.policyId()!,
        clientId: this.collabClientId,
        userName: this.localCollabName(),
        op: { op: 'DELETE_SWIMLANE', swimlaneId }
      });
    }
    this.success.set('Calle eliminada.');
    setTimeout(() => this.success.set(null), 1200);
  }

  nodeSize(n: DiagramNode): { w: number; h: number } {
    // UML: nodos inicial/final son circulares
    if (n.type === 'START' || n.type === 'END') return { w: 56, h: 56 };
    if (n.type === 'DECISION') return { w: 150, h: 90 };
    if (n.type === 'FORK' || n.type === 'JOIN') return { w: 180, h: 16 };
    return { w: 180, h: 70 };
  }

  nodeTopLeft(n: DiagramNode): { x: number; y: number } {
    const { w, h } = this.nodeSize(n);
    const cx = n.positionX ?? 0;
    const cy = n.positionY ?? 0;
    return { x: cx - w / 2, y: cy - h / 2 };
  }


  nodeCenter(nodeId: string): { x: number; y: number } {
    const n = this.draftPayload()?.nodes.find((x) => x.id === nodeId);
    return { x: n?.positionX ?? 0, y: n?.positionY ?? 0 };
  }

  /** Segmento de arista recortado para que la flecha sea visible (no queda bajo el relleno del nodo). */
  edgeEndpoints(e: DiagramEdge): { x1: number; y1: number; x2: number; y2: number } | null {
    const d = this.draftPayload();
    if (!d) return null;
    const a = d.nodes.find((n) => n.id === e.sourceNodeId);
    const b = d.nodes.find((n) => n.id === e.targetNodeId);
    if (!a || !b) return null;
    const ax = a.positionX ?? 0;
    const ay = a.positionY ?? 0;
    const bx = b.positionX ?? 0;
    const by = b.positionY ?? 0;
    let dx = bx - ax;
    let dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return { x1: ax, y1: ay, x2: bx, y2: by };
    dx /= len;
    dy /= len;
    const p1 = this.outlineExit(ax, ay, dx, dy, a);
    const p2 = this.outlineExit(bx, by, -dx, -dy, b);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }

  private outlineExit(cx: number, cy: number, ux: number, uy: number, n: DiagramNode): { x: number; y: number } {
    if (n.type === 'START' || n.type === 'END') {
      const { w, h } = this.nodeSize(n);
      const r = Math.max(10, Math.min(w, h) / 2 + 6);
      return { x: cx + ux * r, y: cy + uy * r };
    }
    if (n.type === 'DECISION') {
      const { w, h } = this.nodeSize(n);
      const r = Math.max(10, Math.min(w, h) / 2 - 8);
      return { x: cx + ux * r, y: cy + uy * r };
    }
    const { w, h } = this.nodeSize(n);
    const hw = w / 2 + 10;
    const hh = h / 2 + 10;
    const t = this.rayToAabbExitT(ux, uy, hw, hh);
    return { x: cx + ux * t, y: cy + uy * t };
  }

  private rayToAabbExitT(ux: number, uy: number, hw: number, hh: number): number {
    const eps = 1e-9;
    let t = Number.POSITIVE_INFINITY;
    if (ux > eps) t = Math.min(t, hw / ux);
    if (ux < -eps) t = Math.min(t, (-hw) / ux);
    if (uy > eps) t = Math.min(t, hh / uy);
    if (uy < -eps) t = Math.min(t, (-hh) / uy);
    if (!Number.isFinite(t) || t <= 0) return Math.min(hw, hh) * 0.55;
    return t;
  }

  private edgeTypeFor(fromId: string, toId: string, d: SaveActivityDiagramPayload): DiagramEdge['type'] {
    const from = d.nodes.find((n) => n.id === fromId);
    const to = d.nodes.find((n) => n.id === toId);
    if (from?.type === 'FORK') return 'PARALLEL';
    if (to?.type === 'JOIN') return 'PARALLEL';
    // En UML, las salidas desde una DECISION suelen ser transiciones condicionales.
    if (from?.type === 'DECISION') return 'ALTERNATIVE';
    return 'NORMAL';
  }

  decisionPoints(n: DiagramNode): string {
    const { w, h } = this.nodeSize(n);
    // rombo dentro de su bbox (0..w, 0..h)
    const cx = w / 2;
    const cy = h / 2;
    return `${cx},0 ${w},${cy} ${cx},${h} 0,${cy}`;
  }

  edgeTextLabel(e: DiagramEdge): string {
    const label = e.label != null ? String(e.label).trim() : '';
    const cond = e.condition != null ? String(e.condition).trim() : '';
    if (!label && !cond) return '';
    if (label && cond) return `${label} · ${cond}`;
    return label || cond;
  }

  /** Etiqueta de transición desplazada respecto al segmento para reducir solapamientos. */
  edgeLabelPos(seg: { x1: number; y1: number; x2: number; y2: number }): { x: number; y: number } {
    let dx = seg.x2 - seg.x1;
    let dy = seg.y2 - seg.y1;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = -dy;
    const ny = dx;
    const mx = (seg.x1 + seg.x2) / 2;
    const my = (seg.y1 + seg.y2) / 2;
    return { x: mx + nx * 14, y: my + ny * 14 - 6 };
  }

  onPointerDown(ev: PointerEvent, nodeId: string, svg: SVGSVGElement) {
    ev.stopPropagation();
    const d = this.draftPayload();
    if (!d) return;
    const n = d.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    // Asegura que el panel de propiedades se muestre siempre al tocar el nodo,
    // incluso si el navegador no dispara el evento "click" por pointer capture.
    this.selectedNodeId.set(nodeId);
    this.selectedEdgeId.set(null);
    // En modo Transición (EDGE) no iniciamos drag: el tap/click debe seleccionar origen/destino.
    if (this.paletteMode() === 'EDGE') {
      ev.preventDefault();
      this.handleEdgeToolNodeTap(nodeId, d);
      return;
    }
    this.connectFromNodeId.set(null);
    this.draggingSwimlaneId.set(null);
    this.swimlaneDragBase = null;
    this.draggingNodeId.set(nodeId);
    const cx = n.positionX ?? 0;
    const cy = n.positionY ?? 0;
    const p = this.svgPoint(ev, svg);
    this.dragOffset = { dx: cx - p.x, dy: cy - p.y };
  }

  private handleEdgeToolNodeTap(nodeId: string, d: SaveActivityDiagramPayload) {
    const from = this.connectFromNodeId();
    if (from && from !== nodeId) {
      const type = this.edgeTypeFor(from, nodeId, d);
      const edge: DiagramEdge = {
        id: this.uid('edge'),
        sourceNodeId: from,
        targetNodeId: nodeId,
        type,
        label: ''
      };
      this.draftPayload.set({ ...d, edges: [...d.edges, edge] });
      if (this.collabEnabled()) {
        this.collabService.send({
          type: 'DIAGRAM_OP',
          policyId: this.policyId()!,
          clientId: this.collabClientId,
          userName: this.localCollabName(),
          op: { op: 'ADD_EDGE', edge }
        });
      }
      this.connectFromNodeId.set(null);
      this.success.set('Transición creada');
      setTimeout(() => this.success.set(null), 900);
      return;
    }

    this.connectFromNodeId.set(nodeId);
    this.success.set('Selecciona el nodo destino para crear la flecha');
    setTimeout(() => this.success.set(null), 900);
  }

  onSwimlaneHeaderPointerDown(ev: PointerEvent, laneId: string, index: number, svg: SVGSVGElement) {
    ev.stopPropagation();
    ev.preventDefault();
    if (this.busy() || this.loading()) return;
    const d = this.draftPayload();
    if (!d) return;
    const lane = d.swimlanes.find((s) => s.id === laneId);
    if (!lane) return;
    this.draggingNodeId.set(null);
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    const box = this.swimLaneBox(lane, index);
    const p = this.svgPoint(ev, svg);
    this.draggingSwimlaneId.set(laneId);
    this.swimlaneDragBase = { downX: p.x, downY: p.y, origX: box.x, origY: box.y };
  }

  private applySwimlaneDrag(ev: PointerEvent, svg: SVGSVGElement) {
    const id = this.draggingSwimlaneId();
    const base = this.swimlaneDragBase;
    const d = this.draftPayload();
    if (!id || !base || !d) return;
    const p = this.svgPoint(ev, svg);
    const nx = Math.round(base.origX + (p.x - base.downX));
    const ny = Math.round(base.origY + (p.y - base.downY));
    const swimlanes = d.swimlanes.map((s) =>
      s.id === id ? { ...s, positionX: nx, positionY: ny } : s
    );
    this.draftPayload.set({ ...d, swimlanes });
    // Real-time: mientras arrastras la calle, sincronizar en vivo.
    if (this.collabEnabled()) {
      this.sendCollabMoveSwimlane(id, nx, ny);
    }
  }

  onPointerUp() {
    const swimId = this.draggingSwimlaneId();
    if (swimId && this.swimlaneDragBase) {
      const cur = this.draftPayload()?.swimlanes.find((s) => s.id === swimId);
      if (cur && this.policyId() && this.collabEnabled()) {
        this.collabService.send({
          type: 'DIAGRAM_OP',
          policyId: this.policyId()!,
          clientId: this.collabClientId,
          userName: this.localCollabName(),
          op: {
            op: 'UPDATE_SWIMLANE',
            swimlaneId: swimId,
            patch: {
              positionX: cur.positionX,
              positionY: cur.positionY,
              width: cur.width,
              height: cur.height
            }
          }
        });
      }
      this.draggingSwimlaneId.set(null);
      this.swimlaneDragBase = null;
    }

    const id = this.draggingNodeId();
    const d = this.draftPayload();
    if (id && d) {
      const n = d.nodes.find((x) => x.id === id);
      if (n && d.swimlanes?.length) {
        const li = this.laneIndexContainingPoint(n.positionX ?? 0, n.positionY ?? 0);
        const lane = li != null ? d.swimlanes[li] : undefined;
        const nextSl = lane?.id;
        const curSl = n.swimlaneId;
        if ((curSl ?? '') !== (nextSl ?? '')) {
          const nodes = d.nodes.map((x) =>
            x.id === id ? { ...x, swimlaneId: nextSl } : x
          );
          this.draftPayload.set({ ...d, nodes });
          if (this.collabEnabled() && this.policyId()) {
            this.collabService.send({
              type: 'DIAGRAM_OP',
              policyId: this.policyId()!,
              clientId: this.collabClientId,
              userName: this.localCollabName(),
              op: { op: 'UPDATE_NODE', nodeId: id, patch: { swimlaneId: nextSl } }
            });
          }
        }
      }
    }
    if (id && this.collabEnabled()) {
      const cur = this.draftPayload()?.nodes.find((x) => x.id === id);
      if (cur && this.policyId()) {
        this.collabService.send({
          type: 'DIAGRAM_OP',
          policyId: this.policyId()!,
          clientId: this.collabClientId,
          userName: this.localCollabName(),
          op: {
            op: 'MOVE_NODE',
            nodeId: id,
            x: cur.positionX ?? 0,
            y: cur.positionY ?? 0
          }
        });
      }
    }
    this.draggingNodeId.set(null);
  }

  readonly activityNodes = computed(() =>
    (this.draftPayload()?.nodes ?? []).filter((n) => n.type === 'ACTIVITY')
  );

  /** Vista de conjunto: actividad ↔ calle ↔ responsable ↔ CU4 (diagrama + inventario en servidor). */
  readonly activityFormRegistryRows = computed(() => {
    const d = this.draftPayload();
    const byNode = new Map((this.policyFormSummaries() ?? []).map((x) => [x.activityNodeId, x]));
    if (!d?.nodes?.length) {
      return [] as Array<{
        nodeId: string;
        activityName: string;
        hasForm: boolean;
        formId?: string;
        formTitle?: string;
        laneLabel: string;
        assigneeLabel: string;
      }>;
    }
    const lanesById = new Map((d.swimlanes ?? []).map((s) => [s.id, s]));
    const users = this.users();
    const roles = this.roles();
    return (d.nodes ?? [])
      .filter((n) => n.type === 'ACTIVITY')
      .map((n) => {
        const sl = n.swimlaneId ? lanesById.get(n.swimlaneId) : undefined;
        const laneLabel = sl?.name?.trim() ? sl.name : '(sin calle)';
        let assigneeLabel = 'Sin calle: defina swimlane y responsable';
        if (sl) {
          const rt = sl.responsibleType as ResponsibleType;
          if (rt === 'USER') {
            const u = users.find((x) => x.id === sl.responsibleId);
            assigneeLabel = u
              ? `Funcionario / usuario: ${u.fullName}`
              : `Usuario ID: ${sl.responsibleId}`;
          } else if (rt === 'ROLE') {
            const r = roles.find((x) => x.id === sl.responsibleId);
            assigneeLabel = r ? `Por rol: ${r.name}` : `Rol ID: ${sl.responsibleId}`;
          } else {
            assigneeLabel = `Por departamento ID: ${sl.responsibleId}`;
          }
        }
        const fromServer = byNode.get(n.id);
        const fid = String(n.formId ?? '').trim() || (fromServer?.id ? String(fromServer.id).trim() : '');
        const formTitle = (fromServer?.name ?? '').trim() || undefined;
        return {
          nodeId: n.id,
          activityName: String((n.name ?? '').trim() || n.id),
          hasForm: !!fid,
          formId: fid || undefined,
          formTitle,
          laneLabel,
          assigneeLabel
        };
      })
      .sort((a, b) => a.activityName.localeCompare(b.activityName, 'es'));
  });

  /** Formularios en BD cuyo activityNodeId no coincide con ninguna actividad actual del lienzo. */
  readonly orphanPolicyForms = computed(() => {
    const d = this.draftPayload();
    const ids = new Set((d?.nodes ?? []).filter((n) => n.type === 'ACTIVITY').map((n) => n.id));
    return (this.policyFormSummaries() ?? []).filter((f) => f.activityNodeId && !ids.has(f.activityNodeId));
  });

  readonly draftEdges = computed(() => this.draftPayload()?.edges ?? []);

  readonly canConfigureCu4 = computed(
    () => this.policyStatus() === 'DRAFT' && this.hasPersistedDiagram() && !!this.draftPayload()
  );

  get fields(): FormArray<FormGroup> {
    return this.activityForm.get('fields') as FormArray<FormGroup>;
  }

  constructor() {
    // Auto-join (UX examen): si el link trae ?collab=1, activa colaboración de una.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      const wants = q.get('collab');
      const who = (q.get('who') ?? '').trim();
      if (who) {
        // nombre “amigable” para el colaborativo, sin depender de login
        this.collabUserNameOverride.set(who.slice(0, 24));
        this.writeLocal('wf_collab_userName', who.slice(0, 24));
      }
      if (wants === '1' || wants === 'true') {
        // Se conecta cuando ya exista policyId.
        queueMicrotask(() => {
          const pid = this.policyId();
          if (pid && !this.collabEnabled()) {
            this.toggleCollab();
          }
        });
      }
    });

    this.route.paramMap
      .pipe(
        map((pm) => pm.get('policyId')),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe((id) => {
        const previousId = this.policyId();
        if (this.collabEnabled() && previousId && id !== previousId) {
          this.collabService.send({
            type: 'DIAGRAM_COLLAB',
            action: 'leave',
            policyId: previousId,
            clientId: this.collabClientId,
            userName: this.localCollabName()
          });
        }
        if (this.collabEnabled() && previousId !== id) {
          this.collabEnabled.set(false);
          this.collabPeers.set({});
          this.collabService.disconnect();
        }
        this.policyId.set(id);
        this.clearMessages();
        this.validationState.set(null);
        this.configValidation.set(null);
        this.clearSelection();
        this.selectedActivityNodeId.set(null);
        this.selectedEdgeId.set(null);
        this.edgeCondition.set('');
        this.dynamicFormExists.set(false);
        this.resetActivityForm();
        this.aiSuggestion.set(null);
        this.aiPromptText.set('');
        this.aiCreatedBy.set(null);
        this.stopVoice();
        if (!id) {
          this.resetData();
          return;
        }
        this.loadForPolicy(id);
        // Colaboración siempre activa en el editor (evita “no se refleja” por no activar).
        queueMicrotask(() => this.ensureCollabOnForCurrentPolicy());
      });

    this.collabService.messages$.pipe(takeUntilDestroyed()).subscribe((m) => this.onRemoteCollab(m));
    this.collabService.state$.pipe(takeUntilDestroyed()).subscribe((s) => this.collabState.set(s));
    // Guardar URL (para debug visible en UI)
    try {
      const url = (this.collabService as any)?.computeWsUrl?.();
      if (typeof url === 'string') this.collabWsUrl.set(url);
    } catch {
      // ignore
    }
    this.realtime.connect();
    this.realtime.events$.pipe(takeUntilDestroyed()).subscribe((ev) => {
      if (ev?.type !== 'DIAGRAM_SAVED') return;
      const pid = this.policyId();
      const payloadPid = String((ev.payload as any)?.policyId ?? '');
      if (pid && payloadPid === pid) {
        // Realtime multiusuario: refrescar diagrama al guardar desde otro cliente.
        this.refreshDiagram(pid);
      }
    });

    fromEvent<KeyboardEvent>(window, 'keydown')
      .pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e.key === 'Escape') {
          this.clearSelection();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.selectedNodeId()) {
            e.preventDefault();
            this.deleteSelected();
          }
        }
      });
  }

  async copyShareLink() {
    const pid = this.policyId();
    if (!pid) return;
    const url = new URL(window.location.href);
    url.pathname = `/policies/${pid}/diagram`;
    url.searchParams.set('collab', '1');
    // opcional: preseleccionar nombre/usuario colaborativo si viene seteado
    const name = (this.localCollabName() ?? '').trim();
    if (name) url.searchParams.set('who', name.slice(0, 24));
    try {
      await navigator.clipboard.writeText(url.toString());
      this.success.set('Link copiado. Pásalo a tu compañero para co-editar en tiempo real.');
      setTimeout(() => this.success.set(null), 2000);
    } catch {
      // fallback: mostrar en pantalla para copiar manual
      this.success.set(`Copia este link: ${url.toString()}`);
      setTimeout(() => this.success.set(null), 5000);
    }
  }

  onActivitySelect(nodeId: string) {
    this.clearMessages();
    this.configValidation.set(null);
    if (!nodeId) {
      this.selectedActivityNodeId.set(null);
      this.dynamicFormExists.set(false);
      this.resetActivityForm();
      return;
    }
    this.selectedActivityNodeId.set(nodeId);
    this.loadDynamicFormForActivity(nodeId);
  }

  /** Desde la tabla resumen: selecciona la actividad y baja al diseñador CU4. */
  openCu4ForActivity(nodeId: string) {
    this.selectedNodeId.set(nodeId);
    this.onActivitySelect(nodeId);
    this.previewOpen.set(true);
    queueMicrotask(() => {
      document.getElementById('cu4-form-designer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  scrollToWorkspaceSection(which: 'forms' | 'diagram' | 'nlp') {
    queueMicrotask(() => {
      const id =
        which === 'forms'
          ? 'form-registry-panel'
          : which === 'diagram'
            ? 'workspace-diagram'
            : 'nlp-assistant-panel';
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (which === 'nlp' && el instanceof HTMLDetailsElement) {
        el.open = true;
      }
    });
  }

  onEdgeSelect(edgeId: string) {
    this.clearMessages();
    this.configValidation.set(null);
    if (!edgeId) {
      this.selectedEdgeId.set(null);
      this.edgeCondition.set('');
      return;
    }
    this.selectedEdgeId.set(edgeId);
    const e = this.draftPayload()?.edges.find((x) => x.id === edgeId);
    this.edgeCondition.set(e?.condition ?? '');
  }

  onEdgeConditionInput(ev: Event) {
    const v = (ev.target as HTMLTextAreaElement).value;
    this.edgeCondition.set(v);
  }

  addFieldRow(partial?: Partial<FormField>) {
    this.fields.push(this.createFieldGroup(partial));
    this.fields.updateValueAndValidity();
  }

  removeFieldRow(index: number) {
    this.fields.removeAt(index);
    this.fields.updateValueAndValidity();
    if (this.fields.length === 0) {
      this.addFieldRow();
    }
  }

  saveActivityForm() {
    const pid = this.policyId();
    const actId = this.selectedActivityNodeId();
    if (!pid || !actId || this.activityForm.invalid) return;
    this.cfgBusy.set(true);
    this.clearMessages();
    const payload = this.buildSaveDynamicFormPayload();

    // Validación local obligatoria antes de guardar
    const local = this.validateDynamicFormLocal(pid, actId, payload);
    this.formValidation.set(local);
    if (!this.isDiagramValidationValid(local)) {
      this.error.set('No se puede guardar: el formulario no cumple las reglas.');
      this.cfgBusy.set(false);
      return;
    }

    const req$ = this.dynamicFormExists()
      ? this.dynamicFormService.updateForm(pid, actId, payload)
      : this.dynamicFormService.createForm(pid, actId, payload);
    req$.subscribe({
      next: (saved) => {
        this.dynamicFormExists.set(true);
        this.previewOpen.set(true);
        if (saved?.id) {
          this.patchActivityNodeFormId(actId, saved.id);
        }
        this.success.set('Formulario guardado correctamente. Vista previa activada — así se verá en ejecución.');
        this.refreshDiagram(pid);
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error guardando el formulario')),
      complete: () => this.cfgBusy.set(false)
    });
  }

  deleteActivityForm() {
    const pid = this.policyId();
    const actId = this.selectedActivityNodeId();
    if (!pid || !actId || !this.dynamicFormExists()) return;
    if (!confirm('¿Eliminar este formulario dinámico del servidor? La actividad volverá a usar la plantilla en ejecución hasta que cree otro formulario.')) {
      return;
    }
    this.cfgBusy.set(true);
    this.clearMessages();
    this.dynamicFormService.deleteForm(pid, actId).subscribe({
      next: () => {
        this.dynamicFormExists.set(false);
        this.formValidation.set(null);
        this.patchActivityNodeFormId(actId, null);
        this.resetActivityForm();
        this.activityForm.patchValue({ name: `Formulario ${actId}`, description: '' });
        this.addFieldRow();
        this.previewOpen.set(false);
        this.success.set('Formulario eliminado. Guarde el diagrama si desea persistir otros cambios del lienzo.');
        this.refreshDiagram(pid);
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error eliminando el formulario')),
      complete: () => this.cfgBusy.set(false)
    });
  }

  validateActivityForm() {
    const pid = this.policyId();
    const actId = this.selectedActivityNodeId();
    if (!pid || !actId) return;
    this.clearMessages();

    const payload = this.buildSaveDynamicFormPayload();
    const local = this.validateDynamicFormLocal(pid, actId, payload);
    this.formValidation.set(local);
    if (!this.isDiagramValidationValid(local)) {
      this.error.set('Validación local: el formulario no cumple las reglas.');
      return;
    }

    // Si pasa local, validamos con backend (sin guardar)
    this.cfgBusy.set(true);
    this.dynamicFormService.validateForm(pid, actId, payload).subscribe({
      next: (r) => {
        this.formValidation.set(r);
        if (this.isDiagramValidationValid(r)) {
          this.success.set('El formulario es válido.');
        } else {
          this.error.set('Validación backend: el formulario no cumple las reglas.');
        }
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error validando el formulario en backend')),
      complete: () => this.cfgBusy.set(false)
    });
  }

  previewFields(): FormField[] {
    const payload = this.buildSaveDynamicFormPayload();
    return [...(payload.fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  openFormDesignerForSelectedNode() {
    const sn = this.selectedNode();
    if (!sn) return;
    if (sn.type !== 'ACTIVITY') {
      this.error.set('Los formularios solo pueden asociarse a actividades (ACTIVITY).');
      return;
    }
    this.openCu4ForActivity(sn.id);
  }

  private validateDynamicFormLocal(
    policyId: string,
    activityNodeId: string,
    payload: { name: string; description?: string; fields: FormField[] }
  ): DiagramValidationResponseDto {
    const errors: { code: string; message: string; elementId?: string }[] = [];

    // Solo ACTIVITY puede tener formulario
    const node = (this.draftPayload()?.nodes ?? []).find((n) => n.id === activityNodeId);
    if (!node || node.type !== 'ACTIVITY') {
      errors.push({
        code: 'FORM_ONLY_ACTIVITY',
        message: 'Los formularios solo pueden asociarse a actividades (ACTIVITY).',
        elementId: activityNodeId
      });
      return { isValid: false, errors };
    }

    const name = String(payload.name ?? '').trim();
    if (!name) {
      errors.push({ code: 'FORM_NAME_REQUIRED', message: 'El formulario debe tener un nombre.' });
    }

    const fields = payload.fields ?? [];
    if (!fields.length) {
      errors.push({ code: 'FORM_EMPTY', message: 'No se debe permitir formulario vacío.' });
      return { isValid: false, errors };
    }

    const assignNextCount = fields.filter(
      (x) => !!(x as any).assignsNextTask && (x as any).type === 'USER'
    ).length;
    if (assignNextCount > 1) {
      errors.push({
        code: 'ASSIGNS_NEXT_DUP',
        message: 'Solo un campo USER puede marcar asignación a la siguiente actividad.'
      });
    }

    const allowed = new Set<FormFieldType>(this.fieldTypes);
    const ids = new Set<string>();
    const keys = new Set<string>();

    for (const f of fields) {
      const id = String((f as any).id ?? '').trim();
      const type = (f as any).type as FormFieldType | undefined;
      const label = String((f as any).label ?? '').trim();
      const key = String((f as any).name ?? '').trim();
      const order = (f as any).order as number | undefined;
      const options = (f as any).options as string[] | undefined;
      const action = String((f as any).action ?? '').trim();
      const assignsNextTask = Boolean((f as any).assignsNextTask);

      if (!id) {
        errors.push({ code: 'FIELD_ID_REQUIRED', message: 'No deben existir componentes sin id.' });
      } else if (ids.has(id)) {
        errors.push({ code: 'FIELD_ID_DUP', message: 'No deben existir ids duplicados.', elementId: id });
      } else {
        ids.add(id);
      }

      if (!type || !allowed.has(type)) {
        errors.push({
          code: 'FIELD_TYPE_UNKNOWN',
          message: 'No deben existir tipos de componente desconocidos.',
          elementId: id || undefined
        });
        continue;
      }

      // Label/text visible
      if (!label) {
        errors.push({
          code: 'FIELD_LABEL_REQUIRED',
          message: 'Todo componente visible debe tener label o texto.',
          elementId: id || undefined
        });
      }

      // key para campos de datos (no LABEL/BUTTON)
      if (type !== 'LABEL' && type !== 'BUTTON') {
        if (!key) {
          errors.push({
            code: 'FIELD_KEY_REQUIRED',
            message: 'Todo campo que no sea LABEL ni BUTTON debe tener key (name).',
            elementId: id || undefined
          });
        } else if (keys.has(key)) {
          errors.push({
            code: 'FIELD_KEY_DUP',
            message: `No deben existir keys duplicadas: '${key}'.`,
            elementId: id || undefined
          });
        } else {
          keys.add(key);
        }
      }

      // opciones SELECT/RADIO
      if (type === 'SELECT' || type === 'RADIO') {
        if (!options || !options.length) {
          errors.push({
            code: 'OPTIONS_REQUIRED',
            message: `El componente ${type} '${label || id}' debe tener al menos una opción.`,
            elementId: id || undefined
          });
        }
      }

      if (assignsNextTask && type !== 'USER') {
        errors.push({
          code: 'ASSIGNS_NEXT_INVALID_TYPE',
          message: '«Asignar siguiente actividad» solo aplica a campos tipo USER.',
          elementId: id || undefined
        });
      }

      // BUTTON label + acción
      if (type === 'BUTTON') {
        if (!label) {
          errors.push({
            code: 'BUTTON_TEXT_REQUIRED',
            message: 'BUTTON debe tener buttonText/label visible.',
            elementId: id || undefined
          });
        }
        if (!action) {
          errors.push({
            code: 'BUTTON_ACTION_REQUIRED',
            message: 'BUTTON debe tener una acción válida.',
            elementId: id || undefined
          });
        }
      }

      if (order == null || Number.isNaN(order) || order < 0) {
        errors.push({
          code: 'FIELD_ORDER_INVALID',
          message: 'Todo componente debe tener order >= 0.',
          elementId: id || undefined
        });
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  saveEdgeCondition() {
    const pid = this.policyId();
    const eid = this.selectedEdgeId();
    const cond = this.edgeCondition().trim();
    if (!pid || !eid || !cond) return;
    this.cfgBusy.set(true);
    this.clearMessages();
    this.diagramConfigService.updateEdgeCondition(pid, eid, { condition: cond }).subscribe({
      next: () => {
        this.success.set('Condición de arista guardada.');
        this.refreshDiagram(pid);
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error guardando la condición')),
      complete: () => this.cfgBusy.set(false)
    });
  }

  validateConfiguration() {
    const pid = this.policyId();
    if (!pid) return;
    this.cfgBusy.set(true);
    this.clearMessages();
    this.diagramConfigService.validateConfiguration(pid).subscribe({
      next: (r) => {
        this.configValidation.set(r);
        if (this.isConfigValidationValid(r)) {
          this.success.set('Configuración válida según el backend.');
        } else {
          this.error.set('La configuración no cumple todas las reglas (revisa la lista de errores).');
        }
      },
      error: (e) => {
        this.configValidation.set(null);
        this.error.set(mapHttpError(e, 'Error validando la configuración'));
      },
      complete: () => this.cfgBusy.set(false)
    });
  }

  edgeSummary(e: DiagramEdge): string {
    const byId = new Map((this.draftPayload()?.nodes ?? []).map((n) => [n.id, n]));
    const a = byId.get(e.sourceNodeId);
    const b = byId.get(e.targetNodeId);
    const left = a ? `${a.type}:${a.id}` : e.sourceNodeId;
    const right = b ? `${b.type}:${b.id}` : e.targetNodeId;
    const c = this.edgeConditionLabel(e.condition);
    return `${e.id}: ${left} → ${right} | ${c}`;
  }

  loadExampleInMemory() {
    this.clearMessages();
    const createdBy = this.pickCreatedBy();
    if (!createdBy) {
      this.error.set('Se necesita al menos un usuario en el sistema para createdBy.');
      return;
    }
    this.draftPayload.set(this.buildMinimalExamplePayload(createdBy));
    this.broadcastCollabFullDiagramSync();
    this.success.set('Diagrama de ejemplo cargado en memoria (aún no guardado). Sin calles: añádelas cuando quieras UML por carriles.');
  }

  loadDecisionExampleInMemory() {
    this.clearMessages();
    const createdBy = this.pickCreatedBy();
    if (!createdBy) {
      this.error.set('Se necesita al menos un usuario en el sistema para createdBy.');
      return;
    }
    this.draftPayload.set(this.buildDecisionExamplePayload(createdBy));
    this.broadcastCollabFullDiagramSync();
    this.success.set(
      'Diagrama con decisión cargado en memoria (aún no guardado). Añade calles manualmente si necesitas responsables por carril.'
    );
  }

  save() {
    const pid = this.policyId();
    const draft = this.draftPayload();
    if (!pid || !draft) return;

    // Validación obligatoria antes de guardar (UX + evita guardar estados inválidos)
    const local = this.validateDraftLocal(draft);
    this.validationState.set(local);
    const okLocal = this.isDiagramValidationValid(local);
    if (!okLocal) {
      this.error.set('No se puede guardar: el diagrama no cumple las reglas UML/requerimientos.');
      return;
    }

    this.busy.set(true);
    this.clearMessages();
    const persisted = this.hasPersistedDiagram();
    const req$ = persisted
      ? this.diagramService.updateDiagram(pid, draft)
      : this.diagramService.createDiagram(pid, draft);
    req$.subscribe({
      next: (res) => {
        this.hasPersistedDiagram.set(true);
        this.missingDiagramHint.set(false);
        this.draftPayload.set(this.toDraftFromResponse(res));
        this.broadcastCollabFullDiagramSync();
        this.success.set(persisted ? 'Diagrama actualizado correctamente.' : 'Diagrama creado correctamente.');
        this.reloadPolicy(pid);
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error al guardar el diagrama')),
      complete: () => this.busy.set(false)
    });
  }

  validateDiagram() {
    const policyId = this.policyId();
    const draft = this.draftPayload();
    if (!policyId || !draft) return;

    this.clearMessages();

    // 1) Validación en memoria (obligatoria)
    const local = this.validateDraftLocal(draft);
    this.validationState.set(local);
    const okLocal = this.isDiagramValidationValid(local);
    if (!okLocal) {
      this.error.set('Validación local: el diagrama no cumple las reglas.');
      return;
    }

    // 2) Si todavía no existe en backend, la validación local es suficiente
    if (!this.hasPersistedDiagram()) {
      this.success.set('El diagrama es válido. (Validación local en memoria)');
      return;
    }

    // 3) Si existe guardado, confirmamos con backend
    this.busy.set(true);
    this.diagramService.validateDiagram(policyId).subscribe({
      next: (r) => {
        this.validationState.set(r);
        const ok = this.isDiagramValidationValid(r);
        if (ok === true) {
          this.success.set('El diagrama es válido.');
        } else if (ok === false) {
          this.error.set('Validación backend: el diagrama no cumple las reglas.');
        }
      },
      error: (e) => {
        // Mantenemos los resultados de validación local mostrados; reportamos error backend aparte.
        this.error.set(mapHttpError(e, 'Error validando diagrama en backend'));
      },
      complete: () => this.busy.set(false)
    });
  }

  swimlaneLine(s: Swimlane): string {
    return `${s.name} (${s.id}) — ${s.responsibleType} → ${s.responsibleId}`;
  }

  nodeLine(n: DiagramNode): string {
    const swim = n.swimlaneId ? ` | swimlane: ${n.swimlaneId}` : '';
    const label = n.name ? ` «${n.name}»` : '';
    const form = n.formId ? ` | formId: ${n.formId}` : '';
    return `${n.type}${label} (${n.id})${swim}${form}`;
  }

  nodeLineWithPosition(n: DiagramNode): string {
    const pos =
      n.positionX != null && n.positionY != null
        ? ` | pos: (${n.positionX}, ${n.positionY})`
        : ' | pos: (—)';
    return `${this.nodeLine(n)}${pos}`;
  }

  edgeConditionLabel(condition: string | undefined | null): string {
    return condition != null && String(condition).trim() !== '' ? String(condition).trim() : 'Sin condición';
  }

  toText(v: unknown): string {
    return v == null ? '' : String(v);
  }

  isDiagramValidationValid(v: DiagramValidationResponseDto): boolean {
    return v.isValid ?? v.valid ?? false;
  }

  private validateDraftLocal(d: SaveActivityDiagramPayload): DiagramValidationResponseDto {
    const errors: { code: string; message: string; elementId?: string }[] = [];

    const nodes = d?.nodes ?? [];
    const edges = d?.edges ?? [];

    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const startNodes = nodes.filter((n) => n.type === 'START');
    const endNodes = nodes.filter((n) => n.type === 'END');

    if (startNodes.length !== 1) {
      errors.push({
        code: 'START_EXACTLY_ONE',
        message: 'Debe existir exactamente 1 nodo inicial (START).'
      });
    }
    if (endNodes.length < 1) {
      errors.push({ code: 'END_AT_LEAST_ONE', message: 'Debe existir al menos 1 nodo final (END).' });
    }

    // Actividades: nombre y swimlane obligatorios
    for (const n of nodes) {
      if (n.type === 'ACTIVITY') {
        if (!String(n.name ?? '').trim()) {
          errors.push({
            code: 'ACTIVITY_NAME_REQUIRED',
            message: 'Toda actividad debe tener nombre.',
            elementId: n.id
          });
        }
        const lanes = (d.swimlanes ?? []).length;
        if (lanes > 0 && !String(n.swimlaneId ?? '').trim()) {
          errors.push({
            code: 'ACTIVITY_SWIMLANE_REQUIRED',
            message:
              'Si definiste calles (swimlanes), toda actividad debe pertenecer a una de ellas. Añada calles o asigne swimlane.',
            elementId: n.id
          });
        }
        if (
          lanes > 0 &&
          String(n.swimlaneId ?? '').trim() &&
          !(d.swimlanes ?? []).some((s) => s.id === n.swimlaneId)
        ) {
          errors.push({
            code: 'ACTIVITY_SWIMLANE_INVALID',
            message: 'La actividad referencia una calle que no existe en el diagrama.',
            elementId: n.id
          });
        }
      }
    }

    // Aristas: sin origen/destino inválidos
    for (const e of edges) {
      if (!String(e.sourceNodeId ?? '').trim() || !String(e.targetNodeId ?? '').trim()) {
        errors.push({
          code: 'EDGE_MISSING_ENDPOINT',
          message: 'No deben existir transiciones sin origen o sin destino.',
          elementId: e.id
        });
        continue;
      }
      if (!byId.has(e.sourceNodeId) || !byId.has(e.targetNodeId)) {
        errors.push({
          code: 'EDGE_NODE_NOT_FOUND',
          message: 'Transición inválida: el origen o destino no existe.',
          elementId: e.id
        });
      }
    }

    // Conectividad: no aislados, y alcanzabilidad desde START a algún END
    const out = new Map<string, string[]>();
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();

    for (const n of nodes) {
      out.set(n.id, []);
      inDeg.set(n.id, 0);
      outDeg.set(n.id, 0);
    }

    for (const e of edges) {
      if (!byId.has(e.sourceNodeId) || !byId.has(e.targetNodeId)) continue;
      out.get(e.sourceNodeId)?.push(e.targetNodeId);
      inDeg.set(e.targetNodeId, (inDeg.get(e.targetNodeId) ?? 0) + 1);
      outDeg.set(e.sourceNodeId, (outDeg.get(e.sourceNodeId) ?? 0) + 1);
    }

    for (const n of nodes) {
      const deg = (inDeg.get(n.id) ?? 0) + (outDeg.get(n.id) ?? 0);
      if (deg === 0) {
        errors.push({
          code: 'NODE_ISOLATED',
          message: 'No deben existir actividades/nodos aislados sin conexión.',
          elementId: n.id
        });
      }
    }

    // Reglas UML adicionales (jurado/examen):
    // - DECISION debe tener al menos 2 salidas
    // - FORK: 1 entrada, >=2 salidas
    // - JOIN: >=2 entradas, 1 salida
    for (const n of nodes) {
      const inN = inDeg.get(n.id) ?? 0;
      const outN = outDeg.get(n.id) ?? 0;
      if (n.type === 'DECISION' && outN < 2) {
        errors.push({
          code: 'DECISION_OUT_MIN',
          message: 'DECISION debe tener al menos 2 salidas.',
          elementId: n.id
        });
      }
      if (n.type === 'FORK') {
        if (inN !== 1) {
          errors.push({
            code: 'FORK_IN_EXACT',
            message: 'FORK debe tener exactamente 1 entrada.',
            elementId: n.id
          });
        }
        if (outN < 2) {
          errors.push({
            code: 'FORK_OUT_MIN',
            message: 'FORK debe tener al menos 2 salidas.',
            elementId: n.id
          });
        }
      }
      if (n.type === 'JOIN') {
        if (inN < 2) {
          errors.push({
            code: 'JOIN_IN_MIN',
            message: 'JOIN debe tener al menos 2 entradas.',
            elementId: n.id
          });
        }
        if (outN !== 1) {
          errors.push({
            code: 'JOIN_OUT_EXACT',
            message: 'JOIN debe tener exactamente 1 salida.',
            elementId: n.id
          });
        }
      }
    }

    const start = startNodes[0];
    if (start?.id) {
      const seen = new Set<string>();
      const q: string[] = [start.id];
      seen.add(start.id);
      while (q.length) {
        const cur = q.shift()!;
        for (const nxt of out.get(cur) ?? []) {
          if (!seen.has(nxt)) {
            seen.add(nxt);
            q.push(nxt);
          }
        }
      }

      // flujo debe partir desde el nodo inicial: todos los nodos (excepto START) deben ser alcanzables
      for (const n of nodes) {
        if (n.type === 'START') continue;
        if (!seen.has(n.id)) {
          errors.push({
            code: 'NODE_NOT_REACHABLE_FROM_START',
            message: 'El flujo debe partir desde el nodo inicial: hay nodos no alcanzables desde START.',
            elementId: n.id
          });
        }
      }

      const reachesEnd = endNodes.some((n) => seen.has(n.id));
      if (!reachesEnd) {
        errors.push({
          code: 'NO_PATH_TO_END',
          message: 'El flujo debe tener al menos un camino hacia un nodo final (END).'
        });
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  isConfigValidationValid(v: ConfigurationValidationResponse): boolean {
    return v.isValid ?? v.valid ?? false;
  }

  private loadForPolicy(policyId: string) {
    this.loading.set(true);
    this.policyLoaded.set(false);
    this.clearMessages();
    this.validationState.set(null);
    this.configValidation.set(null);
    forkJoin({
      policy: this.policyService.getPolicyById(policyId).pipe(
        catchError(() => of(null as BusinessPolicy | null))
      ),
      roles: this.rolesService.list().pipe(catchError(() => of([] as Role[]))),
      users: this.usersService.list().pipe(catchError(() => of([] as User[]))),
      diagram: this.diagramService.getDiagram(policyId).pipe(
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 404) {
            return of(null as ActivityDiagram | null);
          }
          return throwError(() => err);
        })
      )
    }).subscribe({
      next: ({ policy, roles, users, diagram }) => {
        this.roles.set(roles);
        this.users.set(users);
        this.aiCreatedBy.set(users[0]?.id ?? null);
        this.policyStatus.set(policy?.status ?? null);
        this.policyFormSummaries.set(diagram?.dynamicForms ?? []);
        if (diagram) {
          this.hasPersistedDiagram.set(true);
          this.missingDiagramHint.set(false);
          this.draftPayload.set(this.toDraftFromResponse(diagram));
          if (!this.userDiagramViewDirty()) this.fitToContent();
        } else {
          this.hasPersistedDiagram.set(false);
          this.missingDiagramHint.set(true);
          this.draftPayload.set(null);
          if (!this.userDiagramViewDirty()) this.fitToContent();
        }
        this.mergeServerFormIdsIntoDraft();
      },
      error: (e) => {
        this.resetData();
        this.error.set(mapHttpError(e, 'Error cargando el diagrama'));
      },
      complete: () => {
        this.loading.set(false);
        this.policyLoaded.set(true);
      }
    });
  }

  /**
   * Evita que «Generar diagrama» pise el lienzo cuando el usuario quiere modificar (eliminar, conectar, etc.).
   */
  private looksLikeModifyDiagramPrompt(text: string): boolean {
    const t = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    return (
      /\b(eliminar|elimina|elimine|eliminen|borrar|borra|borre|quitar|quita|quite|suprimir|suprime|retirar|retira|sacar|saca)\b/
        .test(t) ||
      /\b(conecta|conectar|une|unir)\b/.test(t) ||
      /\b(renombr|modifica|paralel|fork|calle|franja|swimlane)\b/.test(t) ||
      (/\b(agrega|anade|adiciona|inserta|crea|creame|nuevo|nueva)\b/.test(t) &&
        /\b(nodo|actividad|paso|etapa|calle)\b/.test(t))
    );
  }

  generateAiProposal() {
    const policyId = this.policyId();
    if (!policyId) return;
    if (this.policyStatus() !== 'DRAFT') {
      this.error.set('El asistente solo está disponible cuando la política está en estado DRAFT.');
      return;
    }
    let createdBy = (this.aiCreatedBy() ?? '').trim();
    const promptText = (this.aiPromptText() ?? '').trim();
    const editInstr = (this.aiEditInstruction() ?? '').trim();
    if (!createdBy) {
      // UX: autoselección para demo/examen
      const fallback = this.users()?.[0]?.id ?? '';
      if (fallback) {
        createdBy = fallback;
        this.aiCreatedBy.set(fallback);
      } else {
        this.error.set('Selecciona el usuario creador (createdBy).');
        return;
      }
    }

    const modifyInstruction =
      editInstr || (promptText && this.looksLikeModifyDiagramPrompt(promptText) ? promptText : '');
    if (modifyInstruction.trim()) {
      if (!this.draftPayload()) {
        this.error.set(
          'Para eliminar o editar nodos necesitás un diagrama cargado en el editor. El botón «Generar diagrama» crearía uno nuevo; tu texto parece una modificación.'
        );
        return;
      }
      this.applyAiEdit(false, modifyInstruction);
      return;
    }

    if (!promptText) {
      this.error.set('Escribe una descripción del proceso (prompt).');
      return;
    }

    this.aiBusy.set(true);
    this.clearMessages();
    this.aiSuggestion.set(null);

    const payload: GenerateWorkflowSuggestionRequest = {
      policyId,
      createdBy,
      promptText
    };

    this.aiSuggestionService.generateFromText(payload).subscribe({
      next: (res) => {
        this.aiSuggestion.set(res);
        const raw = res.activityDiagramPayload as SaveActivityDiagramPayload | null;
        if (!raw) {
          this.error.set('La IA no devolvió un diagrama válido.');
          return;
        }
        const normalized: SaveActivityDiagramPayload = {
          ...raw,
          createdBy: (raw.createdBy ?? '').trim() || createdBy
        };
        // Comportamiento esperado: aplicar automáticamente al editor.
        this.draftPayload.set(normalized);
        this.broadcastCollabFullDiagramSync();
        this.success.set(
          this.hasPersistedDiagram()
            ? 'Diagrama generado y aplicado al editor. Ahora puedes Guardar para actualizar el diagrama existente.'
            : 'Diagrama generado y aplicado al editor. Ahora puedes Guardar.'
        );
        // UX: el "Resultado" del modal es texto; el diagrama real está en el lienzo.
        // Cerramos el modal y encuadramos el diagrama para que el usuario lo vea inmediatamente.
        this.closeAiModal();
        queueMicrotask(() => this.fitToContent());
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error generando propuesta')),
      complete: () => this.aiBusy.set(false)
    });
  }

  generateAiAndSave() {
    const policyId = this.policyId();
    if (!policyId) return;
    if (this.policyStatus() !== 'DRAFT') {
      this.error.set('Solo se puede generar y guardar cuando la política está en estado DRAFT.');
      return;
    }
    let createdBy = (this.aiCreatedBy() ?? '').trim();
    const promptText = (this.aiPromptText() ?? '').trim();
    const editInstr = (this.aiEditInstruction() ?? '').trim();
    if (!createdBy) {
      const fallback = this.users()?.[0]?.id ?? '';
      if (fallback) {
        createdBy = fallback;
        this.aiCreatedBy.set(fallback);
      } else {
        this.error.set('Selecciona el usuario creador (createdBy).');
        return;
      }
    }

    const modifyInstruction =
      editInstr || (promptText && this.looksLikeModifyDiagramPrompt(promptText) ? promptText : '');
    if (modifyInstruction.trim()) {
      if (!this.draftPayload()) {
        this.error.set(
          'Para modificar el diagrama actual cargá primero un diagrama en el editor. Tu texto parece una modificación, no un proceso nuevo.'
        );
        return;
      }
      this.applyAiEdit(true, modifyInstruction);
      return;
    }

    if (!promptText) {
      this.error.set('Escribe una descripción del proceso (prompt).');
      return;
    }

    this.aiBusy.set(true);
    this.clearMessages();
    this.aiSuggestion.set(null);

    const payload: GenerateWorkflowSuggestionRequest = { policyId, createdBy, promptText };
    this.aiSuggestionService.generateFromText(payload).subscribe({
      next: (res) => {
        this.aiSuggestion.set(res);
        const raw = res.activityDiagramPayload as SaveActivityDiagramPayload | null;
        if (!raw) {
          this.error.set('La IA no devolvió un diagrama válido.');
          return;
        }
        const normalized: SaveActivityDiagramPayload = {
          ...raw,
          createdBy: (raw.createdBy ?? '').trim() || createdBy
        };

        const req$ = this.hasPersistedDiagram()
          ? this.diagramService.updateDiagram(policyId, normalized)
          : this.diagramService.createDiagram(policyId, normalized);

        req$.subscribe({
          next: (saved) => {
            this.hasPersistedDiagram.set(true);
            this.missingDiagramHint.set(false);
            this.draftPayload.set(this.toDraftFromResponse(saved));
            this.broadcastCollabFullDiagramSync();
            this.success.set('Diagrama generado por IA y guardado correctamente.');
            this.reloadPolicy(policyId);
            this.closeAiModal();
            queueMicrotask(() => this.fitToContent());
          },
          error: (e) => this.error.set(mapHttpError(e, 'Error guardando el diagrama generado por IA')),
          complete: () => this.aiBusy.set(false)
        });
      },
      error: (e) => {
        this.error.set(mapHttpError(e, 'Error generando propuesta'));
        this.aiBusy.set(false);
      }
    });
  }

  applyAiEdit(saveAfter: boolean, instructionOverride?: string) {
    const policyId = this.policyId();
    const draft = this.draftPayload();
    if (!draft) {
      this.error.set('No hay diagrama cargado en el editor.');
      return;
    }
    if (!policyId) return;
    if (this.policyStatus() !== 'DRAFT') {
      this.error.set('La modificación por IA solo está disponible cuando la política está en estado DRAFT.');
      return;
    }
    let createdBy = (this.aiCreatedBy() ?? '').trim();
    const instruction = (instructionOverride ?? this.aiEditInstruction() ?? '').trim();
    if (!createdBy) {
      // UX: autoselección para demo/examen
      const fallback = this.users()?.[0]?.id ?? '';
      if (fallback) {
        createdBy = fallback;
        this.aiCreatedBy.set(fallback);
      } else {
        this.error.set('Selecciona el usuario creador (createdBy).');
        return;
      }
    }
    if (!instruction) {
      this.error.set('Escribe una instrucción para modificar el diagrama.');
      return;
    }

    this.aiBusy.set(true);
    this.clearMessages();

    this.aiDiagramEditService
      .apply({
        policyId,
        createdBy,
        instruction,
        currentDiagram: draft
      })
      .subscribe({
        next: (res) => {
          const payload = res.activityDiagramPayload as SaveActivityDiagramPayload | null;
          if (!payload) {
            this.error.set('La IA no devolvió un diagrama válido.');
            this.aiBusy.set(false);
            return;
          }
          const warns = (res.warnings ?? []).filter(Boolean);
          const notFound = warns.some((w) => w.toLowerCase().includes('no encontré'));
          const missingDeleteTarget = warns.some((w) =>
            /indic[aá]\s+el\s+nombre\s+del\s+nodo/i.test(w)
          );
          if (notFound || missingDeleteTarget) {
            this.error.set(warns.join(' · ') || res.summary || 'No se pudo aplicar el borrado.');
            this.aiBusy.set(false);
            return;
          }

          const normalized: SaveActivityDiagramPayload = {
            ...payload,
            createdBy: (payload.createdBy ?? '').trim() || createdBy
          };
          this.draftPayload.set(normalized);
          this.broadcastCollabFullDiagramSync();

          if (warns.length) {
            this.success.set(`${res.summary} (avisos: ${warns.join(' · ')})`);
          } else {
            this.success.set(res.summary || 'Cambios aplicados al diagrama.');
          }
          // UX: cerrar modal y encuadrar para ver los cambios inmediatamente
          this.closeAiModal();
          queueMicrotask(() => this.fitToContent());

          if (!saveAfter) return;
          const req$ = this.hasPersistedDiagram()
            ? this.diagramService.updateDiagram(policyId, normalized)
            : this.diagramService.createDiagram(policyId, normalized);
          req$.subscribe({
            next: (saved) => {
              this.hasPersistedDiagram.set(true);
              this.missingDiagramHint.set(false);
              this.draftPayload.set(this.toDraftFromResponse(saved));
              this.broadcastCollabFullDiagramSync();
              this.success.set('Cambios aplicados por IA y guardados correctamente.');
              this.reloadPolicy(policyId);
              this.closeAiModal();
              queueMicrotask(() => this.fitToContent());
            },
            error: (e) => this.error.set(mapHttpError(e, 'Error guardando los cambios de IA')),
            complete: () => this.aiBusy.set(false)
          });
        },
        error: (e) => {
          this.error.set(mapHttpError(e, 'Error aplicando cambios por IA'));
          this.aiBusy.set(false);
        },
        complete: () => {
          if (!saveAfter) this.aiBusy.set(false);
        }
      });
  }

  useAiProposal() {
    const s = this.aiSuggestion();
    if (!s?.activityDiagramPayload) return;
    this.clearMessages();
    const raw = s.activityDiagramPayload as SaveActivityDiagramPayload;
    const createdBy = (raw.createdBy ?? '').trim() || (this.aiCreatedBy() ?? '').trim();
    if (!createdBy) {
      this.error.set('Selecciona el usuario creador antes de aplicar la propuesta.');
      return;
    }
    this.draftPayload.set({ ...raw, createdBy });
    this.broadcastCollabFullDiagramSync();
    this.success.set(
      this.hasPersistedDiagram()
        ? 'Propuesta aplicada al editor. Si quieres que quede en el sistema, guarda para actualizar el diagrama.'
        : 'Propuesta aplicada al editor. Ahora puedes guardar el diagrama.'
    );
  }

  startVoice() {
    const SpeechRecognitionCtor: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      this.voiceNotSupported.set(true);
      return;
    }
    this.voiceNotSupported.set(false);

    if (!this.speechRecognition) {
      const rec = new SpeechRecognitionCtor();
      rec.lang = 'es-ES';
      rec.interimResults = true;
      rec.continuous = true;

      rec.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        this.aiPromptText.set(text.trim());
      };
      rec.onerror = () => {
        this.voiceRecording.set(false);
      };
      rec.onend = () => {
        this.voiceRecording.set(false);
      };
      this.speechRecognition = rec;
    }

    try {
      this.voiceRecording.set(true);
      this.speechRecognition.start();
    } catch {
      // algunos navegadores lanzan error si start() se llama dos veces
      this.voiceRecording.set(false);
    }
  }

  stopVoice() {
    if (!this.speechRecognition) {
      this.voiceRecording.set(false);
      return;
    }
    try {
      this.speechRecognition.stop();
    } catch {
      // ignore
    } finally {
      this.voiceRecording.set(false);
    }
  }

  private reloadPolicy(policyId: string) {
    this.policyService.getPolicyById(policyId).subscribe({
      next: (p) => this.policyStatus.set(p.status),
      error: () => {}
    });
  }

  /** Actualiza formId en el borrador local para que la tabla CU4 y el lienzo reflejen el guardado al instante. */
  private patchActivityNodeFormId(activityNodeId: string, formId: string | null | undefined) {
    const d = this.draftPayload();
    if (!d?.nodes?.length) return;
    const fid = formId ? String(formId).trim() : '';
    const nodes = d.nodes.map((n) =>
      n.id === activityNodeId && n.type === 'ACTIVITY'
        ? { ...n, ...(fid ? { formId: fid } : { formId: undefined }) }
        : n
    );
    this.draftPayload.set({ ...d, nodes });
  }

  private refreshDiagram(policyId: string) {
    this.diagramService.getDiagram(policyId).subscribe({
      next: (d) => {
        this.policyFormSummaries.set(d.dynamicForms ?? []);
        this.draftPayload.set(this.toDraftFromResponse(d));
        this.mergeServerFormIdsIntoDraft();
        this.broadcastCollabFullDiagramSync();
        if (!this.userDiagramViewDirty()) this.fitToContent();
        const eid = this.selectedEdgeId();
        if (eid) {
          const e = d.edges?.find((x) => x.id === eid);
          this.edgeCondition.set(e?.condition ?? this.edgeCondition());
        }
      },
      error: (e) => this.error.set(mapHttpError(e, 'No se pudo recargar el diagrama'))
    });
  }

  /** Si Mongo tiene CU4 para un nodo pero el JSON del diagrama no trae formId, lo reflejamos en el borrador (tabla + lienzo). */
  private mergeServerFormIdsIntoDraft() {
    const d = this.draftPayload();
    if (!d?.nodes?.length) return;
    const byNode = new Map((this.policyFormSummaries() ?? []).map((x) => [x.activityNodeId, x]));
    let changed = false;
    const nodes = d.nodes.map((n) => {
      if (n.type !== 'ACTIVITY') return n;
      if (String(n.formId ?? '').trim()) return n;
      const s = byNode.get(n.id);
      if (s?.id) {
        changed = true;
        return { ...n, formId: s.id };
      }
      return n;
    });
    if (changed) this.draftPayload.set({ ...d, nodes });
  }

  private loadDynamicFormForActivity(activityNodeId: string) {
    const pid = this.policyId();
    if (!pid) return;
    this.loadingForm.set(true);
    this.clearMessages();
    this.dynamicFormService
      .getForm(pid, activityNodeId)
      .pipe(
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 404) {
            return of(null);
          }
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (form) => {
          this.resetActivityForm();
          if (form) {
            this.dynamicFormExists.set(true);
            this.activityForm.patchValue({
              name: form.name,
              description: form.description ?? ''
            });
            for (const f of form.fields ?? []) {
              this.addFieldRow(f);
            }
          } else {
            this.dynamicFormExists.set(false);
            this.activityForm.patchValue({ name: `Formulario ${activityNodeId}`, description: '' });
            this.addFieldRow();
          }
        },
        error: (e) => {
          this.dynamicFormExists.set(false);
          this.resetActivityForm();
          this.error.set(mapHttpError(e, 'Error cargando el formulario'));
        },
        complete: () => this.loadingForm.set(false)
      });
  }

  private resetActivityForm() {
    this.activityForm.reset({ name: '', description: '' });
    while (this.fields.length) {
      this.fields.removeAt(0);
    }
    this.fields.updateValueAndValidity();
  }

  private createFieldGroup(partial?: Partial<FormField>): FormGroup {
    const id =
      partial?.id ??
      `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return this.fb.group({
      id: [id, Validators.required],
      label: [partial?.label ?? '', Validators.required],
      name: [partial?.name ?? ''],
      type: this.fb.nonNullable.control<FormFieldType>(partial?.type ?? 'TEXT'),
      required: [partial?.required ?? false],
      placeholder: [partial?.placeholder ?? ''],
      helpText: [partial?.helpText ?? ''],
      defaultValue: [partial?.defaultValue ?? ''],
      optionsText: [(partial?.options ?? []).join(', ')],
      order: [partial?.order ?? 0, [Validators.required, Validators.min(0)]],
      action: [partial?.action ?? ''],
      assignsNextTask: [partial?.assignsNextTask ?? false]
    });
  }

  private buildSaveDynamicFormPayload() {
    const raw = this.activityForm.getRawValue() as {
      name: string;
      description: string;
      fields: Array<{
        id: string;
        label: string;
        name: string;
        type: FormFieldType;
        required: boolean;
        placeholder: string;
        helpText: string;
        defaultValue: string;
        optionsText: string;
        order: number;
        action: string;
        assignsNextTask: boolean;
      }>;
    };
    const fields: FormField[] = raw.fields.map((f, i) => {
      const options = f.optionsText
        ? f.optionsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      const safeName =
        String(f.name ?? '').trim() ||
        (f.type === 'LABEL' || f.type === 'BUTTON' ? `ui_${f.id}` : '');
      return {
        id: f.id,
        label: f.label,
        name: safeName,
        type: f.type,
        required: f.required,
        placeholder: String(f.placeholder ?? '').trim() || undefined,
        helpText: String(f.helpText ?? '').trim() || undefined,
        defaultValue: String(f.defaultValue ?? '').trim() || undefined,
        options: options?.length ? options : undefined,
        order: Math.max(0, Number.isFinite(f.order as any) ? (f.order as any) : i),
        action: String(f.action ?? '').trim() || undefined,
        assignsNextTask: f.type === 'USER' && f.assignsNextTask ? true : undefined
      };
    });
    return {
      name: raw.name,
      description: raw.description || undefined,
      fields
    };
  }

  private resetData() {
    this.loading.set(false);
    this.policyLoaded.set(false);
    this.policyStatus.set(null);
    this.hasPersistedDiagram.set(false);
    this.missingDiagramHint.set(false);
    this.draftPayload.set(null);
    this.policyFormSummaries.set([]);
    this.roles.set([]);
    this.users.set([]);
    this.resetActivityForm();
  }

  private clearMessages() {
    this.success.set(null);
    this.error.set(null);
  }

  private toDraftFromResponse(d: ActivityDiagram): SaveActivityDiagramPayload {
    return {
      createdBy: d.createdBy ?? '',
      version: d.version,
      swimlanes: d.swimlanes ?? [],
      nodes: d.nodes ?? [],
      edges: (d.edges ?? []).map((e) => ({
        ...e,
        type: e.type ?? 'NORMAL'
      }))
    };
  }

  private pickCreatedBy(): string | null {
    const u = this.users()[0];
    return u?.id ?? null;
  }

  /** Ejemplo con una calle por defecto (coherente con validación backend y la IA). */
  private buildMinimalExamplePayload(createdBy: string): SaveActivityDiagramPayload {
    const laneMain = {
      id: 'lane-main',
      name: 'Principal',
      responsibleType: 'ROLE' as const,
      responsibleId: 'role-default',
      positionX: 0,
      positionY: 0,
      width: 900,
      height: 480
    };
    return {
      createdBy,
      swimlanes: [laneMain],
      nodes: [
        {
          id: 'node-start',
          type: 'START',
          name: 'Inicio',
          swimlaneId: laneMain.id,
          positionX: 120,
          positionY: 140
        },
        {
          id: 'node-activity',
          type: 'ACTIVITY',
          name: 'Actividad',
          swimlaneId: laneMain.id,
          positionX: 360,
          positionY: 140
        },
        {
          id: 'node-end',
          type: 'END',
          name: 'Fin',
          swimlaneId: laneMain.id,
          positionX: 620,
          positionY: 140
        }
      ],
      edges: [
        {
          id: 'edge-start-activity',
          sourceNodeId: 'node-start',
          targetNodeId: 'node-activity',
          label: 'Inicio',
          condition: '',
          type: 'NORMAL'
        },
        {
          id: 'edge-activity-end',
          sourceNodeId: 'node-activity',
          targetNodeId: 'node-end',
          label: 'Fin del flujo simple',
          condition: '',
          type: 'NORMAL'
        }
      ]
    };
  }

  private buildDecisionExamplePayload(createdBy: string): SaveActivityDiagramPayload {
    const laneMain = {
      id: 'lane-main',
      name: 'Principal',
      responsibleType: 'ROLE' as const,
      responsibleId: 'role-default',
      positionX: 0,
      positionY: 0,
      width: 1100,
      height: 560
    };
    return {
      createdBy,
      swimlanes: [laneMain],
      nodes: [
        {
          id: 'node-start',
          type: 'START',
          name: 'Inicio',
          swimlaneId: laneMain.id,
          positionX: 40,
          positionY: 120
        },
        {
          id: 'node-registrar',
          type: 'ACTIVITY',
          name: 'Registrar solicitud',
          swimlaneId: laneMain.id,
          positionX: 160,
          positionY: 120
        },
        {
          id: 'node-validar',
          type: 'ACTIVITY',
          name: 'Validar solicitud',
          swimlaneId: laneMain.id,
          positionX: 300,
          positionY: 120
        },
        {
          id: 'node-decision',
          type: 'DECISION',
          name: '¿Solicitud aprobada?',
          swimlaneId: laneMain.id,
          positionX: 460,
          positionY: 120
        },
        {
          id: 'node-ejecutar',
          type: 'ACTIVITY',
          name: 'Ejecutar solicitud',
          swimlaneId: laneMain.id,
          positionX: 620,
          positionY: 40
        },
        {
          id: 'node-notificar-resultado',
          type: 'ACTIVITY',
          name: 'Notificar resultado',
          swimlaneId: laneMain.id,
          positionX: 800,
          positionY: 40
        },
        {
          id: 'node-notificar-rechazo',
          type: 'ACTIVITY',
          name: 'Notificar rechazo',
          swimlaneId: laneMain.id,
          positionX: 620,
          positionY: 220
        },
        {
          id: 'node-end',
          type: 'END',
          name: 'Fin',
          swimlaneId: laneMain.id,
          positionX: 980,
          positionY: 120
        }
      ],
      edges: [
        {
          id: 'edge-start-registrar',
          sourceNodeId: 'node-start',
          targetNodeId: 'node-registrar',
          label: 'Comenzar',
          condition: '',
          type: 'NORMAL'
        },
        {
          id: 'edge-registrar-validar',
          sourceNodeId: 'node-registrar',
          targetNodeId: 'node-validar',
          label: 'Registrado',
          condition: '',
          type: 'NORMAL'
        },
        {
          id: 'edge-validar-decision',
          sourceNodeId: 'node-validar',
          targetNodeId: 'node-decision',
          label: 'Validado',
          condition: '',
          type: 'NORMAL'
        },
        {
          id: 'edge-decision-ejecutar',
          sourceNodeId: 'node-decision',
          targetNodeId: 'node-ejecutar',
          label: 'Aprobada',
          condition: 'aprobada',
          type: 'ALTERNATIVE'
        },
        {
          id: 'edge-decision-rechazo',
          sourceNodeId: 'node-decision',
          targetNodeId: 'node-notificar-rechazo',
          label: 'Rechazada',
          condition: 'rechazada',
          type: 'ALTERNATIVE'
        },
        {
          id: 'edge-ejecutar-notificar',
          sourceNodeId: 'node-ejecutar',
          targetNodeId: 'node-notificar-resultado',
          label: 'Ejecutado',
          condition: '',
          type: 'NORMAL'
        },
        {
          id: 'edge-notificar-ok-end',
          sourceNodeId: 'node-notificar-resultado',
          targetNodeId: 'node-end',
          label: 'Cerrar OK',
          condition: '',
          type: 'NORMAL'
        },
        {
          id: 'edge-notificar-rechazo-end',
          sourceNodeId: 'node-notificar-rechazo',
          targetNodeId: 'node-end',
          label: 'Cerrar rechazo',
          condition: '',
          type: 'NORMAL'
        }
      ]
    };
  }

  clearNlpAssist() {
    this.nlpAssistText.set('');
    this.nlpPreview.set(null);
    this.nlpError.set(null);
  }

  runStructuredDiagramNlp() {
    const pid = this.policyId();
    const draft = this.draftPayload();
    const text = (this.nlpAssistText() ?? '').trim();
    if (!pid || !draft) {
      this.nlpError.set('El diagrama debe estar cargado en el editor para analizar el contexto.');
      return;
    }
    if (text.length < 8) {
      this.nlpError.set('Escriba una descripción más extensa.');
      return;
    }
    this.nlpBusy.set(true);
    this.nlpError.set(null);
    this.nlpPreview.set(null);
    this.clearMessages();
    this.aiDiagramNlpService
      .suggest({ policyId: pid, description: text, currentDiagram: draft })
      .subscribe({
        next: (res) => {
          this.nlpPreview.set(res);
          if (!res.suggestions?.length) {
            this.nlpError.set('No se encontraron elementos sugeridos a partir del texto.');
          } else {
            this.success.set('Se generaron sugerencias. Revise la vista previa antes de aplicar.');
          }
        },
        error: (e) => this.nlpError.set(mapHttpError(e, 'Error en el motor de sugerencias de diagrama')),
        complete: () => this.nlpBusy.set(false)
      });
  }

  nlpRowDetail(r: AiDiagramSuggestionItem): string {
    if (r.type === 'LANE') return r.name ?? '';
    if (r.type === 'ACTIVITY') {
      const ln = r.laneName ? ` · calle ${r.laneName}` : '';
      const od = r.order != null ? ` (#${r.order})` : '';
      return `${r.name ?? '(sin nombre)'}${ln}${od}`;
    }
    return `${r.from ?? '—'} → ${r.to ?? '—'}${r.label ? ' · ' + r.label : ''}`;
  }

  applyStructuredDiagramNlp() {
    const res = this.nlpPreview();
    const draft = this.draftPayload();
    if (!res?.suggestions?.length || !draft) return;
    if (this.policyStatus() !== 'DRAFT') {
      this.error.set('Las sugerencias estructuradas solo se aplican con la política en DRAFT.');
      return;
    }
    try {
      const next = JSON.parse(JSON.stringify(draft)) as SaveActivityDiagramPayload;
      this.mergeStructuredSuggestionsIntoDiagram(next, res);
      const localVal = this.validateDraftLocal(next);
      this.validationState.set(localVal);
      this.draftPayload.set(next);
      this.broadcastCollabFullDiagramSync();
      if (this.isDiagramValidationValid(localVal)) {
        this.success.set(
          'Sugerencias aplicadas (sin borrar nodos previos). Valide y guarde cuando corresponda.'
        );
      } else {
        const errs = (localVal.errors ?? []).map((e) => e.message).join('; ');
        this.error.set(`Diagrama con advertencias tras aplicar IA: ${errs}`);
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'No se pudieron fusionar las sugerencias.');
    }
  }

  /** Normalización estable para igualar etiquetas NLP con nombres de actividad/nodo. */
  private nlpNormText(raw: unknown): string {
    return String(raw ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private mergeStructuredSuggestionsIntoDiagram(next: SaveActivityDiagramPayload, res: AiDiagramStructuredSuggestResponse) {
    if (!this.roles().length && !this.users().length) {
      throw new Error('Debe existir al menos un rol o usuario disponible para asignar nuevas calles.');
    }

    const sugg = [...(res.suggestions ?? [])];

    const laneItems = sugg.filter((s) => s.type === 'LANE');
    for (const ln of laneItems) {
      this.ensureLaneByName(next, ln.name ?? 'Área detectada');
    }

    const actItems = sugg.filter((s) => s.type === 'ACTIVITY');
    let cursorX =
      Math.max(
        40,
        ...next.nodes.map((n) =>
          typeof n.positionX === 'number' && !Number.isNaN(n.positionX) ? n.positionX : 0
        ),
        ...next.edges.map(() => 0)
      );

    /** map nameKey -> activity node id after merge */
    const activityByKey = new Map<string, string>();
    const registerActivityMapping = () => {
      for (const n of next.nodes) {
        if (n.type !== 'ACTIVITY') continue;
        const k = this.nlpNormText(n.name);
        if (!k || activityByKey.has(k)) continue;
        activityByKey.set(k, n.id);
      }
    };

    registerActivityMapping();

    const orderedActs = [...actItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const a of orderedActs) {
      const nm = (a.name ?? '').trim();
      if (!nm) continue;
      const key = this.nlpNormText(nm);
      if (!activityByKey.has(key)) {
        cursorX += 200;
        const swimId = this.ensureLaneByName(next, a.laneName ?? 'Área principal');
        const id = this.uid('node');
        const yn = 72 + Math.min(4, Math.max(next.swimlanes.findIndex((s) => s.id === swimId), 0)) * 44;
        const node: DiagramNode = {
          id,
          type: 'ACTIVITY',
          name: nm.slice(0, 200),
          description: (a.description ?? '').trim() || 'Actividad sugerida automáticamente.',
          swimlaneId: swimId,
          positionX: cursorX,
          positionY: yn
        };
        next.nodes.push(node);
        activityByKey.set(key, id);
      } else {
        const nid = activityByKey.get(key)!;
        const n = next.nodes.find((x) => x.id === nid);
        if (n && !(n.description ?? '').trim() && (a.description ?? '').trim())
          n.description = a.description!;
      }
    }

    registerActivityMapping();

    for (let i = 0; i < orderedActs.length - 1; i++) {
      const a = this.nlpNormText(orderedActs[i].name ?? '');
      const b = this.nlpNormText(orderedActs[i + 1].name ?? '');
      if (!a || !b) continue;
      const idA = activityByKey.get(a);
      const idB = activityByKey.get(b);
      if (!idA || !idB) continue;
      this.addEdgeDedupe(next, idA, idB, '');
    }

    const transItems = sugg.filter((s) => s.type === 'TRANSITION');
    for (const t of transItems) {
      const fa = this.nlpNormText(t.from ?? '');
      const fb = this.nlpNormText(t.to ?? '');
      const idFrom = fa ? activityByKey.get(fa) ?? null : null;
      const idTo = fb ? activityByKey.get(fb) ?? null : null;
      const resolvedFrom =
        idFrom ??
        [...next.nodes]
          .filter((x) => x.type === 'ACTIVITY')
          .find((x) => this.nlpNormText(x.name) === fa)?.id ??
        null;
      const resolvedTo =
        idTo ??
        [...next.nodes]
          .filter((x) => x.type === 'ACTIVITY')
          .find((x) => this.nlpNormText(x.name) === fb)?.id ??
        null;
      if (!resolvedFrom || !resolvedTo) continue;
      this.addEdgeDedupe(next, resolvedFrom, resolvedTo, String(t.label ?? '').trim());
    }

    const start = next.nodes.find((n) => n.type === 'START');
    const end = next.nodes.find((n) => n.type === 'END');
    const firstKey = this.nlpNormText(orderedActs[0]?.name ?? '');
    const lastKey = this.nlpNormText(orderedActs[orderedActs.length - 1]?.name ?? '');
    const firstId = firstKey ? activityByKey.get(firstKey) : null;
    const lastId = lastKey ? activityByKey.get(lastKey) : null;
    if (start?.id && firstId && !this.hasEdgeBetween(next.edges, start.id, firstId)) {
      this.pushEdge(next, start.id, firstId, '');
    }
    if (end?.id && lastId && !this.hasEdgeBetween(next.edges, lastId, end.id)) {
      this.pushEdge(next, lastId, end.id, '');
    }
  }

  private ensureLaneByName(next: SaveActivityDiagramPayload, hint: string): string {
    const nm = hint.trim().length ? hint.trim() : 'Operaciones';
    const key = this.nlpNormText(nm);
    for (const s of next.swimlanes) {
      if (this.nlpNormText(s.name) === key) return s.id;
    }
    const rt: ResponsibleType = this.roles().length ? 'ROLE' : 'USER';
    const rid = (this.roles()[0]?.id ?? this.users()[0]?.id)!;
    const sl: Swimlane = {
      id: this.uid('lane'),
      name: nm.slice(0, 120),
      responsibleType: rt,
      responsibleId: rid
    };
    next.swimlanes.push(sl);
    return sl.id;
  }

  private pushEdge(next: SaveActivityDiagramPayload, fromId: string, toId: string, label: string) {
    const edge: DiagramEdge = {
      id: this.uid('edge'),
      sourceNodeId: fromId,
      targetNodeId: toId,
      label: label || '',
      condition: '',
      type: 'NORMAL'
    };
    next.edges.push(edge);
  }

  private hasEdgeBetween(edges: DiagramEdge[], a: string, b: string): boolean {
    return edges.some((e) => e.sourceNodeId === a && e.targetNodeId === b);
  }

  private addEdgeDedupe(next: SaveActivityDiagramPayload, fromId: string, toId: string, label: string) {
    if (this.hasEdgeBetween(next.edges, fromId, toId)) return;
    this.pushEdge(next, fromId, toId, label);
  }
}
