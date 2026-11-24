import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { CIEZKOWICE_SNAPSHOT, isSnapshotNeighbourhood } from './snapshot-data.js';
import { PUBLIC_SNAPSHOT, publicNeighbourhood } from './public-snapshot.js';
import { createSyntheticMapTile, encodeRgbTile } from './fixture-map.js';

let rgba: Buffer | undefined;
const cache = new Map<string, { body: Buffer; marker: string }>();
function line(pixels: Buffer, a: readonly number[], b: readonly number[]) {
  let t0 = 0,
    t1 = 1;
  const dx = b[0]! - a[0]!,
    dy = b[1]! - a[1]!;
  const ps = [-dx, dx, -dy, dy],
    qs = [a[0]!, 255 - a[0]!, a[1]!, 255 - a[1]!];
  for (let i = 0; i < 4; i++) {
    const p = ps[i]!,
      q = qs[i]!;
    if (p === 0) {
      if (q < 0) return;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return;
    }
  }
  let x = Math.round(a[0]! + t0 * dx),
    y = Math.round(a[1]! + t0 * dy);
  const x1 = Math.round(a[0]! + t1 * dx),
    y1 = Math.round(a[1]! + t1 * dy),
    ax = Math.abs(x1 - x),
    ay = -Math.abs(y1 - y),
    sx = x < x1 ? 1 : -1,
    sy = y < y1 ? 1 : -1;
  let error = ax + ay;
  for (;;) {
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        if (x + ox < 0 || x + ox > 255 || y + oy < 0 || y + oy > 255) continue;
        const i = ((y + oy) * 256 + x + ox) * 3;
        pixels[i] = ox === 0 && oy === 0 ? 252 : 199;
        pixels[i + 1] = ox === 0 && oy === 0 ? 252 : 203;
        pixels[i + 2] = ox === 0 && oy === 0 ? 248 : 194;
      }
    if (x === x1 && y === y1) break;
    const e = 2 * error;
    if (e >= ay) {
      error += ay;
      x += sx;
    }
    if (e <= ax) {
      error += ax;
      y += sy;
    }
  }
}
export function createFixtureTile(
  z: number,
  x: number,
  y: number,
): { body: Buffer; marker: string } {
  const span = 3000000 / 2 ** z,
    e0 = -1000000 + x * span,
    n1 = 2000000 - y * span,
    bounds = [e0, n1 - span, e0 + span, n1];
  if (z < 9 || (!isSnapshotNeighbourhood(bounds) && !publicNeighbourhood(bounds)))
    return { body: createSyntheticMapTile(x, y), marker: 'schematic-map-256px-png' };
  const key = `${z}/${x}/${y}`,
    cached = cache.get(key);
  if (cached) return cached;
  const raster = CIEZKOWICE_SNAPSHOT.raster;
  if (!rgba) {
    const packed = readFileSync(
      new URL('../fixtures/ciezkowice/ortho.rgba.deflate', import.meta.url),
    );
    if (createHash('sha256').update(packed).digest('hex') !== raster.sha256)
      throw new Error('Snapshot raster checksum mismatch');
    rgba = inflateSync(packed, { maxOutputLength: raster.width * raster.height * 4 });
    if (rgba.length !== raster.width * raster.height * 4)
      throw new Error('Snapshot raster dimensions mismatch');
  }
  const pixels = Buffer.alloc(256 * 256 * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = 236;
    pixels[i + 1] = 238;
    pixels[i + 2] = 232;
  }
  for (const street of PUBLIC_SNAPSHOT.streets)
    for (const path of street.paths)
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!,
          b = path[i]!;
        line(
          pixels,
          [((a[0] - e0) / span) * 256, ((n1 - a[1]) / span) * 256],
          [((b[0] - e0) / span) * 256, ((n1 - b[1]) / span) * 256],
        );
      }
  let imagePixels = 0;
  for (let row = 0; row < 256; row++)
    for (let col = 0; col < 256; col++) {
      const e = e0 + ((col + 0.5) * span) / 256,
        n = n1 - ((row + 0.5) * span) / 256,
        sx = Math.floor((e - raster.bounds[0]) / raster.resolution),
        sy = Math.floor((raster.bounds[3] - n) / raster.resolution),
        src = (sy * raster.width + sx) * 4;
      if (sx >= 0 && sy >= 0 && sx < raster.width && sy < raster.height && rgba[src + 3]) {
        const i = (row * 256 + col) * 3;
        pixels[i] = rgba[src]!;
        pixels[i + 1] = rgba[src + 1]!;
        pixels[i + 2] = rgba[src + 2]!;
        imagePixels++;
      }
    }
  const result = {
    body: encodeRgbTile(pixels),
    marker: imagePixels
      ? 'archived-ciezkowice-orthophoto-256px-png'
      : 'captured-public-vectors-256px-png',
  };
  cache.set(key, result);
  if (cache.size > 128) cache.delete(cache.keys().next().value!);
  return result;
}
