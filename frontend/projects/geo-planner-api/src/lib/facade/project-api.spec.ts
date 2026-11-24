import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectApi, ProjectApiError } from './project-api';
import type { CreateProjectRequest, PreviewRequest } from './models';

const provenance = { provider: 'fixture', sourceDataDate: null, limitations: ['Indicative only'] };
const extent = {
  crs: 'EPSG:2180',
  axisOrder: 'easting-northing',
  bounds: [100, 200, 200, 300],
  widthMetres: 100,
  heightMetres: 100,
  envelopeAreaSquareMetres: 10000,
};
const fingerprint = `v1:sha256:${'a'.repeat(64)}`;
const preview = {
  status: 'ready',
  issues: [],
  selectedParcels: [],
  parcelSubjectExtent: null,
  workingExtent: extent,
  warnings: [],
  provenance,
  previewFingerprint: fingerprint,
};
const project = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Test',
  createdAt: '2026-01-01T00:00:00Z',
  parcelIds: [],
  workingExtent: extent,
  selectedParcels: [],
  previewFingerprint: fingerprint,
  provenance,
};
const input: PreviewRequest = {
  parcelIds: [],
  workingExtent: { crs: 'EPSG:2180', axisOrder: 'easting-northing', bounds: [100, 200, 200, 300] },
};
const command: CreateProjectRequest = { ...input, name: 'Test', previewFingerprint: fingerprint };
const json = { 'Content-Type': 'application/json', 'X-Correlation-Id': 'response-id' };

