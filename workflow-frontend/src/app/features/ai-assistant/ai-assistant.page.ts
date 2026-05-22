import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ActivityDiagramService } from '../../core/services/activity-diagram.service';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { AiDiagramEditService } from '../../core/services/ai-diagram-edit.service';
import { AiWorkflowSuggestionService } from '../../core/services/ai-workflow-suggestion.service';
import { PolicyService } from '../../core/services/policy.service';
import { UsersService } from '../../core/services/users.service';
import { BusinessPolicy } from '../../core/models/business-policy.model';
import { User } from '../../core/models/user.model';
import {
  GenerateWorkflowSuggestionRequest,
  WorkflowSuggestionResponse
} from '../../core/models/ai-workflow-suggestion.model';
import { SaveActivityDiagramPayload } from '../../core/models/activity-diagram.model';
import { mapHttpError } from '../../shared/utils/http-error.util';
import { ModifyDiagramWithAiRequest } from '../../core/models/ai-diagram-edit.model';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page">
      <header class="header">
        <div>
          <h2>Asistente IA</h2>
          <p class="muted">
            En frases normales puedes pedir ayuda del manual, avisos («notifícame que…») o diagramas. Para
            <strong>flujo/diagrama</strong> usa palabras como diagrama, flecha, nodo o «generar flujo»; el resto va al
            asistente con acciones en API (notificaciones en la campana si configuraste IA).
          </p>
        </div>
      </header>

      <div class="card">
        <div class="chat">
          <div class="chat-log" role="log" aria-label="Chat del asistente">
            <div class="bubble assistant">
              <div class="bubble-title">Asistente</div>
              <div class="bubble-text">
                ¿Qué necesitas? Ejemplos: “¿Cómo creo una política?”, “¿Cómo conecto flechas en el editor?”,
                “¿Por qué sale 502 o 403?”.
              </div>
            </div>

            <ng-container *ngFor="let m of chatMessages()">
              <div class="bubble" [class.user]="m.role === 'user'" [class.assistant]="m.role === 'assistant'">
                <div class="bubble-title">{{ m.role === 'user' ? 'Tú' : 'Asistente' }}</div>
                <div class="bubble-text" [style.white-space]="'pre-wrap'">{{ m.text }}</div>
                <div class="bubble-sources" *ngIf="m.role === 'assistant' && m.sources?.length">
                  <span class="source" *ngFor="let s of m.sources">{{ s }}</span>
                </div>
                <div class="bubble-actions" *ngIf="m.role === 'assistant' && m.actionsExecuted?.length">
                  <span class="action-chip" *ngFor="let a of m.actionsExecuted">{{ a }}</span>
                </div>
              </div>
            </ng-container>
          </div>

          <div class="chat-input">
            <input
              [value]="chatInput()"
              (input)="chatInput.set($any($event.target).value)"
              (keydown.enter)="sendChat()"
              placeholder="Escribe tu duda…"
              [disabled]="chatBusy()"
            />
            <button type="button" (click)="sendChat()" [disabled]="chatBusy() || !chatInput().trim()">Enviar</button>
          </div>
        </div>
      </div>

      <details class="card" open>
        <summary class="sum">Generador de diagrama (IA)</summary>
        <div class="grid" style="margin-top:12px">
          <div class="field">
            <label>Política (DRAFT)</label>
            <select [value]="policyId()" (change)="policyId.set($any($event.target).value)">
              <option value="" disabled>Selecciona…</option>
              <option *ngFor="let p of draftPolicies()" [value]="p.id">
                {{ p.name }} (v{{ p.version }})
              </option>
            </select>
          </div>

          <div class="field">
            <label>createdBy</label>
            <select [value]="createdBy()" (change)="createdBy.set($any($event.target).value)">
              <option value="" disabled>Selecciona…</option>
              <option *ngFor="let u of activeUsers()" [value]="u.id">
                {{ u.fullName }} — {{ u.email }}
              </option>
            </select>
          </div>

          <div class="field span2">
            <label>Prompt</label>
            <textarea
              rows="4"
              [value]="promptText()"
              (input)="promptText.set($any($event.target).value)"
              placeholder="Ej: Proceso de aprobación de vacaciones con validación de jefe y RRHH..."
            ></textarea>
          </div>
        </div>

        <div class="toolbar">
          <button type="button" class="secondary" (click)="reload()" [disabled]="busy()">Recargar datos</button>
          <button type="button" (click)="generate()" [disabled]="busy()">Generar</button>
          <button type="button" class="secondary" (click)="save()" [disabled]="busy() || !aiSuggestion()">
            Guardar en la política
          </button>
          <a
            class="link-as-button"
            *ngIf="policyId()"
            [routerLink]="['/policies', policyId(), 'diagram']"
            >Abrir en editor</a
          >
        </div>

        <div class="msg" *ngIf="success() || error()">
          <p class="success" *ngIf="success()">{{ success() }}</p>
          <p class="error" *ngIf="error()">{{ error() }}</p>
        </div>
      </details>

      <div class="card" *ngIf="aiSuggestion() as s">
        <h3 style="margin:0 0 8px 0">Resultado</h3>
        <p class="muted" style="margin:0 0 10px 0">{{ s.summary }}</p>

        <div class="chips" *ngIf="s.warnings.length">
          <span class="chip warn" *ngFor="let w of s.warnings">{{ w }}</span>
        </div>

        <details style="margin-top:10px" open>
          <summary>Vista previa (JSON)</summary>
          <pre class="json">{{ pretty(s.activityDiagramPayload) }}</pre>
        </details>
      </div>
    </section>
  `,
  styles: [
    `
      .sum {
        font-weight: 850;
        cursor: pointer;
      }
      .chat {
        display: grid;
        gap: 10px;
      }
      .chat-log {
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px;
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
        min-height: 260px;
        max-height: 520px;
        overflow: auto;
      }
      .bubble {
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 10px 12px;
        background: color-mix(in srgb, var(--panel-solid) 88%, transparent);
        box-shadow: var(--shadow-sm);
        margin-bottom: 10px;
      }
      .bubble.user {
        background: color-mix(in srgb, var(--primary) 10%, var(--panel-solid));
        border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
      }
      .bubble-title {
        font-weight: 850;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .bubble-text {
        font-size: 13px;
        line-height: 1.35;
      }
      .bubble-sources {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .source {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
        color: var(--muted);
      }
      .bubble-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .action-chip {
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 8px;
        background: color-mix(in srgb, #16a34a 12%, var(--panel-solid));
        border: 1px solid color-mix(in srgb, #16a34a 35%, var(--border));
        color: #166534;
      }
      .chat-input {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .field label {
        display: block;
        font-size: 12px;
        font-weight: 750;
        letter-spacing: 0.2px;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .field.span2 {
        grid-column: 1 / -1;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
        align-items: center;
      }
      .msg {
        margin-top: 12px;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: color-mix(in srgb, var(--panel-solid) 86%, transparent);
      }
      .success {
        margin: 0;
        color: #166534;
        font-weight: 650;
      }
      .error {
        margin: 0;
        color: #991b1b;
        font-weight: 650;
      }
      .json {
        margin: 10px 0 0 0;
        padding: 12px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
        overflow: auto;
        max-height: 420px;
        white-space: pre-wrap;
      }
      .chips {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin: 10px 0 0 0;
      }
      .chip {
        font-size: 12px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
      }
      .chip.warn {
        border-color: color-mix(in srgb, #ea580c 45%, var(--border));
        background: color-mix(in srgb, #ea580c 10%, var(--panel-solid));
      }
      .link-as-button {
        display: inline-block;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-solid) 82%, transparent);
        color: var(--text);
        font-size: 13px;
        text-decoration: none;
        font-weight: 650;
        box-shadow: var(--shadow-sm);
      }
    `
  ],
  styleUrls: ['../../shared/styles/admin-page.scss']
})
export class AiAssistantPage implements OnInit {
  private readonly policyService = inject(PolicyService);
  private readonly usersService = inject(UsersService);
  private readonly assistantService = inject(AiAssistantService);
  private readonly aiService = inject(AiWorkflowSuggestionService);
  private readonly diagramEditService = inject(AiDiagramEditService);
  private readonly diagramService = inject(ActivityDiagramService);

  readonly policies = signal<BusinessPolicy[]>([]);
  readonly users = signal<User[]>([]);

  readonly chatMessages = signal<
    { role: 'user' | 'assistant'; text: string; sources?: string[]; actionsExecuted?: string[] }[]
  >([]);
  readonly chatInput = signal('');
  readonly chatBusy = signal(false);

  readonly policyId = signal<string>('');
  readonly createdBy = signal<string>('');
  readonly promptText = signal<string>('');

  readonly aiSuggestion = signal<WorkflowSuggestionResponse | null>(null);
  readonly busy = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly draftPolicies = () => this.policies().filter((p) => p.status === 'DRAFT');
  readonly activeUsers = () => this.users().filter((u) => u.status === 'ACTIVE');

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.busy.set(true);
    this.clearMessages();
    forkJoin({
      policies: this.policyService.getPolicies(),
      users: this.usersService.list()
    }).subscribe({
      next: ({ policies, users }) => {
        this.policies.set(policies ?? []);
        this.users.set(users ?? []);

        const drafts = (policies ?? []).filter((p) => p.status === 'DRAFT');
        if (!this.policyId() && drafts.length) this.policyId.set(drafts[0].id);
        const actives = (users ?? []).filter((u) => u.status === 'ACTIVE');
        if (!this.createdBy() && actives.length) this.createdBy.set(actives[0].id);
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error cargando datos')),
      complete: () => this.busy.set(false)
    });
  }

  sendChat() {
    const text = (this.chatInput() ?? '').trim();
    if (!text) return;
    this.chatInput.set('');
    this.chatBusy.set(true);
    this.chatMessages.set([...this.chatMessages(), { role: 'user', text }]);

    // Examen #5: chat = crear/editar diagrama por prompt.
    // - Si el mensaje parece pregunta (manual), usamos el asistente normal.
    // - Si es acción de edición (eliminar/agregar/cambiar/conectar), aplicamos sobre el diagrama actual.
    // - Si es texto libre (cualquier frase), generamos un diagrama (si aún no hay uno).
    if (this.isDiagramWorkflowIntent(text)) {
      const policyId = (this.policyId() ?? '').trim();
      const createdBy = (this.createdBy() ?? '').trim();
      if (!policyId || !createdBy) {
        this.chatMessages.set([
          ...this.chatMessages(),
          {
            role: 'assistant',
            text:
              'Para generarlo necesito que existan datos cargados. Presiona “Recargar datos” y asegúrate de tener una política DRAFT y un usuario ACTIVE seleccionados.',
            sources: []
          }
        ]);
        this.chatBusy.set(false);
        return;
      }

      this.busy.set(true);
      this.clearMessages();
      const isEdit = this.isDiagramEditIntent(text);

      const getCurrentDiagram$ = () =>
        this.diagramService.getDiagram(policyId).pipe(
          map((d) => ({
            createdBy: (d.createdBy ?? '').trim() || createdBy,
            version: d.version,
            swimlanes: d.swimlanes ?? [],
            nodes: d.nodes ?? [],
            edges: d.edges ?? []
          })),
          catchError((err) => {
            // Si no existe diagrama, generamos primero con el mismo texto.
            if ((err as any)?.status === 404) {
              const payload: GenerateWorkflowSuggestionRequest = { policyId, createdBy, promptText: text };
              return this.aiService.generateFromText(payload).pipe(map((res) => res.activityDiagramPayload));
            }
            return of(null).pipe(
              map(() => {
                throw err;
              })
            );
          })
        );

      const applyEdit$ = () =>
        getCurrentDiagram$().pipe(
          switchMap((currentDiagram) => {
            const req: ModifyDiagramWithAiRequest = {
              policyId,
              createdBy,
              instruction: text,
              currentDiagram: currentDiagram as SaveActivityDiagramPayload
            };
            return this.diagramEditService.apply(req);
          })
        );

      const generate$ = () => {
        const payload: GenerateWorkflowSuggestionRequest = { policyId, createdBy, promptText: text };
        return this.aiService.generateFromText(payload);
      };

      (isEdit ? applyEdit$() : generate$()).subscribe({
        next: (res: any) => {
          const payload = (res as any)?.activityDiagramPayload ?? (res as any)?.activityDiagramPayload;
          if (payload) {
            // Normalizamos para que "Guardar en la política" funcione igual.
            this.aiSuggestion.set({
              suggestedPolicyName: '',
              summary: (res as any)?.summary ?? 'Propuesta generada.',
              activityDiagramPayload: payload,
              detectedActivities: [],
              detectedRoles: [],
              detectedDecisions: [],
              warnings: (res as any)?.warnings ?? []
            });
          } else {
            // Respuesta típica de generateFromText ya viene como WorkflowSuggestionResponse.
            this.aiSuggestion.set(res);
          }

          this.success.set(isEdit ? 'Cambios propuestos correctamente.' : 'Propuesta generada correctamente.');
          this.chatMessages.set([
            ...this.chatMessages(),
            {
              role: 'assistant',
              text: isEdit
                ? 'Listo: apliqué tu cambio al diagrama. Abajo verás el “Resultado (JSON)”. Si te gustó, dale “Guardar en la política”.'
                : 'Listo: generé el diagrama. Abajo verás el “Resultado (JSON)”. Ahora puedes “Guardar en la política” y “Abrir en editor”.',
              sources: isEdit ? ['Edición de diagrama (IA)'] : ['Generador de diagrama (IA)']
            }
          ]);
        },
        error: (e) => {
          this.chatMessages.set([
            ...this.chatMessages(),
            { role: 'assistant', text: mapHttpError(e, isEdit ? 'Error editando el diagrama' : 'Error generando el diagrama'), sources: [] }
          ]);
        },
        complete: () => {
          this.busy.set(false);
          this.chatBusy.set(false);
        }
      });
      return;
    }

    const actorUserId = (this.createdBy() ?? '').trim();
    this.assistantService
      .chat({
        message: text,
        ...(actorUserId ? { actorUserId } : {}),
        executeActions: true
      })
      .subscribe({
      next: (res) => {
        this.chatMessages.set([
          ...this.chatMessages(),
          {
            role: 'assistant',
            text: res.answer ?? 'No pude responder.',
            sources: res.sources ?? [],
            actionsExecuted: res.actionsExecuted?.length ? res.actionsExecuted : undefined
          }
        ]);
      },
      error: (e) => {
        this.chatMessages.set([
          ...this.chatMessages(),
          { role: 'assistant', text: mapHttpError(e, 'Error del asistente IA'), sources: [] }
        ]);
      },
      complete: () => this.chatBusy.set(false)
    });
  }

  /**
   * Solo mensajes claramente orientados a diagrama/flujo van al generador UML.
   * Frases empíricas («notifícame», «cuántas tareas», «explica el manual») van al asistente + API.
   */
  private isDiagramWorkflowIntent(text: string): boolean {
    const t = (text ?? '').trim();
    if (!t) return false;
    if (this.isDiagramEditIntent(text)) return true;
    const lower = t.toLowerCase();
    const mentionsDiagram =
      /\b(diagrama|diagramas|flujo|uml|nodo|nodos|flecha|flechas|transición|transicion|carril|calle|swimlane|bpmn)\b/i.test(
        t
      );
    const generateDiagram =
      /\b(generar|genera|crear|diseñar|diseña|actualiza|guarda)\b/i.test(lower) &&
      /\b(diagrama|flujo)\b/i.test(lower);
    return mentionsDiagram || generateDiagram;
  }

  private isDiagramEditIntent(text: string): boolean {
    const t = (text ?? '').toLowerCase();
    return (
      t.includes('elimina') ||
      t.includes('borra') ||
      t.includes('quita') ||
      t.includes('agrega') ||
      t.includes('añade') ||
      t.includes('adiciona') ||
      t.includes('inserta') ||
      t.includes('cambia') ||
      t.includes('renombra') ||
      t.includes('conecta') ||
      t.includes('une') ||
      t.includes('condicion') ||
      t.includes('condición') ||
      t.includes('aprob') ||
      t.includes('rechaz')
    );
  }

  generate() {
    const policyId = (this.policyId() ?? '').trim();
    const createdBy = (this.createdBy() ?? '').trim();
    const promptText = (this.promptText() ?? '').trim();

    if (!policyId) return this.error.set('Selecciona una política.');
    if (!createdBy) return this.error.set('Selecciona createdBy.');
    if (!promptText) return this.error.set('Escribe el prompt.');

    this.busy.set(true);
    this.clearMessages();
    this.aiSuggestion.set(null);

    const payload: GenerateWorkflowSuggestionRequest = { policyId, createdBy, promptText };
    this.aiService.generateFromText(payload).subscribe({
      next: (res) => {
        this.aiSuggestion.set(res);
        this.success.set('Propuesta generada correctamente.');
      },
      error: (e) => this.error.set(mapHttpError(e, 'Error generando propuesta IA')),
      complete: () => this.busy.set(false)
    });
  }

  save() {
    const policyId = (this.policyId() ?? '').trim();
    const s = this.aiSuggestion();
    if (!policyId || !s?.activityDiagramPayload) return;

    const payload: SaveActivityDiagramPayload = {
      ...s.activityDiagramPayload,
      createdBy: (s.activityDiagramPayload.createdBy ?? '').trim() || (this.createdBy() ?? '').trim()
    };

    this.busy.set(true);
    this.clearMessages();

    this.diagramService
      .getDiagram(policyId)
      .pipe(
        switchMap(() => this.diagramService.updateDiagram(policyId, payload)),
        catchError((err) => {
          // Si no existe, creamos (404)
          if ((err as any)?.status === 404) {
            return this.diagramService.createDiagram(policyId, payload);
          }
          return of(null).pipe(
            map(() => {
              throw err;
            })
          );
        })
      )
      .subscribe({
        next: (res) => {
          if (!res) return;
          this.success.set('Diagrama guardado correctamente en la política.');
        },
        error: (e) => this.error.set(mapHttpError(e, 'Error guardando el diagrama')),
        complete: () => this.busy.set(false)
      });
  }

  pretty(v: unknown) {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }

  private clearMessages() {
    this.success.set(null);
    this.error.set(null);
  }
}

