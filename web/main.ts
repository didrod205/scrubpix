import { readMetadata, stripMetadata, type MetadataField } from "../src/index";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const fileInput = $<HTMLInputElement>("file");
const results = $<HTMLDivElement>("results");
const cardTpl = $<HTMLTemplateElement>("card-tpl");

const fmtBytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

function fieldRow(f: MetadataField): string {
  const cls = f.group === "gps" ? "row gps" : "row";
  return `<div class="${cls}"><span class="k">${escape(f.name)}</span><span class="v">${escape(String(f.value))}</span></div>`;
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

async function handleFile(file: File): Promise<void> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const meta = readMetadata(buf);

  const node = cardTpl.content.cloneNode(true) as DocumentFragment;
  const card = node.querySelector(".card") as HTMLElement;
  (card.querySelector(".name") as HTMLElement).textContent = file.name;

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
  } else if (meta.format !== "unknown") {
    metaEl.innerHTML = `<p class="clean">This image has no removable metadata. 🎉</p>`;
  } else {
    metaEl.innerHTML = `<p class="clean">Only JPEG, PNG and WebP are supported.</p>`;
  }

  const stripBtn = card.querySelector(".strip") as HTMLButtonElement;
  if (meta.format === "unknown" || !meta.hasMetadata) {
    stripBtn.disabled = true;
    stripBtn.textContent = meta.hasMetadata ? "Strip" : "Already clean";
  }
  stripBtn.addEventListener("click", () => {
    const { data, bytesRemoved } = stripMetadata(buf);
    const blob = new Blob([data as BlobPart], { type: file.type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/(\.[^.]+)?$/, "-clean$1");
    a.click();
    URL.revokeObjectURL(url);
    stripBtn.textContent = `Removed ${fmtBytes(bytesRemoved)} — downloaded ✓`;
    stripBtn.disabled = true;
  });

  results.prepend(card);
}

const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp"]);

function handleFiles(files: FileList | File[]): void {
  for (const f of Array.from(files)) {
    // Fall back to extension sniffing when the browser doesn't set a type.
    const ok = SUPPORTED.has(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
    if (ok) void handleFile(f);
  }
}

$("pick").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files) handleFiles(fileInput.files);
});

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
