/**
 * Minimal TIFF/EXIF reader — walks IFD0, the EXIF sub-IFD and the GPS sub-IFD
 * and extracts the high-value, privacy-relevant tags (camera, software,
 * timestamps and GPS location).
 */

import type { GpsCoordinates, MetadataField } from "./types.js";

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

const IMAGE_TAGS: Record<number, string> = {
  0x010f: "Make",
  0x0110: "Model",
  0x0112: "Orientation",
  0x0131: "Software",
  0x0132: "Modify Date",
  0x013b: "Artist",
  0x8298: "Copyright",
  0x9c9b: "Title",
  0x9c9c: "Comment",
};

const EXIF_TAGS: Record<number, string> = {
  0x9003: "Date Taken",
  0x9004: "Create Date",
  0xa002: "Image Width",
  0xa003: "Image Height",
  0x829a: "Exposure Time",
  0x829d: "F Number",
  0x8827: "ISO",
  0x920a: "Focal Length",
  0xa433: "Lens Make",
  0xa434: "Lens Model",
  0x001d: "GPS Date",
};

const GPS_TAGS: Record<number, string> = {
  0x0006: "GPS Altitude",
  0x0012: "GPS Map Datum",
  0x001d: "GPS Date",
};

const EXIF_IFD_POINTER = 0x8769;
const GPS_IFD_POINTER = 0x8825;

interface Entry {
  tag: number;
  type: number;
  count: number;
  valueAbs: number;
}

export function parseTiff(buf: Uint8Array): { fields: MetadataField[]; gps?: GpsCoordinates } {
  const fields: MetadataField[] = [];
  if (buf.length < 8) return { fields };

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const byte0 = buf[0];
  const le = byte0 === 0x49; // 'I' = little-endian, 'M' = big-endian
  if (!le && byte0 !== 0x4d) return { fields };

  const u16 = (abs: number) => dv.getUint16(abs, le);
  const u32 = (abs: number) => dv.getUint32(abs, le);
  const i32 = (abs: number) => dv.getInt32(abs, le);

  if (u16(2) !== 42) return { fields };

  const readIFD = (ifdAbs: number): Entry[] => {
    if (ifdAbs + 2 > buf.length) return [];
    const n = u16(ifdAbs);
    const entries: Entry[] = [];
    for (let i = 0; i < n; i++) {
      const e = ifdAbs + 2 + i * 12;
      if (e + 12 > buf.length) break;
      entries.push({ tag: u16(e), type: u16(e + 2), count: u32(e + 4), valueAbs: e + 8 });
    }
    return entries;
  };

  const dataStart = (e: Entry): number => {
    const size = TYPE_SIZE[e.type] ?? 0;
    const total = size * e.count;
    return total <= 4 ? e.valueAbs : u32(e.valueAbs);
  };

  const readAscii = (e: Entry): string => {
    const start = dataStart(e);
    let s = "";
    for (let i = 0; i < e.count && start + i < buf.length; i++) {
      const c = buf[start + i] as number;
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  };

  const readNumbers = (e: Entry): number[] => {
    const start = dataStart(e);
    const out: number[] = [];
    for (let i = 0; i < e.count; i++) {
      if (e.type === 3) out.push(u16(start + i * 2));
      else if (e.type === 4) out.push(u32(start + i * 4));
      else if (e.type === 9) out.push(i32(start + i * 4));
      else if (e.type === 5) {
        const num = u32(start + i * 8);
        const den = u32(start + i * 8 + 4);
        out.push(den === 0 ? 0 : num / den);
      } else if (e.type === 10) {
        const num = i32(start + i * 8);
        const den = i32(start + i * 8 + 4);
        out.push(den === 0 ? 0 : num / den);
      }
    }
    return out;
  };

  const readValue = (e: Entry): string | number | null => {
    if (e.type === 2) return readAscii(e);
    const nums = readNumbers(e);
    if (nums.length === 0) return null;
    if (nums.length === 1) return Math.round((nums[0] as number) * 10000) / 10000;
    return nums.map((n) => Math.round(n * 10000) / 10000).join(", ");
  };

  const collect = (entries: Entry[], names: Record<number, string>, group: MetadataField["group"]) => {
    for (const e of entries) {
      const name = names[e.tag];
      if (!name) continue;
      const value = readValue(e);
      if (value !== null && value !== "") fields.push({ name, value, group, tag: e.tag });
    }
  };

  const ifd0 = readIFD(8);
  collect(ifd0, IMAGE_TAGS, "image");

  const exifPtr = ifd0.find((e) => e.tag === EXIF_IFD_POINTER);
  if (exifPtr) collect(readIFD(u32(exifPtr.valueAbs)), EXIF_TAGS, "exif");

  const gpsPtr = ifd0.find((e) => e.tag === GPS_IFD_POINTER);
  let gps: GpsCoordinates | undefined;
  if (gpsPtr) {
    const gpsEntries = readIFD(u32(gpsPtr.valueAbs));
    collect(gpsEntries, GPS_TAGS, "gps");

    const byTag = new Map(gpsEntries.map((e) => [e.tag, e]));
    const dms = (e?: Entry): number | null => {
      if (!e) return null;
      const n = readNumbers(e);
      if (n.length < 3) return null;
      return (n[0] as number) + (n[1] as number) / 60 + (n[2] as number) / 3600;
    };
    const lat = dms(byTag.get(0x0002));
    const lon = dms(byTag.get(0x0004));
    if (lat !== null && lon !== null) {
      const latRef = byTag.get(0x0001) ? readAscii(byTag.get(0x0001) as Entry) : "N";
      const lonRef = byTag.get(0x0003) ? readAscii(byTag.get(0x0003) as Entry) : "E";
      const latitude = (latRef.toUpperCase() === "S" ? -1 : 1) * lat;
      const longitude = (lonRef.toUpperCase() === "W" ? -1 : 1) * lon;
      gps = { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 };
      fields.push({ name: "GPS Latitude", value: gps.latitude, group: "gps" });
      fields.push({ name: "GPS Longitude", value: gps.longitude, group: "gps" });
    }
  }

  return { fields, gps };
}
