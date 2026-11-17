import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createProjectSimulatorState, SYNTHETIC_PARCEL_IDS } from './project-scenarios.js';
import {
  createContractSimulator,
  DEFAULT_HOST,
  MAX_REQUEST_BODY_BYTES,
  routeRequest,
} from './server.js';

const PREVIEW_PATH = '/api/v1/projects/previews';
const PROJECTS_PATH = '/api/v1/projects';
const IDEMPOTENCY_KEY = 'project-create-attempt-0001';

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
    'simulator-test',
    body ? JSON.stringify(body) : undefined,
    idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
    state,
  );
}

function readyPreview(state = createProjectSimulatorState()) {
  const response = request(
    'POST',
    PREVIEW_PATH,
    {
      parcelIds: [SYNTHETIC_PARCEL_IDS.single],
      bufferMetres: 100,
    },
    state,
  );

  assert.equal(response.status, 200);
  assert.equal(response.body['status'], 'ready');
  return { preview: response.body, state };
}

test('reports simulator readiness and explicitly identifies its synthetic boundaries', () => {
  const response = routeRequest('GET', '/_simulator/health', 'simulator-test');

  assert.equal(response.status, 200);
  assert.equal(response.contentType, 'application/json');
  assert.equal(response.correlationId, 'simulator-test');
  assert.deepEqual(response.body, {
    service: 'geo-planner-contract-simulator',
    status: 'ready',
    mode: 'synthetic-fixtures',
    providerAccess: 'disabled',
    projectStorage: 'in-memory-only',
  });
});

test('serves preview and create routes over loopback HTTP with correlation and replay headers', async () => {
  const server = createContractSimulator();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, DEFAULT_HOST, resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://${DEFAULT_HOST}:${address.port}`;

  try {
    const previewResponse = await fetch(`${baseUrl}${PREVIEW_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-correlation-id': 'http-preview-test' },
      body: JSON.stringify({ parcelIds: [SYNTHETIC_PARCEL_IDS.single], bufferMetres: 0 }),
    });
    const preview = (await previewResponse.json()) as Record<string, unknown>;

    assert.equal(previewResponse.status, 200);
    assert.equal(previewResponse.headers.get('x-correlation-id'), 'http-preview-test');

    const createResponse = await fetch(`${baseUrl}${PROJECTS_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'http-project-create-attempt-01',
      },
      body: JSON.stringify({
        name: 'HTTP fixture project',
        parcelIds: [SYNTHETIC_PARCEL_IDS.single],
        bufferMetres: 0,
        previewFingerprint: preview['previewFingerprint'],
      }),
    });
    const project = (await createResponse.json()) as Record<string, unknown>;
    const location = createResponse.headers.get('location');

    assert.equal(createResponse.status, 201);
    assert.ok(location);

    const replayResponse = await fetch(`${baseUrl}${PROJECTS_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'http-project-create-attempt-01',
      },
      body: JSON.stringify({
        name: 'HTTP fixture project',
        parcelIds: [SYNTHETIC_PARCEL_IDS.single],
        bufferMetres: 0,
        previewFingerprint: preview['previewFingerprint'],
      }),
    });

    assert.equal(replayResponse.status, 200);
    assert.equal(replayResponse.headers.get('idempotency-replayed'), 'true');
    assert.equal(((await replayResponse.json()) as Record<string, unknown>)['id'], project['id']);

    const reopenedResponse = await fetch(new URL(location, baseUrl));
    assert.equal(reopenedResponse.status, 200);
    assert.equal(((await reopenedResponse.json()) as Record<string, unknown>)['id'], project['id']);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('streams a synthetic PNG tile over loopback HTTP with cache and attribution headers', async () => {
  const server = createContractSimulator();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, DEFAULT_HOST, resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    const tileResponse = await fetch(
      `http://${DEFAULT_HOST}:${address.port}/api/v2/map/layers/fixture-base/tiles/0/0/0`,
    );
    const bytes = new Uint8Array(await tileResponse.arrayBuffer());

    assert.equal(tileResponse.status, 200);
    assert.equal(tileResponse.headers.get('content-type'), 'image/png');
    assert.equal(
      tileResponse.headers.get('x-map-attribution'),
      'Synthetic fixture only; no external map source.',
    );
    assert.equal(tileResponse.headers.get('cache-control'), 'public, max-age=60');
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(Number(tileResponse.headers.get('content-length')), bytes.byteLength);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('previews a deterministic single-parcel fixture in the explicit metric CRS', () => {
  const first = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single],
    bufferMetres: 100,
  });
  const second = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single],
    bufferMetres: 100,
  });

  assert.equal(first.status, 200);
  assert.equal(first.body['status'], 'ready');
  assert.equal(first.body['projectCrs'], 'EPSG:2180');
  assert.equal(first.body['axisOrder'], 'easting-northing');
  assert.deepEqual(first.body['previewFingerprint'], second.body['previewFingerprint']);
  assert.deepEqual(first.body['issues'], []);
  assert.equal((first.body['provenance'] as Record<string, unknown>)['sourceDataDate'], null);
});

