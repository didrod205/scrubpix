import { readMetadata, stripMetadata, type MetadataField } from "../src/index";
import { createZip, type ZipEntry } from "./zip";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const fileInput = $<HTMLInputElement>("file");
const results = $<HTMLDivElement>("results");
const cardTpl = $<HTMLTemplateElement>("card-tpl");
const toolbar = $<HTMLElement>("toolbar");
const summaryEl = $<HTMLElement>("summary");
const stripAllBtn = $<HTMLButtonElement>("strip-all");
const clearBtn = $<HTMLButtonElement>("clear");

const fmtBytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

/** One tracked image in the session. */
interface Item {
  file: File;
  bytes: Uint8Array;
  canStrip: boolean;
  hasMetadata: boolean;
}
const items: Item[] = [];
const objectUrls: string[] = [];

function fieldRow(f: MetadataField): string {
  const cls = f.group === "gps" ? "row gps" : "row";
  return `<div class="${cls}"><span class="k">${escape(f.name)}</span><span class="v">${escape(String(f.value))}</span></div>`;
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function cleanName(name: string): string {
  return name.replace(/(\.[^.]+)?$/, "-clean$1");
}

function downloadBlob(data: Uint8Array, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function updateToolbar(): void {
  const strippable = items.filter((i) => i.canStrip && i.hasMetadata).length;
  const withMeta = items.filter((i) => i.hasMetadata).length;
  toolbar.hidden = items.length === 0;
  summaryEl.textContent =
    `${items.length} image(s) · ${withMeta} with metadata` +
    (strippable !== withMeta ? ` · ${strippable} strippable` : "");
  stripAllBtn.disabled = strippable === 0;
  stripAllBtn.textContent =
    strippable > 1 ? `Strip all (${strippable}) & download .zip` : "Strip all & download .zip";
}

async function handleFile(file: File): Promise<void> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const meta = readMetadata(buf);

  const item: Item = {
    file,
    bytes: buf,
    canStrip: meta.canStrip,
    hasMetadata: meta.hasMetadata,
  };
  items.push(item);

  const node = cardTpl.content.cloneNode(true) as DocumentFragment;
  const card = node.querySelector(".card") as HTMLElement;
  (card.querySelector(".name") as HTMLElement).textContent = file.name;

  // Thumbnail preview (browser-decodable formats only).
  const thumb = card.querySelector(".thumb") as HTMLImageElement;
  if (file.type && file.type.startsWith("image/")) {
    const url = URL.createObjectURL(new Blob([buf as BlobPart], { type: file.type }));
    objectUrls.push(url);
    thumb.src = url;
    thumb.hidden = false;
    thumb.addEventListener("error", () => {
      thumb.hidden = true;
    });
  }

  const readOnly = meta.hasMetadata && !meta.canStrip;

  const badge = card.querySelector(".badge") as HTMLElement;
  if (meta.format === "unknown") {
    badge.textContent = "unsupported";
    badge.className = "badge muted";
  } else if (meta.hasMetadata) {
    badge.textContent = `${meta.fields.length} metadata field(s)`;
    badge.className = "badge warn";
  } else {
    badge.textContent = "no metadata ✓";
    badge.className = "badge ok";
  }

  const metaEl = card.querySelector(".meta") as HTMLElement;
  if (meta.fields.length) {
    metaEl.innerHTML = meta.fields.map(fieldRow).join("");
    if (meta.gps) {
      const { latitude, longitude } = meta.gps;
      const link = document.createElement("a");
      link.className = "maplink";
      link.href = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `📍 This photo reveals a location — open in map (${latitude}, ${longitude})`;
      metaEl.prepend(link);
    }
    if (readOnly) {
      const note = document.createElement("p");
      note.className = "readonly-note";
      note.textContent =
        "ℹ️ HEIC is read-only here: scrubpix reveals the metadata but can't rewrite the file safely. Convert to JPEG to strip it.";
      metaEl.append(note);
    }
  } else if (meta.format !== "unknown") {
    metaEl.innerHTML = `<p class="clean">This image has no removable metadata. 🎉</p>`;
  } else {
    metaEl.innerHTML = `<p class="clean">Only JPEG, PNG, WebP and HEIC are supported.</p>`;
  }

  const stripBtn = card.querySelector(".strip") as HTMLButtonElement;
  if (meta.format === "unknown" || !meta.hasMetadata || readOnly) {
    stripBtn.disabled = true;
    stripBtn.textContent = readOnly ? "Read-only (HEIC)" : meta.hasMetadata ? "Strip" : "Already clean";
  }
  stripBtn.addEventListener("click", () => {
    const { data, bytesRemoved } = stripMetadata(buf);
    downloadBlob(data, cleanName(file.name), file.type || "application/octet-stream");
    stripBtn.textContent = `Removed ${fmtBytes(bytesRemoved)} — downloaded ✓`;
    stripBtn.disabled = true;
  });

  results.prepend(card);
  updateToolbar();
}

const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function handleFiles(files: FileList | File[]): void {
  for (const f of Array.from(files)) {
    // Fall back to extension sniffing when the browser doesn't set a type.
    const ok = SUPPORTED.has(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);
    if (ok) void handleFile(f);
  }
}

/** Strip every strippable image and download them together as a .zip. */
function stripAll(): void {
  const entries: ZipEntry[] = [];
  let totalRemoved = 0;
  const usedNames = new Set<string>();
  for (const item of items) {
    if (!item.canStrip || !item.hasMetadata) continue;
    const { data, bytesRemoved } = stripMetadata(item.bytes);
    totalRemoved += bytesRemoved;
    let name = cleanName(item.file.name);
    // Avoid name collisions inside the zip.
    let n = 1;
    while (usedNames.has(name)) name = cleanName(item.file.name).replace(/(\.[^.]+)?$/, `-${n++}$1`);
    usedNames.add(name);
    entries.push({ name, data });
  }
  if (entries.length === 0) return;

  if (entries.length === 1) {
    // A single file downloads directly (nicer than a one-item zip).
    downloadBlob(entries[0]!.data, entries[0]!.name, "application/octet-stream");
  } else {
    const zip = createZip(entries);
    downloadBlob(zip, "scrubpix-clean.zip", "application/zip");
  }
  stripAllBtn.textContent = `Downloaded ${entries.length} clean image(s) — removed ${fmtBytes(totalRemoved)} ✓`;
  stripAllBtn.disabled = true;
}

function clearAll(): void {
  items.length = 0;
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.length = 0;
  results.innerHTML = "";
  updateToolbar();
}

$("pick").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files) handleFiles(fileInput.files);
  fileInput.value = ""; // allow re-picking the same file
});
stripAllBtn.addEventListener("click", stripAll);
clearBtn.addEventListener("click", clearAll);

const drop = $("drop");
["dragover", "dragenter"].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add("over");
  }),
);
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  const files = (e as DragEvent).dataTransfer?.files;
  if (files) handleFiles(files);
});

window.addEventListener("paste", (e) => {
  const files = Array.from((e as ClipboardEvent).clipboardData?.files ?? []);
  if (files.length) handleFiles(files);
});
