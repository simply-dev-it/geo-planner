import { deflateSync } from 'node:zlib';

const TILE_SIZE = 256;
const CHANNELS = 3;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

type Color = readonly [number, number, number];

const COLORS = {
  land: [242, 240, 229],
  block: [232, 228, 216],
  park: [207, 225, 194],
  water: [171, 210, 221],
  minorRoadEdge: [214, 208, 194],
  minorRoad: [255, 253, 247],
  majorRoadEdge: [200, 187, 157],
  majorRoad: [255, 249, 232],
} as const satisfies Record<string, Color>;

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hashCell(x: number, y: number): number {
  let value = Math.imul(x + 1, 0x45d9f3b) ^ Math.imul(y + 1, 0x119de1f3);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

function paint(pixels: Buffer, x: number, y: number, color: Color): void {
  const offset = (y * TILE_SIZE + x) * CHANNELS;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([header, name, data, checksum]);
}

function renderPixels(column: number, row: number): Buffer {
  const pixels = Buffer.alloc(TILE_SIZE * TILE_SIZE * CHANNELS);
  const originX = column * TILE_SIZE;
  const originY = row * TILE_SIZE;

  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const worldX = originX + x;
      const worldY = originY + y;
      const parkX = modulo(worldX, 640);
      const parkY = modulo(worldY, 640);
      const parkCell = hashCell(Math.floor(worldX / 640), Math.floor(worldY / 640));
      let color: Color = COLORS.land;

      if (parkCell % 5 === 0 && parkX >= 90 && parkX <= 330 && parkY >= 110 && parkY <= 360) {
        color = COLORS.park;
      } else {
        const blockX = modulo(worldX, 128);
        const blockY = modulo(worldY, 128);
        if (blockX >= 20 && blockX <= 108 && blockY >= 20 && blockY <= 108) {
          color = COLORS.block;
        }
      }

      const riverY = 500 + 165 * Math.sin(worldX / 410) + 52 * Math.sin(worldX / 145);
      if (Math.abs(worldY - riverY) <= 5) color = COLORS.water;

      const majorVertical = Math.min(modulo(worldX - 275, 640), modulo(275 - worldX, 640));
      const majorHorizontal = Math.min(modulo(worldY - 355, 640), modulo(355 - worldY, 640));
      if (majorVertical <= 7 || majorHorizontal <= 7) color = COLORS.majorRoadEdge;
      if (majorVertical <= 4 || majorHorizontal <= 4) color = COLORS.majorRoad;

      const minorVertical = Math.min(modulo(worldX - 8, 128), modulo(8 - worldX, 128));
      const minorHorizontal = Math.min(modulo(worldY - 10, 128), modulo(10 - worldY, 128));
      if (minorVertical <= 2 || minorHorizontal <= 2) color = COLORS.minorRoadEdge;
      if (minorVertical === 0 || minorHorizontal === 0) color = COLORS.minorRoad;

      paint(pixels, x, y, color);
    }
  }

  return pixels;
}

export function createSyntheticMapTile(column: number, row: number): Buffer {
  return encodeRgbTile(renderPixels(column, row));
}

export function encodeRgbTile(pixels: Buffer): Buffer {
  if (pixels.length !== TILE_SIZE * TILE_SIZE * CHANNELS) throw new Error('Invalid RGB tile size');
  const scanlines = Buffer.alloc((TILE_SIZE * CHANNELS + 1) * TILE_SIZE);
  for (let y = 0; y < TILE_SIZE; y += 1) {
    const scanline = y * (TILE_SIZE * CHANNELS + 1);
    scanlines[scanline] = 0;
    pixels.copy(scanlines, scanline + 1, y * TILE_SIZE * CHANNELS, (y + 1) * TILE_SIZE * CHANNELS);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(TILE_SIZE, 0);
  header.writeUInt32BE(TILE_SIZE, 4);
  header[8] = 8;
  header[9] = 2;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