test('previews adjacent parcels as a stable bounded subject union independent of input order', () => {
  const first = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.adjacent],
    bufferMetres: 100,
  });
  const reordered = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.adjacent, SYNTHETIC_PARCEL_IDS.single],
    bufferMetres: 100,
  });

  assert.equal(first.body['status'], 'ready');
  assert.deepEqual(first.body['previewFingerprint'], reordered.body['previewFingerprint']);
  assert.deepEqual(first.body['acquisitionExtent'], {
    crs: 'EPSG:2180',
    axisOrder: 'minEasting-minNorthing-maxEasting-maxNorthing',
    bounds: [99920, 199920, 100240, 200180],
    widthMetres: 320,
    heightMetres: 260,
    envelopeAreaSquareMetres: 83200,
  });
});

test('preserves nearby disconnected subject polygons and exposes their unused envelope gap', () => {
  const response = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.nearby],
    bufferMetres: 100,
  });
  const subjectGeometry = response.body['subjectGeometry'] as Record<string, unknown>;
  const bufferedGeometry = response.body['bufferedGeometry'] as Record<string, unknown>;

  assert.equal(response.body['status'], 'ready');
  assert.equal((subjectGeometry['coordinates'] as readonly unknown[]).length, 2);
  assert.equal((bufferedGeometry['coordinates'] as readonly unknown[]).length, 2);
  assert.deepEqual(response.body['subjectExtent'], {
    crs: 'EPSG:2180',
    axisOrder: 'minEasting-minNorthing-maxEasting-maxNorthing',
    bounds: [100020, 200020, 100580, 200080],
    widthMetres: 560,
    heightMetres: 60,
    envelopeAreaSquareMetres: 33600,
  });
  assert.deepEqual(response.body['acquisitionExtent'], {
    crs: 'EPSG:2180',
    axisOrder: 'minEasting-minNorthing-maxEasting-maxNorthing',
    bounds: [99920, 199920, 100680, 200180],
    widthMetres: 760,
    heightMetres: 260,
    envelopeAreaSquareMetres: 197600,
  });
});

test('merges overlapping schematic buffers without joining disconnected subject parcels', () => {
  const response = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.nearby],
    bufferMetres: 500,
  });
  const subject = response.body['subjectGeometry'] as Record<string, unknown>;
  const buffer = response.body['bufferedGeometry'] as Record<string, unknown>;
  assert.equal(response.body['status'], 'ready');
  assert.equal((subject['coordinates'] as readonly unknown[]).length, 2);
  assert.equal((buffer['coordinates'] as readonly unknown[]).length, 1);
});

test('keeps unresolved and ambiguous parcels visible but does not issue a create fingerprint', () => {
  const response = request('POST', PREVIEW_PATH, {
    parcelIds: [
      SYNTHETIC_PARCEL_IDS.single,
      SYNTHETIC_PARCEL_IDS.unresolved,
      SYNTHETIC_PARCEL_IDS.ambiguous,
    ],
    bufferMetres: 100,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body['status'], 'incomplete');
  assert.deepEqual(response.body['issues'], ['UNRESOLVED_PARCEL', 'AMBIGUOUS_PARCEL']);
  assert.equal(response.body['previewFingerprint'], null);
  assert.equal(
    (response.body['parcels'] as readonly Record<string, unknown>[])[0]?.['status'],
    'resolved',
  );
});

test('marks a distant multi-parcel selection outside the accepted envelope limits', () => {
  const response = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.distant],
    bufferMetres: 0,
  });

  assert.equal(response.body['status'], 'outside_limits');
  assert.deepEqual(response.body['issues'], [
    'SUBJECT_EXTENT_EXCEEDED',
    'BUFFERED_EXTENT_EXCEEDED',
  ]);
  assert.equal(response.body['previewFingerprint'], null);
});

test('accepts buffer boundaries and up to 100 identifiers, but rejects out-of-range values and 101 identifiers', () => {
  for (const bufferMetres of [0, 100, 500]) {
    const response = request('POST', PREVIEW_PATH, {
      parcelIds: [SYNTHETIC_PARCEL_IDS.single],
      bufferMetres,
    });
    assert.equal(response.status, 200);
  }

  const oneHundredIds = Array.from({ length: 100 }, (_, index) => `999999_9.9999.${1000 + index}`);
  const hundredResponse = request('POST', PREVIEW_PATH, {
    parcelIds: oneHundredIds,
    bufferMetres: 0,
  });
  assert.equal(hundredResponse.status, 200);
  assert.equal((hundredResponse.body['parcels'] as readonly unknown[]).length, 100);

  const tooManyResponse = request('POST', PREVIEW_PATH, {
    parcelIds: [...oneHundredIds, '999999_9.9999.2000'],
    bufferMetres: 0,
  });
  assert.equal(tooManyResponse.status, 400);
  assert.equal(tooManyResponse.body['errorCode'], 'INVALID_REQUEST');

  const invalidBuffer = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single],
    bufferMetres: 501,
  });
  assert.equal(invalidBuffer.status, 400);
});

