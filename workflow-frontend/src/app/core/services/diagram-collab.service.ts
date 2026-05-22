import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { API_BASE_URL } from './api.config';

/** Mensajes colaborativos del editor (broadcast vía WebSocket). */
export type DiagramCollabPresenceMessage = {
  type: 'DIAGRAM_COLLAB';
  action: 'join' | 'leave' | 'cursor' | 'ping' | 'comment';
  policyId: string;
  clientId: string;
  userName?: string;
  x?: number;
  y?: number;
  text?: string;
  nodeId?: string;
  ts?: string;
};

export type DiagramOp =
  | { op: 'ADD_NODE'; node: any }
  | { op: 'MOVE_NODE'; nodeId: string; x: number; y: number }
  | { op: 'UPDATE_NODE'; nodeId: string; patch: any }
  | { op: 'DELETE_NODE'; nodeId: string }
  | { op: 'ADD_EDGE'; edge: any }
  | { op: 'UPDATE_EDGE'; edgeId: string; patch: any }
  | { op: 'DELETE_EDGE'; edgeId: string }
  | { op: 'SYNC_STATE'; diagram: any }
  | {
      op: 'UPDATE_SWIMLANE';
      swimlaneId: string;
      /** Campos opcionales a fusionar sobre la swimlane */
      patch: Partial<{ name: string; positionX: number; positionY: number; width: number; height: number }>;
    }
  | { op: 'ADD_SWIMLANE'; swimlane: any }
  | { op: 'DELETE_SWIMLANE'; swimlaneId: string }
  /** Reemplazo atómico de todas las calles (p. ej. «reordenar a columnas UML»). */
  | { op: 'SET_SWIMLANES'; swimlanes: any[] };

export type DiagramCollabOpMessage = {
  type: 'DIAGRAM_OP';
  policyId: string;
  clientId: string;
  userName?: string;
  /** Opcional: si viene, solo el cliente destino debe aplicar el mensaje */
  targetClientId?: string;
  op: DiagramOp;
  ts?: string;
};

export type DiagramCollabMessage = DiagramCollabPresenceMessage | DiagramCollabOpMessage;

@Injectable({ providedIn: 'root' })
export class DiagramCollabService {
  private ws: WebSocket | null = null;
  private readonly incoming = new Subject<DiagramCollabMessage>();
  readonly messages$ = this.incoming.asObservable();
  /** Debug/estado (para UI): conexión y últimos eventos. */
  private readonly stateSubject = new Subject<{
    connected: boolean;
    ts: string;
    lastType?: string;
    lastPolicyId?: string;
    receivedCount?: number;
    error?: string;
  }>();
  readonly state$ = this.stateSubject.asObservable();
  private receivedCount = 0;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  /** Si el usuario cerró a propósito, no reconectar en bucle. */
  private allowReconnect = true;

  private readonly outgoingQueue: DiagramCollabMessage[] = [];
  private lastJoin: DiagramCollabPresenceMessage | null = null;

  connect(): void {
    this.allowReconnect = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const wsUrl = this.computeWsUrl();
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.stateSubject.next({ connected: true, ts: new Date().toISOString(), receivedCount: this.receivedCount });

      // Re-join automático tras reconexión (clave para salas/rooms en backend).
      if (this.lastJoin && this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ ...this.lastJoin, ts: new Date().toISOString() }));
        } catch {
          // si falla, se reintentará con cola/reconexión
          this.outgoingQueue.unshift(this.lastJoin);
        }
      }

      // flush mensajes en cola
      while (this.outgoingQueue.length && this.ws?.readyState === WebSocket.OPEN) {
        const m = this.outgoingQueue.shift()!;
        try {
          this.ws.send(JSON.stringify({ ...m, ts: new Date().toISOString() }));
        } catch {
          // si falla, parar flush (se reintentará en reconexión)
          this.outgoingQueue.unshift(m);
          break;
        }
      }
    };
    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as DiagramCollabMessage;
        if (data?.type === 'DIAGRAM_COLLAB' || data?.type === 'DIAGRAM_OP') {
          this.receivedCount++;
          this.stateSubject.next({
            connected: true,
            ts: new Date().toISOString(),
            lastType: (data as any).type,
            lastPolicyId: (data as any).policyId,
            receivedCount: this.receivedCount
          });
          this.incoming.next(data);
        }
      } catch {
        // ignorar mensajes que no sean JSON colaborativo
      }
    };
    this.ws.onclose = () => {
      this.ws = null;
      this.stateSubject.next({ connected: false, ts: new Date().toISOString(), receivedCount: this.receivedCount });
      if (!this.allowReconnect) {
        return;
      }
      // Reintento simple con backoff (hasta ~10s)
      const delay = Math.min(10000, 800 + this.reconnectAttempts * 700);
      this.reconnectAttempts++;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
    this.ws.onerror = () => {
      this.stateSubject.next({
        connected: false,
        ts: new Date().toISOString(),
        receivedCount: this.receivedCount,
        error: 'WS error'
      });
    };
  }

  disconnect(): void {
    this.allowReconnect = false;
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.ws?.close();
    } catch {
      // ignore
    } finally {
      this.ws = null;
      this.lastJoin = null;
      this.stateSubject.next({ connected: false, ts: new Date().toISOString(), receivedCount: this.receivedCount });
    }
  }

  send(msg: DiagramCollabMessage): void {
    // Recordar el último join para re-join en reconexión.
    if (msg.type === 'DIAGRAM_COLLAB' && msg.action === 'join') {
      this.lastJoin = msg;
    }
    if (msg.type === 'DIAGRAM_COLLAB' && msg.action === 'leave') {
      if (this.lastJoin && this.lastJoin.policyId === msg.policyId && this.lastJoin.clientId === msg.clientId) {
        this.lastJoin = null;
      }
    }

    // Si no está abierto, encolamos para flush en onopen.
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.outgoingQueue.push(msg);
      // asegurar intento de conexión
      this.connect();
      return;
    }
    try {
      this.ws.send(JSON.stringify({ ...msg, ts: new Date().toISOString() }));
    } catch {
      this.outgoingQueue.push(msg);
    }
  }

  private computeWsUrl(): string {
    const raw = (API_BASE_URL || '').replace(/\/api\/?$/, '');
    const origin = (() => {
      try {
        return window.location.origin;
      } catch {
        return '';
      }
    })();
    const httpBase = raw.startsWith('http://') || raw.startsWith('https://') ? raw : origin;
    const wsBase = httpBase.startsWith('https://')
      ? httpBase.replace('https://', 'wss://')
      : httpBase.replace('http://', 'ws://');
    return `${wsBase}/ws/workflow-events`;
  }
}
