// Explicit, offline fixture import. It reads public source snapshots, never manual overlays.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import proj4 from '../../frontend/node_modules/proj4/dist/proj4-src.js';
import WKT from '../../frontend/node_modules/ol/format/WKT.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const destination = join(root, 'backend-simulator/fixtures/ciezkowice');
const source = join(root, 'mapa');
const config = JSON.parse(readFileSync(join(source, 'project-config.json'), 'utf8'));
const sourceCrs =
  '+proj=tmerc +lat_0=0 +lon_0=21 +k=0.999923 +x_0=7500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
const targetCrs =
  '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs';
if (config.crs !== 'EPSG:2178') throw new Error('Unexpected snapshot CRS');
const forward = proj4(sourceCrs, targetCrs),
  inverse = proj4(targetCrs, sourceCrs);
const round = (v) => Math.round(v * 1000) / 1000;
const hashes = {};
const readSource = (relative) => {
  const bytes = readFileSync(join(source, relative));
  hashes[relative] = createHash('sha256').update(bytes).digest('hex');
  return bytes;
};
const normalize = (coords) =>
  typeof coords[0] === 'number' ? forward.forward(coords).map(round) : coords.map(normalize);
const bbox = (coords) => {
  const points = [];
  const walk = (c) => {
    if (typeof c[0] === 'number') points.push(c);
    else c.forEach(walk);
  };
  walk(coords);
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
};
const parcels = readdirSync(join(source, 'sources/parcels'))
  .filter((name) => name.endsWith('.txt'))
  .sort()
  .map((name) => {
    const text = readSource('sources/parcels/' + name).toString('utf8');
    const match = /SRID=2178;([^|\r\n]+)\|([^|\r\n]+)\|([^|\r\n]+)/.exec(text);
    if (!match) throw new Error('Invalid public parcel snapshot: ' + name);
    const geometry = new WKT().readGeometry(match[1]);
    if (!['Polygon', 'MultiPolygon'].includes(geometry.getType()))
      throw new Error('Unsupported parcel geometry');
    const coordinates = normalize(geometry.getCoordinates());
    return {
      id: match[2],
      number: match[3].trim(),
      localityId: '0815239',
      bounds: bbox(coordinates),
      geometry: {
        type: geometry.getType(),
        coordinates,
        crs: 'EPSG:2180',
        axisOrder: 'easting-northing',
      },
      source: 'ARCHIVED_GUGIK_ULDK',
      sourceDataDate: null,
    };
  });
const [sx0, sy0, sx1, sy1] = config.bbox;
const corners = [
  [sx0, sy0],
  [sx0, sy1],
  [sx1, sy0],
  [sx1, sy1],
].map((p) => forward.forward(p));
const nativeBounds = bbox(corners),
  resolution = 0.5;
const bounds = [
  Math.floor(nativeBounds[0] / resolution) * resolution,
  Math.floor(nativeBounds[1] / resolution) * resolution,
  Math.ceil(nativeBounds[2] / resolution) * resolution,
  Math.ceil(nativeBounds[3] / resolution) * resolution,
];
const width = Math.round((bounds[2] - bounds[0]) / resolution),
  height = Math.round((bounds[3] - bounds[1]) / resolution);
readSource('assets/ortho.jpg');
const scratch = mkdtempSync(join(tmpdir(), 'geo-ciezkowice-raster-'));
let pixels;
try {
  const bmpPath = join(scratch, 'ortho.bmp');
  // sips is only an optional macOS import-time decoder. Runtime/build/tests use checked-in RGB bytes.
  execFileSync(
    '/usr/bin/sips',
    ['-s', 'format', 'bmp', join(source, 'assets/ortho.jpg'), '--out', bmpPath],
    { stdio: 'pipe' },
  );
  const bmp = readFileSync(bmpPath),
    offset = bmp.readUInt32LE(10),
    sw = bmp.readInt32LE(18),
    sh = bmp.readInt32LE(22),
    bits = bmp.readUInt16LE(28);
  if (
    bmp.toString('ascii', 0, 2) !== 'BM' ||
    bits !== 24 ||
    bmp.readUInt32LE(30) !== 0 ||
    sw !== config.rasterSize.width ||
    Math.abs(sh) !== config.rasterSize.height
  )
    throw new Error('Expected an uncompressed RGB24 snapshot raster');
  const stride = Math.ceil((sw * 3) / 4) * 4,
    sourceHeight = Math.abs(sh);
  pixels = Buffer.alloc(width * height * 4);
  const sample = (x, y, c) => {
    const row = sh > 0 ? sourceHeight - 1 - y : y;
    return bmp[offset + row * stride + x * 3 + (2 - c)];
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [e, n] = inverse.forward([
        bounds[0] + (x + 0.5) * resolution,
        bounds[3] - (y + 0.5) * resolution,
      ]);
      const px = ((e - sx0) / (sx1 - sx0)) * sw - 0.5,
        py = ((sy1 - n) / (sy1 - sy0)) * sourceHeight - 0.5;
      if (px < 0 || py < 0 || px > sw - 1 || py > sourceHeight - 1) continue;
      const x0 = Math.floor(px),
        y0 = Math.floor(py),
        x1 = Math.min(sw - 1, x0 + 1),
        y1 = Math.min(sourceHeight - 1, y0 + 1),
        dx = px - x0,
        dy = py - y0,
        i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++)
        pixels[i + c] = Math.round(
          sample(x0, y0, c) * (1 - dx) * (1 - dy) +
            sample(x1, y0, c) * dx * (1 - dy) +
            sample(x0, y1, c) * (1 - dx) * dy +
            sample(x1, y1, c) * dx * dy,
        );
      pixels[i + 3] = 255;
    }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
mkdirSync(destination, { recursive: true });
const image = deflateSync(pixels, { level: 9 });
writeFileSync(join(destination, 'ortho.rgba.deflate'), image);
writeFileSync(
  join(destination, 'snapshot.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      label: 'Ciężkowice — archived public-source fragment',
      importedOn: '2026-11-19',
      sourceCrs: 'EPSG:2178',
      crs: 'EPSG:2180',
      axisOrder: 'easting-northing',
      sourceDataDate: null,
      raster: {
        width,
        height,
        bounds,
        resolution,
        encoding: 'deflate-rgba8',
        file: 'ortho.rgba.deflate',
        sha256: createHash('sha256').update(image).digest('hex'),
      },
      sourceHashes: hashes,
      parcels,
      limitations: [
        'Archived subset of 13 ULDK parcel geometries and one orthophoto crop; not full cadastral coverage.',
        'Original source dates are not recorded; import date is not the source observation date.',
        'EPSG:2178 source geometry and imagery normalized to EPSG:2180; indicative use only.',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    parcels: parcels.length,
    raster: { width, height, bounds },
    bytes: image.length,
    controlPoint: proj4(sourceCrs, 'EPSG:4326', [(sx0 + sx1) / 2, (sy0 + sy1) / 2]),
  }),
);
