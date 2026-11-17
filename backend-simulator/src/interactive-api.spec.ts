import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createProjectSimulatorState, SYNTHETIC_PARCEL_IDS } from './project-scenarios.js';
import { routeRequest } from './server.js';

const API = '/api/v2';
const IDEMPOTENCY_KEY = 'interactive-create-attempt-01';

function request(
  method: string,
  path: string,
  body?: Readonly<Record<string, unknown>>,
  state = createProjectSimulatorState(),
  idempotencyKey?: string,
) {
  return routeRequest(
    method,
    path,
    'interactive-simulator-test',
    body ? JSON.stringify(body) : undefined,
    idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
    state,
  );
}

function workingExtent(bounds: readonly number[]) {
  return { crs: 'EPSG:2180', axisOrder: 'easting-northing', bounds };
}

test('serves a synthetic raster tile with attribution and rejects invalid tile coordinates', () => {
  const tile = request('GET', `${API}/map/layers/fixture-base/tiles/0/0/0`);
  const invalid = request('GET', `${API}/map/layers/fixture-base/tiles/0/1/0`);
  const negative = request('GET', `${API}/map/layers/fixture-base/tiles/0/-1/0`);
  const unsupported = request('GET', `${API}/map/layers/arbitrary/tiles/0/0/0`);
  const tilePayload = tile as unknown as {
    readonly contentType: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly rawBody?: Uint8Array;
  };

  assert.equal(tile.status, 200);
  assert.equal(tilePayload.contentType, 'image/png');
  assert.ok(tilePayload.rawBody instanceof Uint8Array);
  assert.equal(
    tilePayload.headers?.['x-map-attribution'],
    'Synthetic fixture only; no external map source.',
  );
  assert.equal(invalid.status, 400);
  assert.equal(negative.status, 400);
  assert.equal(unsupported.status, 404);
});

test('searches typed location and parcel candidates without guessing ambiguous streets', () => {
  const locality = request('GET', `${API}/search?query=Nowe%20Przyk%C5%82ady`);
  const ambiguous = request('GET', `${API}/search?query=Przyk%C5%82adowa`);
  const parcel = request(
    'GET',
    `${API}/search?query=${encodeURIComponent(SYNTHETIC_PARCEL_IDS.single)}`,
  );
  const missing = request('GET', `${API}/search?query=No%20synthetic%20match`);
  const unavailable = request('GET', `${API}/search?query=__fixture_unavailable__`);

  assert.equal(locality.status, 200);
  assert.equal(locality.body['status'], 'ready');
  assert.equal(
    (locality.body['candidates'] as readonly Record<string, unknown>[])[0]?.['type'],
    'locality',
  );
  assert.equal(ambiguous.body['status'], 'ambiguous');
  assert.equal((ambiguous.body['candidates'] as readonly unknown[]).length, 2);
  assert.equal(
    (parcel.body['candidates'] as readonly Record<string, unknown>[])[0]?.['type'],
    'parcel',
  );
  assert.equal(missing.body['status'], 'no_match');
  assert.equal(unavailable.status, 503);
});

test('resolves a parcel from a map point and reports unknown identifiers without a partial match', () => {
  const point = request('POST', `${API}/parcels/resolve`, {
    selector: { type: 'point', coordinates: [100050, 200050], crs: 'EPSG:2180' },
  });
  const identifier = request('POST', `${API}/parcels/resolve`, {
    selector: { type: 'identifier', value: SYNTHETIC_PARCEL_IDS.single },
  });
  const ambiguousPoint = request('POST', `${API}/parcels/resolve`, {
    selector: { type: 'point', coordinates: [100080, 200040], crs: 'EPSG:2180' },
  });
  const missing = request('POST', `${API}/parcels/resolve`, {
    selector: { type: 'identifier', value: SYNTHETIC_PARCEL_IDS.unresolved },
  });

  assert.equal(point.status, 200);
  assert.equal(point.body['status'], 'resolved');
  assert.equal(
    (point.body['parcel'] as Record<string, unknown>)['id'],
    SYNTHETIC_PARCEL_IDS.single,
  );
  assert.equal(identifier.body['status'], 'resolved');
  assert.equal(ambiguousPoint.body['status'], 'ambiguous');
  assert.equal(missing.body['status'], 'not_found');
});

test('previews an editable rectangle with no parcels and exact project CRS and axis order', () => {
  const response = request('POST', `${API}/projects/previews`, {
    parcelIds: [],
    workingExtent: workingExtent([100000, 200000, 100100, 200100]),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body['status'], 'ready');
  assert.deepEqual(response.body['selectedParcels'], []);
  const previewExtent = response.body['workingExtent'] as Record<string, unknown>;
  assert.deepEqual(
    {
      crs: previewExtent['crs'],
      axisOrder: previewExtent['axisOrder'],
      bounds: previewExtent['bounds'],
    },
    workingExtent([100000, 200000, 100100, 200100]),
  );
  assert.equal(previewExtent['envelopeAreaSquareMetres'], 10000);
  assert.match(String(response.body['previewFingerprint']), /^v2:sha256:[a-f0-9]{64}$/);
});

test('canonical preview fingerprint is independent of parcel input order', () => {
  const workingArea = workingExtent([100000, 200000, 100200, 200100]);
  const first = request('POST', `${API}/projects/previews`, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.adjacent],
    workingExtent: workingArea,
  });
  const reordered = request('POST', `${API}/projects/previews`, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.adjacent, SYNTHETIC_PARCEL_IDS.single],
    workingExtent: workingArea,
  });

  assert.equal(first.body['status'], 'ready');
  assert.equal(reordered.body['status'], 'ready');
  assert.equal(first.body['previewFingerprint'], reordered.body['previewFingerprint']);
});

