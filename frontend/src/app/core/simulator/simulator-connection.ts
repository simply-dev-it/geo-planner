import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal, InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';
interface Catalog {
  parcels: { id: string; parcelNumber: string; contextLabel: string }[];
}
export const SIMULATOR_BUILD = new InjectionToken<boolean>('simulator-build', {
  providedIn: 'root',
  factory: () => environment.simulator,
});
@Injectable({ providedIn: 'root' })
export class SimulatorConnection {
  private readonly enabled = inject(SIMULATOR_BUILD);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly _connected = signal(false);
  readonly connected = this._connected.asReadonly();
  private readonly _catalog = signal<Catalog | null>(null);
  readonly catalog = this._catalog.asReadonly();
  private readonly _open = signal(false);
  readonly open = this._open.asReadonly();
  constructor() {
    if (this.enabled && this.http)
      this.http.get<unknown>('/_simulator/health').subscribe({
        next: (value) => {
          if (
            value &&
            typeof value === 'object' &&
            'mode' in value &&
            (value.mode === 'offline-fixtures' || value.mode === 'synthetic-fixtures') &&
            'status' in value &&
            value.status === 'ready' &&
            'service' in value &&
            value.service === 'geo-planner-contract-simulator'
          )
            this._connected.set(true);
        },
        error: () => this._connected.set(false),
      });
  }
  hide() {
    this._open.set(false);
  }
  show() {
    if (!this.enabled || !this._connected() || !this.http) return;
    this.http.get<unknown>('/_simulator/catalog').subscribe({
      next: (value) => {
        if (
          !value ||
          typeof value !== 'object' ||
          !('parcels' in value) ||
          !Array.isArray(value.parcels) ||
          value.parcels.length > 100
        )
          return;
        const parcels = value.parcels.filter(
          (p: unknown): p is Catalog['parcels'][number] =>
            !!p &&
            typeof p === 'object' &&
            'id' in p &&
            typeof p.id === 'string' &&
            'parcelNumber' in p &&
            typeof p.parcelNumber === 'string' &&
            'contextLabel' in p &&
            typeof p.contextLabel === 'string',
        );
        this._catalog.set({ parcels });
        this._open.set(true);
      },
      error: () => {
        this._connected.set(false);
        this._open.set(false);
      },
    });
  }
}
