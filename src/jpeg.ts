/**
 * JPEG metadata: read the EXIF segment and strip metadata **losslessly** by
 * removing APPn (n≥1) and comment markers without re-encoding the image —
 * so pixel data and quality are byte-for-byte preserved.
 */

import { parseTiff } from "./tiff.js";
import type { MetadataField, GpsCoordinates } from "./types.js";

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

export function isJpeg(b: Uint8Array): boolean {
  return b.length > 2 && b[0] === 0xff && b[1] === 0xd8;
}

function matches(b: Uint8Array, at: number, sig: number[]): boolean {
  return sig.every((v, i) => b[at + i] === v);
}

export function readJpeg(b: Uint8Array): { fields: MetadataField[]; gps?: GpsCoordinates } {
  let pos = 2;
  const all: MetadataField[] = [];
  let gps: GpsCoordinates | undefined;

  while (pos + 4 < b.length) {
    if (b[pos] !== 0xff) break;
    const marker = b[pos + 1] as number;
    if (marker === 0xda || marker === 0xd9) break; // SOS or EOI → image data begins
    const len = ((b[pos + 2] as number) << 8) | (b[pos + 3] as number);
    const segStart = pos + 4;

    if (marker === 0xe1 && matches(b, segStart, EXIF_HEADER)) {
      const tiff = b.subarray(segStart + EXIF_HEADER.length, pos + 2 + len);
      const parsed = parseTiff(tiff);
      all.push(...parsed.fields);
      if (parsed.gps) gps = parsed.gps;
    } else if (marker === 0xe1) {
      all.push({ name: "XMP / extended metadata", value: "present", group: "text" });
    } else if (marker === 0xed) {
      all.push({ name: "IPTC metadata", value: "present", group: "text" });
    } else if (marker === 0xfe) {
      const text = new TextDecoder().decode(b.subarray(segStart, pos + 2 + len)).trim();
      all.push({ name: "Comment", value: text || "present", group: "text" });
    }
    pos += 2 + len;
  }
  return { fields: all, gps };
}

/** Remove all APPn (n≥1) and COM segments; keep APP0/JFIF and the image verbatim. */
export function stripJpeg(b: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let pos = 2;

  while (pos + 1 < b.length) {
    if (b[pos] !== 0xff) {
      // Malformed; copy the remainder verbatim.
      for (let i = pos; i < b.length; i++) out.push(b[i] as number);
      return Uint8Array.from(out);
    }
    const marker = b[pos + 1] as number;

    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      return Uint8Array.from(out);
    }
    if (marker === 0xda) {
      // Start of scan: copy from here to the end verbatim (entropy data + EOI).
      for (let i = pos; i < b.length; i++) out.push(b[i] as number);
      return Uint8Array.from(out);
    }
    // Standalone markers (RSTn, TEM) have no length.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(0xff, marker);
      pos += 2;
      continue;
    }

    const len = ((b[pos + 2] as number) << 8) | (b[pos + 3] as number);
    const segEnd = pos + 2 + len;
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe; // APP1–APP15, COM
    if (!drop) {
      for (let i = pos; i < segEnd && i < b.length; i++) out.push(b[i] as number);
    }
    pos = segEnd;
  }
  return Uint8Array.from(out);
}
