import { describe, expect, it } from "vitest";
import { createZip } from "../web/zip.js";

const enc = new TextEncoder();

/** Read a little-endian uint32 from a byte array. */
const u32 = (b: Uint8Array, at: number): number =>
  (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;
const u16 = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8);

describe("createZip (store)", () => {
  const entries = [
    { name: "a.txt", data: enc.encode("hello world") },
    { name: "b.bin", data: Uint8Array.from([1, 2, 3, 4, 5]) },
  ];
  const zip = createZip(entries);

  it("starts with a local file header signature", () => {
    expect(u32(zip, 0)).toBe(0x04034b50);
  });

  it("ends with an end-of-central-directory record", () => {
    const eocdAt = zip.length - 22;
    expect(u32(zip, eocdAt)).toBe(0x06054b50);
    expect(u16(zip, eocdAt + 10)).toBe(entries.length); // total entries
  });

  it("contains a central directory with one record per entry", () => {
    let count = 0;
    for (let i = 0; i + 4 <= zip.length; i++) if (u32(zip, i) === 0x02014b50) count++;
    expect(count).toBe(entries.length);
  });

  it("stores uncompressed (method 0) with matching sizes", () => {
    // First local header: compressed size (offset 18) == uncompressed (offset 22).
    expect(u16(zip, 8)).toBe(0); // method = store
    expect(u32(zip, 18)).toBe(entries[0]!.data.length);
    expect(u32(zip, 22)).toBe(entries[0]!.data.length);
  });

  it("embeds the file names", () => {
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("a.txt");
    expect(text).toContain("b.bin");
  });

  it("computes a non-zero CRC for non-empty data", () => {
    expect(u32(zip, 14)).not.toBe(0); // CRC field of the first local header
  });

  it("handles an empty entry list", () => {
    const empty = createZip([]);
    expect(u32(empty, 0)).toBe(0x06054b50); // just the EOCD
    expect(empty.length).toBe(22);
  });
});
