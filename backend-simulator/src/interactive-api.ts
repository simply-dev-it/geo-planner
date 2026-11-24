import type { IncomingHttpHeaders } from 'node:http';

import {
  INTERACTIVE_AXIS_ORDER,
  INTERACTIVE_CRS,
  MAX_PARCEL_COUNT,
  MAX_EXTENT_METRES,
  findSyntheticParcelIntersections,
  createSyntheticInteractiveProject,
  interactiveRequestDigest,
  previewSyntheticWorkingArea,
  resolveSyntheticParcelByIdentifier,
  resolveSyntheticParcelByPoint,
  searchSyntheticLocations,
  searchCursorSignature,
  type InteractiveSimulatorState,
  type WorkingExtentInput,
} from './interactive-scenarios.js';
import { fixtureCatalog, FIXTURE_REGIONS } from './parcel-fixtures.js';
import { createFixtureTile } from './snapshot-map.js';

interface InteractiveApiResponse {
  readonly body: Readonly<Record<string, unknown>>;
  readonly contentType: string;
  readonly correlationId: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly idempotencyReplayed?: boolean;
  readonly location?: string;
  readonly rawBody?: Buffer;
  readonly status: number;
}

interface PreviewInput {
  readonly parcelIds: readonly string[];
  readonly workingExtent: WorkingExtentInput;
}

interface CreateInput extends PreviewInput {
  readonly name: string;
  readonly previewFingerprint: string;
}

const API_PATH = '/api/v1';
const PROJECTS_PATH = `${API_PATH}/projects`;
const PREVIEWS_PATH = `${PROJECTS_PATH}/previews`;
const FINGERPRINT_PATTERN = /^v1:sha256:[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TILE_PATH_PATTERN = /^\/api\/v1\/map\/layers\/([^/]+)\/tiles\/(-?\d+)\/(-?\d+)\/(-?\d+)$/;
const PROJECT_PATH_PATTERN = /^\/api\/v1\/projects\/([^/]+)$/;

function response(
  body: Readonly<Record<string, unknown>>,
  correlationId: string,
  status: number,
  extras: Pick<
    InteractiveApiResponse,
    'headers' | 'idempotencyReplayed' | 'location' | 'rawBody'
  > & {
    readonly contentType?: string;
  } = {},
): InteractiveApiResponse {
  return {
    body,
    correlationId,
    status,
    contentType: extras.contentType ?? 'application/json',
    ...extras,
  };
}

function problem(
  correlationId: string,
  status: number,
  errorCode: string,
  title: string,
  detail: string,
  fieldErrors: readonly Readonly<Record<string, string>>[] = [],
): InteractiveApiResponse {
  return response(
    {
      type: `https://geo-planner.invalid/problems/${errorCode.toLowerCase()}`,
      title,
      status,
      detail,
      errorCode,
      correlationId,
      ...(fieldErrors.length > 0 ? { fieldErrors } : {}),
    },
    correlationId,
    status,
    { contentType: 'application/problem+json' },
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseObject(
  bodyText: string | undefined,
  correlationId: string,
): { readonly body: Record<string, unknown> } | { readonly error: InteractiveApiResponse } {
  if (!bodyText) {
    return {
      error: problem(
        correlationId,
        400,
        'INVALID_REQUEST',
        'Invalid request',
        'A JSON request body is required.',
      ),
    };
  }
  try {
    const body: unknown = JSON.parse(bodyText);
    if (!isObject(body)) {
      return {
        error: problem(
          correlationId,
          400,
          'INVALID_REQUEST',
          'Invalid request',
          'The JSON body must be an object.',
        ),
      };
    }
    return { body };
  } catch {
    return {
      error: problem(
        correlationId,
        400,
        'INVALID_REQUEST',
        'Invalid request',
        'The request body is not valid JSON.',
      ),
    };
  }
}

function rejectUnexpectedKeys(
  body: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  correlationId: string,
): InteractiveApiResponse | undefined {
  const unexpected = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unexpected.length === 0) {
    return undefined;
  }
  return problem(
    correlationId,
    400,
    'INVALID_REQUEST',
    'Invalid request',
    `Unexpected fields: ${unexpected.join(', ')}.`,
    unexpected.map((field) => ({ field, message: 'Unexpected field.' })),
  );
}

function parseParcelIds(
  value: unknown,
  correlationId: string,
): readonly string[] | InteractiveApiResponse {
  if (!Array.isArray(value) || value.length > MAX_PARCEL_COUNT) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid parcel selection',
      'parcelIds must be an array containing no more than 100 identifiers.',
      [{ field: 'parcelIds', message: 'Expected between 0 and 100 identifiers.' }],
    );
  }
  if (
    value.some(
      (parcelId) =>
        typeof parcelId !== 'string' || parcelId.trim().length === 0 || parcelId.length > 64,
    )
  ) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid parcel selection',
      'Each parcel identifier must be a non-empty string of at most 64 characters.',
      [{ field: 'parcelIds', message: 'Each identifier must contain 1 to 64 characters.' }],
    );
  }
  const parcelIds = value.map((parcelId) => (parcelId as string).trim());
  if (new Set(parcelIds).size !== parcelIds.length) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid parcel selection',
      'parcelIds must not contain duplicates.',
      [{ field: 'parcelIds', message: 'Parcel identifiers must be unique.' }],
    );
  }
  return parcelIds;
}

