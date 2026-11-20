import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ProjectCreationState } from './project-creation-state';
import { RuntimeConfigService } from '../../core/runtime-config/runtime-config';
const json = { 'Content-Type': 'application/json' },
  provenance = { provider: 'fixture', sourceDataDate: null, limitations: [] };
const candidate = (id: string) => ({
  id,
  type: 'parcel',
  parcelId: id,
  label: '101/1',
  contextLabel: 'Brzozowo',
  center: [100050, 200050],
  extent: [100020, 200020, 100080, 200080],
  crs: 'EPSG:2180',
  axisOrder: 'easting-northing',
  source: 'fixture',
});
const parcel = {
  id: '999999_9.9999.1',
  parcelNumber: '101/1',
  crs: 'EPSG:2180',
  axisOrder: 'easting-northing',
  source: 'fixture',
  sourceDataDate: null,
  limitations: [],
  geometry: {
    type: 'Polygon',
    crs: 'EPSG:2180',
    axisOrder: 'easting-northing',
    coordinates: [
      [
        [100020, 200020],
        [100080, 200020],
        [100080, 200080],
        [100020, 200080],
        [100020, 200020],
      ],
    ],
  },
};
describe('ProjectCreationState', () => {
  let state: ProjectCreationState, http: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ProjectCreationState,
        { provide: RuntimeConfigService, useValue: { value: { apiBaseUrl: '/api' } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    state = TestBed.inject(ProjectCreationState);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    http.verify({ ignoreCancelled: true });
    vi.useRealTimers();
  });
  async function searchPage(
    rows: Record<string, unknown>[] = Array.from({ length: 5 }, (_, i) => candidate(`parcel-${i}`)),
    cursor: string | null = 'cursor-1',
  ) {
    await vi.advanceTimersByTimeAsync(251);
    const req = http.expectOne(
      (r) => new URL(r.urlWithParams, 'http://local').pathname === '/api/v1/search',
    );
    req.flush(
      {
        status: rows.length > 1 ? 'ambiguous' : rows.length ? 'ready' : 'no_match',
        candidates: rows,
        nextCursor: cursor,
        provenance,
      },
      { headers: json },
    );
  }
  function discover() {
    const req = http.expectOne('/api/v1/parcels/intersections');
    req.flush(
      {
        status: 'complete',
        workingExtent: req.request.body.workingExtent,
        candidates: [],
        provenance,
      },
      { headers: json },
    );
  }
  it('bounds initial results to five, paginates and cancels outdated queries', async () => {
    state.search({ query: 'Brzozowo', regionId: '', type: '' });
    await searchPage();
    expect(state.results()).toHaveLength(5);
    state.more();
    const more = http.expectOne(
      (r) => new URL(r.urlWithParams, 'http://local').searchParams.get('cursor') === 'cursor-1',
    );
    more.flush(
      { status: 'ambiguous', candidates: [candidate('next')], nextCursor: null, provenance },
      { headers: json },
    );
    expect(state.results()).toHaveLength(6);
    state.search({ query: 'old', regionId: '', type: '' });
    await vi.advanceTimersByTimeAsync(251);
    const old = http.expectOne(
      (r) => new URL(r.urlWithParams, 'http://local').searchParams.get('query') === 'old',
    );
    state.search({ query: 'new', regionId: '', type: '' });
    expect(old.cancelled).toBe(true);
    expect(state.results()).toEqual([]);
    await searchPage([], null);
    expect(state.loading()).toBe(false);
  });
  it('does not fetch edited text or empty submits and cancels immediately on editing', async () => {
    await vi.advanceTimersByTimeAsync(400);
    http.expectNone((r) => r.url === '/api/v1/search');
    state.editSearch({ query: ' ab ', regionId: '', type: '' });
    await vi.advanceTimersByTimeAsync(400);
    http.expectNone((r) => r.url === '/api/v1/search');
    expect(state.loading()).toBe(false);
    state.search({ query: 'Brzozowo', regionId: '', type: '' });
    await vi.advanceTimersByTimeAsync(251);
    const pending = http.expectOne((r) => r.url === '/api/v1/search');
    state.editSearch({ query: 'B', regionId: '', type: '' });
    expect(pending.cancelled).toBe(true);
    expect(state.results()).toEqual([]);
    expect(state.hasMore()).toBe(false);
  });
  it('supports explicit short names and context-required results without auto-fetch on edits', async () => {
    state.editSearch({ query: 'Os', regionId: '', type: 'locality' });
    await vi.advanceTimersByTimeAsync(400);
    http.expectNone((r) => r.url === '/api/v1/search');
    expect(state.submitted()).toBe(false);
    state.search();
    await searchPage([], null);
    expect(state.submitted()).toBe(true);
    state.editSearch({ query: '101/1', regionId: '', type: 'parcel' });
    state.search();
    http
      .expectOne((r) => r.url === '/api/v1/search')
      .flush(
        {
          status: 'needs_context',
          contextPrompt: 'Podaj obręb.',
          candidates: [],
          nextCursor: null,
          provenance,
        },
        { headers: json },
      );
    expect(state.contextPrompt()).toBe('Podaj obręb.');
    state.editSearch({ query: 'Centrum 101/1', regionId: '', type: 'parcel' });
    expect(state.contextPrompt()).toBeNull();
    expect(state.results()).toEqual([]);
    http.expectNone((r) => r.url === '/api/v1/search');
  });
  it('debounces street queries, passes context filters and blocks excessive map scopes', async () => {
    state.editSearch({ query: 'Li', regionId: '', type: 'street' });
    await vi.advanceTimersByTimeAsync(500);
    http.expectNone((r) => r.url === '/api/v1/search');
    state.editSearch({
      query: 'Lip',
      regionId: 'north',
      type: 'street',
      countyName: 'Północny',
      communeName: 'Brzozowo',
      localityName: 'Brzozowo',
    });
    await vi.advanceTimersByTimeAsync(401);
    const req = http.expectOne((r) => r.url === '/api/v1/search');
    expect(new URL(req.request.urlWithParams, 'http://local').searchParams.get('countyName')).toBe(
      'Północny',
    );
    expect(req.request.params.get('localityName')).toBe('Brzozowo');
    state.editSearch({ ...state.query(), query: 'Lipo' });
    expect(req.cancelled).toBe(true);
    state.viewportChanged([0, 0, 10000, 10000]);
    state.editSearch({ ...state.query(), inMap: true });
    await vi.advanceTimersByTimeAsync(500);
    http.expectNone((r) => r.url === '/api/v1/search');
    expect(state.contextPrompt()).toContain('Przybliż');
  });
  it('guides locality to street and composes an explicit house-number request without selecting subjects', async () => {
    state.search({ query: 'Brzozowo', type: 'locality', regionId: '', placeText: 'Brzozowo' });
    await searchPage(
      [
        {
          ...candidate('city'),
          type: 'locality',
          parcelId: undefined,
          localityId: 'brzozowo',
          label: 'Brzozowo',
        },
      ],
      null,
    );
    state.choose('city');
    expect(state.lookupStage()).toBe('street');
    state.editSearch({ ...state.query(), query: 'Lip', streetText: 'Lip' });
    await vi.advanceTimersByTimeAsync(401);
    const streetReq = http.expectOne((r) => r.url === '/api/v1/search');
    expect(streetReq.request.params.get('localityId')).toBe('brzozowo');
    streetReq.flush(
      {
        status: 'ready',
        candidates: [
          {
            ...candidate('street'),
            type: 'street',
            label: 'Lipowa',
            parcelId: undefined,
            localityId: 'brzozowo',
            streetId: 'street-brzozowo-0',
          },
        ],
        nextCursor: null,
        provenance,
      },
      { headers: json },
    );
    state.choose('street');
    expect(state.lookupStage()).toBe('number');
    state.openLookup('house');
    state.search({ ...state.query(), query: '1', houseText: '1' });
    const houseReq = http.expectOne((r) => r.url === '/api/v1/search');
    const params = new URL(houseReq.request.urlWithParams, 'http://local').searchParams;
    expect(params.get('type')).toBe('address');
    expect(params.get('query')).toBe('1');
    expect(params.get('localityName')).toBe('Brzozowo');
    expect(params.get('streetName')).toBe('Lipowa');
    expect(params.get('streetId')).toBe('street-brzozowo-0');
    houseReq.flush(
      {
        status: 'ready',
        candidates: [
          {
            ...candidate('address'),
            type: 'point_address',
            parcelId: undefined,
            label: 'Brzozowo, Lipowa 1',
          },
        ],
        nextCursor: null,
        provenance,
      },
      { headers: json },
    );
    state.choose('address');
    expect(state.selectedCount()).toBe(0);
    expect(state.bounds()).toBeNull();
    state.go(1);
    expect(state.step()).toBe(1);
  });
  it('locates a full identity in search and adds it only by explicit selection in project stage two', async () => {
    state.openLookup('identifier');
    state.search({ ...state.query(), query: parcel.id, parcelText: parcel.id });
    const req = http.expectOne((r) => r.url === '/api/v1/search');
    expect(req.request.params.has('bounds')).toBe(false);
    req.flush(
      { status: 'ready', candidates: [candidate(parcel.id)], nextCursor: null, provenance },
      { headers: json },
    );
    state.choose(parcel.id);
    http
      .expectOne('/api/v1/parcels/resolve')
      .flush({ status: 'resolved', parcel, candidates: [] }, { headers: json });
    expect(state.locatedParcel()?.id).toBe(parcel.id);
    expect(state.selectedCount()).toBe(0);
    state.addLocated();
    state.resolvePoint([100050, 200050]);
    state.setBounds([100000, 200000, 100400, 200300]);
    expect(state.selectedCount()).toBe(0);
    expect(state.bounds()).toBeNull();
    http.expectNone('/api/v1/parcels/resolve');
    http.expectNone('/api/v1/parcels/intersections');
    state.go(1);
    state.addLocated();
    expect(state.selectedCount()).toBe(1);
    expect(state.bounds()).toBeNull();
    state.go(0);
    state.remove(parcel.id);
    expect(state.selectedCount()).toBe(1);
  });
  it('loads bounded viewport outlines independently, cancels stale views and reports failures', async () => {
    state.viewportChanged([100000, 200000, 101000, 201000]);
    await vi.advanceTimersByTimeAsync(301);
    const old = http.expectOne('/api/v1/parcels/intersections');
    state.viewportChanged([100000, 200000, 105000, 205000]);
    expect(old.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(301);
    http.expectNone('/api/v1/parcels/intersections');
    expect(state.contextStatus()).toContain('Przybliż');
    state.viewportChanged([100000, 200000, 101000, 201000]);
    await vi.advanceTimersByTimeAsync(301);
    const req = http.expectOne('/api/v1/parcels/intersections');
    req.flush(
      {
        status: 'complete',
        candidates: [parcel],
        workingExtent: req.request.body.workingExtent,
        provenance,
      },
      { headers: json },
    );
    expect(state.contextParcels()).toHaveLength(1);
    expect(state.selected()).toHaveLength(0);
    expect(state.bounds()).toBeNull();
    state.viewportChanged([100010, 200010, 101010, 201010]);
    await vi.advanceTimersByTimeAsync(301);
    http
      .expectOne('/api/v1/parcels/intersections')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(state.contextStatus()).toContain('niedostępne');
    expect(state.contextParcels()).toEqual([]);
  });
  it('toggles a point-resolved parcel without replacing the manual area', () => {
    state.startMapSelection();
    state.setBounds([100000, 200050, 100400, 200350]);
    discover();
    const bounds = state.bounds();
    for (const count of [1, 0, 1]) {
      state.resolvePoint([100050, 200050]);
      http
        .expectOne('/api/v1/parcels/resolve')
        .flush({ status: 'resolved', parcel, candidates: [] }, { headers: json });
      expect(state.selectedCount()).toBe(count);
      expect(state.bounds()).toEqual(bounds);
    }
  });
  it('opens the first gate only after a chosen place, selected parcel or valid area', async () => {
    state.search({ query: 'Brzozowo', regionId: '', type: '' });
    await searchPage(
      [{ ...candidate('brzozowo'), type: 'locality', label: 'Brzozowo', parcelId: undefined }],
      null,
    );
    expect(state.canContinue()).toBe(false);
    state.go(1);
    expect(state.step()).toBe(0);
    state.choose('brzozowo');
    expect(state.locationLabel()).toContain('Brzozowo');
    expect(state.canContinue()).toBe(true);
    expect(state.error()).toBeNull();
    expect(state.bounds()).toBeNull();
    state.go(1);
    expect(state.step()).toBe(1);
    expect(state.canPreview()).toBe(false);
  });
  it('allows an explicit map-only entry but rejects subject and area commands during lookup', () => {
    state.resolvePoint([100050, 200050]);
    state.setBounds([100000, 200000, 100400, 200300]);
    state.setBuffer(200);
    http.expectNone('/api/v1/parcels/resolve');
    http.expectNone('/api/v1/parcels/intersections');
    expect(state.bounds()).toBeNull();
    expect(state.buffer()).toBe(100);
    expect(state.canContinue()).toBe(false);
    state.startMapSelection();
    expect(state.step()).toBe(1);
    state.setBounds([100000, 200000, 100400, 200300]);
    discover();
    expect(state.canPreview()).toBe(true);
    expect(state.selectedCount()).toBe(0);
  });
  it('keeps an invalid area out of review and allows returning to stage two for correction', () => {
    state.go(1);
    expect(state.step()).toBe(0);
    state.startMapSelection();
    state.setBounds([100000, 200000, 103000, 200300]);
    http.expectNone('/api/v1/parcels/intersections');
    expect(state.canPreview()).toBe(false);
    state.previewArea();
    http.expectNone('/api/v1/projects/previews');
    state.go(0);
    state.setBounds([100000, 200000, 100400, 200300]);
    expect(state.areaInvalid()).toBe(true);
    state.go(1);
    state.setBounds([100000, 200000, 100400, 200300]);
    discover();
    expect(state.areaInvalid()).toBe(false);
    expect(state.canPreview()).toBe(true);
  });
  it('preserves manual area until explicit fit and invalidates geometry preview on edits', async () => {
    state.search({ query: '101/1', regionId: '', type: '' });
    await searchPage([candidate(parcel.id)], null);
    state.choose(parcel.id);
    http
      .expectOne('/api/v1/parcels/resolve')
      .flush({ status: 'resolved', parcel, candidates: [] }, { headers: json });
    expect(state.bounds()).toBeNull();
    expect(state.selectedCount()).toBe(0);
    state.go(1);
    state.addLocated();
    http.expectNone('/api/v1/parcels/intersections');
    state.setBounds([100000, 200000, 100400, 200300]);
    discover();
    state.setBuffer(200);
    expect(state.dimensions()).toBe('400 × 300 m');
    state.fit();
    discover();
    expect(state.dimensions()).toBe('460 × 460 m');
    state.previewArea();
    const req = http.expectOne('/api/v1/projects/previews');
    req.flush(
      {
        status: 'ready',
        issues: [],
        selectedParcels: [
          {
            inputId: parcel.id,
            status: 'resolved',
            id: parcel.id,
            candidateIds: [],
            geometry: parcel.geometry,
            crs: 'EPSG:2180',
            axisOrder: 'easting-northing',
            source: 'fixture',
            sourceDataDate: null,
          },
        ],
        parcelSubjectExtent: {
          crs: 'EPSG:2180',
          axisOrder: 'easting-northing',
          bounds: [100020, 200020, 100080, 200080],
          widthMetres: 60,
          heightMetres: 60,
          envelopeAreaSquareMetres: 3600,
        },
        workingExtent: {
          ...req.request.body.workingExtent,
          widthMetres: 460,
          heightMetres: 460,
          envelopeAreaSquareMetres: 211600,
        },
        warnings: [],
        provenance,
        previewFingerprint: `v1:sha256:${'a'.repeat(64)}`,
      },
      { headers: json },
    );
    expect(state.step()).toBe(2);
    state.details.name().value.set('Projekt');
    expect(state.canSave()).toBe(true);
    const bounds = state.bounds(),
      selection = state.selected();
    state.remove(parcel.id);
    state.choose(parcel.id);
    state.resolvePoint([100050, 200050]);
    state.addSuggestion(parcel.id);
    state.setBounds([0, 0, 100, 100]);
    state.resize(50);
    state.fit();
    state.setBuffer(100);
    expect(state.selected()).toEqual(selection);
    expect(state.bounds()).toEqual(bounds);
    expect(state.buffer()).toBe(200);
    expect(state.canSave()).toBe(true);
    expect(state.step()).toBe(2);
    http.expectNone('/api/v1/parcels/resolve');
    http.expectNone('/api/v1/parcels/intersections');
    state.go(1);
    state.resize(50);
    discover();
    expect(state.preview()).toBeNull();
  });
  it('rejects corrupt pending storage without submitting a mutation', () => {
    sessionStorage.setItem('geo-planner.pending-project-create.v1', '{broken');
    const second = TestBed.runInInjectionContext(() => new ProjectCreationState());
    expect(second.uncertain()).toBe(true);
    second.retrySave();
    http.expectNone('/api/v1/projects');
  });
  it('keeps zero-parcel area selection keyboard compatible and persists only preferences', async () => {
    state.startMapSelection();
    state.setBounds([100300, 200350, 100700, 200650]);
    discover();
    expect(state.selectedCount()).toBe(0);
    expect(state.dimensions()).toBe('400 × 300 m');
    state.setBuffer(180);
    const prefs = JSON.parse(localStorage.getItem('geo-planner.workspace-preferences.v1')!);
    expect(prefs.buffer).toBe(180);
    expect(prefs).not.toHaveProperty('selectedParcels');
  });
});
