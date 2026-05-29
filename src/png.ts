/**
 * PNG metadata: read text/EXIF/time chunks and strip them **losslessly** by
 * rewriting the chunk stream without the metadata chunks. Critical chunks
 * (IHDR, PLTE, IDAT, IEND, color profile, …) are copied byte-for-byte.
 */

import { parseTiff } from "./tiff.js";
import type { MetadataField, GpsCoordinates } from "./types.js";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Chunks that carry removable metadata. */
const META_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "tIME", "eXIf"]);

export function isPng(b: Uint8Array): boolean {
  return SIGNATURE.every((v, i) => b[i] === v);
}

interface Chunk {
  type: string;
  start: number; // index of the 4-byte length field
  end: number; // index just past the CRC
  data: Uint8Array;
}

function* chunks(b: Uint8Array): Generator<Chunk> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 8;
  while (pos + 8 <= b.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(b[pos + 4]!, b[pos + 5]!, b[pos + 6]!, b[pos + 7]!);
    const dataStart = pos + 8;
    const end = dataStart + len + 4; // + CRC
    if (end > b.length) break;
    yield { type, start: pos, end, data: b.subarray(dataStart, dataStart + len) };
    if (type === "IEND") break;
    pos = end;
  }
}

function decodeLatin1(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i] as number);
  return s;
}

export function readPng(b: Uint8Array): { fields: MetadataField[]; gps?: GpsCoordinates } {
  const fields: MetadataField[] = [];
  let gps: GpsCoordinates | undefined;

  for (const c of chunks(b)) {
    if (c.type === "tEXt") {
      const nul = c.data.indexOf(0);
      const key = decodeLatin1(c.data.subarray(0, nul < 0 ? 0 : nul));
      const val = decodeLatin1(c.data.subarray(nul + 1)).trim();
      fields.push({ name: key || "Text", value: val || "present", group: "text" });
    } else if (c.type === "iTXt") {
      const nul = c.data.indexOf(0);
      const key = new TextDecoder().decode(c.data.subarray(0, nul < 0 ? 0 : nul));
      fields.push({ name: key || "Text (iTXt)", value: "present", group: "text" });
    } else if (c.type === "zTXt") {
      const nul = c.data.indexOf(0);
      const key = decodeLatin1(c.data.subarray(0, nul < 0 ? 0 : nul));
      fields.push({ name: key || "Text (compressed)", value: "present", group: "text" });
    } else if (c.type === "tIME") {
      fields.push({ name: "Modify Date", value: "present", group: "text" });
    } else if (c.type === "eXIf") {
      const parsed = parseTiff(c.data);
      fields.push(...parsed.fields);
      if (parsed.gps) gps = parsed.gps;
    }
  }
  return { fields, gps };
}

/** Rewrite the PNG without its metadata chunks; everything else is byte-identical. */
export function stripPng(b: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [Uint8Array.from(SIGNATURE)];
  for (const c of chunks(b)) {
    if (META_CHUNKS.has(c.type)) continue;
    keep.push(b.subarray(c.start, c.end));
  }
  const total = keep.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of keep) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