describe('ProjectApi', () => {
  let http: HttpTestingController;
  let api: ProjectApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = new ProjectApi(TestBed.inject(HttpClient), { apiBaseUrl: '/api/v1' });
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('uses only safe caller-supplied paths and bounded tile coordinates', () => {
    expect(api.mapTileUrl('base-map', 2, 1, 3)).toBe('/api/v1/map/layers/base-map/tiles/2/1/3');
    expect(() => api.mapTileUrl('..', 0, 0, 0)).toThrow();
    expect(() => api.mapTileUrl('x', 2, 4, 0)).toThrow();
    expect(
      () => new ProjectApi(TestBed.inject(HttpClient), { apiBaseUrl: '//evil.example/api' }),
    ).toThrow();
    expect(
      () => new ProjectApi(TestBed.inject(HttpClient), { apiBaseUrl: '/api/../other' }),
    ).toThrow();
  });

  it('searches and preserves correlation and source limitations', async () => {
    const result = firstValueFrom(api.search('ulica', { correlationId: 'request-id' }));
    const req = http.expectOne(
      (r) =>
        new URL(r.urlWithParams, 'http://localhost').pathname === '/api/v1/search' &&
        new URL(r.urlWithParams, 'http://localhost').searchParams.get('query') === 'ulica',
    );
    expect(req.request.headers.get('X-Correlation-Id')).toBe('request-id');
    req.flush(
      { status: 'no_match', candidates: [], nextCursor: null, provenance },
      { headers: json },
    );
    expect(await result).toEqual({
      data: { status: 'no_match', candidates: [], nextCursor: null, provenance },
      correlationId: 'response-id',
      status: 200,
    });
  });

  it('keeps missing context separate from no-match and rejects malformed context replies', async () => {
    const request = firstValueFrom(api.search('101/1'));
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
    expect((await request).data.status).toBe('needs_context');
    const invalid = firstValueFrom(api.search('101/1'));
    const rejection = expect(invalid).rejects.toBeInstanceOf(ProjectApiError);
    http
      .expectOne((r) => r.url === '/api/v1/search')
      .flush(
        { status: 'needs_context', candidates: [], nextCursor: null, provenance },
        { headers: json },
      );
    await rejection;
  });
  it('resolves ambiguity without selecting a parcel', async () => {
    const result = firstValueFrom(api.resolveParcel({ type: 'identifier', value: '1' }));
    const req = http.expectOne('/api/v1/parcels/resolve');
    expect(req.request.body).toEqual({ selector: { type: 'identifier', value: '1' } });
    req.flush(
      { status: 'ambiguous', parcel: null, candidates: [{ id: '1', source: 'fixture' }] },
      { headers: json },
    );
    expect((await result).data.status).toBe('ambiguous');
  });

  it('previews, creates and reopens without turning arrays into sets', async () => {
    const pending = firstValueFrom(api.preview(input));
    const req = http.expectOne('/api/v1/projects/previews');
    expect(JSON.stringify(req.request.body)).toBe(JSON.stringify(input));
    req.flush(preview, { headers: json });
    expect((await pending).data.previewFingerprint).toBe(fingerprint);
    const create = firstValueFrom(api.create(command, '1234567890123456'));
    const createReq = http.expectOne('/api/v1/projects');
    expect(createReq.request.headers.get('Idempotency-Key')).toBe('1234567890123456');
    expect(JSON.stringify(createReq.request.body)).toBe(JSON.stringify(command));
    createReq.flush(project, { status: 201, statusText: 'Created', headers: json });
    expect((await create).replayed).toBe(false);
    const read = firstValueFrom(api.get(project.id));
    http.expectOne(`/api/v1/projects/${project.id}`).flush(project, { headers: json });
    expect((await read).data.provenance.limitations).toEqual(['Indicative only']);
  });

  it('rejects invalid variants, geometry, unsafe ready fingerprints and content types', async () => {
    const variants = [
      { ...preview, status: 'new_state' },
      { ...preview, previewFingerprint: null },
      { ...preview, workingExtent: { ...extent, crs: 'EPSG:4326' } },
      {
        ...preview,
        selectedParcels: [
          {
            inputId: '1',
            status: 'resolved',
            id: '1',
            candidateIds: [],
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [9, 9],
                ],
              ],
              crs: 'EPSG:2180',
              axisOrder: 'easting-northing',
            },
            crs: 'EPSG:2180',
            axisOrder: 'easting-northing',
            source: 'fixture',
            sourceDataDate: null,
          },
        ],
      },
    ];
    for (const body of variants) {
      const promise = firstValueFrom(api.preview(input));
      http.expectOne('/api/v1/projects/previews').flush(body, { headers: json });
      await expect(promise).rejects.toMatchObject({ kind: 'invalid_response' });
    }
    const promise = firstValueFrom(api.preview(input));
    http
      .expectOne('/api/v1/projects/previews')
      .flush(preview, { headers: { 'Content-Type': 'text/html' } });
    await expect(promise).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('rejects mismatched submissions and refuses oversized ready areas', async () => {
    const wrongSelection = firstValueFrom(api.preview({ ...input, parcelIds: ['missing'] }));
    http.expectOne('/api/v1/projects/previews').flush(preview, { headers: json });
    await expect(wrongSelection).rejects.toMatchObject({ kind: 'invalid_response' });

    const oversized = firstValueFrom(api.preview(input));
    http.expectOne('/api/v1/projects/previews').flush(
      {
        ...preview,
        workingExtent: {
          ...extent,
          bounds: [0, 0, 3000, 1],
          widthMetres: 3000,
          heightMetres: 1,
          envelopeAreaSquareMetres: 3000,
        },
      },
      { headers: json },
    );
    await expect(oversized).rejects.toMatchObject({ kind: 'invalid_response' });

    const wrongProject = firstValueFrom(api.create(command, '1234567890123456'));
    http
      .expectOne('/api/v1/projects')
      .flush(
        { ...project, name: 'Another project' },
        { status: 201, statusText: 'Created', headers: json },
      );
    await expect(wrongProject).rejects.toMatchObject({
      kind: 'invalid_response',
      outcomeUnknown: true,
    });
  });

  it('does not let later form changes alter the submitted snapshot', async () => {
    const mutable: PreviewRequest = {
      parcelIds: ['a'],
      workingExtent: { ...input.workingExtent, bounds: [...input.workingExtent.bounds] },
    };
    const observable = api.preview(mutable);
    mutable.parcelIds.push('b');
    mutable.workingExtent.bounds[0] = 999;
    const promise = firstValueFrom(observable);
    const req = http.expectOne('/api/v1/projects/previews');
    expect(req.request.body.parcelIds).toEqual(['a']);
    expect(req.request.body.workingExtent.bounds[0]).toBe(100);
    req.flush(
      {
        ...preview,
        status: 'incomplete',
        issues: ['UNRESOLVED_PARCEL'],
        previewFingerprint: null,
        selectedParcels: [
          {
            inputId: 'a',
            status: 'unresolved',
            id: null,
            candidateIds: [],
            geometry: null,
            crs: 'EPSG:2180',
            axisOrder: 'easting-northing',
            source: 'fixture',
            sourceDataDate: null,
          },
        ],
      },
      { headers: json },
    );
    expect((await promise).data.status).toBe('incomplete');
  });

  it('preserves structured problems and marks uncertain create failures without retry', async () => {
    const promise = firstValueFrom(api.create(command, '1234567890123456'));
    const req = http.expectOne('/api/v1/projects');
    const problem = {
      type: '/problem',
      title: 'Conflict',
      status: 409,
      detail: 'Changed',
      errorCode: 'PREVIEW_CHANGED',
      correlationId: 'c',
      fieldErrors: [{ field: 'name', message: 'invalid' }],
    };
    req.flush(problem, {
      status: 409,
      statusText: 'Conflict',
      headers: { 'Content-Type': 'application/problem+json' },
    });
    await expect(promise).rejects.toMatchObject({
      kind: 'http',
      problem,
      correlationId: 'c',
      outcomeUnknown: false,
    });
    const uncertain = firstValueFrom(api.create(command, '1234567890123456'));
    http.expectOne('/api/v1/projects').error(new ProgressEvent('error'));
    await expect(uncertain).rejects.toMatchObject({ kind: 'network', outcomeUnknown: true });
    http.expectNone('/api/v1/projects');
  });

  it('times out a create and cancellation aborts requests', async () => {
    vi.useFakeTimers();
    const short = new ProjectApi(TestBed.inject(HttpClient), {
      apiBaseUrl: '/api/v1',
      timeoutMs: 20,
    });
    const promise = firstValueFrom(short.create(command, '1234567890123456'));
    const rejected = expect(promise).rejects.toMatchObject({
      kind: 'timeout',
      outcomeUnknown: true,
    });
    const req = http.expectOne('/api/v1/projects');
    await vi.advanceTimersByTimeAsync(21);
    await rejected;
    expect(req.cancelled).toBe(true);
    const subscription = short.search('test').subscribe();
    const searchReq = http.expectOne(
      (r) => new URL(r.urlWithParams, 'http://localhost').pathname === '/api/v1/search',
    );
    subscription.unsubscribe();
    expect(searchReq.cancelled).toBe(true);
    expect(new ProjectApiError('network', null, null, null, true).outcomeUnknown).toBe(true);
  });
  it('discovers parcels for the exact bounds and rejects mismatched or incomplete response shapes', async () => {
    const result = {
      status: 'complete',
      workingExtent: input.workingExtent,
      candidates: [],
      provenance,
    };
    const pending = firstValueFrom(api.findIntersectingParcels(input.workingExtent));
    const req = http.expectOne('/api/v1/parcels/intersections');
    expect(req.request.body).toEqual({ workingExtent: input.workingExtent });
    req.flush(result, { headers: json });
    expect((await pending).data.status).toBe('complete');
    for (const body of [
      { ...result, status: 'unknown' },
      { ...result, workingExtent: { ...input.workingExtent, bounds: [0, 0, 10, 10] } },
      { ...result, candidates: [{}] },
    ]) {
      const invalid = firstValueFrom(api.findIntersectingParcels(input.workingExtent));
      http.expectOne('/api/v1/parcels/intersections').flush(body, { headers: json });
      await expect(invalid).rejects.toMatchObject({ kind: 'invalid_response' });
    }
  });
});
