export type ImageFormat = "jpeg" | "png" | "webp" | "heic" | "unknown";

export type FieldGroup = "image" | "exif" | "gps" | "text";

export interface MetadataField {
  /** Human-readable label, e.g. "Make", "GPS Latitude". */
  name: string;
  value: string | number;
  group: FieldGroup;
  /** Numeric tag id (for EXIF/TIFF fields). */
  tag?: number;
}

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

export interface Metadata {
  format: ImageFormat;
  /** `true` if any metadata was found. */
  hasMetadata: boolean;
  fields: MetadataField[];
  /** Decoded GPS position, if the image embedded one. */
  gps?: GpsCoordinates;
  /**
   * Whether scrubpix can losslessly strip this format. Some formats (HEIC) are
   * read-only: their metadata can be detected but not safely removed in place.
   */
  canStrip: boolean;
}

export interface StripResult {
  /** The cleaned image bytes (image data preserved losslessly). */
  data: Uint8Array;
  format: ImageFormat;
  /** How many bytes of metadata were removed. */
  bytesRemoved: number;
  /** `false` when the format is read-only (e.g. HEIC) — `data` is unchanged. */
  stripped: boolean;
}