function parseWorkingExtent(
  value: unknown,
  correlationId: string,
): WorkingExtentInput | InteractiveApiResponse {
  if (!isObject(value)) {
    return problem(
      correlationId,
      400,
      'INVALID_EXTENT',
      'Invalid working extent',
      'workingExtent must be an object with an EPSG:2180 rectangle.',
      [{ field: 'workingExtent', message: 'A rectangle is required.' }],
    );
  }
  const unexpected = rejectUnexpectedKeys(value, ['crs', 'axisOrder', 'bounds'], correlationId);
  if (unexpected) {
    return unexpected;
  }
  if (value['crs'] !== INTERACTIVE_CRS || value['axisOrder'] !== INTERACTIVE_AXIS_ORDER) {
    return problem(
      correlationId,
      400,
      'UNSUPPORTED_CRS',
      'Unsupported coordinate reference system',
      'The fixture contract accepts EPSG:2180 coordinates in easting-northing order only.',
      [{ field: 'workingExtent', message: 'Expected EPSG:2180 and easting-northing order.' }],
    );
  }
  const bounds = value['bounds'];
  if (
    !Array.isArray(bounds) ||
    bounds.length !== 4 ||
    bounds.some(
      (coordinate) =>
        typeof coordinate !== 'number' ||
        !Number.isFinite(coordinate) ||
        Math.abs(coordinate) > 10_000_000,
    )
  ) {
    return problem(
      correlationId,
      400,
      'INVALID_EXTENT',
      'Invalid working extent',
      'bounds must contain four finite, bounded coordinates.',
      [
        {
          field: 'workingExtent.bounds',
          message: 'Expected [minEasting, minNorthing, maxEasting, maxNorthing].',
        },
      ],
    );
  }
  const numericBounds = bounds as number[];
  if (
    numericBounds.some(
      (coordinate) => Math.abs(coordinate * 1000 - Math.round(coordinate * 1000)) > 1e-7,
    ) ||
    numericBounds[0]! >= numericBounds[2]! ||
    numericBounds[1]! >= numericBounds[3]!
  ) {
    return problem(
      correlationId,
      400,
      'INVALID_EXTENT',
      'Invalid working extent',
      'The rectangle must have positive dimensions and coordinates with at most millimetre precision.',
      [
        {
          field: 'workingExtent.bounds',
          message: 'Expected an ordered rectangle with millimetre precision.',
        },
      ],
    );
  }
  return {
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    bounds: [numericBounds[0]!, numericBounds[1]!, numericBounds[2]!, numericBounds[3]!],
  };
}