test('creates only a matching complete preview and supports process-local idempotent replay', () => {
  const { preview, state } = readyPreview();
  const payload = {
    name: 'Synthetic parcel project',
    parcelIds: [SYNTHETIC_PARCEL_IDS.single],
    bufferMetres: 100,
    previewFingerprint: preview['previewFingerprint'],
  };
  const created = request('POST', PROJECTS_PATH, payload, state, IDEMPOTENCY_KEY);

  assert.equal(created.status, 201);
  assert.equal(created.location, `${PROJECTS_PATH}/${created.body['id']}`);

  const replay = request('POST', PROJECTS_PATH, payload, state, IDEMPOTENCY_KEY);
  assert.equal(replay.status, 200);
  assert.equal(replay.idempotencyReplayed, true);
  assert.equal(replay.body['id'], created.body['id']);

  const conflict = request(
    'POST',
    PROJECTS_PATH,
    { ...payload, name: 'Changed payload' },
    state,
    IDEMPOTENCY_KEY,
  );
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body['errorCode'], 'IDEMPOTENCY_CONFLICT');

  const reopened = request(
    'GET',
    `${PROJECTS_PATH}/${String(created.body['id'])}`,
    undefined,
    state,
  );
  assert.equal(reopened.status, 200);
  assert.deepEqual(reopened.body, created.body);

  const afterRestart = request('GET', `${PROJECTS_PATH}/${String(created.body['id'])}`);
  assert.equal(afterRestart.status, 404);
});

test('rejects stale previews and partial or excessive project creation', () => {
  const { preview, state } = readyPreview();
  const basePayload = {
    name: 'Synthetic parcel project',
    parcelIds: [SYNTHETIC_PARCEL_IDS.single],
    bufferMetres: 100,
    previewFingerprint: preview['previewFingerprint'],
  };

  const stale = request(
    'POST',
    PROJECTS_PATH,
    { ...basePayload, previewFingerprint: `v1:sha256:${'0'.repeat(64)}` },
    state,
    'project-create-stale-0001',
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.body['errorCode'], 'PREVIEW_STALE');

  const partial = request(
    'POST',
    PROJECTS_PATH,
    {
      ...basePayload,
      parcelIds: [SYNTHETIC_PARCEL_IDS.unresolved],
    },
    state,
    'project-create-partial-0001',
  );
  assert.equal(partial.status, 422);
  assert.equal(partial.body['errorCode'], 'UNRESOLVED_PARCEL');

  const excessivePreview = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.distant],
    bufferMetres: 0,
  });
  const excessive = request(
    'POST',
    PROJECTS_PATH,
    {
      ...basePayload,
      parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.distant],
      previewFingerprint:
        excessivePreview.body['previewFingerprint'] ?? `v1:sha256:${'0'.repeat(64)}`,
    },
    state,
    'project-create-excessive-0001',
  );
  assert.equal(excessive.status, 422);
  assert.equal(excessive.body['errorCode'], 'EXTENT_EXCEEDED');
});

test('returns problem details for malformed JSON, duplicate identifiers, and oversized bodies', () => {
  const malformed = routeRequest('POST', PREVIEW_PATH, 'simulator-test', '{');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.contentType, 'application/problem+json');

  const forgedResponse = request('POST', PREVIEW_PATH, {
    status: 201,
    contentType: 'application/json',
    correlationId: 'forged',
  });
  assert.equal(forgedResponse.status, 400);
  assert.equal(forgedResponse.body['errorCode'], 'INVALID_REQUEST');

  const duplicate = request('POST', PREVIEW_PATH, {
    parcelIds: [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.single],
    bufferMetres: 0,
  });
  assert.equal(duplicate.status, 400);

  const oversized = routeRequest(
    'POST',
    PREVIEW_PATH,
    'simulator-test',
    'x'.repeat(MAX_REQUEST_BODY_BYTES + 1),
    {},
    undefined,
    true,
  );
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body['errorCode'], 'REQUEST_TOO_LARGE');
});

test('returns a problem response for paths outside the provisional proposal', () => {
  const response = routeRequest('GET', '/api/projects', 'simulator-test');

  assert.equal(response.status, 404);
  assert.equal(response.contentType, 'application/problem+json');
  assert.equal(response.body['title'], 'No simulated contract route');
});
