#!/usr/bin/env node
/**
 * scrubpix command-line interface — zero-dependency.
 *
 *   scrubpix scan   <paths...>     inspect images and print their metadata
 *   scrubpix strip  <paths...>     remove metadata (writes *-clean by default)
 *   scrubpix --help / --version
 *
 * Strips in place with --in-place, or to a directory with --out <dir>.
 * Recurses into directories; only touches .jpg/.jpeg/.png/.webp files.
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { detectFormat, readMetadata, stripMetadata } from "./index.js";

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

interface Options {
  command: "scan" | "strip" | "help" | "version";
  paths: string[];
  inPlace: boolean;
  out: string | null;
  suffix: string;
  json: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    command: "help",
    paths: [],
    inPlace: false,
    out: null,
    suffix: "-clean",
    json: false,
    quiet: false,
  };
  if (argv[0] === "scan" || argv[0] === "strip") opts.command = argv[0];
  else if (argv.includes("--version") || argv.includes("-v")) return { ...opts, command: "version" };
  else if (argv[0] && !argv[0].startsWith("-")) opts.command = "help";

  for (let i = opts.command === "scan" || opts.command === "strip" ? 1 : 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--in-place" || a === "-i") opts.inPlace = true;
    else if (a === "--out" || a === "-o") opts.out = argv[++i] ?? null;
    else if (a === "--suffix") opts.suffix = argv[++i] ?? "-clean";
    else if (a === "--json") opts.json = true;
    else if (a === "--quiet" || a === "-q") opts.quiet = true;
    else if (a === "--help" || a === "-h") opts.command = "help";
    else if (!a.startsWith("-")) opts.paths.push(a);
  }
  return opts;
}

/** Recursively collect image files from the given paths. */
function collect(paths: string[]): string[] {
  const out: string[] = [];
  const walk = (p: string): void => {
    let st;
    try {
      st = statSync(p);
    } catch {
      throw new Error(`path not found: ${p}`);
    }
    if (st.isDirectory()) {
      for (const entry of readdirSync(p)) {
        if (entry.startsWith(".")) continue;
        walk(join(p, entry));
      }
    } else if (st.isFile() && IMAGE_EXT.test(p)) {
      out.push(p);
    }
  };
  for (const p of paths) walk(resolve(p));
  return [...new Set(out)].sort();
}

const c = {
  bold: (s: string) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s: string) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s),
  red: (s: string) => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s: string) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s),
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function relish(p: string): string {
  const cwd = process.cwd();
  return p.startsWith(cwd) ? p.slice(cwd.length + 1) : p;
}

function runScan(files: string[], opts: Options): number {
  const report = files.map((file) => {
    const bytes = readFileSync(file);
    const meta = readMetadata(bytes);
    return {
      file: relish(file),
      format: meta.format,
      hasMetadata: meta.hasMetadata,
      fields: meta.fields,
      gps: meta.gps ?? null,
    };
  });

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return report.some((r) => r.hasMetadata) ? 1 : 0;
  }

  let withMeta = 0;
  let withGps = 0;
  for (const r of report) {
    if (r.format === "unknown") {
      if (!opts.quiet) console.log(`${c.dim("•")} ${r.file} ${c.dim("(unsupported)")}`);
      continue;
    }
    if (!r.hasMetadata) {
      if (!opts.quiet) console.log(`${c.green("✓")} ${r.file} ${c.dim("— clean")}`);
      continue;
    }
    withMeta++;
    const gpsTag = r.gps ? c.red(" 📍 GPS") : "";
    console.log(`${c.yellow("⚠")} ${c.bold(r.file)} — ${r.fields.length} field(s)${gpsTag}`);
    for (const f of r.fields) {
      console.log(`    ${c.dim(f.group.padEnd(6))} ${f.name}: ${String(f.value)}`);
    }
    if (r.gps) {
      withGps++;
      console.log(
        `    ${c.red("→ reveals location:")} https://www.openstreetmap.org/?mlat=${r.gps.latitude}&mlon=${r.gps.longitude}#map=15/${r.gps.latitude}/${r.gps.longitude}`,
      );
    }
  }
  console.log(
    `\n${c.bold("Scanned")} ${report.length} image(s) — ` +
      `${withMeta} with metadata, ${c.red(`${withGps} with GPS`)}.`,
  );
  return withMeta > 0 ? 1 : 0;
}

