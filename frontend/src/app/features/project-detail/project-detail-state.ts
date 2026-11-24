import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Project } from 'geo-planner-api';
import { Subscription } from 'rxjs';

import { PROJECT_API, baseMapTileTemplate } from '../../core/project-api/project-api';

/** Owns loading of one saved project for the read-only project map. */
@Injectable()
export class ProjectDetailState {
  private readonly api = inject(PROJECT_API);
  private request?: Subscription;
  private readonly _project = signal<Project | null>(null);
  readonly project = this._project.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();
  readonly tileUrl = baseMapTileTemplate(this.api);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  open(id: string | null): void {
    this.request?.unsubscribe();
    this._project.set(null);
    this._error.set(null);
    let request;
    try {
      if (!id) throw new Error('Missing project ID');
      request = this.api.get(id);
    } catch {
      this._loading.set(false);
      this._error.set('Nieprawidłowy identyfikator projektu.');
      return;
    }
    this._loading.set(true);
    this.request = request.subscribe({
      next: ({ data }) => {
        this._loading.set(false);
        this._project.set(data);
      },
      error: () => {
        this._loading.set(false);
        this._error.set('Nie udało się otworzyć projektu.');
      },
    });
  }
}
