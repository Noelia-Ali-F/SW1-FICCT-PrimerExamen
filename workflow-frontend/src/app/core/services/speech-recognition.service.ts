import { Injectable } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';

/** Tipos mínimos para Web Speech API (prefijo webkit en Chromium). */
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private listening = false;

  isSupported(): boolean {
    return typeof window !== 'undefined' && !!this.getCtor();
  }

  private getCtor(): SpeechRecognitionCtor | null {
    const w = window as WindowWithSpeech;
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  }

  /**
   * Inicia el reconocimiento continuo. Emite cada vez que el motor entrega un segmento final.
   * Al llamar a {@link stopListening} o al cerrar el micrófono, el observable se completa.
   * La desuscripción invoca {@link stopListening}.
   */
  startListening(options?: { lang?: string }): Observable<string> {
    const Ctor = this.getCtor();
    if (!Ctor) {
      return new Observable((sub) => sub.error(new Error('unsupported')));
    }
    if (this.listening) {
      return new Observable((sub) => sub.error(new Error('already_listening')));
    }

    this.listening = true;
    return new Observable((subscriber: Subscriber<string>) => {
      let finished = false;
      const safeComplete = () => {
        if (finished) return;
        finished = true;
        this.clearRecognitionRef();
        this.listening = false;
        subscriber.complete();
      };
      const safeError = (err: unknown) => {
        if (finished) return;
        finished = true;
        this.clearRecognitionRef();
        this.listening = false;
        subscriber.error(err);
      };

      let r: SpeechRecognitionInstance;
      try {
        r = new Ctor();
      } catch (e) {
        this.listening = false;
        subscriber.error(e);
        return;
      }

      this.recognition = r;
      r.continuous = true;
      r.interimResults = true;
      r.lang = options?.lang ?? 'es-ES';

      r.onresult = (event: SpeechRecognitionResultEvent) => {
        let chunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const row = event.results[i];
          if (row.isFinal) {
            chunk += row[0]?.transcript ?? '';
          }
        }
        const t = chunk.trim();
        if (t) subscriber.next(t);
      };

      r.onerror = (ev: SpeechRecognitionErrorEvent) => {
        safeError(new Error(ev.error || 'speech_error'));
      };

      r.onend = () => {
        safeComplete();
      };

      try {
        r.start();
      } catch (e) {
        safeError(e);
      }

      return () => {
        if (!finished) {
          try {
            r.stop();
          } catch {
            try {
              r.abort();
            } catch {
              /* ignore */
            }
            safeComplete();
          }
        }
      };
    });
  }

  stopListening(): void {
    const r = this.recognition;
    if (!r) return;
    try {
      r.stop();
    } catch {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
    }
  }

  private clearRecognitionRef(): void {
    this.recognition = null;
  }

  isActive(): boolean {
    return this.listening;
  }
}
