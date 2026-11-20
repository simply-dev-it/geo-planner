type Point = readonly [number, number];
type Ring = readonly Point[];
type Polygon = readonly Ring[];
type Rect = readonly [number, number, number, number];
function polygons(value: unknown): Polygon[] {
  if (!value || typeof value !== 'object') return [];
  const g = value as { type?: string; coordinates?: unknown };
  if (!Array.isArray(g.coordinates)) return [];
  return g.type === 'Polygon'
    ? [g.coordinates as Polygon]
    : g.type === 'MultiPolygon'
      ? (g.coordinates as Polygon[])
      : [];
}
function inRing(point: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(cross) < 1e-8 &&
      point[0] >= Math.min(a[0], b[0]) &&
      point[0] <= Math.max(a[0], b[0]) &&
      point[1] >= Math.min(a[1], b[1]) &&
      point[1] <= Math.max(a[1], b[1])
    )
      return true;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function fixtureContainsPoint(value: unknown, point: Point): boolean {
  return polygons(value).some(
    (rings) =>
      rings.length > 0 && inRing(point, rings[0]!) && !rings.slice(1).some((r) => inRing(point, r)),
  );
}
function clippedArea(ring: Ring, bounds: Rect): number {
  let points: Point[] = [...ring];
  for (const [axis, edge, greater] of [
    [0, bounds[0], true],
    [0, bounds[2], false],
    [1, bounds[1], true],
    [1, bounds[3], false],
  ] as const) {
    const output: Point[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length]!,
        b = points[i]!;
      const ai = greater ? a[axis] >= edge : a[axis] <= edge,
        bi = greater ? b[axis] >= edge : b[axis] <= edge;
      if (ai !== bi) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        output.push(
          axis === 0 ? [edge, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), edge],
        );
      }
      if (bi) output.push(b);
    }
    points = output;
  }
  // Shift the origin before the shoelace sum to avoid cancellation at national-grid coordinates.
  const origin = points[0];
  if (!origin) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    area += (a[0] - origin[0]) * (b[1] - origin[1]) - (b[0] - origin[0]) * (a[1] - origin[1]);
  }
  return Math.abs(area) / 2;
}
export function fixtureIntersectsArea(value: unknown, bounds: Rect): boolean {
  return polygons(value).some(
    (rings) =>
      rings.length > 0 &&
      clippedArea(rings[0]!, bounds) -
        rings.slice(1).reduce((sum, r) => sum + clippedArea(r, bounds), 0) >
        1e-6,
  );
}
