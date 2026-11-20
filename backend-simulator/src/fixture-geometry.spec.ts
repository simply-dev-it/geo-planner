import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { fixtureContainsPoint, fixtureIntersectsArea } from './fixture-geometry.js';
import { CIEZKOWICE_SNAPSHOT, CIEZKOWICE_BOUNDS, CIEZKOWICE_CENTER } from './snapshot-data.js';
import { routeRequest } from './server.js';

const polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [3, 3],
      [7, 3],
      [7, 7],
      [3, 7],
      [3, 3],
    ],
  ],
};
test('polygon discovery excludes holes and boundary-only contact', () => {
  assert.equal(fixtureContainsPoint(polygon, [1, 1]), true);
  assert.equal(fixtureContainsPoint(polygon, [5, 5]), false);
  assert.equal(fixtureIntersectsArea(polygon, [4, 4, 6, 6]), false);
  assert.equal(fixtureIntersectsArea(polygon, [10, 2, 12, 4]), false);
  assert.equal(fixtureIntersectsArea(polygon, [1, 1, 5, 5]), true);
});
test('archived parcel lookup preserves source identity, holes and qualified incomplete coverage', () => {
  assert.equal(CIEZKOWICE_SNAPSHOT.parcels.length, 13);
  const response = routeRequest(
    'POST',
    '/api/v1/parcels/resolve',
    'snapshot-test',
    JSON.stringify({ selector: { type: 'identifier', value: '121601_4.0001.1092/2' } }),
  );
  assert.equal(response.body['status'], 'resolved');
  const parcel = response.body['parcel'] as Record<string, unknown>;
  assert.equal(parcel['source'], 'ARCHIVED_GUGIK_ULDK');
  assert.equal(parcel['parcelNumber'], '1092/2');
  assert.equal((parcel['geometry'] as { coordinates: unknown[] }).coordinates.length, 2);
  const found = routeRequest(
    'POST',
    '/api/v1/parcels/intersections',
    'snapshot-test',
    JSON.stringify({
      workingExtent: { crs: 'EPSG:2180', axisOrder: 'easting-northing', bounds: CIEZKOWICE_BOUNDS },
    }),
  );
  assert.equal(found.body['status'], 'truncated');
  assert.equal(
    (found.body['provenance'] as Record<string, unknown>)['provider'],
    'ARCHIVED_GUGIK_SNAPSHOT',
  );
  assert.ok((found.body['candidates'] as unknown[]).length > 0);
});
test('archived orthophoto is served in the product tile grid without live provider access', () => {
  const z = 14,
    span = 3000000 / 2 ** z,
    x = Math.floor((CIEZKOWICE_CENTER[0] + 1000000) / span),
    y = Math.floor((2000000 - CIEZKOWICE_CENTER[1]) / span);
  const response = routeRequest(
    'GET',
    `/api/v1/map/layers/base-map/tiles/${z}/${x}/${y}`,
    'snapshot-map',
  );
  assert.equal(response.status, 200);
  assert.equal(response.contentType, 'image/png');
  assert.equal(
    response.headers?.['x-simulator-fixture'],
    'archived-ciezkowice-orthophoto-256px-png',
  );
  assert.equal(
    response.headers?.['x-map-attribution'],
    'Archived GUGiK ORTO snapshot; source date unknown; indicative only.',
  );
  assert.ok(response.rawBody && response.rawBody.length > 1000);
  assert.equal(response.rawBody?.readUInt32BE(16), 256);
  assert.equal(response.rawBody?.readUInt32BE(20), 256);
});
