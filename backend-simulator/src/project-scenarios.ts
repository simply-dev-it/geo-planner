import { createHash } from 'node:crypto';

export const SYNTHETIC_PARCEL_IDS = {
  single: '999999_9.9999.1',
  adjacent: '999999_9.9999.2',
  nearby: '999999_9.9999.3',
  ambiguous: '999999_9.9999.756',
  distant: '999999_9.9999.9',
  unresolved: '999999_9.9999.404',
} as const;

const CRS = 'EPSG:2180';
const AXIS_ORDER = 'easting-northing';
const SOURCE_RETRIEVED_AT = '2026-01-01T00:00:00Z';

interface Bounds {
  readonly minEasting: number;
  readonly minNorthing: number;
  readonly maxEasting: number;
  readonly maxNorthing: number;
}

interface ResolvedFixture {
  readonly id: string;
  readonly bounds: Bounds;
}

const RESOLVED_FIXTURES: ReadonlyMap<string, ResolvedFixture> = new Map([
  [
    SYNTHETIC_PARCEL_IDS.single,
    {
      id: SYNTHETIC_PARCEL_IDS.single,
      bounds: { minEasting: 100020, minNorthing: 200020, maxEasting: 100080, maxNorthing: 200080 },
    },
  ],
  [
    SYNTHETIC_PARCEL_IDS.adjacent,
    {
      id: SYNTHETIC_PARCEL_IDS.adjacent,
      bounds: { minEasting: 100080, minNorthing: 200020, maxEasting: 100140, maxNorthing: 200080 },
    },
  ],
  [
    SYNTHETIC_PARCEL_IDS.nearby,
    {
      id: SYNTHETIC_PARCEL_IDS.nearby,
      bounds: { minEasting: 100520, minNorthing: 200020, maxEasting: 100580, maxNorthing: 200080 },
    },
  ],
  [
    SYNTHETIC_PARCEL_IDS.distant,
    {
      id: SYNTHETIC_PARCEL_IDS.distant,
      bounds: { minEasting: 103020, minNorthing: 200020, maxEasting: 103080, maxNorthing: 200080 },
    },
  ],
]);

function geometry(bounds: Bounds): Readonly<Record<string, unknown>> {
  return multiGeometry([bounds]);
}

function multiGeometry(boundsList: readonly Bounds[]): Readonly<Record<string, unknown>> {
  return {
    type: 'MultiPolygon',
    coordinates: boundsList.map((bounds) => [
      [
        [bounds.minEasting, bounds.minNorthing],
        [bounds.maxEasting, bounds.minNorthing],
        [bounds.maxEasting, bounds.maxNorthing],
        [bounds.minEasting, bounds.maxNorthing],
        [bounds.minEasting, bounds.minNorthing],
      ],
    ]),
    crs: CRS,
    axisOrder: AXIS_ORDER,
  };
}

function mergeAlignedBounds(source: readonly Bounds[]): Bounds[] {
  let bounds = [...source];
  let merged = true;

  while (merged) {
    merged = false;
    for (let firstIndex = 0; firstIndex < bounds.length && !merged; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < bounds.length; secondIndex += 1) {
        const first = bounds[firstIndex]!;
        const second = bounds[secondIndex]!;
        let union: Bounds | undefined;

        if (
          first.minNorthing === second.minNorthing &&
          first.maxNorthing === second.maxNorthing &&
          first.maxEasting >= second.minEasting &&
          second.maxEasting >= first.minEasting
        ) {
          union = {
            minEasting: Math.min(first.minEasting, second.minEasting),
            minNorthing: first.minNorthing,
            maxEasting: Math.max(first.maxEasting, second.maxEasting),
            maxNorthing: first.maxNorthing,
          };
        } else if (
          first.minEasting === second.minEasting &&
          first.maxEasting === second.maxEasting &&
          first.maxNorthing >= second.minNorthing &&
          second.maxNorthing >= first.minNorthing
        ) {
          union = {
            minEasting: first.minEasting,
            minNorthing: Math.min(first.minNorthing, second.minNorthing),
            maxEasting: first.maxEasting,
            maxNorthing: Math.max(first.maxNorthing, second.maxNorthing),
          };
        }

        if (union) {
          bounds = bounds.filter((_, index) => index !== firstIndex && index !== secondIndex);
          bounds.push(union);
          merged = true;
          break;
        }
      }
    }
  }

  return bounds.sort(
    (first, second) =>
      first.minEasting - second.minEasting || first.minNorthing - second.minNorthing,
  );
}

