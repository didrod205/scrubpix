# scrubpix — Product & Strategy

Why scrubpix exists, who it's for, how it's positioned, and how it could sustain itself.

## 1. Why this idea

Every photo from a phone carries hidden **EXIF metadata** — GPS coordinates, the
device, lens, exact timestamp, sometimes the owner's name. Post that photo and
you've published your location. Most people have no idea. The few who do reach
for an "remove EXIF online" site — which asks them to **upload the sensitive
photo to a stranger's server**, defeating the entire purpose.

scrubpix flips that: it **reveals** the hidden metadata (with the GPS point shown
on a map so the danger is obvious) and **strips it losslessly**, entirely on your
device. It's a textbook "why didn't I know this?" tool — universal, privacy-
critical, and used whenever you share an image.

It also fits every hard constraint: **AI can't replace it** (metadata is in the
bytes, not the pixels; cloud tools require upload), **no server**, **no API key**,
**runs in the browser or any JS runtime**, immediate value, broad audience.

## 2. Competitor analysis

| Tool | What it does | Gaps scrubpix fills |
| ---- | ------------ | ------------------- |
| "Remove EXIF online" sites | Strip metadata after **upload** | Privacy-defeating upload; ads; often re-encode (quality loss) |
| `exiftool` (Perl) | Powerful read/write of metadata | CLI-only, heavyweight, intimidating for non-devs; not a library/web app |
| `piexifjs`, `exifr` | JS EXIF read (some write) | Read-focused; not a one-call lossless *stripper*; no friendly local app |
| Canvas re-export trick | Drops metadata as a side effect | **Lossy** (recompresses); JPEG quality degrades |
| OS "remove location" (Photos/Files) | Strips on export | Platform-locked, opaque, not scriptable, no PNG text handling |

**Nobody** offers: a dependency-free library + a friendly **local** web app that
**shows** the hidden data (map pin!) and removes it **losslessly**, across JPEG
and PNG.

## 3. Differentiation

1. **Local-first** — the only honest design for a privacy tool. No upload, ever.
2. **Lossless strip** — surgical segment/chunk removal, not re-encoding.
3. **Reveal, then remove** — shows the GPS point on a map so users *see* the risk.
4. **Library + app from one core** — devs embed it; everyone uses the studio.
5. **Zero dependencies, any runtime** — works on raw bytes in browser/Node/Deno/Bun.

## 4. Folder structure

```
scrubpix/
├─ src/        types.ts · tiff.ts (EXIF) · jpeg.ts · png.ts · index.ts
├─ test/       programmatic byte-fixture tests (incl. a geotagged JPEG)
├─ web/        Vite app → docs/ (GitHub Pages)
├─ .github/    ci · release · pages workflows, templates, FUNDING
└─ README · LICENSE · CONTRIBUTING · CODE_OF_CONDUCT · CHANGELOG · PRODUCT
```

## 9. GitHub Topics

```
exif, metadata, strip-exif, remove-exif, exif-remover, gps, privacy,
image-metadata, photo-privacy, jpeg, png, lossless, zero-dependency
```

## 10. Product Hunt launch copy

**Tagline:** See — and remove — the hidden metadata in your photos. Locally, losslessly.

**Description:**
> Your photos quietly carry GPS coordinates, your camera model, exact
> timestamps — and you can't see any of it. "Remove EXIF" websites make you
> upload the sensitive photo to their server, which is backwards.
>
> scrubpix shows you what's hidden (it even drops a pin on the map so you can see
> the location you'd be leaking) and strips it out — losslessly, with no
> re-compression — entirely in your browser. Nothing is uploaded. There's a
> zero-dependency npm library too.
>
> Free & open-source (MIT). 🧼

**First comment (maker):** "I realized a screenshot I shared had my home address
baked into it. So I built a local-only tool that *shows* you that before you post
— and removes it without wrecking the image."

## 11. npm package name

- **Primary:** `scrubpix` (brandable, memorable, covers JPEG + PNG, available).
- Discoverability via keyword topics & SEO (below).

## 12. SEO keyword strategy

Intent-rich queries people actually type:

- "remove exif data", "strip gps from photo", "remove location from picture"
- "exif viewer online", "see metadata in photo", "does my photo have gps"
- "remove exif javascript", "strip metadata node", "exiftool alternative"
- "remove png metadata", "clean image before posting"

Tactics: descriptive `<title>`/meta on the app (done), README phrasing, per-task
docs ("How to remove GPS from a photo"), GitHub topics, and the GitHub Pages app
as an indexable landing page.

## 13. Monetization (without breaking the free, local promise)

Core stays free, open-source, local forever.

1. **Sponsorship** — Lemon Squeezy (wired up), with a clear "where it goes" note.
2. **Pro / integrations** — a paid CLI with built-in decoding & folder batch, a
   desktop drag-folder app, a GitHub Action that fails CI when committed assets
   carry GPS, or a paid "team" build with audit logging.
3. **Funded features** — companies sponsor HEIC/WebP/TIFF support or a
   "verify-clean" certification for compliance workflows.

Guardrails: never upload user images, never add telemetry, never paywall the
existing read/strip functionality.
