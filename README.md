<div align="center">

# 🧼 scrubpix

### See — and remove — the hidden metadata in your photos. Locally, losslessly.

[![npm version](https://img.shields.io/npm/v/scrubpix.svg?color=success)](https://www.npmjs.com/package/scrubpix)
[![bundle size](https://img.shields.io/bundlephobia/minzip/scrubpix?label=gzip)](https://bundlephobia.com/package/scrubpix)
[![CI](https://github.com/didrod205/scrubpix/actions/workflows/ci.yml/badge.svg)](https://github.com/didrod205/scrubpix/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/scrubpix.svg)](https://www.npmjs.com/package/scrubpix)
[![license](https://img.shields.io/npm/l/scrubpix.svg)](./LICENSE)

**[🌐 Try the free web app →](https://didrod205.github.io/scrubpix/)** &nbsp;·&nbsp; drop a photo, see what it reveals, download a clean copy. Nothing uploaded.

</div>

---

That photo you're about to post probably knows **exactly where you took it.**
Phone cameras embed **EXIF metadata** in every image: GPS coordinates, the
device and lens, the precise date & time, sometimes your name. Screenshots and
exported graphics can carry editor history and comments too. You can't see any
of it — but anyone who downloads the file can.

**scrubpix** shows you that hidden metadata and **strips it out** — and it does
the removal **losslessly** (it surgically removes the metadata segments instead
of re-encoding, so your image quality is byte-for-byte untouched). All **100%
locally**: your photo never leaves your device.

> 📸 _Screenshot / demo GIF:_ `./web/screenshot.png` — record the [live app](https://didrod205.github.io/scrubpix/) dropping a geotagged photo, revealing the map pin, and downloading the clean copy.

## Why it exists

- **The irony of "remove EXIF online" sites:** they make you *upload your
  sensitive photo to a stranger's server*. A privacy tool must run locally.
  scrubpix does.
- **AI can't do this.** Metadata lives in the file's bytes, not its pixels — a
  vision model can't read it, and asking a chatbot to "strip EXIF" is meaningless
  without the file. It's a precise, binary problem for a small, deterministic tool.
- **Lossless matters.** The common "draw to canvas and re-export" trick *does*
  remove metadata — by re-compressing and degrading your image. scrubpix keeps
  the original image data intact.

## Who it's for

**Anyone who shares images:** creators & photographers (don't leak your home
location), marketers (clean brand assets), journalists & activists (protect
sources), ops/support (sanitize screenshots), and everyday people posting to
the web. Plus developers who want a tiny, dependency-free metadata library.

## Install

**No install —** just open the **[web app](https://didrod205.github.io/scrubpix/)**.

**Command line** (clean a whole folder in one shot):

```bash
npx scrubpix scan ./photos        # see what's hidden (flags GPS!)
npx scrubpix strip ./photos -i    # strip every image in place
```

**Library:**

```bash
npm install scrubpix
```

Zero runtime dependencies. ESM + CJS + TypeScript types. Runs in the browser, Node, Deno and Bun.

## CLI

```bash
scrubpix scan  <paths...>    # inspect images, print metadata, warn on GPS
scrubpix strip <paths...>    # remove metadata (writes *-clean by default)
```

```text
$ scrubpix scan ./photos
✓ photos/clean.png — clean
⚠ photos/vacation.jpg — 2 field(s) 📍 GPS
    gps    GPS Latitude: 37.5
    gps    GPS Longitude: 127
    → reveals location: https://www.openstreetmap.org/?mlat=37.5&mlon=127#map=15/37.5/127

Scanned 3 image(s) — 1 with metadata, 1 with GPS.
```

| Option | Description |
| ------ | ----------- |
| `-i, --in-place` | Overwrite the originals (strip) |
| `-o, --out <dir>` | Write cleaned files into a directory |
| `--suffix <s>` | Suffix for cleaned files (default `-clean`) |
| `--json` | Machine-readable output (scan) |
| `-q, --quiet` | Only show images that have metadata |

Paths can be **files or directories** (recursed). `scan` exits non-zero when any
image still has metadata — drop it into CI as a **privacy gate** so a geotagged
asset never lands in your repo.

## Usage

```ts
import { readMetadata, stripMetadata, detectFormat } from "scrubpix";

const bytes = new Uint8Array(await file.arrayBuffer());

// 1) See what's hidden
const meta = readMetadata(bytes);
meta.format;       // "jpeg" | "png" | "webp" | "heic" | "unknown"
meta.gps;          // { latitude: 37.5, longitude: 127.0 }  ← if geotagged
meta.fields;       // [{ name: "Make", value: "Apple", group: "image" }, ...]

// 2) Remove it — losslessly
const { data, bytesRemoved } = stripMetadata(bytes);
// `data` is a clean Uint8Array with identical pixels; save/download it.
```

### Node

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { stripMetadata } from "scrubpix";

const { data } = stripMetadata(readFileSync("photo.jpg"));
writeFileSync("photo-clean.jpg", data);
```

### Browser download

```ts
const { data } = stripMetadata(bytes);
const url = URL.createObjectURL(new Blob([data], { type: file.type }));
// trigger a download with <a download> …
```

## What it reads & removes

| Format | Reads | Strips (losslessly) |
| ------ | ----- | ------------------- |
| **JPEG** | EXIF (camera, lens, dates, **GPS**), XMP, IPTC, comments | All `APPn` (n≥1) + comment segments; image scan preserved |
| **PNG** | `tEXt` / `zTXt` / `iTXt`, `tIME`, `eXIf` (incl. GPS) | All text/time/EXIF chunks; IHDR/IDAT/PLTE/IEND preserved |
| **WebP** | `EXIF` (incl. GPS), `XMP` chunks | `EXIF`/`XMP` chunks; VP8/VP8L bitstream, `ICCP` profile & `VP8X` header preserved |
| **HEIC** _(read-only)_ | EXIF (camera, dates, **GPS**), XMP — via the ISOBMFF `iloc`/`iinf` item table | _Not stripped — see note below_ |

> **Why HEIC is read-only:** in HEIC the EXIF bytes live in `mdat`, referenced by
> absolute offsets in the `iloc` box. Removing them means recomputing every
> offset — one mistake corrupts the photo. scrubpix won't take that risk: it
> **shows** you what an iPhone HEIC reveals (e.g. your GPS location) but won't
> rewrite the file. `canStrip` is `false` and `stripMetadata` returns the bytes
> unchanged (`stripped: false`). Convert to JPEG to strip.

## API

| Function | Description |
| -------- | ----------- |
| `readMetadata(input)` | `{ format, hasMetadata, fields[], gps?, canStrip }`. |
| `stripMetadata(input)` | `{ data, format, bytesRemoved, stripped }` — cleaned bytes. |
| `detectFormat(input)` | `"jpeg" \| "png" \| "webp" \| "heic" \| "unknown"`. |
| `canStrip(format)` | Whether scrubpix can losslessly strip this format (HEIC → `false`). |
| `hasMetadata(input)` | Boolean shortcut. |

`input` is a `Uint8Array` or `ArrayBuffer`. Low-level helpers
(`readJpeg`/`stripJpeg`, `readWebp`/`stripWebp`, `readHeic`, `parseTiff`, …) are
also exported for advanced use.

## FAQ

**Is my photo uploaded anywhere?**
No. The web app and library run entirely on your device — no server, no
telemetry, works offline.

**Will stripping reduce image quality?**
No. scrubpix removes metadata segments without touching the compressed image
data, so the result is visually and byte-for-byte identical (just smaller).

**Does it remove the GPS location?**
Yes — GPS lives in the EXIF (JPEG/WebP) or `eXIf` chunk (PNG), which scrubpix
strips. The web app even shows you the map pin first, so you can see what you're
removing.

**Which formats are supported?**
JPEG, PNG and WebP are fully supported (read **and** lossless strip). **HEIC**
(iPhone photos) is **read-only**: scrubpix detects and shows its metadata —
including GPS — but won't rewrite the file (see the note above). Standalone TIFF
is on the roadmap.

**Can it remove GPS from my iPhone HEIC photo?**
It will *show* you the GPS the HEIC embeds so you know it's there, but it won't
strip it in place (that risks corrupting the file). The reliable fix today:
convert the HEIC to JPEG, then `scrubpix strip` it.

**Can it strip a whole folder?**
Yes — `scrubpix strip ./photos -i` recurses a directory and cleans every image.
The web app also handles multiple files at once.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md).

```bash
git clone https://github.com/didrod205/scrubpix.git
cd scrubpix
npm install
npm test          # run the suite
npm run dev       # run the web app locally
```

## 💖 Sponsor

scrubpix is free, MIT-licensed, and built in spare time. If it kept your
location (or your client's) off the internet, please consider supporting it:

- ⭐ **Star this repo** — free, and it genuinely helps others find it.
- 🍋 **[Sponsor via Lemon Squeezy](https://elab-studio.lemonsqueezy.com/checkout/buy/5d059b89-51d0-456b-b33a-ed56994f7010)** — one-time or recurring support.

**Where your support goes:** more formats (HEIC/TIFF), deeper EXIF tag coverage,
a "verify clean" re-scan in the web app, drag-a-folder batch mode, keeping the
free web app online, and fast issue responses.

## License

[MIT](./LICENSE) © scrubpix contributors