function parsePreviewInput(
  body: Readonly<Record<string, unknown>>,
  correlationId: string,
): PreviewInput | InteractiveApiResponse {
  const unexpected = rejectUnexpectedKeys(body, ['parcelIds', 'workingExtent'], correlationId);
  if (unexpected) {
    return unexpected;
  }
  const parcelIds = parseParcelIds(body['parcelIds'], correlationId);
  if ('status' in parcelIds) {
    return parcelIds;
  }
  const workingExtent = parseWorkingExtent(body['workingExtent'], correlationId);
  if (!('bounds' in workingExtent)) {
    return workingExtent;
  }
  return { parcelIds, workingExtent };
}

function parseCreateInput(
  body: Readonly<Record<string, unknown>>,
  correlationId: string,
): CreateInput | InteractiveApiResponse {
  const unexpected = rejectUnexpectedKeys(
    body,
    ['name', 'parcelIds', 'workingExtent', 'previewFingerprint'],
    correlationId,
  );
  if (unexpected) {
    return unexpected;
  }
  const name = body['name'];
  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 160) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid project name',
      'name must contain between 1 and 160 characters.',
      [{ field: 'name', message: 'Expected between 1 and 160 characters.' }],
    );
  }
  const parsedPreview = parsePreviewInput(
    { parcelIds: body['parcelIds'], workingExtent: body['workingExtent'] },
    correlationId,
  );
  if (!('parcelIds' in parsedPreview)) {
    return parsedPreview;
  }
  const previewFingerprint = body['previewFingerprint'];
  if (typeof previewFingerprint !== 'string' || !FINGERPRINT_PATTERN.test(previewFingerprint)) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid preview fingerprint',
      'previewFingerprint must be a version 1 SHA-256 fingerprint.',
      [{ field: 'previewFingerprint', message: 'Expected the v1:sha256 format.' }],
    );
  }
  return { ...parsedPreview, name: name.trim(), previewFingerprint };
}

function singleHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

function handleSearch(url: URL, correlationId: string): InteractiveApiResponse {
  const query = (url.searchParams.get('query') ?? '').trim();
  const regionId = url.searchParams.get('regionId') || undefined;
  const type = url.searchParams.get('type') || undefined,
    limit = Number(url.searchParams.get('limit') ?? 5),
    cursor = url.searchParams.get('cursor');
  const invalid = () =>
    problem(
      correlationId,
      400,
      'INVALID_SEARCH',
      'Invalid search',
      'Use bounded query, known filters, a page size of 1-5 and a cursor from the same query.',
    );
  if (
    query.length < 1 ||
    query.length > 120 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 5 ||
    [...url.searchParams.keys()].some(
      (k) =>
        ![
          'query',
          'regionId',
          'type',
          'limit',
          'cursor',
          'countyId',
          'communeId',
          'localityId',
          'streetId',
          'countyName',
          'communeName',
          'localityName',
          'streetName',
          'bounds',
        ].includes(k),
    ) ||
    [...url.searchParams.keys()].some((k) => url.searchParams.getAll(k).length !== 1) ||
    (regionId && !FIXTURE_REGIONS.some((r) => r.id === regionId)) ||
    (type && !['place', 'parcel', 'locality', 'street', 'address'].includes(type))
  )
    return invalid();
  if (query === '__fixture_unavailable__')
    return problem(
      correlationId,
      503,
      'SEARCH_UNAVAILABLE',
      'Search unavailable',
      'Fixture failure.',
    );
  const context = Object.fromEntries(
    [
      'countyId',
      'communeId',
      'localityId',
      'streetId',
      'countyName',
      'communeName',
      'localityName',
      'streetName',
      'bounds',
    ].map((k) => [k, url.searchParams.get(k)?.trim() || undefined]),
  );
  if (
    Object.entries(context).some(
      ([k, v]) => v && v.length > (k === 'bounds' ? 128 : k.endsWith('Name') ? 120 : 64),
    )
  )
    return invalid();
  if (context['bounds']) {
    const parts = context['bounds'].split(',');
    if (parts.some((part) => !part.trim())) return invalid();
    const b = parts.map(Number) as [number, number, number, number];
    if (
      b.length !== 4 ||
      !b.every(Number.isFinite) ||
      b[2] <= b[0] ||
      b[3] <= b[1] ||
      b[2] - b[0] > 2000 ||
      b[3] - b[1] > 2000
    )
      return invalid();
  }
  const options = { regionId, type, limit, ...context };
  let offset = 0;
  if (cursor) {
    const match = /^([a-f0-9]{16}):(\d{1,4})$/.exec(cursor);
    if (!match || match[1] !== searchCursorSignature(query, options)) return invalid();
    offset = Number(match[2]);
    if (offset < 1 || offset > 1000 || offset % limit !== 0) return invalid();
  }
  const result = searchSyntheticLocations(query, { ...options, offset });
  if (offset > 0 && Array.isArray(result['candidates']) && result['candidates'].length === 0)
    return invalid();
  return response(result, correlationId, 200);
}

