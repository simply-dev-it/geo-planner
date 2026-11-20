import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';

import { createInteractiveSimulatorState } from './interactive-scenarios.js';
import { SYNTHETIC_PARCEL_IDS } from './parcel-fixtures.js';
import { routeRequest } from './server.js';

const API = '/api/v1';
const IDEMPOTENCY_KEY = 'interactive-create-attempt-01';

function request(
  method: string,
  path: string,
  body?: Readonly<Record<string, unknown>>,
  state = createInteractiveSimulatorState(),
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

test('serves visible synthetic raster tiles with attribution and rejects invalid coordinates', () => {
  const tile = request('GET', `${API}/map/layers/base-map/tiles/0/0/0`);
  const adjacentTile = request('GET', `${API}/map/layers/base-map/tiles/1/1/0`);
  const invalid = request('GET', `${API}/map/layers/base-map/tiles/0/1/0`);
  const negative = request('GET', `${API}/map/layers/base-map/tiles/0/-1/0`);
  const unsupported = request('GET', `${API}/map/layers/arbitrary/tiles/0/0/0`);
  const tilePayload = tile as unknown as {
    readonly contentType: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly rawBody?: Uint8Array;
  };

  assert.equal(tile.status, 200);
  assert.equal(tilePayload.contentType, 'image/png');
  assert.ok(tilePayload.rawBody instanceof Uint8Array);
  const bytes = Buffer.from(tilePayload.rawBody ?? []);
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(bytes.readUInt32BE(16), 256);
  assert.equal(bytes.readUInt32BE(20), 256);
  const imageData: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') imageData.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const pixels = inflateSync(Buffer.concat(imageData));
  const colors = new Set<string>();
  for (let y = 0; y < 256; y += 1) {
    const scanline = y * (256 * 3 + 1);
    assert.equal(pixels[scanline], 0, 'PNG scanline should use the expected filter');
    for (let x = 0; x < 256; x += 1) {
      const offset = scanline + 1 + x * 3;
      colors.add(`${pixels[offset]}:${pixels[offset + 1]}:${pixels[offset + 2]}`);
    }
  }
  assert.ok(colors.size > 3, 'synthetic tile should contain distinguishable map features');
  assert.notDeepEqual(
    (adjacentTile as unknown as { rawBody: Buffer }).rawBody,
    tilePayload.rawBody,
    'tile artwork should vary with tile coordinates',
  );
  assert.equal(
    tilePayload.headers?.['x-map-attribution'],
    'Synthetic fixture only; no external map source.',
  );
  assert.equal(invalid.status, 400);
  assert.equal(negative.status, 400);
  assert.equal(unsupported.status, 404);
});

test('searches typed location and parcel candidates without guessing ambiguous streets', () => {
  const locality = request('GET', `${API}/search?query=Brzozowo&type=locality`);
  const ambiguous = request('GET', `${API}/search?query=Lipowa`);
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
  assert.equal((ambiguous.body['candidates'] as readonly unknown[]).length, 3);
  assert.deepEqual(
    (ambiguous.body['candidates'] as readonly Record<string, unknown>[]).map(
      (candidate) => candidate['contextLabel'],
    ),
    ['Brzozowo', 'Dąbrowa', 'Jeziorna'],
  );
  assert.equal(
    (parcel.body['candidates'] as readonly Record<string, unknown>[])[0]?.['type'],
    'parcel',
  );
  assert.equal(missing.body['status'], 'no_match');
  assert.equal(unavailable.status, 503);
});

test('narrows a street query by locality and accepts Polish names without diacritics', () => {
  for (const query of ['Leśna, Dąbrowa', 'dabrowa lesna']) {
    const result = request('GET', `${API}/search?query=${encodeURIComponent(query)}`);
    assert.equal(result.body['status'], 'ready');
    const candidates = result.body['candidates'] as Record<string, unknown>[];
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.['id'], 'street-dabrowa-1');
  }
  assert.equal(request('GET', `${API}/search?query=Lipowa%20Warszawa`).body['status'], 'no_match');
});

