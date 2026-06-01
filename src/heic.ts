/**
 * HEIC / HEIF (ISOBMFF) metadata — **READ-ONLY**.
 *
 * HEIC stores EXIF as an item inside the `meta` box, with the actual bytes
 * living in `mdat` and located via the `iloc` box. We walk the box tree, find
 * the `Exif` item, locate its payload, and decode the embedded TIFF/EXIF
 * (camera, timestamps, **GPS**) using the shared TIFF reader.
 *
 * Stripping HEIC losslessly requires rewriting every `iloc` offset (removing
 * bytes from `mdat` shifts all other items), which is error-prone enough to
 * risk corrupting the image — so it is intentionally **not** supported here.
 * `canStrip("heic")` returns false. Reading still warns users that, e.g., an
 * iPhone photo embeds their GPS location.
 */

import { parseTiff } from "./tiff.js";
import type { GpsCoordinates, MetadataField } from "./types.js";

const HEIC_BRANDS = /^(heic|heix|heim|heis|hevc|hevx|mif1|msf1|heif|avif)$/;

function fourcc(b: Uint8Array, at: number): string {
  return String.fromCharCode(b[at] ?? 0, b[at + 1] ?? 0, b[at + 2] ?? 0, b[at + 3] ?? 0);
}

export function isHeic(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  if (fourcc(b, 4) !== "ftyp") return false;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const size = Math.min(dv.getUint32(0), b.length);
  const brands = new Set<string>([fourcc(b, 8)]); // major brand
  for (let p = 16; p + 4 <= size; p += 4) brands.add(fourcc(b, p));
  for (const brand of brands) if (HEIC_BRANDS.test(brand)) return true;
  return false;
}

interface Box {
  type: string;
  start: number;
  dataStart: number;
  end: number;
}

function* boxes(b: Uint8Array, start: number, end: number): Generator<Box> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = start;
  while (pos + 8 <= end) {
    let size = dv.getUint32(pos);
    const type = fourcc(b, pos + 4);
    let dataStart = pos + 8;
    if (size === 1) {
      // 64-bit extended size.
      const hi = dv.getUint32(pos + 8);
      const lo = dv.getUint32(pos + 12);
      size = hi * 2 ** 32 + lo;
      dataStart = pos + 16;
    } else if (size === 0) {
      size = end - pos;
    }
    const boxEnd = pos + size;
    if (size < 8 || boxEnd > end) break;
    yield { type, start: pos, dataStart, end: boxEnd };
    pos = boxEnd;
  }
}

function findBox(b: Uint8Array, start: number, end: number, type: string): Box | undefined {
  for (const box of boxes(b, start, end)) if (box.type === type) return box;
  return undefined;
}

/** Read an unsigned big-endian integer of `size` bytes at `p`. */
function readUint(b: Uint8Array, p: number, size: number): number {
  let v = 0;
  for (let i = 0; i < size; i++) v = v * 256 + (b[p + i] ?? 0);
  return v;
}

/** Find the item id whose `infe` item_type matches `wanted` (e.g. "Exif"). */
function findItemId(b: Uint8Array, iinf: Box, wanted: string): number | null {
  const version = b[iinf.dataStart] ?? 0;
  let p = iinf.dataStart + 4; // skip version + flags
  // entry_count (16-bit for v0, 32-bit otherwise) — value unused, we iterate boxes.
  p += version === 0 ? 2 : 4;

  for (const box of boxes(b, p, iinf.end)) {
    if (box.type !== "infe") continue;
    const v = b[box.dataStart] ?? 0;
    let q = box.dataStart + 4; // skip version + flags
    let id: number;
    if (v === 2) {
      id = readUint(b, q, 2);
      q += 2;
    } else if (v === 3) {
      id = readUint(b, q, 4);
      q += 4;
    } else {
      continue; // versions 0/1 use a different layout (rare for HEIC items)
    }
    q += 2; // item_protection_index
    if (fourcc(b, q) === wanted) return id;
  }
  return null;
}

interface ItemLocation {
  /** Absolute file offset (for construction_method 0). */
  offset: number;
  length: number;
  /** 0 = file offset (mdat), 1 = relative to the `idat` box. */
  method: number;
}

