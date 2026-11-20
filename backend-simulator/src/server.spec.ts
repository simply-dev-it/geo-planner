import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { SYNTHETIC_PARCEL_IDS } from './parcel-fixtures.js';
import {
  createContractSimulator,
  DEFAULT_HOST,
  MAX_REQUEST_BODY_BYTES,
  routeRequest,
} from './server.js';

const PREVIEW_PATH = '/api/v1/projects/previews';
const PROJECTS_PATH = '/api/v1/projects';
const workingExtent = {
  crs: 'EPSG:2180',
  axisOrder: 'easting-northing',
  bounds: [100000, 200000, 100100, 200100],
};

test('reports simulator readiness and explicitly identifies its synthetic boundaries', () => {
  const response = routeRequest('GET', '/_simulator/health', 'simulator-test');

  assert.equal(response.status, 200);
  assert.equal(response.contentType, 'application/json');
  assert.equal(response.correlationId, 'simulator-test');
  assert.deepEqual(response.body, {
    service: 'geo-planner-contract-simulator',
    status: 'ready',
    mode: 'offline-fixtures',
    providerAccess: 'disabled',
    projectStorage: 'in-memory-only',
  });
});

test('serves interactive preview and create over loopback HTTP with correlation and replay headers', async () => {
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
      body: JSON.stringify({ parcelIds: [SYNTHETIC_PARCEL_IDS.single], workingExtent }),
    });
    const preview = (await previewResponse.json()) as Record<string, unknown>;

    assert.equal(previewResponse.status, 200);
    assert.equal(previewResponse.headers.get('x-correlation-id'), 'http-preview-test');
    assert.match(String(preview['previewFingerprint']), /^v1:sha256:[a-f0-9]{64}$/);

    const createBody = JSON.stringify({
      name: 'HTTP fixture project',
      parcelIds: [SYNTHETIC_PARCEL_IDS.single],
      workingExtent,
      previewFingerprint: preview['previewFingerprint'],
    });
    const headers = {
      'content-type': 'application/json',
      'idempotency-key': 'http-project-create-attempt-01',
    };
    const createResponse = await fetch(`${baseUrl}${PROJECTS_PATH}`, {
      method: 'POST',
      headers,
      body: createBody,
    });
    const project = (await createResponse.json()) as Record<string, unknown>;
    const location = createResponse.headers.get('location');

    assert.equal(createResponse.status, 201);
    assert.equal(location, `${PROJECTS_PATH}/${String(project['id'])}`);

    const replayResponse = await fetch(`${baseUrl}${PROJECTS_PATH}`, {
      method: 'POST',
      headers,
      body: createBody,
    });
    assert.equal(replayResponse.status, 200);
    assert.equal(replayResponse.headers.get('idempotency-replayed'), 'true');
    assert.equal(((await replayResponse.json()) as Record<string, unknown>)['id'], project['id']);

    const reopenedResponse = await fetch(new URL(location!, baseUrl));
    assert.equal(reopenedResponse.status, 200);
    assert.deepEqual(await reopenedResponse.json(), project);

    const retiredResponse = await fetch(`${baseUrl}/api/v2/projects/previews`, {
      method: 'POST',
      headers,
      body: createBody,
    });
    assert.equal(retiredResponse.status, 404);
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
      `http://${DEFAULT_HOST}:${address.port}/api/v1/map/layers/base-map/tiles/0/0/0`,
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

test('rejects all retired v2 routes and paths outside the provisional proposal', () => {
  for (const [method, path] of [
    ['GET', '/api/v2/map/layers/base-map/tiles/0/0/0'],
    ['GET', '/api/v2/search?query=Nowe'],
    ['POST', '/api/v2/parcels/resolve'],
    ['POST', '/api/v2/projects/previews'],
    ['POST', '/api/v2/projects'],
    ['GET', '/api/v2/projects/00000000-0000-4000-8000-000000000001'],
    ['GET', '/api/projects'],
  ]) {
    const response = routeRequest(method, path, 'simulator-test');
    assert.equal(response.status, 404, `${method} ${path}`);
    assert.equal(response.contentType, 'application/problem+json');
    assert.equal(response.body['title'], 'No simulated contract route');
  }
});

test('rejects superseded parcel-only payloads on the reused v1 project paths', () => {
  const parcelIds = [SYNTHETIC_PARCEL_IDS.single];
  for (const [path, body] of [
    [PREVIEW_PATH, { parcelIds, bufferMetres: 100 }],
    [
      PROJECTS_PATH,
      {
        name: 'Retired project',
        parcelIds,
        bufferMetres: 100,
        previewFingerprint: `v1:sha256:${'0'.repeat(64)}`,
      },
    ],
  ] as const) {
    const response = routeRequest('POST', path, 'simulator-test', JSON.stringify(body), {
      'idempotency-key': 'retired-create-attempt-01',
    });
    assert.equal(response.status, 400);
    assert.equal(response.body['errorCode'], 'INVALID_REQUEST');
    assert.ok(
      (response.body['fieldErrors'] as readonly Record<string, unknown>[]).some(
        (error) => error['field'] === 'bufferMetres',
      ),
    );
  }
});

test('returns problem details for malformed JSON, forged fields, and oversized bodies', () => {
  const malformed = routeRequest('POST', PREVIEW_PATH, 'simulator-test', '{');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.contentType, 'application/problem+json');

  const forged = routeRequest(
    'POST',
    PREVIEW_PATH,
    'simulator-test',
    JSON.stringify({ status: 201, contentType: 'application/json', correlationId: 'forged' }),
  );
  assert.equal(forged.status, 400);
  assert.equal(forged.body['errorCode'], 'INVALID_REQUEST');

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
