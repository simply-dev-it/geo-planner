import { createHash } from 'node:crypto';

import {
  createRequestDigest,
  previewSyntheticParcels,
  type ProjectSimulatorState,
  SYNTHETIC_PARCEL_IDS,
} from './project-scenarios.js';

export const INTERACTIVE_CRS = 'EPSG:2180';
export const INTERACTIVE_AXIS_ORDER = 'easting-northing';
export const MAX_PARCEL_COUNT = 100;
export const MAX_EXTENT_METRES = 2000;
export const MAX_EXTENT_AREA_SQUARE_METRES = 4_000_000;

export interface WorkingExtentInput {
  readonly crs: typeof INTERACTIVE_CRS;
  readonly axisOrder: typeof INTERACTIVE_AXIS_ORDER;
  readonly bounds: readonly [number, number, number, number];
}

interface InteractiveProject {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly parcelIds: readonly string[];
  readonly workingExtent: Readonly<Record<string, unknown>>;
  readonly selectedParcels: readonly Readonly<Record<string, unknown>>[];
  readonly previewFingerprint: string;
  readonly provenance: Readonly<Record<string, unknown>>;
}

interface InteractiveIdempotencyRecord {
  readonly requestDigest: string;
  readonly project: InteractiveProject;
}

interface InteractiveSimulatorState {
  nextProjectNumber: number;
  readonly projects: Map<string, InteractiveProject>;
  readonly idempotencyRecords: Map<string, InteractiveIdempotencyRecord>;
}

interface Bounds {
  readonly minEasting: number;
  readonly minNorthing: number;
  readonly maxEasting: number;
  readonly maxNorthing: number;
}

const interactiveStates = new WeakMap<ProjectSimulatorState, InteractiveSimulatorState>();
const PARCEL_LOOKUP_FIXTURES = [
  SYNTHETIC_PARCEL_IDS.single,
  SYNTHETIC_PARCEL_IDS.adjacent,
  SYNTHETIC_PARCEL_IDS.nearby,
  SYNTHETIC_PARCEL_IDS.distant,
  SYNTHETIC_PARCEL_IDS.ambiguous,
  SYNTHETIC_PARCEL_IDS.unresolved,
] as const;

const LOCATION_FIXTURES: readonly Readonly<Record<string, unknown>>[] = [
  {
    id: 'fixture-voivodeship',
    type: 'voivodeship',
    label: 'Województwo Testowe',
    center: [102000, 202000],
    extent: [100000, 200000, 104000, 204000],
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: 'SYNTHETIC_FIXTURE',
  },
  {
    id: 'fixture-locality',
    type: 'locality',
    label: 'Nowe Przykłady',
    center: [100500, 200500],
    extent: [100000, 200000, 101000, 201000],
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: 'SYNTHETIC_FIXTURE',
  },
  {
    id: 'fixture-street-a',
    type: 'street',
    label: 'Ulica Przykładowa',
    center: [100200, 200200],
    extent: [100100, 200100, 100300, 200300],
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: 'SYNTHETIC_FIXTURE',
  },
  {
    id: 'fixture-street-b',
    type: 'street',
    label: 'Ulica Przykładowa',
    center: [101200, 201200],
    extent: [101100, 201100, 101300, 201300],
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: 'SYNTHETIC_FIXTURE',
  },
];

export function interactiveStateFor(
  projectState: ProjectSimulatorState,
): InteractiveSimulatorState {
  const existing = interactiveStates.get(projectState);
  if (existing) {
    return existing;
  }

  const created: InteractiveSimulatorState = {
    nextProjectNumber: 1,
    projects: new Map(),
    idempotencyRecords: new Map(),
  };
  interactiveStates.set(projectState, created);
  return created;
}

function fixtureParcel(parcelId: string): Readonly<Record<string, unknown>> | undefined {
  const preview = previewSyntheticParcels([parcelId], 0);
  const parcels = preview['parcels'] as readonly Readonly<Record<string, unknown>>[];
  const parcel = parcels[0];

  if (!parcel || parcel['status'] !== 'resolved') {
    return undefined;
  }

  return {
    id: parcel['resolvedId'],
    geometry: parcel['geometry'],
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: 'SYNTHETIC_FIXTURE',
    sourceDataDate: null,
    limitations: ['Fictional test geometry; not retrieved from ULDK.'],
  };
}

