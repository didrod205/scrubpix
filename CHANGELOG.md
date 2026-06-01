# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/didrod205/scrubpix/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/didrod205/scrubpix/releases/tag/v0.2.0
[0.1.0]: https://github.com/didrod205/scrubpix/releases/tag/v0.1.0
