# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0]

### Added

- **HEIC / HEIF support (read-only).** Detect HEIC (incl. iPhone photos) and read
  their EXIF — camera, timestamps and **GPS** — by walking the ISOBMFF box tree
  (`meta` → `iinf`/`infe` → `iloc` → `mdat`/`idat`). Validated against real Apple
  HEIC files.
- `canStrip(format)` helper and a `canStrip` field on `readMetadata` results;
  `stripMetadata` now returns `stripped` (false for read-only formats).
- CLI and web app surface HEIC's read-only nature: `scan` reveals the metadata
  (and warns on GPS); `strip` refuses to rewrite HEIC (and says why) so the
  original file is never corrupted.
- `isHeic` / `readHeic` exported.

### Changed

- `ImageFormat` now includes `"heic"`.
- **HEIC is intentionally not stripped:** its EXIF is referenced by absolute
  `iloc` offsets into `mdat`, so removing it safely would require rewriting the
  whole offset table. scrubpix shows the metadata instead of risking corruption.

## [0.2.0]

### Added

- **WebP support** — read and losslessly strip `EXIF` (incl. GPS) and `XMP`
  chunks from WebP (RIFF) images; the VP8/VP8L bitstream, `ICCP` color profile
  and `VP8X` header are preserved, and the `VP8X` EXIF/XMP flags are cleared.
- **Command-line interface** (`scrubpix` bin), zero-dependency:
  - `scrubpix scan <paths...>` — inspect images, print metadata, warn on GPS with
    a map link; exits non-zero when metadata is present (CI privacy gate);
    `--json` for machine-readable output.
  - `scrubpix strip <paths...>` — remove metadata, writing `*-clean` files by
    default, or in place (`-i`), or into a directory (`-o <dir>`).
  - Recurses directories; only touches `.jpg/.jpeg/.png/.webp`.
- Low-level per-format helpers exported: `isJpeg/readJpeg/stripJpeg`,
  `isPng/readPng/stripPng`, `isWebp/readWebp/stripWebp`, `parseTiff`.
- Web app now accepts WebP (drop/paste/pick).

### Changed

- `ImageFormat` now includes `"webp"`.

## [0.1.0]

### Added

- Initial release.
- `readMetadata(input)` — read EXIF (camera, lens, dates, **GPS**), XMP, IPTC and
  comments from JPEG, and `tEXt`/`zTXt`/`iTXt`/`tIME`/`eXIf` from PNG.
- `stripMetadata(input)` — **lossless** removal (no re-encoding): drops JPEG
  `APPn`/comment segments and PNG metadata chunks while preserving image data
  byte-for-byte. Returns `bytesRemoved`.
- `detectFormat(input)` and `hasMetadata(input)`.
- GPS decoded to decimal degrees.
- Free, local-only web app (drop/paste/drag photos, see a map pin, download clean
  copies) deployed to GitHub Pages.
- Zero runtime dependencies; ESM + CJS + TypeScript types.

[Unreleased]: https://github.com/didrod205/scrubpix/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/didrod205/scrubpix/releases/tag/v0.3.0
[0.2.0]: https://github.com/didrod205/scrubpix/releases/tag/v0.2.0
[0.1.0]: https://github.com/didrod205/scrubpix/releases/tag/v0.1.0