function handleTile(pathname: string, correlationId: string): InteractiveApiResponse | undefined {
  const match = TILE_PATH_PATTERN.exec(pathname);
  if (!match) {
    return undefined;
  }
  const [, layerId, zoomText, columnText, rowText] = match;
  if (layerId !== 'base-map') {
    return problem(
      correlationId,
      404,
      'MAP_LAYER_NOT_FOUND',
      'Map layer not found',
      'Only the configured offline fixture layer is available.',
    );
  }
  const zoom = Number(zoomText);
  const column = Number(columnText);
  const row = Number(rowText);
  const matrixWidth = 2 ** zoom;
  if (
    zoom < 0 ||
    zoom > 18 ||
    column < 0 ||
    row < 0 ||
    column >= matrixWidth ||
    row >= matrixWidth
  ) {
    return problem(
      correlationId,
      400,
      'INVALID_TILE_COORDINATE',
      'Invalid tile coordinate',
      'z must be from 0 to 18 and x and y must lie within the XYZ tile matrix.',
    );
  }
  const tile = createFixtureTile(zoom, column, row);
  return response({}, correlationId, 200, {
    contentType: 'image/png',
    rawBody: tile.body,
    headers: {
      'cache-control': 'public, max-age=60',
      'x-map-attribution': tile.marker.startsWith('archived-')
        ? 'Archived GUGiK ORTO snapshot; source date unknown; indicative only.'
        : tile.marker === 'captured-public-vectors-256px-png'
          ? 'Captured GUGiK PRG street vectors; frozen partial snapshot; indicative only.'
          : 'Synthetic fixture only; no external map source.',
      'x-simulator-fixture': tile.marker,
    },
  });
}

