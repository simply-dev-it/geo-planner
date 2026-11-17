import type { IncomingHttpHeaders } from 'node:http';

import {
  createProjectSimulatorState,
  createRequestDigest,
  previewSyntheticParcels,
  syntheticProject,
  type ProjectSimulatorState,
  type SimulatedProject,
} from './project-scenarios.js';

export interface ProjectApiResponse {
  readonly body: Readonly<Record<string, unknown>>;
  readonly contentType: 'application/json' | 'application/problem+json';
  readonly correlationId: string;
  readonly idempotencyReplayed?: boolean;
  readonly location?: string;
  readonly status: number;
}

interface PreviewInput {
  readonly parcelIds: readonly string[];
  readonly bufferMetres: number;
}

interface CreateInput extends PreviewInput {
  readonly name: string;
  readonly previewFingerprint: string;
}

const PROJECTS_PATH = '/api/v1/projects';
const PREVIEWS_PATH = `${PROJECTS_PATH}/previews`;
const PREVIEW_FINGERPRINT_PATTERN = /^v1:sha256:[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(
  body: Readonly<Record<string, unknown>>,
  correlationId: string,
  status: number,
  contentType: ProjectApiResponse['contentType'] = 'application/json',
  extras: Pick<ProjectApiResponse, 'idempotencyReplayed' | 'location'> = {},
): ProjectApiResponse {
  return { body, contentType, correlationId, status, ...extras };
}

function problem(
  correlationId: string,
  status: number,
  errorCode: string,
  title: string,
  detail: string,
  extras: Readonly<Record<string, unknown>> = {},
): ProjectApiResponse {
  return response(
    {
      type: `https://geo-planner.invalid/problems/${errorCode.toLowerCase()}`,
      title,
      status,
      detail,
      errorCode,
      correlationId,
      ...extras,
    },
    correlationId,
    status,
    'application/problem+json',
  );
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseObject(
  bodyText: string | undefined,
  correlationId: string,
): { parsed: Record<string, unknown> } | { error: ProjectApiResponse } {
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
    const parsed: unknown = JSON.parse(bodyText);
    if (!objectValue(parsed)) {
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
    return { parsed };
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

function onlyAllowedKeys(
  body: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  correlationId: string,
): ProjectApiResponse | undefined {
  const unexpected = Object.keys(body).filter((key) => !allowedKeys.includes(key));
  if (unexpected.length === 0) {
    return undefined;
  }

  return problem(
    correlationId,
    400,
    'INVALID_REQUEST',
    'Invalid request',
    `Unexpected field${unexpected.length === 1 ? '' : 's'}: ${unexpected.join(', ')}.`,
    { fieldErrors: unexpected.map((field) => ({ field, message: 'Unexpected field.' })) },
  );
}

function parsePreviewInput(
  body: Readonly<Record<string, unknown>>,
  correlationId: string,
): PreviewInput | ProjectApiResponse {
  const unexpected = onlyAllowedKeys(body, ['parcelIds', 'bufferMetres'], correlationId);
  if (unexpected) {
    return unexpected;
  }

  const rawIds = body['parcelIds'];
  if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 100) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid request',
      'parcelIds must contain between 1 and 100 identifiers.',
      {
        fieldErrors: [{ field: 'parcelIds', message: 'Expected between 1 and 100 identifiers.' }],
      },
    );
  }

  if (
    rawIds.some(
      (value) => typeof value !== 'string' || value.trim().length === 0 || value.length > 64,
    )
  ) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid request',
      'Each parcel identifier must be a non-empty string of at most 64 characters.',
      {
        fieldErrors: [
          { field: 'parcelIds', message: 'Each identifier must contain 1 to 64 characters.' },
        ],
      },
    );
  }

  const parcelIds = rawIds.map((value) => (value as string).trim());
  if (new Set(parcelIds).size !== parcelIds.length) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid request',
      'parcelIds must not contain duplicates.',
      {
        fieldErrors: [{ field: 'parcelIds', message: 'Identifiers must be unique.' }],
      },
    );
  }

  const bufferMetres = body['bufferMetres'];
  if (
    typeof bufferMetres !== 'number' ||
    !Number.isFinite(bufferMetres) ||
    bufferMetres < 0 ||
    bufferMetres > 500
  ) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid request',
      'bufferMetres must be a number from 0 to 500.',
      {
        fieldErrors: [{ field: 'bufferMetres', message: 'Expected a number from 0 to 500.' }],
      },
    );
  }

  return { parcelIds, bufferMetres };
}

function parseCreateInput(
  body: Readonly<Record<string, unknown>>,
  correlationId: string,
): CreateInput | ProjectApiResponse {
  const unexpected = onlyAllowedKeys(
    body,
    ['name', 'parcelIds', 'bufferMetres', 'previewFingerprint'],
    correlationId,
  );
  if (unexpected) {
    return unexpected;
  }

  const name = body['name'];
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 120) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid request',
      'name must contain between 1 and 120 characters.',
      {
        fieldErrors: [
          { field: 'name', message: 'Expected between 1 and 120 non-whitespace characters.' },
        ],
      },
    );
  }

  const parsedPreviewInput = parsePreviewInput(
    { parcelIds: body['parcelIds'], bufferMetres: body['bufferMetres'] },
    correlationId,
  );
  if (!('parcelIds' in parsedPreviewInput)) {
    return parsedPreviewInput;
  }

  const previewFingerprint = body['previewFingerprint'];
  if (
    typeof previewFingerprint !== 'string' ||
    !PREVIEW_FINGERPRINT_PATTERN.test(previewFingerprint)
  ) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid request',
      'previewFingerprint is missing or malformed.',
      {
        fieldErrors: [
          { field: 'previewFingerprint', message: 'Expected a versioned SHA-256 fingerprint.' },
        ],
      },
    );
  }

  return { ...parsedPreviewInput, name: name.trim(), previewFingerprint };
}

function singleHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

function notReadyError(preview: Readonly<Record<string, unknown>>): {
  code: string;
  detail: string;
  parcelIds?: readonly string[];
} {
  const issues = preview['issues'] as readonly string[];
  const parcels = preview['parcels'] as readonly Readonly<Record<string, unknown>>[];
  const affected = parcels
    .filter((parcel) => parcel['status'] !== 'resolved')
    .map((parcel) => String(parcel['inputId']));

  if (issues.includes('AMBIGUOUS_PARCEL')) {
    return {
      code: 'AMBIGUOUS_PARCEL',
      detail: 'One or more parcel identifiers resolved ambiguously.',
      parcelIds: affected,
    };
  }
  if (issues.includes('UNRESOLVED_PARCEL')) {
    return {
      code: 'UNRESOLVED_PARCEL',
      detail: 'One or more parcel identifiers could not be resolved.',
      parcelIds: affected,
    };
  }
  return {
    code: 'EXTENT_EXCEEDED',
    detail: 'The subject or buffered extent exceeds the accepted spatial limits.',
  };
}

function projectResponse(
  project: SimulatedProject,
  correlationId: string,
  status: number,
  replayed = false,
): ProjectApiResponse {
  return response(
    project as unknown as Readonly<Record<string, unknown>>,
    correlationId,
    status,
    'application/json',
    {
      location: `${PROJECTS_PATH}/${project.id}`,
      ...(replayed ? { idempotencyReplayed: true } : {}),
    },
  );
}

function handlePreview(bodyText: string | undefined, correlationId: string): ProjectApiResponse {
  const parsed = parseObject(bodyText, correlationId);
  if ('error' in parsed) {
    return parsed.error;
  }

  const input = parsePreviewInput(parsed.parsed, correlationId);
  if (!('parcelIds' in input)) {
    return input;
  }

  return response(previewSyntheticParcels(input.parcelIds, input.bufferMetres), correlationId, 200);
}

function handleCreate(
  bodyText: string | undefined,
  headers: IncomingHttpHeaders,
  correlationId: string,
  state: ProjectSimulatorState,
): ProjectApiResponse {
  const parsed = parseObject(bodyText, correlationId);
  if ('error' in parsed) {
    return parsed.error;
  }

  const input = parseCreateInput(parsed.parsed, correlationId);
  if (!('name' in input)) {
    return input;
  }

  const idempotencyKey = singleHeader(headers, 'idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return problem(
      correlationId,
      400,
      'INVALID_REQUEST',
      'Invalid request',
      'Idempotency-Key must contain 16 to 128 characters.',
      {
        fieldErrors: [{ field: 'Idempotency-Key', message: 'Expected 16 to 128 characters.' }],
      },
    );
  }

  const normalizedIds = [...input.parcelIds].sort();
  const normalizedPayload = {
    name: input.name,
    parcelIds: normalizedIds,
    bufferMetres: input.bufferMetres,
    previewFingerprint: input.previewFingerprint,
  };
  const requestDigest = createRequestDigest(normalizedPayload);
  const priorAttempt = state.idempotencyRecords.get(idempotencyKey);

  if (priorAttempt) {
    if (priorAttempt.requestDigest !== requestDigest) {
      return problem(
        correlationId,
        409,
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key conflict',
        'This key was already used for a different create payload.',
      );
    }
    return projectResponse(priorAttempt.project, correlationId, 200, true);
  }

  const freshPreview = previewSyntheticParcels(normalizedIds, input.bufferMetres);
  if (freshPreview['status'] !== 'ready') {
    const failure = notReadyError(freshPreview);
    return problem(correlationId, 422, failure.code, 'Project cannot be created', failure.detail, {
      ...(failure.parcelIds ? { parcelIds: failure.parcelIds } : {}),
    });
  }

  if (freshPreview['previewFingerprint'] !== input.previewFingerprint) {
    return problem(
      correlationId,
      409,
      'PREVIEW_STALE',
      'Preview is no longer current',
      'The current resolved result differs from the preview fingerprint; request a new preview.',
    );
  }

  const project = syntheticProject(
    input.name,
    normalizedIds,
    input.bufferMetres,
    freshPreview,
    state.nextProjectNumber,
  );
  state.nextProjectNumber += 1;
  state.projects.set(project.id, project);
  state.idempotencyRecords.set(idempotencyKey, { requestDigest, project });

  return projectResponse(project, correlationId, 201);
}

export function routeProjectApi(
  method: string | undefined,
  pathname: string,
  bodyText: string | undefined,
  headers: IncomingHttpHeaders,
  correlationId: string,
  state: ProjectSimulatorState = createProjectSimulatorState(),
): ProjectApiResponse | undefined {
  if (pathname === PREVIEWS_PATH && method === 'POST') {
    return handlePreview(bodyText, correlationId);
  }

  if (pathname === PROJECTS_PATH && method === 'POST') {
    return handleCreate(bodyText, headers, correlationId, state);
  }

  const projectMatch = /^\/api\/v1\/projects\/([^/]+)$/.exec(pathname);
  if (projectMatch && method === 'GET') {
    const projectId = projectMatch[1];
    if (!projectId || !UUID_PATTERN.test(projectId)) {
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
        'No simulated project exists for this identifier.',
      );
    }
    return projectResponse(project, correlationId, 200);
  }

  return undefined;
}
