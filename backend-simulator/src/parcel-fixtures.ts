import { PUBLIC_SNAPSHOT } from './public-snapshot.js';
import { CIEZKOWICE_SNAPSHOT } from './snapshot-data.js';
export const SYNTHETIC_PARCEL_IDS = {
  single: '999999_9.9999.1',
  adjacent: '999999_9.9999.2',
  nearby: '999999_9.9999.3',
  ambiguous: '999999_9.9999.756',
  candidateFirst: '999999_9.9999.756.1',
  candidateSecond: '999999_9.9999.756.2',
  distant: '999999_9.9999.9',
  unresolved: '999999_9.9999.404',
} as const;
export const FIXTURE_REGIONS = [
  { id: 'north', label: 'Północne' },
  { id: 'south', label: 'Południowe' },
  { id: '12', label: 'Małopolskie' },
  { id: '10', label: 'Łódzkie' },
  { id: '16', label: 'Opolskie' },
  { id: '32', label: 'Zachodniopomorskie' },
] as const;
export const FIXTURE_LOCALITIES = [
  {
    id: 'brzozowo',
    label: 'Brzozowo',
    regionId: 'north',
    precinct: 'Centrum',
    center: [100500, 200500],
  },
  {
    id: 'dabrowa',
    label: 'Dąbrowa',
    regionId: 'north',
    precinct: 'Leśny',
    center: [101000, 200500],
  },
  {
    id: 'jeziorna',
    label: 'Jeziorna',
    regionId: 'south',
    precinct: 'Nad Jeziorem',
    center: [101500, 201000],
  },
  ...PUBLIC_SNAPSHOT.localities,
] as const;
interface ParcelFixture {
  readonly id: string;
  readonly number: string;
  readonly localityId: string;
  readonly bounds: readonly [number, number, number, number];
  readonly geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
    crs: 'EPSG:2180';
    axisOrder: 'easting-northing';
  };
  readonly source?: string;
  readonly sourceDataDate?: string | null;
  readonly contextLabel?: string;
}
const ALL_PARCEL_FIXTURES: readonly ParcelFixture[] = [
  {
    id: SYNTHETIC_PARCEL_IDS.single,
    number: '101/1',
    localityId: 'brzozowo',
    bounds: [100020, 200020, 100080, 200080],
  },
  {
    id: SYNTHETIC_PARCEL_IDS.adjacent,
    number: '102/1',
    localityId: 'brzozowo',
    bounds: [100080, 200020, 100140, 200080],
  },
  {
    id: SYNTHETIC_PARCEL_IDS.nearby,
    number: '103/1',
    localityId: 'brzozowo',
    bounds: [100520, 200020, 100580, 200080],
  },
  {
    id: SYNTHETIC_PARCEL_IDS.candidateFirst,
    number: '104/1',
    localityId: 'brzozowo',
    bounds: [100020, 200120, 100080, 200180],
  },
  {
    id: SYNTHETIC_PARCEL_IDS.candidateSecond,
    number: '101/1',
    localityId: 'jeziorna',
    bounds: [101020, 201120, 101080, 201180],
  },
  {
    id: SYNTHETIC_PARCEL_IDS.distant,
    number: '199/1',
    localityId: 'jeziorna',
    bounds: [103020, 200020, 103080, 200080],
  },
  ...Array.from({ length: 18 }, (_, i): ParcelFixture => {
    const group = Math.floor(i / 6);
    const e = 100300 + group * 550 + (i % 3) * 70;
    const n = 200500 + Math.floor((i % 6) / 3) * 80;
    return {
      id: `999999_9.999${group}.${110 + i}/1`,
      number: `${110 + i}/1`,
      localityId: FIXTURE_LOCALITIES[group]!.id,
      bounds: [e, n, e + 50, n + 60],
    };
  }),
  ...CIEZKOWICE_SNAPSHOT.parcels,
  ...PUBLIC_SNAPSHOT.parcels.map((p) => ({
    ...p,
    contextLabel: [
      String(p.sourceProperties['NAZWA_GMINY'] || ''),
      `obręb ${p.precinct}`,
      'archiwalny fragment',
    ]
      .filter(Boolean)
      .join(' · '),
  })),
];
export const PARCEL_FIXTURES = [...new Map(ALL_PARCEL_FIXTURES.map((p) => [p.id, p])).values()];
export function syntheticParcelLabels(id: string) {
  const parcel = PARCEL_FIXTURES.find((p) => p.id === id);
  const locality =
    FIXTURE_LOCALITIES.find((p) => p.id === parcel?.localityId) ?? FIXTURE_LOCALITIES[0];
  const region = FIXTURE_REGIONS.find((r) => r.id === locality.regionId)!;
  return {
    parcelNumber: parcel?.number ?? id.split('.').at(-1)!,
    contextLabel:
      parcel?.contextLabel ??
      `${locality.label} · obręb ${parcel?.source ? parcel.id.split('.')[1] : locality.precinct} · ${region.label}`,
    localityId: locality.id,
    regionId: region.id,
  };
}
export function resolveSyntheticParcelFixture(inputId: string): Readonly<Record<string, unknown>> {
  const fixture = PARCEL_FIXTURES.find((p) => p.id === inputId);
  if (fixture) {
    const [x, y, maxX, maxY] = fixture.bounds;
    return {
      inputId,
      status: 'resolved',
      resolvedId: inputId,
      ...syntheticParcelLabels(inputId),
      candidateIds: [],
      source: fixture.source ?? 'SYNTHETIC_FIXTURE',
      sourceDataDate: fixture.sourceDataDate ?? null,
      geometry: fixture.geometry ?? {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [x, y],
              [maxX, y],
              [maxX, maxY],
              [x, maxY],
              [x, y],
            ],
          ],
        ],
        crs: 'EPSG:2180',
        axisOrder: 'easting-northing',
      },
    };
  }
  if (inputId === SYNTHETIC_PARCEL_IDS.ambiguous)
    return {
      inputId,
      status: 'ambiguous',
      resolvedId: null,
      candidateIds: [SYNTHETIC_PARCEL_IDS.candidateFirst, SYNTHETIC_PARCEL_IDS.candidateSecond],
      geometry: null,
    };
  return { inputId, status: 'unresolved', resolvedId: null, candidateIds: [], geometry: null };
}
export function fixtureCatalog() {
  return {
    regions: FIXTURE_REGIONS,
    localities: FIXTURE_LOCALITIES.map(({ center, ...l }) => l),
    parcels: PARCEL_FIXTURES.map((p) => ({ id: p.id, ...syntheticParcelLabels(p.id) })),
  };
}
