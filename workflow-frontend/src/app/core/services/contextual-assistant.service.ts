import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

export interface ContextualAssistantContent {
  /** Etiqueta corta del módulo (UI). */
  moduleLabel: string;
  message: string;
  suggestions: string[];
}

@Injectable({ providedIn: 'root' })
export class ContextualAssistantService {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Ruta normalizada sin query ni hash (ej. `/policies/abc/diagram`). */
  readonly currentPath = signal<string>(this.normalizePath(this.router.url));

  readonly content = computed<ContextualAssistantContent>(() =>
    this.resolveForPath(this.currentPath())
  );

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map((e) => this.normalizePath(e.urlAfterRedirects)),
        startWith(this.normalizePath(this.router.url)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((path) => this.currentPath.set(path));
  }

  private normalizePath(raw: string): string {
    const path = raw.split('#')[0]?.split('?')[0] ?? raw;
    if (!path) return '/';
    return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  }

  private resolveForPath(path: string): ContextualAssistantContent {
    if (/^\/policies\/[^/]+\/diagram$/.test(path)) {
      return {
        moduleLabel: 'Editor de diagrama UML 2.5',
        message:
          'Estás en el Editor de Diagrama UML 2.5. Aquí defines el flujo de actividades, responsables, decisiones y condiciones.',
        suggestions: [
          'Primero crea o genera un diagrama.',
          'Luego guarda y valida el diagrama.',
          'Configura formularios y condiciones antes de activar la política.',
          'Puedes usar el asistente IA para generar una propuesta desde texto o voz.'
        ]
      };
    }

    if (/^\/process-instances\/.+/.test(path)) {
      return {
        moduleLabel: 'Monitoreo y trazabilidad',
        message:
          'Estás en Monitoreo y Trazabilidad. Aquí puedes revisar el avance del trámite, tareas e historial.',
        suggestions: [
          'Consulta qué actividades están pendientes.',
          'Revisa la línea de tiempo para ver quién hizo cada acción.'
        ]
      };
    }

    if (path === '/process-instances') {
      return {
        moduleLabel: 'Trámites',
        message:
          'Estás en Trámites. Aquí puedes crear instancias de proceso a partir de políticas activas.',
        suggestions: [
          'Solo las políticas ACTIVE pueden iniciar trámites.',
          'Cada trámite genera tareas para los responsables.'
        ]
      };
    }

    if (path === '/roles') {
      return {
        moduleLabel: 'Roles',
        message:
          'Estás en Roles. Aquí puedes crear perfiles de acceso que luego serán usados para asignar responsabilidades en los workflows.',
        suggestions: [
          'Crea roles como Administrador, Diseñador, Funcionario y Supervisor.',
          'Los roles se usarán en las calles del diagrama.'
        ]
      };
    }

    if (path === '/departments') {
      return {
        moduleLabel: 'Departamentos',
        message:
          'Estás en Departamentos. Aquí defines las áreas responsables que pueden participar en las políticas de negocio.',
        suggestions: [
          'Crea departamentos antes de configurar swimlanes.',
          'Un departamento puede ser responsable de una actividad.'
        ]
      };
    }

    if (path === '/users') {
      return {
        moduleLabel: 'Usuarios',
        message: 'Estás en Usuarios. Aquí registras las personas que utilizarán el sistema.',
        suggestions: [
          'Cada usuario debe tener rol y departamento.',
          'Los funcionarios ejecutarán actividades asignadas.'
        ]
      };
    }

    if (path === '/policies') {
      return {
        moduleLabel: 'Políticas de negocio',
        message:
          'Estás en Políticas de negocio. Aquí puedes crear, editar, versionar, desactivar o activar políticas.',
        suggestions: [
          'Una política solo puede activarse si tiene un diagrama válido.',
          'Usa el botón Diseñar diagrama para crear el workflow.'
        ]
      };
    }

    if (path === '/my-tasks') {
      return {
        moduleLabel: 'Mis actividades',
        message:
          'Estás en Mis actividades. Aquí los funcionarios ejecutan las tareas asignadas.',
        suggestions: [
          'Selecciona un usuario para simular sesión.',
          'Inicia la tarea antes de completarla.',
          'Si el flujo llega a una decisión, envía la condición correspondiente.'
        ]
      };
    }

    if (path === '/reports') {
      return {
        moduleLabel: 'Reportes',
        message: 'Estás en Reportes. Aquí se muestran indicadores de procesos y tareas.',
        suggestions: [
          'Revisa tareas pendientes y procesos en ejecución.',
          'Estos datos pueden ayudar a detectar cuellos de botella.'
        ]
      };
    }

    return {
      moduleLabel: 'Sistema',
      message:
        'Bienvenido al sistema de gestión de políticas de negocio. Usa el menú lateral para navegar por los módulos principales.',
      suggestions: []
    };
  }
}