test('preserves selected parcel geometry when the working rectangle only partly overlaps it', () => {
  const response = request('POST', `${API}/projects/previews`, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single],
    workingExtent: workingExtent([100050, 200000, 100120, 200100]),
  });
  const parcel = (response.body['selectedParcels'] as readonly Record<string, unknown>[])[0]!;
  const warnings = response.body['warnings'] as readonly Record<string, unknown>[];

  assert.equal(response.body['status'], 'ready');
  assert.deepEqual(parcel['geometry'], {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [100020, 200020],
          [100080, 200020],
          [100080, 200080],
          [100020, 200080],
          [100020, 200020],
        ],
      ],
    ],
    crs: 'EPSG:2180',
    axisOrder: 'easting-northing',
  });
  assert.ok(warnings.some((warning) => warning['code'] === 'PARCEL_PARTLY_OUTSIDE_WORKING_EXTENT'));
});

test('rejects invalid and over-limit rectangles and makes incomplete previews unusable for create', () => {
  const invalidCrs = request('POST', `${API}/projects/previews`, {
    parcelIds: [],
    workingExtent: { ...workingExtent([100000, 200000, 100100, 200100]), crs: 'EPSG:4326' },
  });
  const outsideLimits = request('POST', `${API}/projects/previews`, {
    parcelIds: [],
    workingExtent: workingExtent([100000, 200000, 102001, 202000]),
  });
  const atLimits = request('POST', `${API}/projects/previews`, {
    parcelIds: [],
    workingExtent: workingExtent([100000, 200000, 102000, 202000]),
  });
  const tooManyParcels = request('POST', `${API}/projects/previews`, {
    parcelIds: Array.from({ length: 101 }, (_, index) => `fixture-parcel-${index}`),
    workingExtent: workingExtent([100000, 200000, 100100, 200100]),
  });
  const maximumParcels = request('POST', `${API}/projects/previews`, {
    parcelIds: Array.from({ length: 100 }, (_, index) => `fixture-parcel-${index}`),
    workingExtent: workingExtent([100000, 200000, 100100, 200100]),
  });
  const duplicateParcels = request('POST', `${API}/projects/previews`, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.single],
    workingExtent: workingExtent([100000, 200000, 100100, 200100]),
  });
  const incomplete = request('POST', `${API}/projects/previews`, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.unresolved],
    workingExtent: workingExtent([100000, 200000, 100100, 200100]),
  });
  const incompleteState = createProjectSimulatorState();
  const incompleteCreate = request(
    'POST',
    `${API}/projects`,
    {
      name: 'Incomplete area',
      parcelIds: [SYNTHETIC_PARCEL_IDS.unresolved],
      workingExtent: workingExtent([100000, 200000, 100100, 200100]),
      previewFingerprint: `v2:sha256:${'0'.repeat(64)}`,
    },
    incompleteState,
    'incomplete-create-attempt-01',
  );
  const noPartialProject = request(
    'GET',
    `${API}/projects/00000000-0000-4000-8000-000000000001`,
    undefined,
    incompleteState,
  );

  assert.equal(invalidCrs.status, 400);
  assert.equal(outsideLimits.status, 200);
  assert.equal(outsideLimits.body['status'], 'outside_limits');
  assert.equal(atLimits.body['status'], 'ready');
  assert.equal(tooManyParcels.status, 400);
  assert.equal(maximumParcels.status, 200);
  assert.equal(maximumParcels.body['status'], 'incomplete');
  assert.equal(duplicateParcels.status, 400);
  assert.equal(incomplete.body['status'], 'incomplete');
  assert.equal(incomplete.body['previewFingerprint'], null);
  assert.equal(incompleteCreate.status, 422);
  assert.equal(noPartialProject.status, 404);
});

test('creates only the unchanged preview, replays the same attempt, rejects key conflicts, and reopens it', () => {
  const state = createProjectSimulatorState();
  const extent = workingExtent([100000, 200000, 100100, 200100]);
  const preview = request(
    'POST',
    `${API}/projects/previews`,
    { parcelIds: [], workingExtent: extent },
    state,
  );
  const createBody = {
    name: 'Interactive fixture project',
    parcelIds: [],
    workingExtent: extent,
    previewFingerprint: preview.body['previewFingerprint'],
  };
  const created = request('POST', `${API}/projects`, createBody, state, IDEMPOTENCY_KEY);
  const replay = request('POST', `${API}/projects`, createBody, state, IDEMPOTENCY_KEY);
  const conflict = request(
    'POST',
    `${API}/projects`,
    { ...createBody, workingExtent: workingExtent([100000, 200000, 100200, 200100]) },
    state,
    IDEMPOTENCY_KEY,
  );
  const stale = request(
    'POST',
    `${API}/projects`,
    {
      ...createBody,
      workingExtent: workingExtent([100000, 200000, 100200, 200100]),
    },
    state,
    'interactive-create-attempt-02',
  );
  const projectId = String(created.body['id']);
  const reopened = request('GET', `${API}/projects/${projectId}`, undefined, state);

  assert.equal(created.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.idempotencyReplayed, true);
  assert.equal(replay.body['id'], created.body['id']);
  assert.equal('bufferMetres' in created.body, false);
  assert.equal('preview' in created.body, false);
  assert.equal(conflict.status, 409);
  assert.equal(stale.status, 409);
  assert.equal(reopened.status, 200);
  assert.deepEqual(
    (reopened.body['workingExtent'] as Record<string, unknown>)['bounds'],
    extent.bounds,
  );
});
