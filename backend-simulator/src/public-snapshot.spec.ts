import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { PUBLIC_SNAPSHOT } from './public-snapshot.js';
import { routeRequest } from './server.js';

test('public capture bytes are unchanged and stay within the explicit two-MiB budget', () => {
  const snapshot = JSON.parse(
    readFileSync(
      new URL('../fixtures/public-near-ciezkowice/snapshot.json', import.meta.url),
      'utf8',
    ),
  ) as {
    responseBytes: number;
    byteBudget: number;
    requests: { name: string; sha256: string; bytes: number; error?: string }[];
  };
  let total = 0;
  for (const record of snapshot.requests) {
    if (record.error) continue;
    const bytes = readFileSync(
      new URL(`../fixtures/public-near-ciezkowice/${record.name}.response`, import.meta.url),
    );
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
    assert.equal(bytes.length, record.bytes);
    total += bytes.length;
  }
  assert.equal(total, snapshot.responseBytes);
  assert.ok(total <= snapshot.byteBudget);
  assert.equal(PUBLIC_SNAPSHOT.parcels.length, 15);
  assert.equal(PUBLIC_SNAPSHOT.streets.length, 15);
});
test('public-vector tiles retain PRG attribution rather than claiming synthetic data', () => {
  const bobowa = PUBLIC_SNAPSHOT.localities.find((place) => place.id === '0417728');
  assert.ok(bobowa);
  const z = 14,
    span = 3000000 / 2 ** z,
    x = Math.floor((bobowa.center[0] + 1000000) / span),
    y = Math.floor((2000000 - bobowa.center[1]) / span);
  const response = routeRequest(
    'GET',
    `/api/v1/map/layers/base-map/tiles/${z}/${x}/${y}`,
    'public-vector-attribution',
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers?.['x-simulator-fixture'], 'captured-public-vectors-256px-png');
  assert.equal(
    response.headers?.['x-map-attribution'],
    'Captured GUGiK PRG street vectors; frozen partial snapshot; indicative only.',
  );
});
test('locality search preserves the three real Ciezkowice candidates rather than inventing a unique locality', () => {
  const raw = JSON.parse(
    readFileSync(
      new URL('../fixtures/public-near-ciezkowice/ciezkowice-locality.response', import.meta.url),
      'utf8',
    ),
  ) as { results: Record<string, { simc: string }> };
  const result = routeRequest(
    'GET',
    '/api/v1/search?type=locality&query=Ci%C4%99%C5%BCkowice',
    'public-snapshot',
  );
  const rows = result.body['candidates'] as { id: string; source: string }[];
  assert.deepEqual(
    rows.map((r) => r.id).sort(),
    Object.values(raw.results)
      .map((r) => r.simc)
      .sort(),
  );
  assert.ok(rows.every((r) => r.source === 'CAPTURED_GUGIK_UUG'));
});
test('house-number lookup honours actual SIMC and ULIC qualification despite fuzzy native street candidates', () => {
  const response = routeRequest(
    'GET',
    '/api/v1/search?type=address&query=1&localityId=0417728&streetId=20254&streetName=S%C5%82oneczna',
    'public-snapshot',
  );
  const rows = response.body['candidates'] as { label: string; streetId: string }[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.label, 'Bobowa, Słoneczna 1');
  assert.equal(rows[0]?.streetId, '20254');
  const missing = routeRequest(
    'GET',
    '/api/v1/search?type=address&query=1&localityId=0815239&streetId=08828',
    'public-snapshot',
  );
  assert.equal(missing.body['status'], 'no_match');
  const raw = JSON.parse(
    readFileSync(
      new URL(
        '../fixtures/public-near-ciezkowice/ciezkowice-address-08828.response',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { results: null; 'returned objects': number };
  assert.equal(raw.results, null);
  assert.equal(raw['returned objects'], 0);
});
