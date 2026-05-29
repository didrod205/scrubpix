# Contributing to scrubpix

Thanks for taking the time to contribute! 🎉 scrubpix aims to be a small,
dependency-free, **deterministic** tool that handles real binary formats
correctly. Contributions are reviewed with that in mind.

## Getting started

```bash
git clone https://github.com/didrod205/scrubpix.git
cd scrubpix
npm install
```

| Command | What it does |
| ------- | ------------ |
| `npm test` | Run the test suite (Vitest). |
| `npm run test:watch` | Re-run tests on change. |
| `npm run typecheck` | Type-check without emitting. |
| `npm run build` | Build the library (`dist/`). |
| `npm run build:web` | Build the web app (`docs/`). |
| `npm run dev` | Run the web app locally (`vite`). |

## Good contributions

- **New formats** (HEIC, WebP, TIFF) — add a reader/stripper module and wire it
  into `detectFormat`. **Stripping must be lossless** (no pixel re-encoding).
- **More EXIF tags** in `src/tiff.ts`, with the correct Unicode/EXIF name.
- **Web app UX** and docs.

## Rules of the road

1. Every change needs a test. Build byte fixtures **programmatically** (see the
   existing tests) so expectations are exact and reproducible — don't commit
   binary image files.
2. `npm run typecheck` and `npm test` must pass.
3. Keep the public API small and the package **zero-dependency**.
4. Never re-encode pixels when stripping; preserve image data byte-for-byte.

## Reporting bugs

Open an issue with a description (and, if you can, a small **programmatic** byte
fixture or the hex of the problematic segment), the format, and what you
expected vs. got. Please don't attach private photos.

By contributing you agree your contributions are licensed under the project's
[MIT License](./LICENSE).
