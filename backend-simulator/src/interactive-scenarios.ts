import { PUBLIC_SNAPSHOT, publicNeighbourhood } from './public-snapshot.js';
import { CIEZKOWICE_SNAPSHOT, isSnapshotNeighbourhood } from './snapshot-data.js';
import { fixtureContainsPoint, fixtureIntersectsArea } from './fixture-geometry.js';
import { createHash } from 'node:crypto';

import {
  resolveSyntheticParcelFixture,
  SYNTHETIC_PARCEL_IDS,
  syntheticParcelLabels,
  PARCEL_FIXTURES,
  FIXTURE_REGIONS,
  FIXTURE_LOCALITIES,
} from './parcel-fixtures.js';

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

export interface InteractiveSimulatorState {
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

const PARCEL_LOOKUP_FIXTURES = PARCEL_FIXTURES.map((p) => p.id);
const LOCATION_FIXTURES: readonly Readonly<Record<string, unknown>>[] = [
  ...FIXTURE_LOCALITIES.map((l) => ({
    id: l.id,
    type: 'locality',
    label: l.label,
    contextLabel:
      'contextLabel' in l
        ? l.contextLabel
        : FIXTURE_REGIONS.find((r) => r.id === l.regionId)!.label,
    regionId: l.regionId,
    localityId: l.id,
    center: l.center,
    extent:
      'extent' in l
        ? l.extent
        : [l.center[0] - 500, l.center[1] - 500, l.center[0] + 500, l.center[1] + 500],
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: 'source' in l ? l.source : 'SYNTHETIC_FIXTURE',
  })),
  ...FIXTURE_LOCALITIES.filter((l) => !('source' in l)).flatMap((l) =>
    ['Lipowa', 'Leśna'].map((name, i) => ({
      id: `street-${l.id}-${i}`,
      streetId: `street-${l.id}-${i}`,
      type: 'street',
      label: name,
      contextLabel: l.label,
      regionId: l.regionId,
      localityId: l.id,
      center: l.center,
      extent: [l.center[0] - 150, l.center[1] - 150, l.center[0] + 150, l.center[1] + 150],
      crs: INTERACTIVE_CRS,
      axisOrder: INTERACTIVE_AXIS_ORDER,
      source: 'SYNTHETIC_FIXTURE',
    })),
  ),
  ...PUBLIC_SNAPSHOT.streets.map((s) => ({
    ...s,
    type: 'street',
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
  })),
];

export function createInteractiveSimulatorState(): InteractiveSimulatorState {
  return {
    nextProjectNumber: 1,
    projects: new Map(),
    idempotencyRecords: new Map(),
  };
}

function fixtureParcel(parcelId: string): Readonly<Record<string, unknown>> | undefined {
  const parcel = resolveSyntheticParcelFixture(parcelId);

  if (parcel['status'] !== 'resolved') {
    return undefined;
  }

  return {
    id: parcel['resolvedId'],
    parcelNumber: syntheticParcelLabels(parcelId).parcelNumber,
    contextLabel: syntheticParcelLabels(parcelId).contextLabel,
    geometry: parcel['geometry'],
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: parcel['source'] ?? 'SYNTHETIC_FIXTURE',
    sourceDataDate: parcel['sourceDataDate'] ?? null,
    limitations:
      parcel['source'] === 'ARCHIVED_GUGIK_ULDK'
        ? CIEZKOWICE_SNAPSHOT.limitations
        : parcel['source'] === 'CAPTURED_GUGIK_EGIB'
          ? PUBLIC_SNAPSHOT.limitations
          : ['Fictional test geometry; not retrieved from ULDK.'],
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
    ...(parcel['status'] === 'resolved'
      ? { parcelNumber: parcel['parcelNumber'], contextLabel: parcel['contextLabel'] }
      : {}),
    status: parcel['status'],
    id: parcel['resolvedId'] ?? null,
    candidateIds: parcel['candidateIds'],
    geometry: parcel['geometry'],
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: parcel['source'] ?? 'SYNTHETIC_FIXTURE',
    sourceDataDate: parcel['sourceDataDate'] ?? null,
  };
}

function candidateForParcel(parcelId: string): Readonly<Record<string, unknown>> | undefined {
  const parcel = fixtureParcel(parcelId);
  const bounds = parcel ? coordinateBounds(parcel['geometry']) : undefined;
  if (!parcel || !bounds) {
    return undefined;
  }
  return {
    id: `fixture-parcel-${parcelId}`,
    type: 'parcel',
    label: syntheticParcelLabels(parcelId).parcelNumber,
    contextLabel: syntheticParcelLabels(parcelId).contextLabel,
    parcelId,
    regionId: syntheticParcelLabels(parcelId).regionId,
    localityId:
      parcel['source'] === 'SYNTHETIC_FIXTURE'
        ? syntheticParcelLabels(parcelId).localityId
        : undefined,
    center: [
      (bounds.minEasting + bounds.maxEasting) / 2,
      (bounds.minNorthing + bounds.maxNorthing) / 2,
    ],
    extent: boundsArray(bounds),
    crs: INTERACTIVE_CRS,
    axisOrder: INTERACTIVE_AXIS_ORDER,
    source: parcel['source'] ?? 'SYNTHETIC_FIXTURE',
  };
}

export interface FixtureSearchOptions {
  countyId?: string;
  communeId?: string;
  localityId?: string;
  streetId?: string;
  countyName?: string;
  communeName?: string;
  localityName?: string;
  streetName?: string;
  bounds?: string;
  regionId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}
export function searchSyntheticLocations(
  query: string,
  options: FixtureSearchOptions = {},
): Readonly<Record<string, unknown>> {
  if (
    options.type === 'address' &&
    (!(options.localityId || options.localityName) || !(options.streetId || options.streetName))
  )
    return {
      status: 'needs_context',
      candidates: [],
      nextCursor: null,
      contextPrompt: 'Wybierz miejscowość i ulicę.',
      provenance: { provider: 'SYNTHETIC_FIXTURE', sourceDataDate: null, limitations: [] },
    };
  if (
    !['place', 'locality', 'street', 'address'].includes(options.type ?? '') &&
    /^\d+(?:\/\d+)?$/.test(query.trim()) &&
    !options.bounds
  )
    return {
      status: 'needs_context',
      candidates: [],
      nextCursor: null,
      contextPrompt: 'Wybierz miejscowość lub adres i przybliż mapę do szukanego miejsca.',
      provenance: {
        provider: 'SYNTHETIC_FIXTURE',
        sourceDataDate: null,
        limitations: ['Fictional source-aligned lookup example.'],
      },
    };
  const normalize = (value: string) =>
    value.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
  const terms = normalize(query)
    .split(/[\s,]+/)
    .filter(Boolean);
  const parcels = PARCEL_LOOKUP_FIXTURES.map(candidateForParcel).filter(
    (p): p is Readonly<Record<string, unknown>> => !!p,
  );
  const addresses: Readonly<Record<string, unknown>>[] = ['place', 'address'].includes(
    options.type ?? '',
  )
    ? FIXTURE_LOCALITIES.filter((l) => !('source' in l)).map((l) => ({
        id: `address-${l.id}-lipowa-1`,
        streetId: `street-${l.id}-0`,
        type: 'point_address',
        label: `${l.label}, Lipowa 1`,
        contextLabel:
          'contextLabel' in l
            ? l.contextLabel
            : FIXTURE_REGIONS.find((r) => r.id === l.regionId)!.label,
        regionId: l.regionId,
        localityId: l.id,
        center: [l.center[0] + 30, l.center[1] + 30],
        extent: [l.center[0] - 250, l.center[1] - 250, l.center[0] + 250, l.center[1] + 250],
        crs: INTERACTIVE_CRS,
        axisOrder: INTERACTIVE_AXIS_ORDER,
        source: 'SYNTHETIC_FIXTURE',
      }))
    : [];
  addresses.push(
    ...PUBLIC_SNAPSHOT.addresses.map((a) => ({
      ...a,
      type: 'point_address',
      crs: INTERACTIVE_CRS,
      axisOrder: INTERACTIVE_AXIS_ORDER,
    })),
  );
  const all = [...LOCATION_FIXTURES, ...parcels, ...addresses].filter((p) => {
    if (options.regionId && p['regionId'] !== options.regionId) return false;
    if (
      options.type === 'place'
        ? !['locality', 'street', 'point_address'].includes(String(p['type']))
        : options.type === 'address'
          ? p['type'] !== 'point_address'
          : options.type && p['type'] !== options.type
    )
      return false;
    const locality = FIXTURE_LOCALITIES.find((l) => l.id === p['localityId']);
    const county = p['regionId'] === 'north' ? 'Północny' : 'Południowy';
    if (
      options.localityName &&
      (!locality || !normalize(locality.label).includes(normalize(options.localityName)))
    )
      return false;
    if (
      options.communeName &&
      (!locality || !normalize(locality.label).includes(normalize(options.communeName)))
    )
      return false;
    if (options.countyName && !normalize(county).includes(normalize(options.countyName)))
      return false;
    if (options.localityId && p['localityId'] !== options.localityId) return false;
    if (options.communeId && p['localityId'] !== options.communeId) return false;
    if (options.countyId && options.countyId !== `${String(p['regionId'])}-county`) return false;
    if (options.streetId && options.streetId !== (p['streetId'] ?? p['id'])) return false;
    if (
      !options.streetId &&
      options.streetName &&
      normalize(options.streetName) !==
        normalize(
          p['type'] === 'point_address' ? String(p['streetName'] ?? 'Lipowa') : String(p['label']),
        )
    )
      return false;
    if (options.bounds) {
      const b = options.bounds.split(',').map(Number) as [number, number, number, number],
        e = p['extent'] as [number, number, number, number];
      if (!e || e[2] <= b[0] || e[0] >= b[2] || e[3] <= b[1] || e[1] >= b[3]) return false;
    }
    if (options.type === 'address') return query.trim() === String(p['houseNumber'] ?? '1');
    if (options.type === 'place') {
      // Match the explicit phrase; a locality does not enumerate its streets/house numbers.
      const phrase =
        p['type'] === 'street' ? `${locality?.label ?? ''} ${p['label']}` : String(p['label']);
      const words = (value: string) =>
        normalize(value)
          .split(/[\s,]+/)
          .filter(Boolean)
          .join(' ');
      return words(phrase) === words(query);
    }
    const matchText = String(p['source']).startsWith('CAPTURED_')
      ? (v: string) => v.toLocaleLowerCase('pl-PL').normalize('NFC')
      : normalize;
    const recordTerms = matchText(query)
      .split(/[\s,]+/)
      .filter(Boolean);
    const label = matchText(String(p['label']));
    const identity = String(p['parcelId'] ?? '');
    const haystack = matchText([label, p['contextLabel'], identity].join(' '));
    const numbers = recordTerms.filter((t) => /^\d+(?:\/\d+)?$/.test(t));
    if (p['type'] === 'parcel' && numbers.some((t) => t !== label)) return false;
    return (
      !recordTerms.length ||
      recordTerms.every((t) =>
        options.type === 'street'
          ? haystack.includes(t)
          : haystack.split(/[\s,·]+/).includes(t) || identity === t,
      )
    );
  });
  const offset = options.offset ?? 0,
    limit = options.limit ?? 5;
  const signature = createHash('sha256')
    .update(
      JSON.stringify([
        query,
        options.regionId ?? '',
        options.type ?? '',
        limit,
        options.countyId ?? '',
        options.communeId ?? '',
        options.localityId ?? '',
        options.streetId ?? '',
        options.countyName ?? '',
        options.communeName ?? '',
        options.localityName ?? '',
        options.streetName ?? '',
        options.bounds ?? '',
      ]),
    )
    .digest('hex')
    .slice(0, 16);
  const captured =
    all.some((p) => String(p['source']).startsWith('CAPTURED_')) ||
    PUBLIC_SNAPSHOT.localities.some((l) => l.id === options.localityId) ||
    (options.bounds && publicNeighbourhood(options.bounds.split(',').map(Number)));
  const archived =
    all.some((p) => String(p['source']).startsWith('ARCHIVED_')) ||
    (options.bounds && isSnapshotNeighbourhood(options.bounds.split(',').map(Number)));
  return {
    status: all.length === 0 ? 'no_match' : all.length === 1 ? 'ready' : 'ambiguous',
    candidates: all
      .slice(offset, offset + limit)
      .map((p) =>
        Object.fromEntries(
          [
            'id',
            'type',
            'label',
            'contextLabel',
            'parcelId',
            'regionId',
            'localityId',
            'streetId',
            'center',
            'extent',
            'crs',
            'axisOrder',
            'source',
          ]
            .filter((k) => p[k] !== undefined)
            .map((k) => [k, p[k]]),
        ),
      ),
    nextCursor: offset + limit < all.length ? `${signature}:${offset + limit}` : null,
    provenance: {
      provider: captured
        ? 'CAPTURED_GUGIK_SNAPSHOT'
        : archived
          ? 'ARCHIVED_GUGIK_SNAPSHOT'
          : 'SYNTHETIC_FIXTURE',
      sourceDataDate: null,
      limitations: captured
        ? PUBLIC_SNAPSHOT.limitations
        : archived
          ? CIEZKOWICE_SNAPSHOT.limitations
          : ['Fictional cadastral catalogue; no live provider access.'],
    },
  };
}
export function searchCursorSignature(query: string, options: FixtureSearchOptions): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        query,
        options.regionId ?? '',
        options.type ?? '',
        options.limit ?? 5,
        options.countyId ?? '',
        options.communeId ?? '',
        options.localityId ?? '',
        options.streetId ?? '',
        options.countyName ?? '',
        options.communeName ?? '',
        options.localityName ?? '',
        options.streetName ?? '',
        options.bounds ?? '',
      ]),
    )
    .digest('hex')
    .slice(0, 16);
}