function coordinateBounds(geometryValue: unknown): Bounds | undefined {
  const points: number[][] = [];

  function collect(value: unknown): void {
    if (!Array.isArray(value)) {
      return;
    }
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      points.push([value[0], value[1]]);
      return;
    }
    value.forEach(collect);
  }

  if (typeof geometryValue !== 'object' || geometryValue === null) {
    return undefined;
  }
  collect((geometryValue as Readonly<Record<string, unknown>>)['coordinates']);
  if (points.length === 0) {
    return undefined;
  }

  return points.reduce(
    (bounds, point) => ({
      minEasting: Math.min(bounds.minEasting, point[0]!),
      minNorthing: Math.min(bounds.minNorthing, point[1]!),
      maxEasting: Math.max(bounds.maxEasting, point[0]!),
      maxNorthing: Math.max(bounds.maxNorthing, point[1]!),
    }),
    {
      minEasting: Number.POSITIVE_INFINITY,
      minNorthing: Number.POSITIVE_INFINITY,
      maxEasting: Number.NEGATIVE_INFINITY,
      maxNorthing: Number.NEGATIVE_INFINITY,
    },
  );
}

function boundsArray(bounds: Bounds): readonly [number, number, number, number] {
  return [bounds.minEasting, bounds.minNorthing, bounds.maxEasting, bounds.maxNorthing];
}

function extentMetrics(bounds: Bounds): Readonly<Record<string, unknown>> {
  const widthMetres = bounds.maxEasting - bounds.minEasting;
  const heightMetres = bounds.maxNorthing - bounds.minNorthing;
  return {
    crs: INTERACTIVE_CRS,
    axisOrder: 'minEasting-minNorthing-maxEasting-maxNorthing',
    bounds: boundsArray(bounds),
    widthMetres,
    heightMetres,
    envelopeAreaSquareMetres: widthMetres * heightMetres,
  };
}

function exceedsLimits(bounds: Bounds): boolean {
  const extent = extentMetrics(bounds);
  return (
    Number(extent['widthMetres']) > MAX_EXTENT_METRES ||
    Number(extent['heightMetres']) > MAX_EXTENT_METRES ||
    Number(extent['envelopeAreaSquareMetres']) > MAX_EXTENT_AREA_SQUARE_METRES
  );
}

function overlaps(first: Bounds, second: Bounds): boolean {
  return (
    first.minEasting < second.maxEasting &&
    first.maxEasting > second.minEasting &&
    first.minNorthing < second.maxNorthing &&
    first.maxNorthing > second.minNorthing
  );
}

function partlyOutside(first: Bounds, second: Bounds): boolean {
  return (
    first.minEasting < second.minEasting ||
    first.minNorthing < second.minNorthing ||
    first.maxEasting > second.maxEasting ||
    first.maxNorthing > second.maxNorthing
  );
}

function resolvedParcelRecord(
  parcel: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    inputId: parcel['inputId'],
    status: parcel['status'],
    id: parcel['resolvedId'] ?? null,
    candidateIds: parcel['candidateIds'],
    geometry: parcel['geometry'],
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: 'SYNTHETIC_FIXTURE',
    sourceDataDate: null,
  };
}

function candidateForParcel(parcelId: string): Readonly<Record<string, unknown>> | undefined {
  const parcel = fixtureParcel(parcelId);
  const bounds = parcel ? coordinateBounds(parcel['geometry']) : undefined;
  if (!bounds) {
    return undefined;
  }
  return {
    id: `fixture-parcel-${parcelId}`,
    type: 'parcel',
    label: parcelId,
    parcelId,
    center: [
      (bounds.minEasting + bounds.maxEasting) / 2,
      (bounds.minNorthing + bounds.maxNorthing) / 2,
    ],
    extent: boundsArray(bounds),
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: 'SYNTHETIC_FIXTURE',
  };
}