function handleParcelResolve(
  bodyText: string | undefined,
  correlationId: string,
): InteractiveApiResponse {
  const parsed = parseObject(bodyText, correlationId);
  if ('error' in parsed) {
    return parsed.error;
  }
  const unexpected = rejectUnexpectedKeys(parsed.body, ['selector'], correlationId);
  if (unexpected) {
    return unexpected;
  }
  const selector = parsed.body['selector'];
  if (!isObject(selector) || typeof selector['type'] !== 'string') {
    return problem(
      correlationId,
      400,
      'INVALID_SELECTOR',
      'Invalid parcel selector',
      'selector must identify a point or full parcel identifier.',
    );
  }

  if (selector['type'] === 'identifier') {
    const invalid = rejectUnexpectedKeys(selector, ['type', 'value'], correlationId);
    if (invalid) {
      return invalid;
    }
    const value = selector['value'];
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) {
      return problem(
        correlationId,
        400,
        'INVALID_SELECTOR',
        'Invalid parcel identifier',
        'value must contain 1 to 64 characters.',
      );
    }
    return response(resolveSyntheticParcelByIdentifier(value.trim()), correlationId, 200);
  }

  if (selector['type'] === 'point') {
    const invalid = rejectUnexpectedKeys(selector, ['type', 'coordinates', 'crs'], correlationId);
    if (invalid) {
      return invalid;
    }
    const coordinates = selector['coordinates'];
    if (
      selector['crs'] !== INTERACTIVE_CRS ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      coordinates.some(
        (coordinate) =>
          typeof coordinate !== 'number' ||
          !Number.isFinite(coordinate) ||
          Math.abs(coordinate) > 10_000_000,
      )
    ) {
      return problem(
        correlationId,
        400,
        'INVALID_SELECTOR',
        'Invalid map point',
        'Provide two finite EPSG:2180 coordinates in easting-northing order.',
      );
    }
    return response(
      resolveSyntheticParcelByPoint([coordinates[0] as number, coordinates[1] as number]),
      correlationId,
      200,
    );
  }

  return problem(
    correlationId,
    400,
    'INVALID_SELECTOR',
    'Invalid parcel selector',
    'selector.type must be point or identifier.',
  );
}

function handleIntersections(
  bodyText: string | undefined,
  correlationId: string,
): InteractiveApiResponse {
  const parsed = parseObject(bodyText, correlationId);
  if ('error' in parsed) return parsed.error;
  const unexpected = rejectUnexpectedKeys(parsed.body, ['workingExtent'], correlationId);
  if (unexpected) return unexpected;
  const extent = parseWorkingExtent(parsed.body['workingExtent'], correlationId);
  if (!('bounds' in extent)) return extent;
  if (
    extent.bounds[2] - extent.bounds[0] > MAX_EXTENT_METRES ||
    extent.bounds[3] - extent.bounds[1] > MAX_EXTENT_METRES
  ) {
    return problem(
      correlationId,
      400,
      'INVALID_EXTENT',
      'Invalid discovery extent',
      'Parcel discovery requires a rectangle no larger than 2 km by 2 km.',
    );
  }
  return response(findSyntheticParcelIntersections(extent), correlationId, 200);
}

function handlePreview(
  bodyText: string | undefined,
  correlationId: string,
): InteractiveApiResponse {
  const parsed = parseObject(bodyText, correlationId);
  if ('error' in parsed) {
    return parsed.error;
  }
  const input = parsePreviewInput(parsed.body, correlationId);
  if (!('parcelIds' in input)) {
    return input;
  }
  return response(
    previewSyntheticWorkingArea(input.parcelIds, input.workingExtent),
    correlationId,
    200,
  );
}

function projectResponse(
  project: object,
  correlationId: string,
  status: number,
  replayed = false,
): InteractiveApiResponse {
  const projectBody = project as Readonly<Record<string, unknown>>;
  return response(projectBody, correlationId, status, {
    location: `${PROJECTS_PATH}/${String(projectBody['id'])}`,
    ...(replayed ? { idempotencyReplayed: true } : {}),
  });
}

