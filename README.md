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

For the library:

```bash
npm install scrubpix
```

Zero dependencies. ESM + CJS + TypeScript types. Runs in the browser, Node, Deno and Bun.

## Usage

```ts
import { readMetadata, stripMetadata, detectFormat } from "scrubpix";

const bytes = new Uint8Array(await file.arrayBuffer());

// 1) See what's hidden
const meta = readMetadata(bytes);
meta.format;       // "jpeg" | "png" | "unknown"
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

## API

| Function | Description |
| -------- | ----------- |
| `readMetadata(input)` | `{ format, hasMetadata, fields[], gps? }`. |
| `stripMetadata(input)` | `{ data, format, bytesRemoved }` — cleaned bytes. |
| `detectFormat(input)` | `"jpeg" \| "png" \| "unknown"`. |
| `hasMetadata(input)` | Boolean shortcut. |

`input` is a `Uint8Array` or `ArrayBuffer`.

## FAQ

**Is my photo uploaded anywhere?**
No. The web app and library run entirely on your device — no server, no
telemetry, works offline.

**Will stripping reduce image quality?**
No. scrubpix removes metadata segments without touching the compressed image
data, so the result is visually and byte-for-byte identical (just smaller).

**Does it remove the GPS location?**
Yes — GPS lives in the EXIF (JPEG) or `eXIf` chunk (PNG), which scrubpix strips.
The web app even shows you the map pin first, so you can see what you're removing.

**Which formats are supported?**
JPEG and PNG today. HEIC, WebP and TIFF are on the roadmap — [open an issue](https://github.com/didrod205/scrubpix/issues) if you need them.

**Can it strip a whole folder?**
The web app handles multiple files at once; in Node, map `stripMetadata` over
your files.

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

**Where your support goes:** adding formats (HEIC/WebP/TIFF), deeper EXIF tag
coverage, a "verify clean" re-scan, a drag-a-folder batch mode and a CLI,
keeping the free web app online, and fast issue responses.

## License

[MIT](./LICENSE) © scrubpix contributors
