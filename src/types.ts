export type ImageFormat = "jpeg" | "png" | "webp" | "unknown";

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
  /** `true` if any removable metadata was found. */
  hasMetadata: boolean;
  fields: MetadataField[];
  /** Decoded GPS position, if the image embedded one. */
  gps?: GpsCoordinates;
}

export interface StripResult {
  /** The cleaned image bytes (image data preserved losslessly). */
  data: Uint8Array;
  format: ImageFormat;
  /** How many bytes of metadata were removed. */
  bytesRemoved: number;
}