export function searchSyntheticLocations(query: string): Readonly<Record<string, unknown>> {
  const normalizedQuery = query.trim().toLocaleLowerCase('pl-PL');
  const parcelCandidates = [SYNTHETIC_PARCEL_IDS.single, SYNTHETIC_PARCEL_IDS.ambiguous]
    .map(candidateForParcel)
    .filter((candidate): candidate is Readonly<Record<string, unknown>> => candidate !== undefined);
  const candidates = [...LOCATION_FIXTURES, ...parcelCandidates].filter((candidate) => {
    const label = String(candidate['label']).toLocaleLowerCase('pl-PL');
    const parcelId = String(candidate['parcelId'] ?? '').toLocaleLowerCase('pl-PL');
    return label.includes(normalizedQuery) || parcelId === normalizedQuery;
  });

  return {
    status: candidates.length === 0 ? 'no_match' : candidates.length === 1 ? 'ready' : 'ambiguous',
    candidates,
    provenance: {
      provider: 'SYNTHETIC_FIXTURE',
      sourceDataDate: null,
      limitations: ['Fictional search candidates; no live place or parcel service was called.'],
    },
  };
}

export function resolveSyntheticParcelByIdentifier(
  parcelId: string,
): Readonly<Record<string, unknown>> {
  const preview = previewSyntheticParcels([parcelId], 0);
  const parcels = preview['parcels'] as readonly Readonly<Record<string, unknown>>[];
  const parcel = parcels[0];

  if (parcel?.['status'] === 'resolved') {
    return {
      status: 'resolved',
      parcel: fixtureParcel(parcelId) ?? null,
      candidates: [],
    };
  }
  if (parcel?.['status'] === 'ambiguous') {
    return {
      status: 'ambiguous',
      parcel: null,
      candidates: (parcel['candidateIds'] as readonly string[]).map((candidateId) => ({
        id: candidateId,
        inputId: parcelId,
        source: 'SYNTHETIC_FIXTURE',
      })),
    };
  }
  return { status: 'not_found', parcel: null, candidates: [] };
}

export function resolveSyntheticParcelByPoint(
  coordinates: readonly [number, number],
): Readonly<Record<string, unknown>> {
  const matches = PARCEL_LOOKUP_FIXTURES.flatMap((parcelId) => {
    const parcel = fixtureParcel(parcelId);
    const bounds = parcel ? coordinateBounds(parcel['geometry']) : undefined;
    if (
      !parcel ||
      !bounds ||
      coordinates[0] < bounds.minEasting ||
      coordinates[0] > bounds.maxEasting ||
      coordinates[1] < bounds.minNorthing ||
      coordinates[1] > bounds.maxNorthing
    ) {
      return [];
    }
    return [parcel];
  });

  if (matches.length === 1) {
    return { status: 'resolved', parcel: matches[0], candidates: [] };
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', parcel: null, candidates: matches };
  }
  return { status: 'not_found', parcel: null, candidates: [] };
}

