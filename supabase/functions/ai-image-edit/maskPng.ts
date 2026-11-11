/**
 * Brush-mask rasterizer.
 *
 * The app records finger strokes as normalized points (0..1) plus a normalized
 * radius. This module turns them into a real PNG at the exact pixel size of the
 * image being inpainted, so ComfyUI's `LoadImage` -> `ImageToMask` gets a mask
 * that lines up 1:1 with the photo.
 *
 * The PNG is 8-bit grayscale (color type 0): white = repaint, black = keep.
 */

export type MaskStroke = {
  /** Normalized [x, y] pairs, 0..1 relative to image width/height. */
  points: Array<[number, number]>;
  /** Normalized radius relative to image width. */
  r: number;
};

const MAX_STROKES = 400;
const MAX_POINTS_PER_STROKE = 4000;
const MAX_TOTAL_POINTS = 20000;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function sanitizeStrokes(raw: unknown): MaskStroke[] {
  if (!Array.isArray(raw)) return [];

  const strokes: MaskStroke[] = [];
  let totalPoints = 0;

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const points = Array.isArray(rec.points) ? rec.points : [];
    const radius = Number(rec.r);

    const clean: Array<[number, number]> = [];
    for (const point of points) {
      if (!Array.isArray(point) || point.length < 2) continue;
      clean.push([clamp01(Number(point[0])), clamp01(Number(point[1]))]);
      totalPoints += 1;
      if (clean.length >= MAX_POINTS_PER_STROKE || totalPoints >= MAX_TOTAL_POINTS) break;
    }

    if (clean.length === 0) continue;
    strokes.push({
      points: clean,
      r: Math.min(0.25, Math.max(0.002, Number.isFinite(radius) ? radius : 0.03)),
    });

    if (strokes.length >= MAX_STROKES || totalPoints >= MAX_TOTAL_POINTS) break;
  }

  return strokes;
}

/** Distance from point (px, py) to segment (x0,y0)-(x1,y1). */
function distanceToSegment(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x0, py - y0);

  let t = ((px - x0) * dx + (py - y0) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

function paintDisc(mask: Uint8Array, width: number, height: number, cx: number, cy: number, r: number) {
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(width - 1, Math.ceil(cx + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(height - 1, Math.ceil(cy + r));
  const rSq = r * r;

  for (let y = minY; y <= maxY; y++) {
    const dy = y + 0.5 - cy;
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= rSq) mask[y * width + x] = 255;
    }
  }
}

function paintSegment(
  mask: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number
) {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - r));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1) + r));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - r));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1) + r));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (distanceToSegment(x + 0.5, y + 0.5, x0, y0, x1, y1) <= r) {
        mask[y * width + x] = 255;
      }
    }
  }
}

function rasterize(width: number, height: number, strokes: MaskStroke[]): Uint8Array {
  const mask = new Uint8Array(width * height);

  for (const stroke of strokes) {
    const radius = Math.max(1, stroke.r * width);
    const points = stroke.points.map(([x, y]) => [x * width, y * height] as [number, number]);

    if (points.length === 1) {
      paintDisc(mask, width, height, points[0][0], points[0][1], radius);
      continue;
    }

    for (let i = 1; i < points.length; i++) {
      paintSegment(
        mask,
        width,
        height,
        points[i - 1][0],
        points[i - 1][1],
        points[i][0],
        points[i][1],
        radius
      );
    }
  }

  return mask;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** zlib-wrapped deflate, which is what PNG IDAT requires. */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * Builds an 8-bit grayscale PNG mask.
 * Returns null when there are no usable strokes, so callers can fall back to
 * an automatic segmentation mask instead of sending an all-black mask.
 */
export async function buildBrushMaskPng(
  width: number,
  height: number,
  rawStrokes: unknown
): Promise<Uint8Array | null> {
  const strokes = sanitizeStrokes(rawStrokes);
  if (strokes.length === 0) return null;

  const w = Math.max(8, Math.floor(width));
  const h = Math.max(8, Math.floor(height));
  const mask = rasterize(w, h, strokes);

  // If every pixel is black the flood-fill would be a no-op; treat as missing.
  let painted = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      painted += 1;
      if (painted > 32) break;
    }
  }
  if (painted === 0) return null;

  const rowBytes = 1 + w;
  const raw = new Uint8Array(rowBytes * h);
  for (let y = 0; y < h; y++) {
    raw[y * rowBytes] = 0; // filter: none
    raw.set(mask.subarray(y * w, y * w + w), y * rowBytes + 1);
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, w);
  ihdrView.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const idat = await deflate(raw);

  const parts = [
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }

  return png;
}
