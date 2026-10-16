#!/usr/bin/env node
// Spec Growth — compacts openspec/changes/archive/ (v0.9).
// YYYY-MM-DD-* folders older than N days collapse into one line per change
// in archive/YYYY.md (digest, with dedupe). With --apply, folders are deleted
// ONLY if they are clean (no pending changes) and committed in git.
// --force skips "never committed"/"no git", but NEVER deletes dirty content.
// Usage: node scripts/gates/compact-archive.mjs [--root DIR] [--days=90] [--apply] [--force]
// Default: dry-run.
import { readdirSync, readFileSync, existsSync, statSync, rmSync } from "node:fs";
import { join, normalize, relative } from "node:path";
import { execFileSync } from "node:child_process";
import * as lib from "./lib.mjs";

const args = process.argv.slice(2);
const getVal = (n) => {
  const eq = args.find((a) => a.startsWith(n + "="));
  if (eq) return eq.slice(n.length + 1);
  const i = args.indexOf(n);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  return undefined;
};
const daysProvided = getVal("--days");
let days = 90;
if (daysProvided !== undefined) {
  const n = Number(daysProvided);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`--days invalid: '${daysProvided}' (expected a number > 0)`);
    process.exit(1);
  }
  days = n;
}
const apply = args.includes("--apply");
const force = args.includes("--force");
const root = normalize(getVal("--root") || lib.resolveRoot(process.cwd()) || process.cwd());
const archiveDir = join(root, "openspec", "changes", "archive");

if (!existsSync(archiveDir)) {
  console.error(`openspec/changes/archive/ not found under: ${root}`);
  process.exit(1);
}

const cutoff = Date.now() - days * 86400000;
const candidates = [];
for (const name of readdirSync(archiveDir)) {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (!m) continue;
  const p = join(archiveDir, name);
  let st;
  try {
    st = statSync(p);
  } catch {
    continue;
  }
  if (!st.isDirectory()) continue;
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (date.getTime() < cutoff) candidates.push({ name, year: m[1], dir: p });
}

if (!candidates.length) {
  console.log(`Nothing to compact (cutoff: ${days} days).`);
  process.exit(0);
}

function kindOf(dir) {
  const f = join(dir, ".openspec.yaml");
  if (!existsSync(f)) return "?";
  const mm = lib.readText(f).match(/^(?:x-)?kind:\s*(\S+)/m);
  return mm ? mm[1].trim() : "?";
}

function committedCheck(relDir) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%H", "--", relDir], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return out ? { ok: true } : { ok: false, reason: "never committed" };
  } catch {
    return { ok: false, reason: "no git / not verifiable" };
  }
}

const plan = new Map(); // year -> [lines]
const skipped = [];
for (const c of candidates) {
  const rel = relative(root, c.dir).replace(/\\/g, "/");
  const clean = lib.gitDirIsClean(root, rel);
  if (clean === false) {
    skipped.push({ name: c.name, reason: "uncommitted changes — NOT deleted (not even with --force)" });
    continue;
  }
  const safety = committedCheck(rel);
  if (!force && !(clean === true && safety.ok)) {
    skipped.push({
      name: c.name,
      reason: clean === null ? "no git / not verifiable" : safety.ok ? "not verifiable" : safety.reason,
    });
    continue;
  }
  if (!(clean === true && safety.ok)) {
    console.log(`  ⚠ --force: ${c.name} — deletion without git verification (irreversible)`);
  }
  const id = c.name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const line = `- ${c.name.slice(0, 10)} · ${id} · ${kindOf(c.dir)}`;
  if (!plan.has(c.year)) plan.set(c.year, []);
  plan.get(c.year).push(line);
}

console.log(`${apply ? "APPLY" : "DRY-RUN"} — ${candidates.length} candidate(s), ${skipped.length} skipped (cutoff: ${days} days)`);
for (const s of skipped) console.log(`  ⊘ ${s.name} — ${s.reason} (use --force to force)`);

let deleted = 0;
let appended = 0;
for (const [year, lines] of plan) {
  const digest = join(archiveDir, `${year}.md`);
  const existing = existsSync(digest) ? readFileSync(digest, "utf8") : "";
  const fresh = lines.filter((l) => !existing.includes(l));
  console.log(`→ archive/${year}.md (+${fresh.length} new, ${lines.length - fresh.length} already present)`);
  if (!apply) continue;
  const header = `# Archive ${year}\n\nCompacted changes — full text in git history.\n\n`;
  const base = existsSync(digest) ? readFileSync(digest, "utf8") : header;
  if (fresh.length) lib.writeAtomic(digest, base + fresh.join("\n") + "\n");
  else if (!existsSync(digest)) lib.writeAtomic(digest, header);
  appended += fresh.length;
  for (const c of candidates.filter((x) => x.year === year && !skipped.some((s) => s.name === x.name))) {
    rmSync(c.dir, { recursive: true, force: true });
    deleted++;
  }
}

if (apply) {
  console.log(`\nDone: ${deleted} folder(s) deleted, ${appended} new line(s) in digests.`);
  console.log("Commit (the originals remain in git history).");
} else {
  console.log("\nDry-run: to apply, add --apply");
}