test('every ambiguous parcel candidate can be selected and previewed', () => {
  const ambiguous = request('POST', `${API}/parcels/resolve`, {
    selector: { type: 'identifier', value: SYNTHETIC_PARCEL_IDS.ambiguous },
  });
  for (const candidate of ambiguous.body['candidates'] as { id: string }[]) {
    const resolved = request('POST', `${API}/parcels/resolve`, {
      selector: { type: 'identifier', value: candidate.id },
    });
    assert.equal(resolved.body['status'], 'resolved');
    const preview = request('POST', `${API}/projects/previews`, {
      parcelIds: [candidate.id],
      workingExtent: workingExtent([100000, 200000, 101200, 201300]),
    });
    assert.equal(preview.body['status'], 'ready');
    const search = request('GET', `${API}/search?query=${encodeURIComponent(candidate.id)}`);
    assert.equal(search.body['status'], 'ready');
  }
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
  const ambiguousIdentifier = request('POST', `${API}/parcels/resolve`, {
    selector: { type: 'identifier', value: SYNTHETIC_PARCEL_IDS.ambiguous },
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
  assert.equal(ambiguousIdentifier.body['status'], 'ambiguous');
  assert.deepEqual(ambiguousIdentifier.body['candidates'], [
    {
      id: '999999_9.9999.756.1',
      parcelNumber: '104/1',
      contextLabel: 'Brzozowo · obręb Centrum · Północne',
      inputId: SYNTHETIC_PARCEL_IDS.ambiguous,
      source: 'SYNTHETIC_FIXTURE',
    },
    {
      id: '999999_9.9999.756.2',
      parcelNumber: '101/1',
      contextLabel: 'Jeziorna · obręb Nad Jeziorem · Południowe',
      inputId: SYNTHETIC_PARCEL_IDS.ambiguous,
      source: 'SYNTHETIC_FIXTURE',
    },
  ]);
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
  assert.equal(
    response.body['previewFingerprint'],
    'v1:sha256:7e78266055dad16f66a5653bf4f045be467c66d1cdeab136afe7fd41eea7cd8a',
  );
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

test('preserves incomplete fixture results and rejects a distant parcel subject', () => {
  const extent = workingExtent([100000, 200000, 100100, 200100]);
  const incomplete = request('POST', `${API}/projects/previews`, {
    parcelIds: [
      SYNTHETIC_PARCEL_IDS.single,
      SYNTHETIC_PARCEL_IDS.unresolved,
      SYNTHETIC_PARCEL_IDS.ambiguous,
    ],
    workingExtent: extent,
  });
  assert.equal(incomplete.body['status'], 'incomplete');
  assert.deepEqual(incomplete.body['issues'], ['UNRESOLVED_PARCEL', 'AMBIGUOUS_PARCEL']);
  assert.equal(incomplete.body['previewFingerprint'], null);
  const parcels = incomplete.body['selectedParcels'] as readonly Record<string, unknown>[];
  assert.deepEqual(
    parcels.map((parcel) => parcel['status']),
    ['resolved', 'unresolved', 'ambiguous'],
  );
  assert.deepEqual(parcels[2]?.['candidateIds'], ['999999_9.9999.756.1', '999999_9.9999.756.2']);

  const distant = request('POST', `${API}/projects/previews`, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.distant],
    workingExtent: extent,
  });
  assert.equal(distant.body['status'], 'outside_limits');
  assert.deepEqual(distant.body['issues'], ['PARCEL_SUBJECT_EXCEEDED']);
  assert.equal(distant.body['previewFingerprint'], null);
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
  const incompleteState = createInteractiveSimulatorState();
  const incompleteCreate = request(
    'POST',
    `${API}/projects`,
    {
      name: 'Incomplete area',
      parcelIds: [SYNTHETIC_PARCEL_IDS.unresolved],
      workingExtent: workingExtent([100000, 200000, 100100, 200100]),
      previewFingerprint: `v1:sha256:${'0'.repeat(64)}`,
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
  const state = createInteractiveSimulatorState();
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
  const afterRestart = request('GET', `${API}/projects/${projectId}`);
  const oldFingerprint = request(
    'POST',
    `${API}/projects`,
    { ...createBody, previewFingerprint: `v2:sha256:${'0'.repeat(64)}` },
    state,
    'interactive-create-attempt-03',
  );

  assert.equal(created.status, 201);
  assert.equal(created.location, `${API}/projects/${projectId}`);
  assert.equal(replay.status, 200);
  assert.equal(replay.idempotencyReplayed, true);
  assert.equal(replay.body['id'], created.body['id']);
  assert.equal('bufferMetres' in created.body, false);
  assert.equal('preview' in created.body, false);
  assert.equal(conflict.status, 409);
  assert.equal(stale.status, 409);
  assert.equal(reopened.status, 200);
  assert.equal(afterRestart.status, 404);
  assert.equal(oldFingerprint.status, 400);
  assert.equal(oldFingerprint.body['errorCode'], 'INVALID_REQUEST');
  assert.deepEqual(
    (reopened.body['workingExtent'] as Record<string, unknown>)['bounds'],
    extent.bounds,
  );
});

test('discovers exact positive-area fixture intersections without selecting subjects', () => {
  const discover = (bounds: number[]) =>
    request('POST', `${API}/parcels/intersections`, { workingExtent: workingExtent(bounds) });
  const ids = (response: ReturnType<typeof discover>) =>
    (response.body['candidates'] as { id: string }[]).map((p) => p.id);
  const full = discover([100000, 200000, 100200, 200200]);
  assert.equal(full.status, 200);
  assert.equal(full.body['status'], 'complete');
  assert.deepEqual(
    ids(full),
    [
      SYNTHETIC_PARCEL_IDS.single,
      SYNTHETIC_PARCEL_IDS.adjacent,
      SYNTHETIC_PARCEL_IDS.candidateFirst,
    ].sort(),
  );
  assert.deepEqual(ids(discover([100030, 200030, 100040, 200040])), [SYNTHETIC_PARCEL_IDS.single]);
  assert.deepEqual(ids(discover([100000, 200000, 100020, 200020])), []);
  assert.deepEqual(ids(discover([101500, 201500, 101600, 201600])), []);
  assert.ok(JSON.stringify(full.body['provenance']).includes('fictional'));
  assert.equal(discover([100000, 200000, 102001, 200100]).status, 400);
  assert.equal(discover([100000, 200000, 100000, 200100]).status, 400);
  assert.equal(
    request('POST', `${API}/parcels/intersections`, {
      workingExtent: { ...workingExtent([0, 0, 10, 10]), crs: 'EPSG:4326' },
    }).status,
    400,
  );
});

test('searches fractional parcel numbers with context while preserving full identities', () => {
  const find = (query: string) =>
    request('GET', `${API}/search?query=${encodeURIComponent(query)}`);
  const context = find('101/1');
  assert.equal(context.body['status'], 'needs_context');
  assert.deepEqual(context.body['candidates'], []);
  assert.equal(context.body['nextCursor'], null);
  assert.ok(context.body['contextPrompt']);
  const narrowed = find('Nad Jeziorem 101/1');
  assert.equal(narrowed.body['status'], 'ready');
  assert.equal(
    (narrowed.body['candidates'] as Record<string, unknown>[])[0]?.['parcelId'],
    SYNTHETIC_PARCEL_IDS.candidateSecond,
  );
  assert.equal(find(SYNTHETIC_PARCEL_IDS.single).body['status'], 'ready');
  assert.equal(find('101/1 nieistniejący obręb').body['status'], 'no_match');
  assert.equal(find('101').body['status'], 'needs_context');
  assert.equal(find('101/10').body['status'], 'needs_context');
});

test('bounds search pages, filters candidates and binds cursors to their query', () => {
  const first = request('GET', `${API}/search?query=Brzozowo&type=parcel&limit=5`);
  assert.equal(first.status, 200);
  assert.equal((first.body['candidates'] as unknown[]).length, 5);
  const cursor = String(first.body['nextCursor']);
  assert.ok(cursor.length > 0);
  const next = request(
    'GET',
    `${API}/search?query=Brzozowo&type=parcel&limit=5&cursor=${encodeURIComponent(cursor)}`,
  );
  assert.equal(next.status, 200);
  assert.equal((next.body['candidates'] as unknown[]).length, 5);
  const a = (first.body['candidates'] as { id: string }[]).map((p) => p.id);
  const b = (next.body['candidates'] as { id: string }[]).map((p) => p.id);
  assert.equal(a.filter((id) => b.includes(id)).length, 0);
  assert.equal(
    request('GET', `${API}/search?query=Lipowa&type=parcel&cursor=${encodeURIComponent(cursor)}`)
      .status,
    400,
  );
  assert.equal(request('GET', `${API}/search?limit=100`).status, 400);
  const filtered = request(
    'GET',
    `${API}/search?query=Brzozowo%20101%2F1&regionId=north&type=parcel`,
  );
  assert.equal((filtered.body['candidates'] as unknown[]).length, 1);
  assert.equal(request('GET', `${API}/search?regionId=south&localityId=brzozowo`).status, 400);
  assert.equal(request('GET', `${API}/search?query=a&query=b`).status, 400);
  for (const query of ['', '  '])
    assert.equal(request('GET', `${API}/search?query=${encodeURIComponent(query)}`).status, 400);
  assert.ok(
    (request('GET', `${API}/search?query=Polnocne`).body['candidates'] as { type: string }[]).every(
      (p) => p.type !== 'voivodeship',
    ),
  );
  assert.equal(request('GET', `${API}/search?query=Brzozowo&type=voivodeship`).status, 400);
  assert.deepEqual(Object.keys(request('GET', `${API}/search/filters`).body), ['regions']);
});

test('filters contextual streets and rejects invalid viewport scopes', () => {
  const lookup = (q: string) => request('GET', `${API}/search?query=Lip&type=street&${q}`);
  assert.equal(
    (lookup('localityName=Brzozowo&communeName=Brzozowo').body['candidates'] as unknown[]).length,
    1,
  );
  assert.equal(
    (lookup('countyName=' + encodeURIComponent('Południowy')).body['candidates'] as unknown[])
      .length,
    1,
  );
  assert.equal(lookup('bounds=0,0,10000,10000').status, 400);
  assert.equal(lookup('bounds=not-a-bbox').status, 400);
  const within = request(
    'GET',
    `${API}/search?query=101%2F1&type=parcel&bounds=100000,200000,100200,200200`,
  );
  assert.equal(within.body['status'], 'ready');
  assert.equal((within.body['candidates'] as unknown[]).length, 1);
});

test('keeps explicit place intent separate from parcel numbers and returns address fixtures', () => {
  const place = request('GET', `${API}/search?query=101%2F1&type=place`);
  assert.equal(place.body['status'], 'no_match');
  const address = request('GET', `${API}/search?query=Brzozowo%20Lipowa%201&type=place`);
  assert.equal(address.body['status'], 'ready');
  const rows = address.body['candidates'] as Record<string, unknown>[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.['type'], 'point_address');
  assert.equal(rows[0]?.['localityId'], 'brzozowo');
});

test('does not enumerate streets or addresses for a locality-only place query', () => {
  const lookup = (query: string) =>
    request('GET', `${API}/search?query=${encodeURIComponent(query)}&type=place`).body;
  const locality = lookup('Brzozowo');
  const rows = locality['candidates'] as Record<string, unknown>[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.['type'], 'locality');
  assert.equal(lookup('Brzo')['status'], 'no_match');
  assert.equal(lookup('Brzozowo Lip')['status'], 'no_match');
  const street = lookup('Brzozowo, Lipowa')['candidates'] as Record<string, unknown>[];
  assert.equal(street.length, 1);
  assert.equal(street[0]?.['type'], 'street');
  const address = lookup('Brzozowo, Lipowa 1')['candidates'] as Record<string, unknown>[];
  assert.equal(address.length, 1);
  assert.equal(address[0]?.['type'], 'point_address');
});

test('resolves a house number only with explicit selected locality and street context', () => {
  const missing = request('GET', `${API}/search?query=1&type=address`);
  assert.equal(missing.body['status'], 'needs_context');
  const found = request(
    'GET',
    `${API}/search?query=1&type=address&localityId=brzozowo&streetId=street-brzozowo-0&streetName=Lipowa`,
  );
  assert.equal(found.body['status'], 'ready');
  assert.equal(
    (found.body['candidates'] as Record<string, unknown>[])[0]?.['label'],
    'Brzozowo, Lipowa 1',
  );
  assert.equal(
    request(
      'GET',
      `${API}/search?query=2&type=address&localityId=brzozowo&streetId=street-brzozowo-0`,
    ).body['status'],
    'no_match',
  );
  assert.equal(
    request(
      'GET',
      `${API}/search?query=1&type=address&localityId=jeziorna&streetId=street-brzozowo-0`,
    ).body['status'],
    'no_match',
  );
});
