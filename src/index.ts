/**
 * scrubpix — see and strip the hidden metadata (EXIF, GPS, comments) in your
 * images, losslessly and 100% locally.
 *
 * Zero dependencies. Works on raw bytes (`Uint8Array`/`ArrayBuffer`), so it runs
 * in the browser, Node, Deno and Bun — and never uploads your photo anywhere.
 */

import { isJpeg, readJpeg, stripJpeg } from "./jpeg.js";
import { isPng, readPng, stripPng } from "./png.js";
import { isWebp, readWebp, stripWebp } from "./webp.js";
import { isHeic, readHeic } from "./heic.js";
import type { ImageFormat, Metadata, StripResult } from "./types.js";

export type {
  ImageFormat,
  Metadata,
  MetadataField,
  FieldGroup,
  GpsCoordinates,
  StripResult,
} from "./types.js";

// Low-level per-format helpers, for advanced use.
export { isJpeg, readJpeg, stripJpeg } from "./jpeg.js";
export { isPng, readPng, stripPng } from "./png.js";
export { isWebp, readWebp, stripWebp } from "./webp.js";
export { isHeic, readHeic } from "./heic.js";
export { parseTiff } from "./tiff.js";

/** Formats whose metadata scrubpix can losslessly remove. HEIC is read-only. */
const STRIPPABLE = new Set<ImageFormat>(["jpeg", "png", "webp"]);

/** Can scrubpix losslessly strip metadata from this format? */
export function canStrip(format: ImageFormat): boolean {
  return STRIPPABLE.has(format);
}

function toBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/** Detect the image format from its magic bytes. */
export function detectFormat(input: Uint8Array | ArrayBuffer): ImageFormat {
  const b = toBytes(input);
  if (isJpeg(b)) return "jpeg";
  if (isPng(b)) return "png";
  if (isWebp(b)) return "webp";
  if (isHeic(b)) return "heic";
  return "unknown";
}

/**
 * Read the metadata embedded in an image (EXIF, GPS, comments, text chunks).
 *
 * ```ts
 * const meta = readMetadata(bytes);
 * meta.gps;     // { latitude, longitude } if the photo is geotagged
 * meta.fields;  // [{ name: "Make", value: "Apple", group: "image" }, ...]
 * ```
 */
export function readMetadata(input: Uint8Array | ArrayBuffer): Metadata {
  const b = toBytes(input);
  const format = detectFormat(b);
  const { fields, gps } =
    format === "jpeg"
      ? readJpeg(b)
      : format === "png"
        ? readPng(b)
        : format === "webp"
          ? readWebp(b)
          : format === "heic"
            ? readHeic(b)
            : { fields: [], gps: undefined };
  return { format, hasMetadata: fields.length > 0, fields, gps, canStrip: canStrip(format) };
}

/**
 * Return a copy of the image with all removable metadata stripped — losslessly
 * (no re-encoding; pixel data is preserved exactly).
 *
 * ```ts
 * const { data, bytesRemoved } = stripMetadata(bytes);
 * // `data` is a clean image you can download/save; `bytesRemoved` > 0 if it had metadata.
 * ```
 */
export function stripMetadata(input: Uint8Array | ArrayBuffer): StripResult {
  const b = toBytes(input);
  const format = detectFormat(b);
  if (!canStrip(format)) {
    // Read-only formats (HEIC) or unknown: return the bytes unchanged.
    return { data: b.slice(), format, bytesRemoved: 0, stripped: false };
  }
  const data =
    format === "jpeg" ? stripJpeg(b) : format === "png" ? stripPng(b) : stripWebp(b);
  return { data, format, bytesRemoved: b.length - data.length, stripped: true };
}

/** Convenience: does this image carry any removable metadata? */
export function hasMetadata(input: Uint8Array | ArrayBuffer): boolean {
  return readMetadata(input).hasMetadata;
}