export function resolveSyntheticParcelByIdentifier(
  parcelId: string,
): Readonly<Record<string, unknown>> {
  const parcel = resolveSyntheticParcelFixture(parcelId);

  if (parcel['status'] === 'resolved') {
    return {
      status: 'resolved',
      parcel: fixtureParcel(parcelId) ?? null,
      candidates: [],
    };
  }
  if (parcel['status'] === 'ambiguous') {
    return {
      status: 'ambiguous',
      parcel: null,
      candidates: (parcel['candidateIds'] as readonly string[]).map((candidateId) => ({
        id: candidateId,
        inputId: parcelId,
        source: 'SYNTHETIC_FIXTURE',
        parcelNumber: syntheticParcelLabels(candidateId).parcelNumber,
        contextLabel: syntheticParcelLabels(candidateId).contextLabel,
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
    if (!parcel || !fixtureContainsPoint(parcel['geometry'], coordinates)) return [];
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
  const selectedParcels = parcelIds.map(resolveSyntheticParcelFixture).map(resolvedParcelRecord);
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
    const warning = !fixtureIntersectsArea(parcel['geometry'], [
      workingBounds.minEasting,
      workingBounds.minNorthing,
      workingBounds.maxEasting,
      workingBounds.maxNorthing,
    ])
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
    version: 1,
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
      ? `v1:sha256:${createHash('sha256').update(canonicalSnapshot).digest('hex')}`
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
      provider: selectedParcels.some((p) => p['source'] === 'ARCHIVED_GUGIK_ULDK')
        ? 'ARCHIVED_GUGIK_SNAPSHOT'
        : selectedParcels.some((p) => String(p['source']).startsWith('CAPTURED_'))
          ? 'CAPTURED_GUGIK_SNAPSHOT'
          : 'SYNTHETIC_FIXTURE',
      sourceDataDate: null,
      limitations: [
        ...(selectedParcels.some((p) => String(p['source']).startsWith('CAPTURED_'))
          ? PUBLIC_SNAPSHOT.limitations
          : []),
        ...(selectedParcels.some((p) => p['source'] === 'ARCHIVED_GUGIK_ULDK')
          ? CIEZKOWICE_SNAPSHOT.limitations
          : []),
        selectedParcels.some(
          (p) =>
            String(p['source']).startsWith('CAPTURED_') ||
            String(p['source']).startsWith('ARCHIVED_'),
        )
          ? 'Offline public snapshots; no live provider access or current-coverage guarantee.'
          : 'Fictional geometries; no live provider access.',
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
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function findSyntheticParcelIntersections(
  workingExtent: WorkingExtentInput,
): Readonly<Record<string, unknown>> {
  const [minEasting, minNorthing, maxEasting, maxNorthing] = workingExtent.bounds;
  const bounds = { minEasting, minNorthing, maxEasting, maxNorthing };
  // Clip actual polygon rings, including archived holes, to the requested rectangle.
  const matches = PARCEL_LOOKUP_FIXTURES.flatMap((id) => {
    const parcel = fixtureParcel(id);
    const parcelBounds = parcel ? coordinateBounds(parcel['geometry']) : undefined;
    return parcel &&
      parcelBounds &&
      fixtureIntersectsArea(parcel['geometry'], [
        bounds.minEasting,
        bounds.minNorthing,
        bounds.maxEasting,
        bounds.maxNorthing,
      ])
      ? [parcel]
      : [];
  }).sort((first, second) => String(first['id']).localeCompare(String(second['id'])));
  const archived = isSnapshotNeighbourhood(workingExtent.bounds);
  const captured = publicNeighbourhood(workingExtent.bounds);
  const detailed = publicNeighbourhood(workingExtent.bounds, true);
  return {
    status:
      captured && !detailed && !archived
        ? 'unavailable'
        : archived || captured || matches.length > MAX_PARCEL_COUNT
          ? 'truncated'
          : 'complete',
    workingExtent,
    candidates: matches.slice(0, MAX_PARCEL_COUNT),
    provenance: {
      provider: archived
        ? 'ARCHIVED_GUGIK_SNAPSHOT'
        : captured
          ? 'CAPTURED_GUGIK_SNAPSHOT'
          : 'SYNTHETIC_FIXTURE',
      sourceDataDate: null,
      limitations: archived
        ? CIEZKOWICE_SNAPSHOT.limitations
        : captured
          ? PUBLIC_SNAPSHOT.limitations
          : ['Complete only for the fictional fixture set; no live provider access.'],
    },
  };
}
