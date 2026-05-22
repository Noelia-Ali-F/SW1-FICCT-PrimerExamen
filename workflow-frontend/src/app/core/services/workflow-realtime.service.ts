import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface WorkflowEvent {
  type: string;
  ts: string;
  payload: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class WorkflowRealtimeService {
  private ws: WebSocket | null = null;
  private readonly eventsSubject = new Subject<WorkflowEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = this.computeWsUrl();
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as WorkflowEvent;
        if (data?.type) this.eventsSubject.next(data);
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      // Reintento simple (MVP)
      this.ws = null;
      setTimeout(() => this.connect(), 1200);
    };
  }

  disconnect() {
    try {
      this.ws?.close();
    } catch {
      // ignore
    } finally {
      this.ws = null;
    }
  }

  private computeWsUrl(): string {
    // API_BASE_URL puede ser absoluto ("http://host/api") o relativo ("/api").
    const raw = (API_BASE_URL || '').replace(/\/api\/?$/, ''); // "http://host" o "" si era "/api"
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

