# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/didrod205/scrubpix/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/didrod205/scrubpix/releases/tag/v0.1.0
