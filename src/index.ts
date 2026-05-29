/**
 * scrubpix — see and strip the hidden metadata (EXIF, GPS, comments) in your
 * images, losslessly and 100% locally.
 *
 * Zero dependencies. Works on raw bytes (`Uint8Array`/`ArrayBuffer`), so it runs
 * in the browser, Node, Deno and Bun — and never uploads your photo anywhere.
 */

import { isJpeg, readJpeg, stripJpeg } from "./jpeg.js";
import { isPng, readPng, stripPng } from "./png.js";
import type { ImageFormat, Metadata, StripResult } from "./types.js";

export type {
  ImageFormat,
  Metadata,
  MetadataField,
  FieldGroup,
  GpsCoordinates,
  StripResult,
} from "./types.js";

function toBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/** Detect the image format from its magic bytes. */
export function detectFormat(input: Uint8Array | ArrayBuffer): ImageFormat {
  const b = toBytes(input);
  if (isJpeg(b)) return "jpeg";
  if (isPng(b)) return "png";
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
  const { fields, gps } = format === "jpeg" ? readJpeg(b) : format === "png" ? readPng(b) : { fields: [], gps: undefined };
  return { format, hasMetadata: fields.length > 0, fields, gps };
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
  const data = format === "jpeg" ? stripJpeg(b) : format === "png" ? stripPng(b) : b.slice();
  return { data, format, bytesRemoved: b.length - data.length };
}

/** Convenience: does this image carry any removable metadata? */
export function hasMetadata(input: Uint8Array | ArrayBuffer): boolean {
  return readMetadata(input).hasMetadata;
}