function combinedBounds(fixtures: readonly ResolvedFixture[]): Bounds | undefined {
  if (fixtures.length === 0) {
    return undefined;
  }

  return fixtures.reduce(
    (result, fixture) => ({
      minEasting: Math.min(result.minEasting, fixture.bounds.minEasting),
      minNorthing: Math.min(result.minNorthing, fixture.bounds.minNorthing),
      maxEasting: Math.max(result.maxEasting, fixture.bounds.maxEasting),
      maxNorthing: Math.max(result.maxNorthing, fixture.bounds.maxNorthing),
    }),
    fixtures[0]!.bounds,
  );
}

function extent(bounds: Bounds, bufferMetres: number): Readonly<Record<string, unknown>> {
  const expanded = {
    minEasting: bounds.minEasting - bufferMetres,
    minNorthing: bounds.minNorthing - bufferMetres,
    maxEasting: bounds.maxEasting + bufferMetres,
    maxNorthing: bounds.maxNorthing + bufferMetres,
  };
  const widthMetres = expanded.maxEasting - expanded.minEasting;
  const heightMetres = expanded.maxNorthing - expanded.minNorthing;

  return {
    crs: CRS,
    axisOrder: 'minEasting-minNorthing-maxEasting-maxNorthing',
    bounds: [expanded.minEasting, expanded.minNorthing, expanded.maxEasting, expanded.maxNorthing],
    widthMetres,
    heightMetres,
    envelopeAreaSquareMetres: widthMetres * heightMetres,
  };
}

function fingerprint(
  parcelIds: readonly string[],
  bufferMetres: number,
  parcels: readonly Readonly<Record<string, unknown>>[],
  subjectGeometry: Readonly<Record<string, unknown>> | null,
  bufferedGeometry: Readonly<Record<string, unknown>> | null,
  subjectExtent: Readonly<Record<string, unknown>> | null,
  acquisitionExtent: Readonly<Record<string, unknown>> | null,
): string {
  const canonicalSnapshot = JSON.stringify({
    parcelIds: [...parcelIds].sort(),
    bufferMetres,
    projectCrs: CRS,
    axisOrder: AXIS_ORDER,
    parcels: [...parcels].sort((left, right) =>
      String(left['inputId']).localeCompare(String(right['inputId'])),
    ),
    subjectGeometry,
    bufferedGeometry,
    subjectExtent,
    acquisitionExtent,
  });
  const digest = createHash('sha256').update(canonicalSnapshot).digest('hex');

  return `v1:sha256:${digest}`;
}

