import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Project, ResolvedParcel } from 'geo-planner-api';

import { parcelCountLabel } from '../project-creation/working-area';
import { AoiMapAdapter } from '../project-creation/aoi-map-adapter';
import { ProjectDetailState } from './project-detail-state';

@Component({
  selector: 'app-project-detail-page',
  providers: [ProjectDetailState],
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
      @if (attributions().length) {
        <p class="map-attribution">Podkład: {{ attributions().join(' · ') }}</p>
      }
      @if (project(); as item) {
        <details class="source-card">
          <summary>Źródło i ograniczenia</summary>
          <div class="pt-2">
            <p>
              {{ item.provenance.provider }} · {{ item.provenance.sourceDataDate ?? 'brak daty' }} ·
              EPSG:2180
            </p>
            @if (item.provenance.attribution) {
              <p>{{ item.provenance.attribution }}</p>
            }
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
      .map-attribution {
        position: absolute;
        left: 10px;
        bottom: 12px;
        max-width: calc(100% - 200px);
        border-radius: 4px;
        background: #ffffffde;
        padding: 4px 7px;
        font-size: 10px;
        line-height: 1.3;
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
export class ProjectDetailPage implements OnInit, OnDestroy {
  @ViewChild('mapHost', { static: true }) private mapHost!: ElementRef<HTMLElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly state = inject(ProjectDetailState);
  private map?: AoiMapAdapter;
  private readonly mapError = signal<string | null>(null);
  readonly parcelCountLabel = parcelCountLabel;
  readonly project = this.state.project;
  readonly loading = this.state.loading;
  readonly rendered = signal(false);
  readonly attributions = signal<readonly string[]>([]);
  readonly error = computed(() => this.state.error() ?? this.mapError());

  constructor() {
    effect(() => {
      const project = this.state.project();
      if (project && !this.map) this.render(project);
    });
  }

  ngOnInit(): void {
    this.state.open(this.route.snapshot.paramMap.get('id'));
  }

  private render(project: Project): void {
    this.map = new AoiMapAdapter(this.mapHost.nativeElement, this.state.tileUrl, {
      onPoint: () => undefined,
      onExtentChanged: () => undefined,
      onRenderComplete: () => this.rendered.set(true),
      onTileError: () => this.mapError.set('Podkład mapy jest niedostępny.'),
      onAttributionsChanged: (texts) => this.attributions.set(texts),
    });
    this.map.setProjectFrame(project.workingExtent.bounds);
    const parcels: ResolvedParcel[] = project.selectedParcels.flatMap((parcel) =>
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
    this.map.setParcels(parcels);
  }

  ngOnDestroy(): void {
    this.map?.destroy();
  }
}
