/**
 * WebP metadata: read EXIF/XMP chunks and strip them **losslessly** by
 * rewriting the RIFF chunk stream without the metadata chunks. The image
 * bitstream (VP8 / VP8L / ALPH / ANMF) and the color profile (ICCP) are copied
 * byte-for-byte. When an extended-format header (VP8X) is present, the EXIF/XMP
 * presence flags are cleared so the result is a valid, clean WebP.
 *
 * WebP layout: "RIFF" <u32 size> "WEBP" then a sequence of chunks, each
 * { FourCC[4], u32le size, data[size], pad to even }.
 */

import { parseTiff } from "./tiff.js";
import type { GpsCoordinates, MetadataField } from "./types.js";

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

/** Metadata chunks that are safe to remove. ICCP (color profile) is kept. */
const META_CHUNKS = new Set(["EXIF", "XMP "]);

// VP8X feature flag bits (byte 0 of the VP8X chunk).
const FLAG_EXIF = 0x08;
const FLAG_XMP = 0x04;

export function isWebp(b: Uint8Array): boolean {
  return (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // "RIFF"
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // "WEBP"
  );
}

interface Chunk {
  fourcc: string;
  /** index of the FourCC */
  start: number;
  /** index just past the data + padding */
  end: number;
  data: Uint8Array;
}

function* chunks(b: Uint8Array): Generator<Chunk> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 12;
  while (pos + 8 <= b.length) {
    const fourcc = String.fromCharCode(b[pos]!, b[pos + 1]!, b[pos + 2]!, b[pos + 3]!);
    const size = dv.getUint32(pos + 4, true);
    const dataStart = pos + 8;
    if (dataStart + size > b.length) break;
    const padded = size + (size & 1); // chunks are padded to even length
    yield { fourcc, start: pos, end: dataStart + padded, data: b.subarray(dataStart, dataStart + size) };
    pos = dataStart + padded;
  }
}

function startsWith(b: Uint8Array, sig: number[]): boolean {
  if (b.length < sig.length) return false;
  return sig.every((v, i) => b[i] === v);
}

export function readWebp(b: Uint8Array): { fields: MetadataField[]; gps?: GpsCoordinates } {
  const fields: MetadataField[] = [];
  let gps: GpsCoordinates | undefined;

  for (const c of chunks(b)) {
    if (c.fourcc === "EXIF") {
      const tiff = startsWith(c.data, EXIF_HEADER) ? c.data.subarray(EXIF_HEADER.length) : c.data;
      const parsed = parseTiff(tiff);
      fields.push(...parsed.fields);
      if (parsed.gps) gps = parsed.gps;
    } else if (c.fourcc === "XMP ") {
      fields.push({ name: "XMP metadata", value: "present", group: "text" });
    } else if (c.fourcc === "ICCP") {
      // Color profile is not privacy-relevant; note it but never strip it.
      // (Intentionally not reported as removable metadata.)
    }
  }
  return { fields, gps };
}

/** Rewrite the WebP without EXIF/XMP chunks; clear VP8X flags; fix RIFF size. */
export function stripWebp(b: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [];
  let removed = false;

  for (const c of chunks(b)) {
    if (META_CHUNKS.has(c.fourcc)) {
      removed = true;
      continue;
    }
    if (c.fourcc === "VP8X") {
      // Clear EXIF/XMP presence flags so the header stays consistent.
      const copy = b.slice(c.start, c.end);
      copy[8] = (copy[8]! & ~(FLAG_EXIF | FLAG_XMP)) & 0xff; // flags byte = data[0] = start+8
      kept.push(copy);
    } else {
      kept.push(b.subarray(c.start, c.end));
    }
  }

  if (!removed) return b.slice();

  const body = kept.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(12 + body);
  // "RIFF"
  out[0] = 0x52; out[1] = 0x49; out[2] = 0x46; out[3] = 0x46;
  // size = everything after the first 8 bytes
  const riffSize = 4 + body; // "WEBP" + chunks
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >> 8) & 0xff;
  out[6] = (riffSize >> 16) & 0xff;
  out[7] = (riffSize >>> 24) & 0xff;
  // "WEBP"
  out[8] = 0x57; out[9] = 0x45; out[10] = 0x42; out[11] = 0x50;
  let offset = 12;
  for (const part of kept) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
