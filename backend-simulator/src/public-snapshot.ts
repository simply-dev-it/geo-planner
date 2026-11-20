import { readFileSync } from 'node:fs';
import type { SnapshotParcel } from './snapshot-data.js';
export interface PublicLocality {
  id: string;
  label: string;
  regionId: string;
  precinct: string;
  center: [number, number];
  extent: [number, number, number, number];
  contextLabel: string;
  source: string;
  detailedCapture: boolean;
}
export interface PublicStreet {
  id: string;
  streetId: string;
  localityId: string;
  regionId: string;
  label: string;
  contextLabel: string;
  center: [number, number];
  extent: [number, number, number, number];
  paths: [number, number][][];
  source: string;
}
export interface PublicAddress extends Omit<PublicStreet, 'paths'> {
  houseNumber: string;
  streetName: string;
}
export interface PublicParcel extends Omit<SnapshotParcel, 'sourceDataDate'> {
  sourceDataDate: string | null;
  precinct: string;
  sourceProperties: Record<string, unknown>;
}
export const PUBLIC_SNAPSHOT = JSON.parse(
  readFileSync(
    new URL('../fixtures/public-near-ciezkowice/snapshot.json', import.meta.url),
    'utf8',
  ),
) as {
  localities: PublicLocality[];
  streets: PublicStreet[];
  addresses: PublicAddress[];
  parcels: PublicParcel[];
  limitations: string[];
  responseBytes: number;
  capturedAt: string;
};
export function publicNeighbourhood(bounds: readonly number[], detailedOnly = false): boolean {
  return PUBLIC_SNAPSHOT.localities.some(
    (l) =>
      (!detailedOnly || l.detailedCapture) &&
      bounds[2]! > l.center[0] - 4000 &&
      bounds[0]! < l.center[0] + 4000 &&
      bounds[3]! > l.center[1] - 4000 &&
      bounds[1]! < l.center[1] + 4000,
  );
}
