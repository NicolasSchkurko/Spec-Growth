// Spec Growth — utilidades compartidas por los gates (v0.6).
// Sin dependencias externas. Parser YAML: subconjunto propio del sistema.
// Política de case: TODAS las comparaciones de paths/globs son case-insensitive
// (se normalizan a minúsculas); documentado en SKILL.md.
import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, statSync, lstatSync } from "node:fs";
import { join, relative, normalize } from "node:path";
import { execFileSync } from "node:child_process";

export const clean = (s) => String(s).trim().replace(/^["']|["']$/g, "").trim();
export const arr = (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);

// Extensiones de código donde se buscan citas (@cita REQ-...) dentro de directorios.
export const CODE_EXTS = new Set([
  ".kt", ".java", ".ts", ".tsx", ".js", ".jsx", ".py", ".cs", ".rs", ".go", ".dart",
  ".rb", ".php", ".swift", ".m", ".mm", ".c", ".h", ".cc", ".cpp", ".hpp", ".scala", ".sql",
]);

// --- texto: siempre sin BOM (con cache de lectura por corrida) ---
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

// Parser del subconjunto. `errors` (opcional): array donde se registran
// { line, text } de las líneas no interpretadas (y claves duplicadas).
// Soporta bloques escalares (| y >): su contenido se captura en el valor.
export function parseYaml(text, errors = null) {
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
        report(i, raw); // estructura anidada fuera de listas de objetos
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(out, key)) report(i, raw); // clave duplicada
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
const MD_EXCLUDES = new Set(["node_modules", ".git"]); // specs: no excluir build/target/out (carpetas legítimas bajo openspec/)
const WALK_MAX_DEPTH = 40;

export function walkMd(dir, depth = 0) {
  if (!existsSync(dir) || depth > WALK_MAX_DEPTH) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (MD_EXCLUDES.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = lstatSync(p); // no sigue symlinks: evita ciclos
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...walkMd(p, depth + 1));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

// Archivos de código (por extensión) dentro de un directorio, recursivo.
// Mismas exclusiones y protecciones que walkMd.
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

export function readChange(root, id, errors = null) {
  const dir = join(root, "openspec", "changes", id);
  const metaPath = join(dir, ".openspec.yaml");
  const errs = [];
  const meta = existsSync(metaPath) ? parseYaml(readText(metaPath), errs) : {};
  if (errors) {
    for (const e of errs) errors.push({ id, file: metaPath, line: e.line, text: e.text });
  }
  return {
    id,
    dir,
    title: proposalTitle(dir),
    kind: meta.kind || "feature",
    status: meta.status || "draft",
    targets: arr(meta.targets),
    tests: arr(meta.tests),
    deps: arr(meta.deps),
    gitref: meta.gitref || null,
    merged_as: meta.merged_as || null,
    reason: meta.reason || null,
    human_approved: asBool(meta.human_approved),
    accepted_by: meta.accepted_by || null,
    accepted_at: meta.accepted_at || null,
    superseded_by: meta.superseded_by || null,
    waivers: arr(meta.waivers).map((w) => (typeof w === "string" ? { type: w } : w)),
    open_decisions: arr(meta.open_decisions).map((d) => (typeof d === "string" ? { question: d } : d)),
    conflicts: arr(meta.conflicts).map((cf) => (typeof cf === "string" ? { what: cf } : cf)),
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
      if (errors) errors.push({ id: name, file: dir, line: 0, text: "carpeta de change sin proposal.md (¿add incompleto?)" });
      continue;
    }
    out.push(readChange(root, name, errors));
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

// Devuelve { archived, digests, digestIds } — digestIds permite resolver deps
// contra cambios ya compactados (líneas "- YYYY-MM-DD · <id> · <kind>").
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

export function readConfig(root, errors = null) {
  const p = join(root, "openspec", "config.yaml");
  const errs = [];
  const cfg = existsSync(p) ? parseYaml(readText(p), errs) : {};
  if (errors) for (const e of errs) errors.push({ file: p, line: e.line, text: e.text });
  const protectedZones = arr(cfg.protected)
    .map((z) => (typeof z === "string" ? { glob: z, reason: "" } : z))
    .filter((z) => z && z.glob);
  return { protectedZones, testCommand: cfg.test_command || null };
}

export function listCapabilities(root) {
  const specsDir = join(root, "openspec", "specs");
  const out = [];
  for (const file of walkMd(specsDir)) {
    const fm = readFrontmatter(file);
    const rel = relative(root, file).replace(/\\/g, "/");
    const prov = arr(fm.provides);
    if (!prov.length && !fm.name) continue;
    out.push({ path: rel, name: fm.name || rel.split("/").slice(-2, -1)[0] || rel, provides: prov });
  }
  return out;
}

// --- paths y globs (case-insensitive: todo se normaliza a minúsculas) ---
export const pathKey = (p) => String(p).replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "").toLowerCase();

export function targetsOverlap(a, b) {
  const x = pathKey(a);
  const y = pathKey(b);
  return x === y || x.startsWith(y + "/") || y.startsWith(x + "/");
}

export function pathCoveredBy(relPath, target) {
  const p = pathKey(relPath);
  const t = pathKey(target);
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

// Matchea (case-insensitive) un path contra zonas; incluye el path como directorio
// (path + "/") para que `**/auth/**` cubra el target directorio `src/auth`.
export function matchZones(relPath, zones) {
  const base = pathKey(relPath);
  const candidates = [base, base + "/"];
  for (const z of zones) {
    const re = globToRegExp(z.glob);
    if (candidates.some((c) => re.test(c))) return z;
  }
  return null;
}

// --- git (con caches por corrida) ---
const gitTsCache = new Map();
export function gitLastCommitTs(root, relPath) {
  const key = root + "::" + pathKey(relPath);
  if (gitTsCache.has(key)) return gitTsCache.get(key);
  let val = null;
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ct", "--follow", "--", relPath], {
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

// true = ancestro de HEAD; false = no lo es (ref válida); null = no verificable
// (git ausente, repo vacío, o ref inválida/ambigua). Rechaza refs que empiezan con "-".
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

// ¿El contenido actual de relDir está limpio en git? (vacío = sin cambios pendientes)
// Devuelve true/false/null (sin git).
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

// Raíz del sistema: el ancestro más cercano con openspec/changes.
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

// --- requisitos y citas ---
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

// --- evidencia ---
export function readEvidence(root) {
  const p = join(root, "openspec", "evidence.json");
  try {
    return existsSync(p) ? JSON.parse(readText(p)) : null;
  } catch {
    return null;
  }
}

// Expande un target con wildcards contra archivos trackeados.
// Sin wildcards: [pathKey(target)]. Con wildcards y sin git: null (desconocido).
// Cap de 2000: expansiones gigantes degradan a null (los callers usan el literal).
export function expandTarget(root, target, tracked) {
  const t = String(target);
  if (!/[*?]/.test(t)) return [pathKey(t)];
  if (!tracked) return null;
  const re = globToRegExp(t);
  const matches = tracked.map(pathKey).filter((f) => re.test(f));
  if (matches.length > 2000) return null;
  return matches;
}

// Escritura atómica: tmp + rename con retry (Windows/AV) y cleanup.
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
        /* backoff corto (contexto síncrono) */
      }
    }
  }
  try {
    writeFileSync(file, content); // fallback no-atómico (destino bloqueado)
    try {
      unlinkSync(tmp);
    } catch {
      /* tmp huerfano tolerable */
    }
    console.error(`⚠ writeAtomic: rename falló (${lastErr ? lastErr.code : "?"}) — escritura directa en ${file}`);
  } catch (e2) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignorar */
    }
    throw e2;
  }
}

export function writeEvidence(root, obj) {
  writeAtomic(join(root, "openspec", "evidence.json"), JSON.stringify(obj, null, 2) + "\n");
}