function handleCreate(
  bodyText: string | undefined,
  headers: IncomingHttpHeaders,
  correlationId: string,
  state: InteractiveSimulatorState,
): InteractiveApiResponse {
  const parsed = parseObject(bodyText, correlationId);
  if ('error' in parsed) {
    return parsed.error;
  }
  const input = parseCreateInput(parsed.body, correlationId);
  if (!('name' in input)) {
    return input;
  }

  const idempotencyKey = singleHeader(headers, 'idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid idempotency key',
      'Idempotency-Key must contain 16 to 128 characters.',
      [{ field: 'Idempotency-Key', message: 'Expected 16 to 128 characters.' }],
    );
  }

  const requestDigest = interactiveRequestDigest({
    name: input.name,
    parcelIds: [...input.parcelIds].sort(),
    workingExtent: input.workingExtent,
    previewFingerprint: input.previewFingerprint,
  });
  const priorAttempt = state.idempotencyRecords.get(idempotencyKey);
  if (priorAttempt) {
    if (priorAttempt.requestDigest !== requestDigest) {
      return problem(
        correlationId,
        409,
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key conflict',
        'This key was already used for a different interactive project payload.',
      );
    }
    return projectResponse(priorAttempt.project, correlationId, 200, true);
  }

  const preview = previewSyntheticWorkingArea(input.parcelIds, input.workingExtent);
  if (preview['status'] !== 'ready') {
    return problem(
      correlationId,
      422,
      'PREVIEW_NOT_READY',
      'Project area cannot be created',
      'Incomplete or over-limit parcel and rectangle data cannot create a project.',
    );
  }
  if (preview['previewFingerprint'] !== input.previewFingerprint) {
    return problem(
      correlationId,
      409,
      'PREVIEW_CHANGED',
      'Preview is stale',
      'The revalidated result differs from the submitted preview fingerprint.',
    );
  }

  const project = createSyntheticInteractiveProject(
    input.name,
    input.parcelIds,
    preview,
    state.nextProjectNumber,
  );
  state.nextProjectNumber += 1;
  state.projects.set(project.id, project);
  state.idempotencyRecords.set(idempotencyKey, { requestDigest, project });
  return projectResponse(project, correlationId, 201);
}

function handleReadProject(
  pathname: string,
  correlationId: string,
  state: InteractiveSimulatorState,
): InteractiveApiResponse | undefined {
  const match = PROJECT_PATH_PATTERN.exec(pathname);
  if (!match || pathname === PREVIEWS_PATH) {
    return undefined;
  }
  const projectId = match[1]!;
  if (!UUID_PATTERN.test(projectId)) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid project identifier',
      'projectId must be a UUID.',
    );
  }
  const project = state.projects.get(projectId);
  if (!project) {
    return problem(
      correlationId,
      404,
      'NOT_FOUND',
      'Project not found',
      'No synthetic interactive project exists for this identifier.',
    );
  }
  return response(project as unknown as Readonly<Record<string, unknown>>, correlationId, 200);
}

export function routeInteractiveApi(
  method: string | undefined,
  url: URL,
  bodyText: string | undefined,
  headers: IncomingHttpHeaders,
  correlationId: string,
  state: InteractiveSimulatorState,
): InteractiveApiResponse | undefined {
  const tile = method === 'GET' ? handleTile(url.pathname, correlationId) : undefined;
  if (tile) {
    return tile;
  }
  if (method === 'GET' && url.pathname === `${API_PATH}/search/filters`)
    return response(
      {
        regions: FIXTURE_REGIONS,
      },
      correlationId,
      200,
    );
  if (method === 'GET' && url.pathname === '/_simulator/catalog')
    return response(fixtureCatalog(), correlationId, 200);
  if (method === 'GET' && url.pathname === `${API_PATH}/search`) {
    return handleSearch(url, correlationId);
  }
  if (method === 'POST' && url.pathname === `${API_PATH}/parcels/resolve`) {
    return handleParcelResolve(bodyText, correlationId);
  }
  if (method === 'POST' && url.pathname === `${API_PATH}/parcels/intersections`) {
    return handleIntersections(bodyText, correlationId);
  }
  if (method === 'POST' && url.pathname === PREVIEWS_PATH) {
    return handlePreview(bodyText, correlationId);
  }
  if (method === 'POST' && url.pathname === PROJECTS_PATH) {
    return handleCreate(bodyText, headers, correlationId, state);
  }
  if (method === 'GET') {
    const project = handleReadProject(url.pathname, correlationId, state);
    if (project) {
      return project;
    }
  }
  return undefined;
}
