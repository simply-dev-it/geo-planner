import { HttpClient } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Project, ProjectApi, ResolvedParcel } from 'geo-planner-api';
import { Subscription } from 'rxjs';

import { RuntimeConfigService } from '../../core/runtime-config/runtime-config';
import { parcelCountLabel } from '../project-creation/working-area';
import { AoiMapAdapter } from '../project-creation/aoi-map-adapter';

@Component({
  selector: 'app-project-detail-page',
  imports: [RouterLink],
  template: `
    <section class="saved-map">
      <div
        #mapHost
        class="map"
        role="region"
        aria-label="Mapa zapisanego projektu"
        [attr.aria-busy]="loading() || (!rendered() && !error())"
        tabindex="0"
      ></div>
      <div class="title-card">
        <a routerLink="/projects/new" class="text-xs text-emerald-800">← Nowy projekt</a>
        @if (project(); as item) {
          <h1>{{ item.name }}</h1>
          <span class="text-xs text-stone-500"
            >Wycinek projektu · {{ item.workingExtent.widthMetres }} ×
            {{ item.workingExtent.heightMetres }} m ·
            {{ parcelCountLabel(item.parcelIds.length) }}</span
          >
        }
        @if (loading()) {
          <p role="status">Otwieranie projektu…</p>
        }
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
      </div>
      @if (project(); as item) {
        <details class="source-card">
          <summary>Źródło i ograniczenia</summary>
          <div class="pt-2">
            <p>
              {{ item.provenance.provider }} · {{ item.provenance.sourceDataDate ?? 'brak daty' }} ·
              EPSG:2180
            </p>
            @for (l of item.provenance.limitations; track $index) {
              <p>{{ l }}</p>
            }
            <p>Podgląd poglądowy. Nie potwierdza granic ani stanu prawnego.</p>
          </div>
        </details>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }
      .saved-map {
        height: 100%;
        position: relative;
      }
      .map {
        height: 100%;
        width: 100%;
        background: #e5ecde;
      }
      .title-card {
        position: absolute;
        top: 16px;
        left: 52px;
        max-width: calc(100% - 70px);
        border: 1px solid #d8e3d6;
        border-radius: 9px;
        background: #fffffff0;
        padding: 12px 18px;
        box-shadow: 0 3px 16px #193f2512;
      }
      .title-card h1 {
        font-size: 20px;
        font-weight: 650;
        margin: 5px 0;
      }
      .source-card {
        position: absolute;
        bottom: 12px;
        right: 12px;
        max-width: min(400px, 90%);
        max-height: 50%;
        overflow: auto;
        border-radius: 6px;
        background: #fffffff0;
        padding: 8px 12px;
        font-size: 11px;
        color: #50634e;
      }
      .source-card summary {
        cursor: pointer;
      }
      .source-card p {
        margin-top: 6px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailPage implements AfterViewInit, OnDestroy {
  @ViewChild('mapHost', { static: true }) private mapHost!: ElementRef<HTMLElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly api = new ProjectApi(inject(HttpClient), {
    apiBaseUrl: `${inject(RuntimeConfigService).value.apiBaseUrl.replace(/\/$/, '')}/v1`,
  });
  private map?: AoiMapAdapter;
  private request?: Subscription;
  readonly parcelCountLabel = parcelCountLabel;
  readonly project = signal<Project | null>(null);
  readonly loading = signal(true);
  readonly rendered = signal(false);
  readonly error = signal<string | null>(null);

  ngAfterViewInit(): void {
    const tileUrl = this.api.mapTileUrl('base-map', 0, 0, 0).replace(/0\/0\/0$/, '{z}/{x}/{y}');
    const id = this.route.snapshot.paramMap.get('id');
    try {
      if (!id) throw new Error('Missing project ID');
      this.request = this.api.get(id).subscribe({
        next: ({ data }) => {
          this.loading.set(false);
          this.project.set(data);
          this.map = new AoiMapAdapter(this.mapHost.nativeElement, tileUrl, {
            onPoint: () => undefined,
            onExtentChanged: () => undefined,
            onRenderComplete: () => this.rendered.set(true),
            onTileError: () => this.error.set('Podkład mapy jest niedostępny.'),
          });

          this.map?.setProjectFrame(data.workingExtent.bounds);
          const parcels: ResolvedParcel[] = data.selectedParcels.flatMap((parcel) =>
            parcel.id && parcel.geometry
              ? [
                  {
                    id: parcel.id,
                    geometry: parcel.geometry,
                    crs: parcel.crs,
                    axisOrder: parcel.axisOrder,
                    source: parcel.source,
                    sourceDataDate: parcel.sourceDataDate,
                    limitations: [],
                  },
                ]
              : [],
          );
          this.map?.setParcels(parcels);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Nie udało się otworzyć projektu.');
        },
      });
    } catch {
      this.loading.set(false);
      this.error.set('Nieprawidłowy identyfikator projektu.');
    }
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
    this.map?.destroy();
  }
}
