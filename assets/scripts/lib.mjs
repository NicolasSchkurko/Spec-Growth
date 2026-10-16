// Spec Growth — shared utilities for the gates (v0.9).
// No external dependencies. YAML parser: system's own subset.
// Case policy: ALL path/glob comparisons are case-insensitive
// (normalized to lowercase); documented in SKILL.md.
import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, statSync, lstatSync } from "node:fs";
import { join, relative, normalize } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export const clean = (s) => String(s).trim().replace(/^["']|["']$/g, "").trim();
export const arr = (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);

// Code extensions scanned for citations (@cita REQ-...) inside directories.
export const CODE_EXTS = new Set([
  ".kt", ".java", ".ts", ".tsx", ".js", ".jsx", ".py", ".cs", ".rs", ".go", ".dart",
  ".rb", ".php", ".swift", ".m", ".mm", ".c", ".h", ".cc", ".cpp", ".hpp", ".scala", ".sql",
]);

// --- text: always without BOM (with per-run read cache) ---
const textCache = new Map();
export function readText(file) {
  if (textCache.has(file)) return textCache.get(file);
  let t = readFileSync(file, "utf8");
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  textCache.set(file, t);
  return t;
}

const stripInlineComment = (s) => {
  const t = s.trim();
  if (/^["'].*["']$/.test(t)) return t;
  const i = t.search(/\s#/);
  return (i >= 0 ? t.slice(0, i) : t).trim();
};

// Subset parser. `errors` (optional): array where unparsed lines
// { line, text } get recorded (and duplicate keys).
// opts.reportNestedUnder (optional Set): when given, nested lines are only reported
// if they belong to one of these parent keys (used by config.yaml: OpenSpec-owned
// sections like `rules:` are not gate data and must not add noise).
// Supports scalar blocks (| and >): their content is captured in the value.
export function parseYaml(text, errors = null, opts = {}) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const out = {};
  let currentKey = null;
  let currentItem = null;
  let blockKey = null;
  let blockIndent = -1;
  let blockBase = null;
  let blockLines = [];
  const lines = text.split(/\r?\n/);
  const report = (i, raw) => {
    if (errors) errors.push({ line: i + 1, text: raw.trim() });
  };
  const finalizeBlock = () => {
    if (blockKey !== null) {
      out[blockKey] = blockLines.join("\n").trimEnd();
      blockKey = null;
      blockLines = [];
      blockIndent = -1;
      blockBase = null;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    const indent = raw.length - raw.trimStart().length;
    if (blockKey !== null) {
      if (!t || indent > blockIndent) {
        if (blockBase === null && t) blockBase = indent;
        blockLines.push(raw.slice(Math.min(raw.length, blockBase === null ? indent : blockBase)));
        continue;
      }
      finalizeBlock();
    }
    if (!t) continue;
    if (t.startsWith("#")) continue;
    const line = stripInlineComment(t);
    if (!line || line === "---") continue;
    const dash = line.match(/^-\s*(.*)$/);
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (dash && currentKey) {
      const rest = dash[1];
      const obj = rest.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (obj) {
        currentItem = { [obj[1]]: clean(obj[2]) };
        out[currentKey].push(currentItem);
      } else {
        currentItem = null;
        if (rest !== "") out[currentKey].push(clean(rest));
      }
      continue;
    }
    if (kv) {
      const [, key, valueRaw] = kv;
      if (indent > 0 && currentItem) {
        currentItem[key] = clean(valueRaw);
        continue;
      }
      if (indent > 0) {
        const nested = opts.reportNestedUnder; // Set of parent keys that stay strict
        if (!nested || nested.has(currentKey)) report(i, raw); // nested structure outside object lists
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(out, key)) report(i, raw); // duplicate key
      if (/^[|>][-+]?\d*$/.test(valueRaw.trim())) {
        out[key] = "";
        currentKey = null;
        currentItem = null;
        blockKey = key;
        blockIndent = indent;
        blockBase = null;
        blockLines = [];
        continue;
      }
      if (valueRaw.trim() === "") {
        out[key] = [];
        currentKey = key;
        currentItem = null;
        continue;
      }
      currentKey = null;
      currentItem = null;
      const value = clean(valueRaw);
      if (value === "[]") {
        out[key] = [];
        continue;
      }
      if (value.startsWith("[") && value.endsWith("]")) {
        out[key] = value.slice(1, -1).split(",").map(clean).filter(Boolean);
        continue;
      }
      out[key] = value;
      continue;
    }
    report(i, raw);
  }
  finalizeBlock();
  return out;
}

export function readFrontmatter(file, errors = null) {
  const text = readText(file);
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? parseYaml(m[1], errors) : {};
}

function safeStat(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

const WALK_EXCLUDES = new Set(["node_modules", ".git", "dist", "build", "out", "target", ".gradle", ".idea", ".vscode", ".venv", "venv", "__pycache__", ".next", ".nuxt"]);
const MD_EXCLUDES = new Set(["node_modules", ".git"]); // specs: do not exclude build/target/out (legit folders under openspec/)
const WALK_MAX_DEPTH = 40;

export function walkMd(dir, depth = 0) {
  if (!existsSync(dir) || depth > WALK_MAX_DEPTH) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (MD_EXCLUDES.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = lstatSync(p); // does not follow symlinks: avoids cycles
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...walkMd(p, depth + 1));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

// Code files (by extension) inside a directory, recursive.
// Same exclusions and protections as walkMd.
export function walkFiles(dir, depth = 0) {
  if (!existsSync(dir) || depth > WALK_MAX_DEPTH) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (WALK_EXCLUDES.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = lstatSync(p);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...walkFiles(p, depth + 1));
    else if (CODE_EXTS.has(name.slice(name.lastIndexOf(".")).toLowerCase())) out.push(p);
  }
  return out;
}

export function proposalTitle(dir) {
  const p = join(dir, "proposal.md");
  if (!existsSync(p)) return "";
  const m = readText(p).match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}

const asBool = (v) => v === true || ["true", "yes", "si", "sí"].includes(String(v).trim().toLowerCase());

// Custom metadata keys may be written bare (`kind`) or `x-`-prefixed (`x-kind`).
// OpenSpec >= 1.14 strict validation recommends the `x-` prefix for custom keys;
// the gate accepts both (the prefixed form wins if both are present).
export const normalizeMeta = (meta) => {
  const out = {};
  for (const k of Object.keys(meta)) if (!k.startsWith("x-")) out[k] = meta[k];
  for (const k of Object.keys(meta)) if (k.startsWith("x-")) out[k.slice(2)] = meta[k]; // the prefixed form wins if both are present
  return out;
};

export function readChange(root, id, errors = null) {
  const dir = join(root, "openspec", "changes", id);
  const metaPath = join(dir, ".openspec.yaml");
  const errs = [];
  const raw = existsSync(metaPath) ? parseYaml(readText(metaPath), errs) : {};
  const m = normalizeMeta(raw);
  if (errors) {
    for (const e of errs) errors.push({ id, file: metaPath, line: e.line, text: e.text });
  }
  return {
    id,
    dir,
    title: proposalTitle(dir),
    kind: m.kind || "feature",
    status: m.status || "draft",
    targets: arr(m.targets),
    tests: arr(m.tests),
    deps: arr(m.deps),
    gitref: m.gitref || null,
    merged_as: m.merged_as || null,
    reason: m.reason || null,
    tech_brief: asBool(m.tech_brief),
    understood_by: m.understood_by || null,
    understood_at: m.understood_at || null,
    human_approved: asBool(m.human_approved),
    accepted_by: m.accepted_by || null,
    accepted_at: m.accepted_at || null,
    superseded_by: m.superseded_by || null,
    waivers: arr(m.waivers).map((w) => (typeof w === "string" ? { type: w } : w)),
    open_decisions: arr(m.open_decisions).map((d) => (typeof d === "string" ? { question: d } : d)),
    conflicts: arr(m.conflicts).map((cf) => (typeof cf === "string" ? { what: cf } : cf)),
  };
}

export function listChanges(root, errors = null) {
  const changesDir = join(root, "openspec", "changes");
  if (!existsSync(changesDir)) return [];
  const out = [];
  for (const name of readdirSync(changesDir)) {
    if (name === "archive") continue;
    const dir = join(changesDir, name);
    const st = safeStat(dir);
    if (!st || !st.isDirectory()) continue;
    if (!existsSync(join(dir, "proposal.md"))) {
      if (errors) errors.push({ id: name, file: dir, line: 0, text: "change folder without proposal.md (incomplete add?)" });
      continue;
    }
    out.push(readChange(root, name, errors));
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

// Returns { archived, digests, digestIds } — digestIds resolves deps
// against already-compacted changes (lines "- YYYY-MM-DD · <id> · <kind>").
export function listArchive(root) {
  const archiveDir = join(root, "openspec", "changes", "archive");
  const archived = [];
  const digests = [];
  const digestIds = [];
  if (!existsSync(archiveDir)) return { archived, digests, digestIds };
  for (const name of readdirSync(archiveDir)) {
    const p = join(archiveDir, name);
    const st = safeStat(p);
    if (!st) continue;
    if (st.isDirectory()) archived.push(name);
    else if (/^\d{4}\.md$/.test(name)) {
      digests.push(name);
      for (const line of readText(p).split(/\r?\n/)) {
        const m = line.match(/^-\s+\d{4}-\d{2}-\d{2}\s+·\s+([^\s·]+)\s+·/);
        if (m) digestIds.push(m[1]);
      }
    }
  }
  archived.sort().reverse();
  return { archived, digests, digestIds };
}

// All files inside a directory (recursive), same exclusions as walkFiles.
export function walkAll(dir, depth = 0) {
  if (!existsSync(dir) || depth > WALK_MAX_DEPTH) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (WALK_EXCLUDES.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = lstatSync(p);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...walkAll(p, depth + 1));
    else out.push(p);
  }
  return out;
}

// --- tech brief (walkthrough.md) ---
export const WALKTHROUGH_SECTIONS = [
  ["Mechanism", /^##\s+Mechanism\b/im],
  ["Physical traceability", /^##\s+Physical traceability\b/im],
  ["Limits and failure modes", /^##\s+Limits and failure modes\b/im],
  ["Touched APIs", /^##\s+Touched APIs\b/im],
  ["Implicit decisions", /^##\s+Implicit decisions\b/im],
];

// Structural issues of the tech brief (missing or empty sections). Empty array = complete.
export function briefIssues(dir) {
  const wp = join(dir, "walkthrough.md");
  if (!existsSync(wp)) return ["walkthrough.md missing"];
  const text = readText(wp);
  const issues = [];
  for (const [name, re] of WALKTHROUGH_SECTIONS) {
    const m = re.exec(text);
    if (!m) {
      issues.push(`'## ${name}' missing`);
      continue;
    }
    const rest = text.slice(m.index + m[0].length);
    const next = rest.search(/^##\s/m);
    const body = (next >= 0 ? rest.slice(0, next) : rest).trim();
    if (body.length < 40) issues.push(`'## ${name}' looks empty`);
  }
  if (!/^##\s+Cognitive sign-off\b/im.test(text)) issues.push("'## Cognitive sign-off' missing");
  return issues;
}

// True when the Cognitive sign-off section still contains TODO(human) answers.
export function signoffTodoIn(dir) {
  const wp = join(dir, "walkthrough.md");
  if (!existsSync(wp)) return false;
  const text = readText(wp);
  const m = text.match(/^##\s+Cognitive sign-off\b/im);
  if (!m) return false;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^##\s/m);
  const body = next >= 0 ? rest.slice(0, next) : rest;
  return /TODO\(human\)/i.test(body);
}

export function readConfig(root, errors = null) {
  const p = join(root, "openspec", "config.yaml");
  const errs = [];
  const cfg = existsSync(p) ? parseYaml(readText(p), errs, { reportNestedUnder: new Set(["protected"]) }) : {};
  if (errors) for (const e of errs) errors.push({ file: p, line: e.line, text: e.text });
  const protectedZones = arr(cfg.protected)
    .map((z) => (typeof z === "string" ? { glob: z, reason: "" } : z))
    .filter((z) => z && z.glob);
  return { protectedZones, testCommand: cfg.test_command || null };
}

// A capability is the owning spec folder (`openspec/specs/<capability>/spec.md`)
// → id `cap:<capability>`; an explicit `provides:` frontmatter may alias it.
export function listCapabilities(root) {
  const specsDir = join(root, "openspec", "specs");
  const out = [];
  for (const file of walkMd(specsDir)) {
    const fm = normalizeMeta(readFrontmatter(file));
    const rel = relative(root, file).replace(/\\/g, "/");
    let prov = arr(fm.provides);
    const m = rel.match(/^openspec\/specs\/(.+)\/spec\.md$/i);
    if (!prov.length && m) prov = ["cap:" + m[1]];
    if (!prov.length && !fm.name) continue;
    out.push({ path: rel, name: fm.name || rel.split("/").slice(-2, -1)[0] || rel, provides: prov });
  }
  return out;
}

// --- paths and globs (case-insensitive: everything normalized to lowercase) ---
export const pathKey = (p) => String(p).replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "").toLowerCase();

export function targetsOverlap(a, b) {
  const x = pathKey(a);
  const y = pathKey(b);
  return x === y || x.startsWith(y + "/") || y.startsWith(x + "/");
}

export function pathCoveredBy(relPath, target) {
  const p = pathKey(relPath);
  const t = pathKey(target);
  if (/[*?]/.test(t)) {
    const re = globToRegExp(t);
    return re.test(p) || re.test(p + "/");
  }
  return p === t || p.startsWith(t + "/");
}

const globCache = new Map();
export function globToRegExp(glob) {
  const g = String(glob).replace(/\\/g, "/").toLowerCase();
  if (globCache.has(g)) return globCache.get(g);
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        if (g[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  const compiled = new RegExp("^" + re + "$");
  globCache.set(g, compiled);
  return compiled;
}

// Matches (case-insensitive) a path against zones; includes the path as a directory
// (path + "/") so `**/auth/**` covers the directory target `src/auth`.
export function matchZones(relPath, zones) {
  const base = pathKey(relPath);
  const candidates = [base, base + "/"];
  for (const z of zones) {
    const re = globToRegExp(z.glob);
    if (candidates.some((c) => re.test(c))) return z;
  }
  return null;
}

// --- git (with per-run caches) ---
const gitTsCache = new Map();
export function gitLastCommitTs(root, relPath) {
  const key = root + "::" + pathKey(relPath);
  if (gitTsCache.has(key)) return gitTsCache.get(key);
  let val = null;
  try {
    const args = ["log", "-1", "--format=%ct"];
    if (!/[*?]/.test(String(relPath))) args.push("--follow"); // --follow does not take wildcard pathspecs
    args.push("--", relPath);
    const out = execFileSync("git", args, {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    val = out ? Number(out) * 1000 : null;
  } catch {
    val = null;
  }
  gitTsCache.set(key, val);
  return val;
}

export function gitHead(root) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// True when the directory is inside a git repository (works even with no commits yet).
export function gitRepoPresent(root) {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

// true = ancestor of HEAD; false = not (valid ref); null = unverifiable
// (git absent, empty repo, or invalid/ambiguous ref). Rejects refs starting with "-".
export function gitIsAncestor(root, ref) {
  if (!ref || String(ref).startsWith("-")) return null;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ref, "HEAD"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch (e) {
    return e && e.status === 1 ? false : null;
  }
}

const trackedCache = new Map();
export function listTrackedFiles(root) {
  if (trackedCache.has(root)) return trackedCache.get(root);
  let val = null;
  try {
    val = execFileSync("git", ["ls-files"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    val = null;
  }
  trackedCache.set(root, val);
  return val;
}

// Is the current content of relDir clean in git? (empty = no pending changes)
// Returns true/false/null (no git).
export function gitDirIsClean(root, relDir) {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--", relDir], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return out.length === 0;
  } catch {
    return null;
  }
}

// System root: nearest ancestor with openspec/changes.
export function resolveRoot(start) {
  let d = normalize(start);
  for (let i = 0; i < 80; i++) {
    if (existsSync(join(d, "openspec", "changes"))) return d;
    const parent = normalize(join(d, ".."));
    if (parent === d) break;
    d = parent;
  }
  return null;
}

// --- requirements and citations ---
export function testRefsIn(file) {
  const refs = [];
  const text = readText(file);
  const re = /\[@test\]\s+`?([^`\s]+)`?/g;
  let m;
  while ((m = re.exec(text))) refs.push(clean(m[1]));
  return refs;
}

export function requirementIdsIn(text) {
  const ids = [];
  const re = /\[REQ-([A-Za-z0-9][A-Za-z0-9_.-]*)\]/g;
  let m;
  while ((m = re.exec(text))) ids.push("REQ-" + m[1]);
  return ids;
}

export function citationsIn(text) {
  const ids = [];
  const re = /@cita\s+(REQ-[A-Za-z0-9_.-]+)/g;
  let m;
  while ((m = re.exec(text))) ids.push(m[1]);
  return ids;
}

// --- evidence ---
export function readEvidence(root) {
  const p = join(root, "openspec", "evidence.json");
  try {
    return existsSync(p) ? JSON.parse(readText(p)) : null;
  } catch {
    return null;
  }
}

// Expands a wildcard target against tracked files.
// No wildcards: [pathKey(target)]. With wildcards and no git: null (unknown).
// Cap 2000: huge expansions degrade to null (callers use the literal).
export function expandTarget(root, target, tracked) {
  const t = String(target);
  if (!/[*?]/.test(t)) return [pathKey(t)];
  if (!tracked) return null;
  const re = globToRegExp(t);
  const matches = tracked.map(pathKey).filter((f) => re.test(f));
  if (matches.length > 2000) return null;
  return matches;
}

// Content fingerprint of the files covered by the given targets/tests (evidence
// freshness): survives "commit right after green", catches edits without commit.
// Literal files: as-is. Directories/globs: code files on disk (includes untracked).
// Returns null when not evaluable (empty, too large, or a pattern starting with a wildcard).
export function targetsFingerprint(root, paths) {
  const set = new Map();
  const add = (rel, abs) => {
    const k = pathKey(rel);
    if (!set.has(k)) set.set(k, abs);
  };
  for (const t of paths) {
    const ts = String(t);
    if (/[*?]/.test(ts)) {
      const base = ts.slice(0, ts.search(/[*?]/)).replace(/[\\/]+$/, "");
      if (!base) return null;
      const baseAbs = join(root, base);
      const stB = safeStat(baseAbs);
      if (!stB || !stB.isDirectory()) continue;
      const re = globToRegExp(ts);
      for (const f of walkAll(baseAbs)) {
        const r = relative(root, f);
        if (re.test(pathKey(r))) add(r, f);
      }
      continue;
    }
    const p = join(root, ts);
    const st = safeStat(p);
    if (!st) continue;
    if (st.isFile()) add(ts, p);
    else if (st.isDirectory()) for (const f of walkAll(p)) add(relative(root, f), f);
  }
  if (!set.size || set.size > 5000) return null;
  const h = createHash("sha1");
  for (const k of [...set.keys()].sort()) {
    h.update(k);
    h.update("\0");
    let buf = null;
    for (let i = 0; i < 3 && buf === null; i++) {
      try {
        buf = readFileSync(set.get(k));
      } catch {
        const until = Date.now() + 30 * (i + 1);
        while (Date.now() < until) {
          /* short backoff (Windows/AV locks) */
        }
      }
    }
    if (buf === null) return null; // unreadable file → not evaluable (timestamps fallback)
    h.update(buf);
    h.update("\0");
  }
  return h.digest("hex").slice(0, 16);
}

// Atomic write: tmp + rename with retry (Windows/AV) and cleanup.
export function writeAtomic(file, content) {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  writeFileSync(tmp, content);
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      renameSync(tmp, file);
      return;
    } catch (e) {
      lastErr = e;
      const until = Date.now() + 40 * (i + 1);
      while (Date.now() < until) {
        /* short backoff (synchronous context) */
      }
    }
  }
  try {
    writeFileSync(file, content); // non-atomic fallback (target locked)
    try {
      unlinkSync(tmp);
    } catch {
      /* orphan tmp is tolerable */
    }
    console.error(`⚠ writeAtomic: rename failed (${lastErr ? lastErr.code : "?"}) — direct write to ${file}`);
  } catch (e2) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw e2;
  }
}

export function writeEvidence(root, obj) {
  writeAtomic(join(root, "openspec", "evidence.json"), JSON.stringify(obj, null, 2) + "\n");
}