export function previewSyntheticWorkingArea(
  parcelIds: readonly string[],
  workingExtent: WorkingExtentInput,
): Readonly<Record<string, unknown>> {
  const parcelPreview = previewSyntheticParcels(parcelIds, 0);
  const inputParcels = parcelPreview['parcels'] as readonly Readonly<Record<string, unknown>>[];
  const selectedParcels = inputParcels.map(resolvedParcelRecord);
  const workingBounds: Bounds = {
    minEasting: workingExtent.bounds[0],
    minNorthing: workingExtent.bounds[1],
    maxEasting: workingExtent.bounds[2],
    maxNorthing: workingExtent.bounds[3],
  };
  const parcelBounds = selectedParcels
    .map((parcel) => coordinateBounds(parcel['geometry']))
    .filter((bounds): bounds is Bounds => bounds !== undefined);
  const subjectBounds =
    parcelBounds.length === 0
      ? undefined
      : parcelBounds.reduce((result, bounds) => ({
          minEasting: Math.min(result.minEasting, bounds.minEasting),
          minNorthing: Math.min(result.minNorthing, bounds.minNorthing),
          maxEasting: Math.max(result.maxEasting, bounds.maxEasting),
          maxNorthing: Math.max(result.maxNorthing, bounds.maxNorthing),
        }));
  const warnings: Readonly<Record<string, unknown>>[] = [];

  for (const parcel of selectedParcels) {
    const bounds = coordinateBounds(parcel['geometry']);
    if (!bounds) {
      continue;
    }
    const warning = !overlaps(bounds, workingBounds)
      ? 'PARCEL_OUTSIDE_WORKING_EXTENT'
      : partlyOutside(bounds, workingBounds)
        ? 'PARCEL_PARTLY_OUTSIDE_WORKING_EXTENT'
        : undefined;
    if (warning) {
      warnings.push({ code: warning, parcelId: parcel['inputId'] });
    }
  }

  const issues: string[] = [];
  if (selectedParcels.some((parcel) => parcel['status'] === 'unresolved')) {
    issues.push('UNRESOLVED_PARCEL');
  }
  if (selectedParcels.some((parcel) => parcel['status'] === 'ambiguous')) {
    issues.push('AMBIGUOUS_PARCEL');
  }

  const overLimit =
    exceedsLimits(workingBounds) || (subjectBounds ? exceedsLimits(subjectBounds) : false);
  if (exceedsLimits(workingBounds)) {
    issues.push('WORKING_EXTENT_EXCEEDED');
  }
  if (subjectBounds && exceedsLimits(subjectBounds)) {
    issues.push('PARCEL_SUBJECT_EXCEEDED');
  }
  const incomplete = issues.includes('UNRESOLVED_PARCEL') || issues.includes('AMBIGUOUS_PARCEL');
  const status = incomplete ? 'incomplete' : overLimit ? 'outside_limits' : 'ready';
  const subjectExtent = subjectBounds ? extentMetrics(subjectBounds) : null;
  const normalizedSelectedParcels = [...selectedParcels].sort((first, second) =>
    String(first['inputId']).localeCompare(String(second['inputId'])),
  );
  const canonicalSnapshot = JSON.stringify({
    version: 2,
    parcelIds: [...parcelIds].sort(),
    selectedParcels: normalizedSelectedParcels,
    projectCrs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    workingExtent: {
      crs: workingExtent.crs,
      axisOrder: workingExtent.axisOrder,
      bounds: workingExtent.bounds,
    },
  });
  const previewFingerprint =
    status === 'ready'
      ? `v2:sha256:${createHash('sha256').update(canonicalSnapshot).digest('hex')}`
      : null;

  return {
    status,
    issues,
    selectedParcels,
    parcelSubjectExtent: subjectExtent,
    workingExtent: {
      ...workingExtent,
      widthMetres: workingBounds.maxEasting - workingBounds.minEasting,
      heightMetres: workingBounds.maxNorthing - workingBounds.minNorthing,
      envelopeAreaSquareMetres:
        (workingBounds.maxEasting - workingBounds.minEasting) *
        (workingBounds.maxNorthing - workingBounds.minNorthing),
    },
    warnings,
    provenance: {
      provider: 'SYNTHETIC_FIXTURE',
      sourceDataDate: null,
      limitations: [
        'Fictional geometries and no live ULDK, place-search, or map provider requests.',
        'The simulator is in-memory and does not establish production revalidation or persistence.',
      ],
    },
    previewFingerprint,
  };
}

export function createSyntheticInteractiveProject(
  name: string,
  parcelIds: readonly string[],
  preview: Readonly<Record<string, unknown>>,
  projectNumber: number,
): InteractiveProject {
  return {
    id: `00000000-0000-4000-8000-${String(projectNumber).padStart(12, '0')}`,
    name,
    createdAt: '2026-01-01T00:00:00Z',
    parcelIds: [...parcelIds],
    workingExtent: preview['workingExtent'] as Readonly<Record<string, unknown>>,
    selectedParcels: preview['selectedParcels'] as readonly Readonly<Record<string, unknown>>[],
    previewFingerprint: String(preview['previewFingerprint']),
    provenance: preview['provenance'] as Readonly<Record<string, unknown>>,
  };
}

export function interactiveRequestDigest(value: Readonly<Record<string, unknown>>): string {
  return createRequestDigest(value);
}
