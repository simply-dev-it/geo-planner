import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { form, required, maxLength, min, max, disabled } from '@angular/forms/signals';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, Subscription, catchError, map, of, switchMap, timer } from 'rxjs';
import {
  CreateProjectRequest,
  ParcelIntersectionResult,
  Preview,
  ProjectApi,
  ProjectApiError,
  Provenance,
  ResolvedParcel,
  SearchCandidate,
  SearchOptions,
} from 'geo-planner-api';
import { SearchState, SearchRow, ParcelRow, LookupStage } from 'ui';
import { PROJECT_API, baseMapTileTemplate } from '../../core/project-api/project-api';
import {
  Bounds,
  boundsOfCoordinates,
  centeredArea,
  parcelNumber,
  parcelCountLabel,
  proposedWorkingArea,
  roundMapBounds,
  validWorkingArea,
} from './working-area';
const INSERTED_AREA_METRES = 500;
const PENDING = 'geo-planner.pending-project-create.v1',
  PREFS = 'geo-planner.workspace-preferences.v1';
interface Attempt {
  key: string;
  request: CreateProjectRequest;
}
const emptySearch: SearchState = { query: '', regionId: '', type: '' };
@Injectable()
export class ProjectCreationState {
  private readonly api = inject(PROJECT_API);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly queries = new Subject<(SearchState & { auto?: boolean }) | null>();
  private readonly viewports = new Subject<Bounds | null>();
  private readonly _contextParcels = signal<ResolvedParcel[]>([]);
  readonly contextParcels = this._contextParcels.asReadonly();
  private readonly _contextProvenance = signal<Provenance | null>(null);
  readonly contextProvenance = this._contextProvenance.asReadonly();
  private readonly _contextStatus = signal('Przybliż mapę, aby zobaczyć obrysy działek.');
  readonly contextStatus = this._contextStatus.asReadonly();
  private pageRequest?: Subscription;
  private areaRequest?: Subscription;
  private parcelRequest?: Subscription;
  private previewRequest?: Subscription;
  private revision = 0;
  private attempt: Attempt | null = null;
  private readonly _lookupStage = signal<LookupStage>('locality');
  readonly lookupStage = this._lookupStage.asReadonly();
  private readonly _lookupStreet = signal<SearchCandidate | null>(null);
  readonly lookupStreet = this._lookupStreet.asReadonly();
  private readonly _locatedParcel = signal<ResolvedParcel | null>(null);
  readonly locatedParcel = this._locatedParcel.asReadonly();
  private readonly _mapIntent = signal(false);
  readonly canAddLocated = computed(
    () =>
      !!this._locatedParcel() && !this._selected().some((p) => p.id === this._locatedParcel()!.id),
  );
  private readonly _query = signal<SearchState>({ ...emptySearch });
  readonly query = this._query.asReadonly();
  private readonly _results = signal<SearchCandidate[]>([]);
  readonly results = this._results.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _searchError = signal<string | null>(null);
  readonly searchError = this._searchError.asReadonly();
  private readonly _submitted = signal(false);
  readonly submitted = this._submitted.asReadonly();
  readonly lookupNotice = signal<string | null>(null);
  private readonly _contextPrompt = signal<string | null>(null);
  readonly contextPrompt = this._contextPrompt.asReadonly();
  private readonly _cursor = signal<string | null>(null);
  readonly hasMore = computed(() => !!this._cursor());
  private readonly _selected = signal<ResolvedParcel[]>([]);
  readonly selected = this._selected.asReadonly();
  private readonly _bounds = signal<Bounds | null>(null);
  readonly bounds = this._bounds.asReadonly();
  readonly areaInvalid = computed(() => !!this._bounds() && !validWorkingArea(this._bounds()!));
  readonly areaError = computed(() =>
    this.areaInvalid() ? 'Obszar przekracza limit 2 × 2 km lub ma nieprawidłowy kształt.' : null,
  );
  private readonly _viewport = signal<Bounds | null>(null);
  private readonly _chosenLocality = signal<SearchCandidate | null>(null);
  readonly chosenLocality = this._chosenLocality.asReadonly();
  private readonly _locationLabel = signal<string | null>(null);
  readonly locationLabel = this._locationLabel.asReadonly();
  readonly hasSpatialIntent = computed(
    () =>
      this._mapIntent() ||
      !!this._locationLabel() ||
      this._selected().length > 0 ||
      (!!this._bounds() && !this.areaInvalid()),
  );
  readonly canContinue = computed(() => !this.locked() && this.hasSpatialIntent());
  readonly canPreview = computed(() => !this.locked() && !!this._bounds() && !this.areaInvalid());
  private readonly _discovery = signal<ParcelIntersectionResult | null>(null);
  readonly discovery = this._discovery.asReadonly();
  private readonly _discoveryLoading = signal(false);
  readonly discoveryLoading = this._discoveryLoading.asReadonly();
  private readonly _discoveryError = signal<string | null>(null);
  readonly discoveryError = this._discoveryError.asReadonly();
  private readonly _preview = signal<Preview | null>(null);
  readonly preview = this._preview.asReadonly();
  private readonly _step = signal(0);
  readonly step = this._step.asReadonly();
  private readonly _busy = signal(false);
  readonly busy = this._busy.asReadonly();
  private readonly _uncertain = signal(false);
  readonly uncertain = this._uncertain.asReadonly();
  readonly canRetrySave = computed(
    () => this._uncertain() && this.attempt !== null && !this._busy(),
  );
  readonly locked = computed(() => this._busy() || this._uncertain());
  readonly editable = computed(() => !this.locked() && this._step() < 2);
  readonly canEditArea = computed(() => !this.locked() && this._step() === 1);
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();
  private readonly _camera = signal<Bounds | null>(null);
  readonly camera = this._camera.asReadonly();
  private readonly model = signal({ name: '', buffer: 100 });
  readonly details = form(this.model, (p) => {
    required(p.name);
    maxLength(p.name, 160);
    min(p.buffer, 0);
    max(p.buffer, 500);
    disabled(p, { when: () => this.locked() });
  });
  readonly buffer = computed(() => this.model().buffer);
  readonly selectedCount = computed(() =>
    this._uncertain() && this.attempt
      ? this.attempt.request.parcelIds.length
      : this._selected().length,
  );
  readonly selectionSummary = computed(() => parcelCountLabel(this.selectedCount()));
  readonly suggested = computed(() => {
    const ids = new Set(this._selected().map((p) => p.id));
    return (this._discovery()?.candidates ?? []).filter((p) => !ids.has(p.id));
  });
  readonly dimensions = computed(() => {
    const b = this._bounds();
    if (!b) return null;
    const format = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
    return `${format.format(b[2] - b[0])} × ${format.format(b[3] - b[1])} m`;
  });
  readonly resultRows = computed<SearchRow[]>(() =>
    this._results().map((p) => ({
      id: p.id,
      label: p.label,
      context: p.contextLabel ?? '',
      kind: {
        parcel: 'Działka',
        locality: 'Miejscowość',
        street: 'Ulica',
        voivodeship: 'Województwo',
        point_address: 'Adres',
      }[p.type],
    })),
  );
  readonly selectedRows = computed<ParcelRow[]>(() =>
    this._selected().map((p) => ({
      id: p.id,
      label: p.parcelNumber ?? parcelNumber(p.id),
      context: p.contextLabel,
    })),
  );
  readonly suggestionRows = computed<ParcelRow[]>(() =>
    this.suggested().map((p) => ({
      id: p.id,
      label: p.parcelNumber ?? parcelNumber(p.id),
      context: p.contextLabel,
    })),
  );
  readonly canSave = computed(
    () =>
      this._preview()?.status === 'ready' &&
      !this.locked() &&
      !!this.model().name.trim() &&
      this.model().name.length <= 160,
  );
  constructor() {
    this.restorePreferences();
    this.restoreAttempt();
    this.viewports
      .pipe(
        switchMap((bounds) =>
          !bounds
            ? of(null)
            : timer(300).pipe(
                switchMap(() =>
                  this.api.findIntersectingParcels({
                    crs: 'EPSG:2180',
                    axisOrder: 'easting-northing',
                    bounds: [...bounds],
                  }),
                ),
                catchError(() => of('failed' as const)),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (!result) return;
        if (result === 'failed') {
          this._contextStatus.set('Obrysy działek są niedostępne. Przesuń mapę, aby ponowić.');
          return;
        }
        this._contextParcels.set(result.data.candidates);
        this._contextProvenance.set(result.data.provenance);
        this._contextStatus.set(
          result.data.status === 'truncated'
            ? result.data.provenance.provider.endsWith('_GUGIK_SNAPSHOT')
              ? 'Archiwalny fragment — nie obejmuje wszystkich działek w okolicy.'
              : 'Obrysy niepełne — przybliż mapę.'
            : result.data.status === 'unavailable'
              ? 'Brak danych o obrysach w tym widoku.'
              : result.data.candidates.length
                ? ''
                : 'Brak dostępnych obrysów działek w tym widoku.',
        );
      });
    this.queries
      .pipe(
        switchMap((q) =>
          !q
            ? of({ data: null, error: null })
            : (q.auto ? timer(400) : of(0)).pipe(
                switchMap(() => this.api.search(q.query.trim(), undefined, this.options(q))),
                map((r) => ({ data: r.data, error: null })),
                catchError(() => of({ data: null, error: 'Wyszukiwanie jest niedostępne.' })),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this._loading.set(false);
        this._searchError.set(r.error);
        if (r.data) {
          this.lookupNotice.set(
            r.data.provenance.provider.endsWith('_GUGIK_SNAPSHOT')
              ? 'Archiwalny fragment danych — wyniki nie obejmują całej miejscowości.'
              : null,
          );
          this._contextPrompt.set(
            r.data.status === 'needs_context' ? (r.data.contextPrompt ?? null) : null,
          );
          this._results.set(r.data.candidates);
          this._cursor.set(r.data.nextCursor);
        }
      });
    this.destroy.onDestroy(() => {
      this.queries.complete();
      this.viewports.complete();
      this.pageRequest?.unsubscribe();
      this.areaRequest?.unsubscribe();
      this.parcelRequest?.unsubscribe();
      this.previewRequest?.unsubscribe();
    });
  }
  viewportChanged(bounds: Bounds) {
    const next = roundMapBounds(bounds);
    this._viewport.set(next);
    if (this._query().inMap && this._submitted() && this._step() === 0)
      this.editSearch(this._query(), false);
    this._contextParcels.set([]);
    this._contextProvenance.set(null);
    const valid = validWorkingArea(next);
    this._contextStatus.set(
      valid ? 'Wczytywanie obrysów działek…' : 'Przybliż mapę, aby zobaczyć obrysy działek.',
    );
    this.viewports.next(valid ? next : null);
  }
  private options(q: SearchState): SearchOptions {
    const city = this._chosenLocality(),
      street = this._lookupStreet();
    return {
      regionId: q.regionId || undefined,
      countyName: q.countyName?.trim() || undefined,
      communeName: q.communeName?.trim() || undefined,
      localityName: q.type === 'address' ? city?.label : q.localityName?.trim() || undefined,
      localityId:
        q.localityId || (['street', 'address'].includes(q.type) ? city?.localityId : undefined),
      streetName: q.type === 'address' ? street?.label : undefined,
      streetId: q.type === 'address' ? street?.streetId : undefined,
      bounds: q.inMap ? this._viewport()?.join(',') : undefined,
      type: (q.type || undefined) as SearchOptions['type'],
      limit: 5,
    };
  }
  editSearch(q: SearchState, auto = true) {
    if (this.locked() || this._step() !== 0) return;
    this.revision++;
    this.pageRequest?.unsubscribe();
    this.queries.next(null);
    this._query.set({ ...q, query: q.query.slice(0, 120) });
    this.lookupNotice.set(null);
    this._results.set([]);
    this._cursor.set(null);
    this._loading.set(false);
    this._submitted.set(false);
    this._contextPrompt.set(null);
    this._searchError.set(null);
    this.persistPreferences();
    if (auto && q.type === 'street' && q.query.trim().length >= 3) this.beginLookup(true);
  }
  openLookup(stage: LookupStage) {
    if (!this.editable() || this._step() !== 0) return;
    if (['street', 'number', 'parcel'].includes(stage) && !this._chosenLocality()) return;
    if (stage === 'house' && (!this._chosenLocality() || !this._lookupStreet())) return;
    const previous = this._lookupStage();
    if (stage === 'locality' || stage === 'identifier') {
      this.clearLocatedParcel();
      this._lookupStreet.set(null);
      if (stage === 'identifier') {
        this._chosenLocality.set(null);
        this._locationLabel.set(null);
      }
    }
    let q = this._query();
    if (stage === 'number' && previous === 'street') {
      this._lookupStreet.set(null);
      q = { ...q, streetText: '', houseText: '' };
    }
    if (stage === 'identifier' || (stage === 'parcel' && previous === 'identifier'))
      q = { ...q, parcelText: '' };
    const type =
      stage === 'house'
        ? 'address'
        : stage === 'identifier' || stage === 'parcel'
          ? 'parcel'
          : stage === 'street'
            ? 'street'
            : 'locality';
    const query =
      stage === 'house'
        ? (q.houseText ?? '')
        : ['identifier', 'parcel'].includes(stage)
          ? (q.parcelText ?? '')
          : stage === 'street'
            ? (q.streetText ?? '')
            : (q.placeText ?? '');
    this._lookupStage.set(stage);
    this.editSearch({ ...q, type, query, inMap: false }, false);
  }
  startMapSelection() {
    if (this.locked() || this._step() !== 0) return;
    this._mapIntent.set(true);
    this.go(1);
  }
  search(q: SearchState = this._query()) {
    if (this.locked() || this._step() !== 0) return;
    this.editSearch(q, false);
    if (!q.query.trim()) return;
    if (q.type === 'address' && (!this._chosenLocality() || !this._lookupStreet())) {
      this._searchError.set('Wybierz najpierw miejscowość i ulicę.');
      return;
    }
    if (q.type === 'parcel' && q.parcelText !== undefined && this._lookupStage() !== 'identifier') {
      const viewport = this._viewport();
      if (!viewport || !validWorkingArea(viewport)) {
        this._contextPrompt.set(
          'Przybliż mapę do szukanej okolicy, aby znaleźć krótki numer działki.',
        );
        this._submitted.set(true);
        return;
      }
      this._query.update((value) => ({ ...value, inMap: true }));
    } else if (q.type === 'parcel') this._query.update((value) => ({ ...value, inMap: false }));
    this.beginLookup(false);
  }
  private beginLookup(auto: boolean) {
    this._submitted.set(true);
    if (this._query().inMap && (!this._viewport() || !validWorkingArea(this._viewport()!))) {
      this._contextPrompt.set('Przybliż mapę do obszaru nie większego niż 2 × 2 km.');
      this._loading.set(false);
      return;
    }
    this._loading.set(true);
    this.queries.next({ ...this._query(), auto });
  }
  more() {
    const cursor = this._cursor();
    if (!cursor || this._loading() || this.locked() || this._step() !== 0) return;
    const revision = this.revision;
    this._loading.set(true);
    this._searchError.set(null);
    this.pageRequest = this.api
      .search(this._query().query, undefined, { ...this.options(this._query()), cursor })
      .subscribe({
        next: (r) => {
          if (revision !== this.revision) return;
          this._loading.set(false);
          const ids = new Set(this._results().map((p) => p.id));
          this._results.update((rows) => [
            ...rows,
            ...r.data.candidates.filter((p) => !ids.has(p.id)),
          ]);
          this._cursor.set(r.data.nextCursor);
        },
        error: () => {
          this._loading.set(false);
          this._searchError.set('Nie udało się wczytać kolejnych wyników.');
        },
      });
  }
  retrySearch() {
    if (this._results().length && this._cursor()) this.more();
    else this.search();
  }
  choose(id: string) {
    if (!this.editable() || this._step() !== 0) return;
    const candidate = this._results().find((p) => p.id === id);
    if (!candidate) return;
    this._error.set(null);
    this._locationLabel.set([candidate.label, candidate.contextLabel].filter(Boolean).join(' · '));
    this._camera.set(
      candidate.type === 'parcel'
        ? [
            candidate.center[0] - 400,
            candidate.center[1] - 400,
            candidate.center[0] + 400,
            candidate.center[1] + 400,
          ]
        : [...candidate.extent],
    );
    if (candidate.type === 'locality') {
      this._chosenLocality.set(candidate);
      this._lookupStreet.set(null);
      this.clearLocatedParcel();
      this._query.update((q) => ({
        ...q,
        placeText: candidate.label,
        streetText: '',
        houseText: '',
        parcelText: '',
        localityId: '',
        localityName: '',
      }));
      this.openLookup('street');
    } else if (candidate.type === 'street') {
      this._lookupStreet.set(candidate);
      this.clearLocatedParcel();
      this._query.update((q) => ({
        ...q,
        streetText: candidate.label,
        houseText: '',
        parcelText: '',
      }));
      this._lookupStage.set('number');
      this.editSearch({ ...this._query(), query: '' }, false);
    } else if (candidate.type === 'parcel' && candidate.parcelId)
      this.resolve({ type: 'identifier', value: candidate.parcelId }, true);
  }
  private clearLocatedParcel() {
    this.parcelRequest?.unsubscribe();
    this.parcelRequest = undefined;
    this._locatedParcel.set(null);
  }
  addLocated() {
    const parcel = this._locatedParcel();
    if (parcel && this.canEditArea()) this.add(parcel);
  }
  resolvePoint(point: [number, number]) {
    if (this.canEditArea()) this.resolve({ type: 'point', coordinates: point, crs: 'EPSG:2180' });
  }
  private resolve(selector: Parameters<ProjectApi['resolveParcel']>[0], locate = false) {
    this.parcelRequest?.unsubscribe();
    this._error.set(null);
    this.parcelRequest = this.api.resolveParcel(selector).subscribe({
      next: (r) => {
        if (r.data.status === 'resolved') {
          const parcel = r.data.parcel;
          if (locate) {
            this._locatedParcel.set(parcel);
            return;
          }
          if (!this.canEditArea()) return;
          if (selector.type === 'point' && this._selected().some((p) => p.id === parcel.id))
            this.remove(parcel.id);
          else this.add(r.data.parcel);
        } else
          this._error.set(
            r.data.status === 'ambiguous'
              ? 'W tym miejscu pasuje kilka działek. Wybierz ją w wyszukiwarce.'
              : 'Nie znaleziono działki w tym miejscu.',
          );
      },
      error: () => this._error.set('Nie udało się rozpoznać działki.'),
    });
  }
  addSuggestion(id: string) {
    const parcel = this.suggested().find((p) => p.id === id);
    if (parcel && this.canEditArea()) this.add(parcel);
  }
  private add(parcel: ResolvedParcel) {
    if (!this.canEditArea()) return;
    if (this._selected().some((p) => p.id === parcel.id)) return;
    if (this._selected().length >= 100) {
      this._error.set('Możesz wybrać najwyżej 100 działek.');
      return;
    }
    this._selected.update((rows) => [...rows, parcel]);
    this.invalidate();
  }

  remove(id: string) {
    if (!this.canEditArea()) return;
    this._selected.update((p) => p.filter((x) => x.id !== id));
    this.invalidate();
  }
  private invalidate() {
    this.previewRequest?.unsubscribe();
    this._preview.set(null);
    if (this._step() === 2) this._step.set(1);
    this._error.set(null);
  }
  setBounds(value: Bounds) {
    if (!this.canEditArea()) return;
    const b = roundMapBounds(value);
    this.invalidate();
    this.areaRequest?.unsubscribe();
    this._discovery.set(null);
    this._discoveryError.set(null);
    this._discoveryLoading.set(false);
    this._bounds.set(b);
    if (!validWorkingArea(b)) {
      this._error.set('Obszar przekracza limit 2 × 2 km lub ma nieprawidłowy kształt.');
      return;
    }
    this.discover();
  }
  insertArea() {
    const view = this._viewport();
    if (!this.canEditArea() || this._bounds()) return;
    if (!view) {
      this._error.set('Mapa nie jest jeszcze gotowa. Spróbuj ponownie za chwilę.');
      return;
    }
    const fit = Math.floor((Math.min(view[2] - view[0], view[3] - view[1]) * 0.6) / 10) * 10;
    const side = Math.min(INSERTED_AREA_METRES, fit);
    if (side < 10) return;
    const next = centeredArea([(view[0] + view[2]) / 2, (view[1] + view[3]) / 2], side, side);
    this.setBounds(next);
    const inserted = this._bounds();
    if (inserted && validWorkingArea(inserted)) this._camera.set(inserted);
  }
  resize(delta: number) {
    const b = this._bounds();
    if (!b || !this.canEditArea()) return;
    const width = b[2] - b[0] + delta,
      height = b[3] - b[1] + delta;
    const next = centeredArea([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], width, height);
    if (validWorkingArea(next)) this.setBounds(next);
    else this._error.set('Nie można bardziej zmienić rozmiaru obszaru.');
  }
  discover() {
    const b = this._bounds();
    if (!b || !validWorkingArea(b) || !this.canEditArea()) return;
    this.areaRequest?.unsubscribe();
    this._discoveryLoading.set(true);
    this._discoveryError.set(null);
    this.areaRequest = this.api.findIntersectingParcels(this.extent()).subscribe({
      next: (r) => {
        this._discoveryLoading.set(false);
        this._discovery.set(r.data);
      },
      error: () => {
        this._discoveryLoading.set(false);
        this._discoveryError.set('Nie udało się wykryć działek.');
      },
    });
  }
  setBuffer(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 500 || !this.canEditArea()) return;
    this.model.update((m) => ({ ...m, buffer: value }));
    this.persistPreferences();
  }
  fit() {
    if (!this._selected().length || !this.canEditArea()) return;
    const bounds = boundsOfCoordinates(this._selected().map((p) => p.geometry.coordinates));
    if (!bounds) return;
    const next = roundMapBounds(proposedWorkingArea(bounds, this.buffer()));
    if (!validWorkingArea(next)) {
      this.invalidate();
      this._error.set(
        'Działki z buforem przekraczają limit 2 × 2 km. Zmniejsz bufor lub wybór działek.',
      );
      return;
    }
    this.setBounds(next);
    this._camera.set(next);
  }
  go(step: number) {
    if (this.locked() || !Number.isInteger(step) || step < 0 || step > 1) return;
    if (step > this._step() && !this.canContinue()) {
      this._error.set('Wybierz miejsce lub pomiń wyszukiwanie, aby przejść do mapy.');
      return;
    }
    this.queries.next(null);
    this.pageRequest?.unsubscribe();
    this._loading.set(false);
    this.revision++;
    this._step.set(step);
    this._preview.set(null);
  }
  previewArea() {
    if (!this.canEditArea()) return;
    const b = this._bounds();
    if (!b || !validWorkingArea(b) || this.locked()) {
      this._error.set('Zaznacz obszar projektu na mapie.');
      return;
    }
    this._busy.set(true);
    this._error.set(null);
    this.previewRequest = this.api
      .preview({ parcelIds: this._selected().map((p) => p.id), workingExtent: this.extent() })
      .subscribe({
        next: (r) => {
          this._busy.set(false);
          if (r.data.status !== 'ready') {
            this._error.set('Sprawdź wybór działek i limit obszaru.');
            return;
          }
          this._preview.set(r.data);
          this._step.set(2);
          this._camera.set([...r.data.workingExtent.bounds]);
        },
        error: () => {
          this._busy.set(false);
          this._error.set('Nie udało się przygotować podglądu. Spróbuj ponownie.');
        },
      });
  }
  save() {
    if (!this.canSave()) return;
    const preview = this._preview();
    if (preview?.status !== 'ready') return;
    const attempt: Attempt = {
      key: crypto.randomUUID(),
      request: {
        name: this.model().name.trim(),
        parcelIds: this._selected().map((p) => p.id),
        workingExtent: this.extent(),
        previewFingerprint: preview.previewFingerprint,
      },
    };
    try {
      sessionStorage.setItem(PENDING, JSON.stringify(attempt));
    } catch {
      this._error.set('Nie można bezpiecznie zapamiętać próby zapisu w tej karcie.');
      return;
    }
    this.attempt = attempt;
    this.sendAttempt();
  }
  retrySave() {
    if (this._uncertain() && this.attempt && !this._busy()) this.sendAttempt();
  }
  private sendAttempt() {
    if (!this.attempt) return;
    this._busy.set(true);
    this._error.set(null);
    this.api
      .create(this.attempt.request, this.attempt.key)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this._busy.set(false);
          try {
            sessionStorage.removeItem(PENDING);
          } catch {
            /* A committed result remains authoritative. */
          }
          this.attempt = null;
          this._uncertain.set(false);
          void this.router.navigate(['/projects', r.data.id]);
        },
        error: (error: unknown) => {
          this._busy.set(false);
          if (!(error instanceof ProjectApiError) || error.outcomeUnknown) {
            this._uncertain.set(true);
            this._error.set('Nie znamy wyniku zapisu. Ponów tę samą próbę.');
          } else {
            try {
              sessionStorage.removeItem(PENDING);
            } catch {
              /* Preserve the current session state. */
            }
            this.attempt = null;
            this._uncertain.set(false);
            this._preview.set(null);
            this._step.set(1);
            this._error.set('Nie udało się zapisać projektu. Sprawdź obszar i ponów podgląd.');
          }
        },
      });
  }
  private extent() {
    const b = this._bounds();
    if (!b) throw new Error('Missing area');
    return {
      crs: 'EPSG:2180' as const,
      axisOrder: 'easting-northing' as const,
      bounds: [...b] as [number, number, number, number],
    };
  }
  tileUrl() {
    return baseMapTileTemplate(this.api);
  }
  private persistPreferences() {
    try {
      localStorage.setItem(
        PREFS,
        JSON.stringify({ version: 1, search: this._query(), buffer: this.buffer() }),
      );
    } catch {
      /* Preferences are optional. */
    }
  }
  private restorePreferences() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) ?? 'null');
      if (p?.version !== 1) return;
      const q = p.search;
      if (
        q &&
        ['query', 'regionId', 'type'].every(
          (k) => typeof q[k] === 'string' && q[k].length <= 120,
        ) &&
        ['', 'place', 'parcel', 'locality', 'street', 'address'].includes(q.type)
      )
        this._query.set({
          query: q.query,
          placeText: typeof q.placeText === 'string' ? q.placeText.slice(0, 120) : '',
          streetText: typeof q.streetText === 'string' ? q.streetText.slice(0, 120) : '',
          parcelText: typeof q.parcelText === 'string' ? q.parcelText.slice(0, 120) : '',
          houseText: typeof q.houseText === 'string' ? q.houseText.slice(0, 120) : '',
          regionId: '',
          type: ['place', 'street', 'parcel'].includes(q.type) ? q.type : 'place',
          inMap: false,
        });
      if (Number.isFinite(p.buffer) && p.buffer >= 0 && p.buffer <= 500)
        this.model.update((m) => ({ ...m, buffer: p.buffer }));
    } catch {
      /* Ignore invalid optional preferences. */
    }
  }
  private restoreAttempt() {
    try {
      const saved = sessionStorage.getItem(PENDING);
      if (!saved) return;
      const a = JSON.parse(saved);
      const r = a?.request;
      if (
        typeof a?.key !== 'string' ||
        a.key.length < 16 ||
        a.key.length > 128 ||
        !r ||
        typeof r.name !== 'string' ||
        !r.name.trim() ||
        r.name.length > 160 ||
        !Array.isArray(r.parcelIds) ||
        r.parcelIds.length > 100 ||
        !r.parcelIds.every(
          (id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 64,
        ) ||
        new Set(r.parcelIds).size !== r.parcelIds.length ||
        r.workingExtent?.crs !== 'EPSG:2180' ||
        r.workingExtent?.axisOrder !== 'easting-northing' ||
        !Array.isArray(r.workingExtent.bounds) ||
        r.workingExtent.bounds.length !== 4 ||
        !validWorkingArea(r.workingExtent.bounds) ||
        !/^v1:sha256:[a-f0-9]{64}$/.test(r.previewFingerprint)
      )
        throw new Error('Invalid attempt');
      this.attempt = a;
      this._bounds.set(r.workingExtent.bounds);
      this._camera.set(r.workingExtent.bounds);
      this.model.update((m) => ({ ...m, name: r.name }));
      this._step.set(2);
      this._uncertain.set(true);
      this._error.set('Poprzedni zapis ma nieznany wynik. Ponów tę samą próbę.');
    } catch {
      this._uncertain.set(true);
      this._step.set(2);
      this._error.set(
        'Nie można odtworzyć poprzedniej próby. Sprawdź jej wynik przed utworzeniem kolejnego projektu.',
      );
    }
  }
}
