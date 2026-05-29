import { describe, expect, it } from "vitest";
import { detectFormat, readMetadata, stripMetadata } from "../src/index.js";

// --- byte builders ---
const flat = (...parts: Array<number[] | Uint8Array>): Uint8Array =>
  Uint8Array.from(parts.flatMap((p) => Array.from(p)));
const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const rat = (num: number, den: number) => [...u32le(num), ...u32le(den)];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

// TIFF (little-endian) with a single ASCII "Make" = "AB"
const makeTiff = flat(
  ascii("II"), u16le(42), u32le(8),
  u16le(1),
  [...u16le(0x010f), ...u16le(2), ...u32le(3), 0x41, 0x42, 0x00, 0x00],
  u32le(0),
);

// TIFF with a GPS sub-IFD encoding 37.5° N, 127.0° E
const gpsIFD = flat(
  u16le(4),
  [...u16le(0x0001), ...u16le(2), ...u32le(2), 0x4e, 0, 0, 0], // GPSLatitudeRef "N"
  [...u16le(0x0002), ...u16le(5), ...u32le(3), ...u32le(80)], // GPSLatitude → offset 80
  [...u16le(0x0003), ...u16le(2), ...u32le(2), 0x45, 0, 0, 0], // GPSLongitudeRef "E"
  [...u16le(0x0004), ...u16le(5), ...u32le(3), ...u32le(104)], // GPSLongitude → offset 104
  u32le(0),
);
const gpsTiff = flat(
  ascii("II"), u16le(42), u32le(8),
  u16le(1),
  [...u16le(0x8825), ...u16le(4), ...u32le(1), ...u32le(26)], // GPS IFD pointer → offset 26
  u32le(0),
  gpsIFD, // at 26 (len 54) → ends at 80
  flat(rat(37, 1), rat(30, 1), rat(0, 1)), // lat at 80
  flat(rat(127, 1), rat(0, 1), rat(0, 1)), // lon at 104
);

function jpegWithExif(tiff: Uint8Array): Uint8Array {
  const app1len = 2 + 6 + tiff.length;
  return flat(
    [0xff, 0xd8],
    [0xff, 0xe1], u16be(app1len), ascii("Exif"), [0, 0], tiff,
    [0xff, 0xda, 0x00, 0x04, 0xaa, 0xbb], // start of scan
    [0xcc, 0xdd], // entropy data
    [0xff, 0xd9], // EOI
  );
}

const pngChunk = (type: string, data: number[]) =>
  flat(u32be(data.length), ascii(type), data, [0, 0, 0, 0]);
const pngWithText = flat(
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  pngChunk("IHDR", [...u32be(1), ...u32be(1), 8, 2, 0, 0, 0]),
  pngChunk("tEXt", [...ascii("Author"), 0, ...ascii("Jane Doe")]),
  pngChunk("IDAT", [0x78, 0x9c, 0x00]),
  pngChunk("IEND", []),
);

const includes = (hay: Uint8Array, needle: number[]): boolean => {
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((v, j) => hay[i + j] === v)) return true;
  }
  return false;
};

describe("detectFormat", () => {
  it("identifies JPEG, PNG and unknown", () => {
    expect(detectFormat(jpegWithExif(makeTiff))).toBe("jpeg");
    expect(detectFormat(pngWithText)).toBe("png");
    expect(detectFormat(Uint8Array.from([1, 2, 3, 4]))).toBe("unknown");
  });
});

describe("readMetadata — JPEG/EXIF", () => {
  it("reads an ASCII EXIF tag", () => {
    const meta = readMetadata(jpegWithExif(makeTiff));
    expect(meta.hasMetadata).toBe(true);
    expect(meta.fields.find((f) => f.name === "Make")?.value).toBe("AB");
  });

  it("decodes GPS coordinates to decimal degrees", () => {
    const meta = readMetadata(jpegWithExif(gpsTiff));
    expect(meta.gps).toEqual({ latitude: 37.5, longitude: 127 });
  });
});

describe("stripMetadata — JPEG", () => {
  const jpeg = jpegWithExif(makeTiff);
  const result = stripMetadata(jpeg);

  it("removes the APP1/EXIF segment", () => {
    expect(result.bytesRemoved).toBeGreaterThan(0);
    expect(includes(result.data, [0xff, 0xe1])).toBe(false);
    expect(readMetadata(result.data).hasMetadata).toBe(false);
  });

  it("preserves the image data losslessly (scan + EOI intact)", () => {
    expect(result.data[0]).toBe(0xff);
    expect(result.data[1]).toBe(0xd8);
    expect(includes(result.data, [0xff, 0xda, 0x00, 0x04, 0xaa, 0xbb, 0xcc, 0xdd])).toBe(true);
    expect(includes(result.data, [0xff, 0xd9])).toBe(true);
  });

  it("is idempotent (re-stripping removes nothing)", () => {
    expect(stripMetadata(result.data).bytesRemoved).toBe(0);
  });
});

describe("PNG metadata", () => {
  it("reads a tEXt chunk", () => {
    const meta = readMetadata(pngWithText);
    expect(meta.fields.find((f) => f.name === "Author")?.value).toBe("Jane Doe");
  });

  it("strips text chunks but keeps critical chunks", () => {
    const { data, bytesRemoved } = stripMetadata(pngWithText);
    expect(bytesRemoved).toBeGreaterThan(0);
    expect(includes(data, ascii("tEXt"))).toBe(false);
    expect(includes(data, ascii("IHDR"))).toBe(true);
    expect(includes(data, ascii("IDAT"))).toBe(true);
    expect(includes(data, ascii("IEND"))).toBe(true);
  });
});
