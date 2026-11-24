import { readFileSync } from 'node:fs';

export interface SnapshotParcel {
  id: string;
  number: string;
  localityId: string;
  bounds: [number, number, number, number];
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
    crs: 'EPSG:2180';
    axisOrder: 'easting-northing';
  };
  source: string;
  sourceDataDate: string | null;
}
interface Snapshot {
  raster: {
    width: number;
    height: number;
    bounds: [number, number, number, number];
    resolution: number;
    sha256: string;
  };
  parcels: SnapshotParcel[];
  limitations: string[];
}
export const CIEZKOWICE_SNAPSHOT = JSON.parse(
  readFileSync(new URL('../fixtures/ciezkowice/snapshot.json', import.meta.url), 'utf8'),
) as Snapshot;
export const CIEZKOWICE_BOUNDS = CIEZKOWICE_SNAPSHOT.raster.bounds;
export const CIEZKOWICE_CENTER = [
  (CIEZKOWICE_BOUNDS[0] + CIEZKOWICE_BOUNDS[2]) / 2,
  (CIEZKOWICE_BOUNDS[1] + CIEZKOWICE_BOUNDS[3]) / 2,
] as const;
export function isSnapshotNeighbourhood(bounds: readonly number[]): boolean {
  return (
    bounds[2]! > CIEZKOWICE_BOUNDS[0] - 4000 &&
    bounds[0]! < CIEZKOWICE_BOUNDS[2] + 4000 &&
    bounds[3]! > CIEZKOWICE_BOUNDS[1] - 4000 &&
    bounds[1]! < CIEZKOWICE_BOUNDS[3] + 4000
  );
}