function findItemLocation(b: Uint8Array, iloc: Box, itemId: number): ItemLocation | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const version = b[iloc.dataStart] ?? 0;
  let p = iloc.dataStart + 4; // skip version + flags

  const b1 = b[p] ?? 0;
  const b2 = b[p + 1] ?? 0;
  p += 2;
  const offsetSize = (b1 >> 4) & 0xf;
  const lengthSize = b1 & 0xf;
  const baseOffsetSize = (b2 >> 4) & 0xf;
  const indexSize = b2 & 0xf; // version 1/2 only

  let itemCount: number;
  if (version < 2) {
    itemCount = dv.getUint16(p);
    p += 2;
  } else {
    itemCount = dv.getUint32(p);
    p += 4;
  }

  const take = (size: number): number => {
    const v = readUint(b, p, size);
    p += size;
    return v;
  };

  for (let i = 0; i < itemCount; i++) {
    let id: number;
    if (version < 2) {
      id = dv.getUint16(p);
      p += 2;
    } else {
      id = dv.getUint32(p);
      p += 4;
    }
    let method = 0;
    if (version === 1 || version === 2) {
      method = dv.getUint16(p) & 0xf; // 12 bits reserved + 4 bits construction_method
      p += 2;
    }
    p += 2; // data_reference_index
    const baseOffset = take(baseOffsetSize);
    const extentCount = dv.getUint16(p);
    p += 2;

    let found: ItemLocation | null = null;
    for (let e = 0; e < extentCount; e++) {
      if ((version === 1 || version === 2) && indexSize > 0) take(indexSize); // extent_index
      const extentOffset = take(offsetSize);
      const extentLength = take(lengthSize);
      if (id === itemId && e === 0) {
        found = { offset: baseOffset + extentOffset, length: extentLength, method };
      }
    }
    if (found) return found;
  }
  return null;
}

/** Locate the TIFF header inside an EXIF item payload (robust to the offset field). */
function findTiffStart(b: Uint8Array, from: number, end: number): number {
  const limit = Math.min(from + 64, end - 4);
  for (let p = from; p <= limit; p++) {
    const ok =
      (b[p] === 0x49 && b[p + 1] === 0x49 && b[p + 2] === 0x2a && b[p + 3] === 0x00) || // "II" 42
      (b[p] === 0x4d && b[p + 1] === 0x4d && b[p + 2] === 0x00 && b[p + 3] === 0x2a); // "MM" 42
    if (ok) return p;
  }
  return -1;
}

export function readHeic(b: Uint8Array): { fields: MetadataField[]; gps?: GpsCoordinates } {
  const meta = findBox(b, 0, b.length, "meta");
  if (!meta) return { fields: [] };
  // `meta` is a FullBox: skip its version + flags before the child boxes.
  const metaStart = meta.dataStart + 4;

  const iinf = findBox(b, metaStart, meta.end, "iinf");
  const iloc = findBox(b, metaStart, meta.end, "iloc");
  if (!iinf || !iloc) return { fields: [] };

  const fields: MetadataField[] = [];
  let gps: GpsCoordinates | undefined;

  const exifId = findItemId(b, iinf, "Exif");
  if (exifId !== null) {
    const loc = findItemLocation(b, iloc, exifId);
    if (loc && loc.length > 0) {
      let payloadStart = loc.offset;
      let payloadEnd = loc.offset + loc.length;
      if (loc.method === 1) {
        // Offsets are relative to the `idat` box's data.
        const idat = findBox(b, metaStart, meta.end, "idat");
        if (idat) {
          payloadStart = idat.dataStart + loc.offset;
          payloadEnd = payloadStart + loc.length;
        }
      }
      if (payloadEnd <= b.length) {
        // Skip the 4-byte exif_tiff_header_offset field, then find the TIFF header.
        const tiffStart = findTiffStart(b, payloadStart + 4, payloadEnd);
        if (tiffStart !== -1) {
          const parsed = parseTiff(b.subarray(tiffStart, payloadEnd));
          fields.push(...parsed.fields);
          if (parsed.gps) gps = parsed.gps;
        }
      }
    }
  }

  // XMP (stored as a "mime" item) — note its presence.
  const xmpId = findItemId(b, iinf, "mime");
  if (xmpId !== null) fields.push({ name: "XMP metadata", value: "present", group: "text" });

  return { fields, gps };
}