function destFor(file: string, opts: Options): string {
  if (opts.inPlace) return file;
  const ext = extname(file);
  const name = basename(file, ext);
  if (opts.out) {
    mkdirSync(opts.out, { recursive: true });
    return join(opts.out, `${name}${ext}`);
  }
  return join(dirname(file), `${name}${opts.suffix}${ext}`);
}

function runStrip(files: string[], opts: Options): number {
  let cleaned = 0;
  let totalRemoved = 0;
  for (const file of files) {
    const bytes = readFileSync(file);
    if (detectFormat(bytes) === "unknown") {
      if (!opts.quiet) console.log(`${c.dim("•")} ${relish(file)} ${c.dim("(unsupported)")}`);
      continue;
    }
    const { data, bytesRemoved } = stripMetadata(bytes);
    if (bytesRemoved === 0) {
      if (!opts.quiet) console.log(`${c.green("✓")} ${relish(file)} ${c.dim("— already clean")}`);
      continue;
    }
    const dest = destFor(file, opts);
    writeFileSync(dest, data);
    cleaned++;
    totalRemoved += bytesRemoved;
    console.log(
      `${c.green("✓")} ${relish(file)} → ${c.bold(relish(dest))} ${c.dim(`(removed ${fmtBytes(bytesRemoved)})`)}`,
    );
  }
  console.log(
    `\n${c.bold("Cleaned")} ${cleaned}/${files.length} image(s), removed ${fmtBytes(totalRemoved)} of metadata.`,
  );
  return 0;
}

const HELP = `${c.bold("scrubpix")} — see & strip hidden image metadata, 100% locally.

${c.bold("Usage")}
  scrubpix scan  <paths...>   Inspect images and print their metadata
  scrubpix strip <paths...>   Remove metadata from images

${c.bold("Options")}
  -i, --in-place       Overwrite the original files (strip)
  -o, --out <dir>      Write cleaned files into <dir> (strip)
      --suffix <s>     Suffix for cleaned files (default: -clean)
      --json           Output JSON (scan)
  -q, --quiet          Only show images that have metadata
  -h, --help           Show this help
  -v, --version        Show version

${c.bold("Examples")}
  scrubpix scan photo.jpg
  scrubpix scan ./photos --json
  scrubpix strip ./photos --in-place
  scrubpix strip vacation.png --out ./clean

Paths can be files or directories (recursed). Only .jpg/.jpeg/.png/.webp are touched.
Nothing is ever uploaded — all processing happens on your machine.`;

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.command === "version") {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    console.log(pkg.version);
    return;
  }
  if (opts.command === "help") {
    console.log(HELP);
    return;
  }
  if (opts.paths.length === 0) {
    console.error(`scrubpix: provide at least one file or directory. See ${c.bold("scrubpix --help")}.`);
    process.exit(2);
  }

  try {
    const files = collect(opts.paths);
    if (files.length === 0) {
      console.error("scrubpix: no .jpg/.jpeg/.png/.webp files found in the given path(s).");
      process.exit(2);
    }
    const code = opts.command === "scan" ? runScan(files, opts) : runStrip(files, opts);
    // scan exits 1 when metadata is present (useful as a CI privacy gate).
    process.exit(opts.command === "scan" ? code : 0);
  } catch (e) {
    console.error(`scrubpix: ${(e as Error).message}`);
    process.exit(2);
  }
}

void main();
