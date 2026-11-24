export type Bounds = readonly [number, number, number, number];

export function validWorkingArea(bounds: Bounds): boolean {
  if (!bounds.every(Number.isFinite)) return false;
  const [minX, minY, maxX, maxY] = bounds;
  const width = maxX - minX;
  const height = maxY - minY;
  return (
    bounds.every((value) => Math.abs(value) <= 10_000_000) &&
    bounds.every((value) => Math.abs(value * 1000 - Math.round(value * 1000)) <= 1e-7) &&
    width > 0 &&
    height > 0 &&
    width <= 2000 &&
    height <= 2000 &&
    width * height <= 4_000_000
  );
}

export function roundMapBounds(bounds: Bounds): Bounds {
  return bounds.map((value) => Math.round(value * 1000) / 1000) as unknown as Bounds;
}

export function boundsOfCoordinates(coordinates: unknown): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let invalid = false;

  function visit(value: unknown): void {
    if (!Array.isArray(value) || value.length === 0) {
      invalid = true;
      return;
    }
    if (typeof value[0] === 'number') {
      if (
        value.length < 2 ||
        typeof value[1] !== 'number' ||
        !Number.isFinite(value[0]) ||
        !Number.isFinite(value[1])
      ) {
        invalid = true;
        return;
      }
      minX = Math.min(minX, value[0]);
      minY = Math.min(minY, value[1]);
      maxX = Math.max(maxX, value[0]);
      maxY = Math.max(maxY, value[1]);
      return;
    }
    value.forEach(visit);
  }

  visit(coordinates);
  return invalid || !Number.isFinite(minX) ? null : [minX, minY, maxX, maxY];
}

export function proposedWorkingArea(parcelBounds: Bounds, bufferMetres = 100): Bounds {
  if (!Number.isFinite(bufferMetres) || bufferMetres < 0 || bufferMetres > 500)
    throw new Error('Invalid buffer');
  return [
    parcelBounds[0] - bufferMetres,
    parcelBounds[1] - bufferMetres,
    parcelBounds[2] + bufferMetres,
    parcelBounds[3] + bufferMetres,
  ];
}

export function parcelNumber(id: string): string {
  return id.split('.').at(-1) ?? id;
}

export function centeredArea(center: readonly number[], width: number, height: number): Bounds {
  return roundMapBounds([
    center[0] - width / 2,
    center[1] - height / 2,
    center[0] + width / 2,
    center[1] + height / 2,
  ]);
}

const parcelPlural = new Intl.PluralRules('pl');
export function parcelCountLabel(count: number): string {
  if (count === 0) return 'Bez wybranych działek';
  const kind = parcelPlural.select(count);
  return `${count} ${kind === 'one' ? 'działka' : kind === 'few' ? 'działki' : 'działek'}`;
}