export function previewSyntheticParcels(
  parcelIds: readonly string[],
  bufferMetres: number,
): Readonly<Record<string, unknown>> {
  const parcels = parcelIds.map((inputId): Readonly<Record<string, unknown>> => {
    const resolved = RESOLVED_FIXTURES.get(inputId);

    if (resolved) {
      return {
        inputId,
        status: 'resolved',
        resolvedId: resolved.id,
        candidateIds: [],
        geometry: geometry(resolved.bounds),
      };
    }

    if (inputId === SYNTHETIC_PARCEL_IDS.ambiguous) {
      return {
        inputId,
        status: 'ambiguous',
        resolvedId: null,
        candidateIds: ['999999_9.9999.756.1', '999999_9.9999.756.2'],
        geometry: null,
      };
    }

    return {
      inputId,
      status: 'unresolved',
      resolvedId: null,
      candidateIds: [],
      geometry: null,
    };
  });
  const resolvedFixtures = parcelIds
    .map((parcelId) => RESOLVED_FIXTURES.get(parcelId))
    .filter((fixture): fixture is ResolvedFixture => fixture !== undefined);
  const subjectBounds = combinedBounds(resolvedFixtures);
  const subjectParts = mergeAlignedBounds(resolvedFixtures.map((fixture) => fixture.bounds));
  const subjectGeometry = subjectParts.length > 0 ? multiGeometry(subjectParts) : null;
  const bufferedGeometry =
    subjectParts.length > 0
      ? multiGeometry(
          mergeAlignedBounds(
            subjectParts.map((bounds) => ({
              minEasting: bounds.minEasting - bufferMetres,
              minNorthing: bounds.minNorthing - bufferMetres,
              maxEasting: bounds.maxEasting + bufferMetres,
              maxNorthing: bounds.maxNorthing + bufferMetres,
            })),
          ),
        )
      : null;
  const subjectExtent = subjectBounds ? extent(subjectBounds, 0) : null;
  const acquisitionExtent = subjectBounds ? extent(subjectBounds, bufferMetres) : null;
  const issues: string[] = [];

  if (parcels.some((parcel) => parcel['status'] === 'unresolved')) {
    issues.push('UNRESOLVED_PARCEL');
  }
  if (parcels.some((parcel) => parcel['status'] === 'ambiguous')) {
    issues.push('AMBIGUOUS_PARCEL');
  }

  if (subjectExtent && acquisitionExtent) {
    const subjectExceeded = exceedsLimits(subjectExtent);
    const bufferedExceeded = exceedsLimits(acquisitionExtent);

    if (subjectExceeded) {
      issues.push('SUBJECT_EXTENT_EXCEEDED');
    }
    if (bufferedExceeded) {
      issues.push('BUFFERED_EXTENT_EXCEEDED');
    }
  }

  const hasUnresolved = issues.includes('UNRESOLVED_PARCEL') || issues.includes('AMBIGUOUS_PARCEL');
  const outsideLimits =
    issues.includes('SUBJECT_EXTENT_EXCEEDED') || issues.includes('BUFFERED_EXTENT_EXCEEDED');
  const status = hasUnresolved ? 'incomplete' : outsideLimits ? 'outside_limits' : 'ready';
  const previewFingerprint =
    status === 'ready'
      ? fingerprint(
          parcelIds,
          bufferMetres,
          parcels,
          subjectGeometry,
          bufferedGeometry,
          subjectExtent,
          acquisitionExtent,
        )
      : null;

  return {
    status,
    issues,
    parcels,
    subjectGeometry,
    bufferedGeometry,
    projectCrs: CRS,
    axisOrder: AXIS_ORDER,
    subjectExtent,
    acquisitionExtent,
    provenance: {
      provider: 'GUGIK_ULDK',
      operation: 'GetParcelByIdOrNr',
      retrievedAt: SOURCE_RETRIEVED_AT,
      sourceDataDate: null,
      attribution: 'Główny Urząd Geodezji i Kartografii',
      limitations: [
        'Schematic synthetic geometry; no live ULDK request or production buffer calculation.',
      ],
    },
    previewFingerprint,
  };
}

function exceedsLimits(value: Readonly<Record<string, unknown>>): boolean {
  return (
    Number(value['widthMetres']) > 2000 ||
    Number(value['heightMetres']) > 2000 ||
    Number(value['envelopeAreaSquareMetres']) > 4_000_000
  );
}

export interface SimulatedProject {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly parcelIds: readonly string[];
  readonly bufferMetres: number;
  readonly preview: Readonly<Record<string, unknown>>;
}

export interface IdempotencyRecord {
  readonly requestDigest: string;
  readonly project: SimulatedProject;
}

export interface ProjectSimulatorState {
  nextProjectNumber: number;
  readonly projects: Map<string, SimulatedProject>;
  readonly idempotencyRecords: Map<string, IdempotencyRecord>;
}

export function createProjectSimulatorState(): ProjectSimulatorState {
  return {
    nextProjectNumber: 1,
    projects: new Map(),
    idempotencyRecords: new Map(),
  };
}

export function syntheticProject(
  name: string,
  parcelIds: readonly string[],
  bufferMetres: number,
  preview: Readonly<Record<string, unknown>>,
  projectNumber: number,
): SimulatedProject {
  return {
    id: `00000000-0000-4000-8000-${String(projectNumber).padStart(12, '0')}`,
    name,
    createdAt: SOURCE_RETRIEVED_AT,
    parcelIds: [...parcelIds],
    bufferMetres,
    preview,
  };
}

export function createRequestDigest(value: Readonly<Record<string, unknown>>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
