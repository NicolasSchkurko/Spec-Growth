#!/usr/bin/env node
// Spec Growth — mechanical gate (v0.9).
// Checks: parse · status/kind enums · reason/superseded_by · overlaps (containment+globs,
//   severity by active work; deps-sequenced → warning) · [@test] · targets ·
//   fix/refactor→regression · ⚔ conflicts · waivers
//   (valid granted ENABLES; requested/expired block) · decisions · acceptance ·
//   findings · tasks · tech brief (walkthrough + sign-off) · protected zones (targets + real files + ADR) · capabilities
//   (case-insensitive) · requirements/citations · deps · archive · suite · evidence
//   (substituted ≠ green) · --pre-archive · --scope.
// Modes: [--root DIR] [--json] [--run-tests] [--tests-command "CMD"] [--pre-archive ID] [--diff BASE] [--scope ID]
// Exit: 1 if there are errors, 0 otherwise. Writes openspec/evidence.json.
import { join, normalize, relative } from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";
import { execSync, execFileSync } from "node:child_process";
import * as lib from "./lib.mjs";

const args = process.argv.slice(2);
const getVal = (n) => {
  const eq = args.find((a) => a.startsWith(n + "="));
  if (eq) return eq.slice(n.length + 1);
  const i = args.indexOf(n);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  return undefined;
};
const asJson = args.includes("--json");
const explicitCmd = getVal("--tests-command");
const wantTests = args.includes("--run-tests") || Boolean(explicitCmd);
const preArchiveId = getVal("--pre-archive");
const diffBase = getVal("--diff");
const scopeId = getVal("--scope");

const root = normalize(getVal("--root") || lib.resolveRoot(process.cwd()) || process.cwd());
if (!existsSync(join(root, "openspec", "changes"))) {
  console.error(`openspec/changes/ not found under: ${root}`);
  console.error("Run 'openspec init' first, or pass --root <dir> pointing at the repo root.");
  process.exit(1);
}

const cfgErrors = [];
const cfg = lib.readConfig(root, cfgErrors);
const testsCmd = explicitCmd || cfg.testCommand;
const parseErrors = [];
const changes = lib.listChanges(root, parseErrors);
const { archived, digestIds } = lib.listArchive(root);

const STATUSES = ["draft", "accepted", "applying", "verified", "blocked", "rejected", "superseded"];
const KINDS = ["fix", "feature", "architecture", "refactor"];
const ADVANCED = ["accepted", "applying", "verified"];
const TERMINAL = ["rejected", "superseded"];
const restId = (name) => name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
const archiveResolves = (id) =>
  archived.some((a) => restId(a) === id || restId(a).endsWith("-" + id)) || digestIds.includes(id);

const errors = [];
const warnings = [];
const err = (msg, ids = []) => errors.push({ msg, ids });
const warn = (msg, ids = []) => warnings.push({ msg, ids });

// A waiver "blocks" if it is requested, invalid, or granted without owner/expires or expired.
// A valid granted waiver ENABLES (it is a permission) and does not block.
const blameWaiver = (w) => {
  const st = String(w.state || "").toLowerCase();
  if (st !== "granted") return true;
  if (!w.owner || !w.expires) return true;
  const expRaw = String(w.expires);
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(expRaw) ? expRaw + "T23:59:59" : expRaw);
  return Number.isNaN(d.getTime()) || d < new Date();
};

for (const ce of cfgErrors) {
  warn(`config.yaml: line ${ce.line} not parsed — ${String(ce.text).slice(0, 60)}`);
}
{
  const tracked0 = lib.listTrackedFiles(root);
  if (tracked0 && tracked0.some((f) => lib.pathKey(f) === "openspec/evidence.json")) {
    err("openspec/evidence.json is committed — evidence is local ('git rm --cached openspec/evidence.json')");
  }
}

// 0) parse: unparsed lines / folders without proposal
for (const pe of parseErrors) {
  const where = pe.file && pe.line ? `${relative(root, pe.file)} line ${pe.line}` : pe.file;
  err(`${pe.id}: ${where} — ${pe.text.slice(0, 70)}`, [pe.id]);
}

// 1) status/kind enums
for (const c of changes) {
  if (!STATUSES.includes(c.status)) err(`${c.id}: invalid status '${c.status}' (allowed: ${STATUSES.join("|")})`, [c.id]);
  if (!KINDS.includes(c.kind)) err(`${c.id}: invalid kind '${c.kind}' (allowed: ${KINDS.join("|")})`, [c.id]);
}

// 2) overlaps (case-insensitive; expanded globs; severity: error only with active work)
//    Explicit exception: if the changes are sequenced by deps (direct or transitive),
//    the overlap is a planned order → warning.
{
  const tracked = lib.listTrackedFiles(root);
  const byId = new Map(changes.map((c) => [c.id, c]));
  const reachMemo = new Map();
  const reach = (from) => {
    if (reachMemo.has(from)) return reachMemo.get(from);
    const seen = new Set();
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const dep of (byId.get(cur) || {}).deps || []) {
        if (seen.has(dep)) continue;
        seen.add(dep);
        if (byId.has(dep)) q.push(dep);
      }
    }
    reachMemo.set(from, seen);
    return seen;
  };
  const sequenced = (x, y) => reach(x).has(y) || reach(y).has(x);
  const pairs = [];
  for (const c of changes) {
    if (TERMINAL.includes(c.status)) continue;
    for (const t of c.targets) {
      const expanded = lib.expandTarget(root, t, tracked) || [lib.pathKey(t)];
      for (const key of expanded) pairs.push({ c, raw: String(t), key });
    }
  }
  const seen = new Set();
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i];
      const b = pairs[j];
      if (a.c.id === b.c.id) continue;
      if (!lib.targetsOverlap(a.key, b.key)) continue;
      const k = [a.c.id, b.c.id].sort().join("|") + "::" + [String(a.raw), String(b.raw)].sort().join(" ~ ");
      if (seen.has(k)) continue;
      seen.add(k);
      const msg = `overlap: '${a.raw}' (${a.c.id}, ${a.c.status}) and '${b.raw}' (${b.c.id}, ${b.c.status}) overlap`;
      const active = a.c.status === "applying" || b.c.status === "applying";
      const seq = sequenced(a.c.id, b.c.id);
      if (active && !seq) err(msg, [a.c.id, b.c.id]);
      else if (seq) warn(`${msg} — sequenced by deps (declared order, not a conflict)`, [a.c.id, b.c.id]);
      else warn(msg, [a.c.id, b.c.id]);
    }
  }
}

// 3) [@test]: declared paths exist
for (const c of changes) {
  for (const file of lib.walkMd(join(c.dir, "specs"))) {
    for (const ref of lib.testRefsIn(file)) {
      if (ref.includes("*")) {
        warn(`${c.id}: glob not supported by the gate → ${ref}`, [c.id]);
        continue;
      }
      if (!existsSync(normalize(join(root, ref)))) {
        const msg = `${c.id}: [@test] does not exist → ${ref} (in ${relative(root, file)})`;
        if (["applying", "verified"].includes(c.status)) err(msg, [c.id]);
        else warn(msg, [c.id]);
      }
    }
  }
}

// 4) existing targets (applying/verified): suspect renames; wildcard targets check their base
for (const c of changes) {
  if (!["applying", "verified"].includes(c.status)) continue;
  for (const t of c.targets) {
    const s = String(t);
    if (!/[*?]/.test(s)) {
      if (!existsSync(normalize(join(root, s)))) warn(`${c.id}: target does not exist on disk (renamed?) → ${s}`, [c.id]);
      continue;
    }
    const base = s.slice(0, s.search(/[*?]/)).replace(/[\\/]+$/, "");
    if (!base) continue; // pattern starts with a wildcard: uncheckable
    if (!existsSync(normalize(join(root, base)))) {
      warn(`${c.id}: target base path does not exist on disk (renamed?) → ${s}`, [c.id]);
    }
  }
}

// 5) kind: fix/refactor require a regression test (literal refs only, no globs)
for (const c of changes) {
  if (c.kind !== "fix" && c.kind !== "refactor") continue;
  const refs = lib.walkMd(join(c.dir, "specs"))
    .flatMap((f) => lib.testRefsIn(f))
    .filter((r) => !r.includes("*"));
  if (!refs.length) {
    const msg = `${c.id}: kind ${c.kind} has no valid [@test] (regression required; globs don't count)`;
    if (ADVANCED.includes(c.status)) err(msg, [c.id]);
    else warn(msg, [c.id]);
  }
}

// 6) waivers (valid types; valid granted ENABLES; requested/expired block)
const WAIVER_TYPES = ["known-gap", "deferred-test", "pending-external-evidence", "frontier-stub", "comprehension-debt"];
const today = new Date();
for (const c of changes) {
  for (const w of c.waivers) {
    const state = String(w.state || "").toLowerCase();
    const type = String(w.type || "?");
    if (!WAIVER_TYPES.includes(type)) {
      err(`${c.id}: waiver with invalid type '${type}' (allowed: ${WAIVER_TYPES.join("|")})`, [c.id]);
    }
    if (!["requested", "granted"].includes(state)) {
      err(`${c.id}: waiver without valid state (requested|granted) — type ${type}`, [c.id]);
      continue;
    }
    if (state === "requested") {
      if (!w.reason) err(`${c.id}: waiver ${type} requested without a reason`, [c.id]);
      warn(`${c.id}: waiver PENDING (${type}, requested) — blocks verified until your decision`, [c.id]);
    } else {
      if (!w.owner) err(`${c.id}: waiver ${type} granted without owner`, [c.id]);
      if (!w.expires) err(`${c.id}: waiver ${type} granted without expires`, [c.id]);
      let stillValid = false;
      if (w.expires) {
        const expRaw = String(w.expires);
        const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(expRaw) ? expRaw + "T23:59:59" : expRaw);
        if (Number.isNaN(d.getTime())) err(`${c.id}: waiver ${type} with invalid expires (${w.expires})`, [c.id]);
        else if (d < today) err(`${c.id}: waiver ${type} EXPIRED (${w.expires})`, [c.id]);
        else {
          stillValid = Boolean(w.owner);
          if (d - today < 14 * 86400000) warn(`${c.id}: waiver ${type} expires soon (${w.expires})`, [c.id]);
          else if (d - today > 180 * 86400000) {
            warn(`${c.id}: waiver ${type} with long validity (>180 days) — review its reason?`, [c.id]);
          }
        }
      }
      if (stillValid) warn(`${c.id}: waiver IN FORCE (${type}, until ${w.expires})`, [c.id]);
    }
  }
  if (c.status === "verified") {
    const blocking = c.waivers.filter(blameWaiver);
    if (blocking.length) err(`${c.id}: 'verified' with blocking waiver(s) (requested/expired)`, [c.id]);
  }
}

// 7) open decisions
for (const c of changes) {
  for (const d of c.open_decisions) {
    if (!d.question || !d.target) err(`${c.id}: decision request without question/target`, [c.id]);
    else warn(`${c.id}: DECISION PENDING — "${d.question}" (→ ${d.target})`, [c.id]);
  }
  if (c.status === "verified" && c.open_decisions.length) {
    err(`${c.id}: 'verified' with pending decision(s)`, [c.id]);
  }
}

// 7b) conflicts to approve: they contradict something already decided/written → block closure, not implementation
for (const c of changes) {
  for (const cf of c.conflicts) {
    if (!cf.with || !cf.what) err(`${c.id}: conflict without 'with'/'what'`, [c.id]);
    else warn(`${c.id}: ⚔ CONFLICT to approve — "${cf.what}" (against ${cf.with})${cf.proposal ? ` · proposal: ${cf.proposal}` : ""}`, [c.id]);
  }
  if (c.status === "verified" && c.conflicts.length) {
    err(`${c.id}: 'verified' with unapproved conflict(s)`, [c.id]);
  }
}

// 8) acceptance trace, reason and superseded
for (const c of changes) {
  if (ADVANCED.includes(c.status) && (!c.accepted_by || !c.accepted_at)) {
    warn(`${c.id}: missing acceptance trace (accepted_by / accepted_at)`, [c.id]);
  }
  if (c.status === "rejected" && !c.reason) {
    err(`${c.id}: 'rejected' without reason (why was it rejected?)`, [c.id]);
  }
  if (c.status === "superseded") {
    if (!c.superseded_by) err(`${c.id}: 'superseded' without superseded_by`, [c.id]);
    else if (!changes.some((x) => x.id === c.superseded_by) && !archiveResolves(c.superseded_by)) {
      warn(`${c.id}: superseded_by '${c.superseded_by}' does not exist (neither active nor archived)`, [c.id]);
    }
  }
}

// 9) open findings from the semantic pass
for (const c of changes) {
  if (!["applying", "verified"].includes(c.status)) continue;
  const fp = join(c.dir, "findings.md");
  if (existsSync(fp) && /^\s*[-*]\s+\[ \]/m.test(lib.readText(fp))) {
    warn(`${c.id}: open findings in findings.md`, [c.id]);
  }
}

// 9b) open tasks from the checklist
for (const c of changes) {
  if (!["applying", "verified"].includes(c.status)) continue;
  const tp = join(c.dir, "tasks.md");
  if (existsSync(tp) && /^\s*[-*]\s+\[ \]/m.test(lib.readText(tp))) {
    warn(`${c.id}: open tasks in tasks.md`, [c.id]);
  }
}

// 9c) tech brief: walkthrough.md completeness + comprehension sign-off
const WALKTHROUGH_SECTIONS = [
  ["Mechanism", /^##\s+Mechanism\b/im],
  ["Physical traceability", /^##\s+Physical traceability\b/im],
  ["Limits and failure modes", /^##\s+Limits and failure modes\b/im],
  ["Touched APIs", /^##\s+Touched APIs\b/im],
  ["Implicit decisions", /^##\s+Implicit decisions\b/im],
];
function briefIssues(c) {
  const wp = join(c.dir, "walkthrough.md");
  if (!existsSync(wp)) return ["walkthrough.md missing"];
  const text = lib.readText(wp);
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
function signoffPending(c) {
  if (!c.understood_by || !c.understood_at) return "sign-off not recorded (understood_by/understood_at)";
  const wp = join(c.dir, "walkthrough.md");
  if (existsSync(wp) && /TODO\(human\)/i.test(lib.readText(wp))) return "answers still TODO(human)";
  return null;
}
for (const c of changes) {
  if (!c.tech_brief || TERMINAL.includes(c.status)) continue;
  if (!["applying", "verified"].includes(c.status)) continue;
  const issues = briefIssues(c);
  if (issues.length) {
    warn(`${c.id}: tech brief incomplete — ${issues.join("; ")}`, [c.id]);
  } else if (c.status === "verified") {
    const pend = signoffPending(c);
    if (pend) warn(`${c.id}: walkthrough ready — awaiting comprehension sign-off (${pend})`, [c.id]);
  }
}

// 10) protected zones: target matches, dead globs, and --diff (CI)
for (const c of changes) {
  const hits = new Map();
  for (const t of c.targets) {
    const z = lib.matchZones(t, cfg.protectedZones);
    if (z) hits.set(z.glob, t);
  }
  if (hits.size && !c.human_approved && !TERMINAL.includes(c.status)) {
    const list = [...hits.entries()].map(([glob, t]) => `${t} (zone ${glob})`).join(" · ");
    const msg = `${c.id}: touches a protected zone without human approval → ${list}`;
    if (c.status === "applying") err(msg, [c.id]);
    else if (c.status === "verified") warn(`${msg} — verified: regularize with your approval`, [c.id]);
    else warn(`${msg} — will require approval`, [c.id]);
  }
}
{
  const tracked = lib.listTrackedFiles(root);
  if (!tracked && cfg.protectedZones.length) {
    warn("protected zones: not verifiable without git (dead globs unchecked)");
  } else if (tracked && cfg.protectedZones.length) {
    for (const z of cfg.protectedZones) {
      const re = lib.globToRegExp(z.glob);
      const any = tracked.some((f) => re.test(lib.pathKey(f)) || re.test(lib.pathKey(f) + "/"));
      if (!any) warn(`protected zone with no matching files: ${z.glob} (renamed? — dead protection)`);
    }
  }
}

// ADR required for human approvals: a line with an approval verb that mentions the id
// as a full word (not a substring; a rejection line does not approve).
const adrApproves = (dec, id) => {
  const esc = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reId = new RegExp(`(?:^|[^A-Za-z0-9_-])${esc}(?![A-Za-z0-9_-])`);
  // Section-aware: id and approval verb may live on different lines (heading +
  // decision line) as long as they share the `## ...` section.
  return dec.split(/\r?\n(?=##\s)/).some((block) => {
    if (!reId.test(block)) return false;
    return block
      .split(/\r?\n/)
      .some((l) => /aprob|approv/i.test(l) && !/rechaz|reject/i.test(l));
  });
};
for (const c of changes) {
  if (!c.human_approved) continue;
  const decPath = join(root, "DECISIONS.md");
  const dec = existsSync(decPath) ? lib.readText(decPath) : "";
  if (!adrApproves(dec, c.id)) {
    err(
      `${c.id}: human_approved without a valid ADR in DECISIONS.md (a line with 'approved'/'aprobado' mentioning '${c.id}' as a word)`,
      [c.id]
    );
  }
}

// Protected zones over REAL changed files (working tree + staged), even if targets don't match the glob
if (!diffBase) {
  try {
    let changed = [];
    for (const gitArgs of [
      ["diff", "--name-only", "HEAD"],
      ["diff", "--name-only", "--cached"],
      ["ls-files", "--others", "--exclude-standard"],
    ]) {
      try {
        changed.push(
          ...execFileSync("git", gitArgs, { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
            .toString()
            .split(/\r?\n/)
            .filter(Boolean)
        );
      } catch {
        /* no git or no HEAD */
      }
    }
    changed = [...new Set(changed)];
    for (const f of changed) {
      const z = lib.matchZones(f, cfg.protectedZones);
      if (!z) continue;
      const owners = changes.filter((c) => !TERMINAL.includes(c.status) && c.targets.some((t) => lib.pathCoveredBy(f, t)));
      if (!owners.length) err(`protected file modified with no change claiming it → ${f} (zone ${z.glob})`);
      else
        for (const o of owners) {
          if (!o.human_approved) err(`${o.id}: modifies a protected file without approval → ${f} (zone ${z.glob})`, [o.id]);
        }
    }
  } catch {
    /* no git */
  }
}
if (diffBase) {
  let changed = [];
  let ok = false;
  let usedFallback = false;
  for (const range of [`${diffBase}...HEAD`, diffBase]) {
    try {
      changed = execFileSync("git", ["diff", "--name-only", range], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .split(/\r?\n/)
        .filter(Boolean);
      ok = true;
      usedFallback = range === diffBase;
      break;
    } catch {
      /* try the next range */
    }
  }
  if (!ok) {
    warn(`--diff ${diffBase}: could not obtain the diff (git? ref?)`);
  } else {
    if (usedFallback) warn(`--diff: could not use ${diffBase}...HEAD; used 'git diff ${diffBase}' (includes working tree)`);
    for (const f of changed) {
      const z = lib.matchZones(f, cfg.protectedZones);
      if (!z) continue;
      const owners = changes.filter((c) => !TERMINAL.includes(c.status) && c.targets.some((t) => lib.pathCoveredBy(f, t)));
      if (!owners.length) {
        err(`--diff: protected file modified with no change claiming it → ${f} (zone ${z.glob})`);
        continue;
      }
      for (const o of owners) {
        if (!o.human_approved) err(`--diff: ${o.id} touches a protected file without approval → ${f} (zone ${z.glob})`, [o.id]);
      }
    }
    for (const f of changed) {
      if (lib.matchZones(f, cfg.protectedZones)) continue;
      const k = lib.pathKey(f);
      if (k.startsWith("openspec/")) continue;
      const ext = k.slice(k.lastIndexOf("."));
      if (!lib.CODE_EXTS.has(ext)) continue;
      const owners = changes.filter((c) => !TERMINAL.includes(c.status) && c.targets.some((t) => lib.pathCoveredBy(f, t)));
      if (!owners.length) warn(`--diff: changed file not claimed by any active change → ${f} (scope drift?)`);
    }
  }
}

// 11) capabilities: living + deltas
{
  const caps = new Map();
  const pushCap = (id, source, path, status) => {
    const key = String(id).trim().toLowerCase();
    if (!caps.has(key)) caps.set(key, []);
    caps.get(key).push({ source, path, status });
  };
  for (const cap of lib.listCapabilities(root)) for (const id of cap.provides) pushCap(id, "living", cap.path, "living");
  for (const c of changes) {
    for (const f of lib.walkMd(join(c.dir, "specs"))) {
      const fm = lib.readFrontmatter(f);
      for (const id of lib.arr(fm.provides)) pushCap(id, c.id, relative(root, f), c.status);
    }
  }
  const capPathOf = (p) => {
    const m = String(p).replace(/\\/g, "/").match(/specs\/(.+)\/spec\.md$/);
    return m ? m[1] : null;
  };
  for (const [id, entries] of caps) {
    const living = entries.filter((e) => e.source === "living");
    const deltas = entries.filter((e) => e.source !== "living");
    if (living.length > 1) err(`duplicate capability ${id} (living specs): ${living.map((e) => e.path).join(" · ")}`);
    for (const d of deltas) {
      if (!living.length) continue;
      const sameOwner = living.some((e) => capPathOf(e.path) && capPathOf(e.path) === capPathOf(d.path));
      if (sameOwner) {
        warn(`${d.source}: capability ${id} re-declared in the delta — remove 'provides' (the living spec owns it)`, [d.source]);
        continue;
      }
      const msg = `duplicate capability ${id}: delta from '${d.source}' vs living spec (${d.path})`;
      if (ADVANCED.includes(d.status)) err(msg, [d.source]);
      else warn(msg, [d.source]);
    }
    for (let a = 0; a < deltas.length; a++) {
      for (let b = a + 1; b < deltas.length; b++) {
        if (deltas[a].source === deltas[b].source) continue;
        const msg = `duplicate capability ${id}: '${deltas[a].source}' and '${deltas[b].source}' both provide it`;
        const both = ADVANCED.includes(deltas[a].status) && ADVANCED.includes(deltas[b].status);
        if (both) err(msg, [deltas[a].source, deltas[b].source]);
        else warn(msg, [deltas[a].source, deltas[b].source]);
      }
    }
  }
}

// 11b) two active changes creating the same NEW capability (folder collision)
{
  const livingCapPaths = new Set();
  for (const cap of lib.listCapabilities(root)) {
    const m = String(cap.path).replace(/\\/g, "/").match(/^openspec\/specs\/(.+)\/spec\.md$/i);
    if (m) livingCapPaths.add(m[1].toLowerCase());
  }
  const creators = new Map();
  for (const c of changes) {
    if (TERMINAL.includes(c.status)) continue;
    for (const f of lib.walkMd(join(c.dir, "specs"))) {
      const rel = relative(root, f).replace(/\\/g, "/");
      const m = rel.match(/changes\/[^/]+\/specs\/(.+)\/spec\.md$/i);
      if (!m) continue;
      const key = m[1].toLowerCase();
      if (livingCapPaths.has(key)) continue; // modification of an existing capability
      if (!creators.has(key)) creators.set(key, []);
      creators.get(key).push(c);
    }
  }
  for (const [key, cs] of creators) {
    const uniq = [...new Map(cs.map((c) => [c.id, c])).values()];
    if (uniq.length < 2) continue;
    const ids = uniq.map((c) => c.id);
    const both = uniq.filter((c) => ADVANCED.includes(c.status)).length >= 2;
    const msg = `new capability '${key}' created by ${ids.join(" and ")} (pick one owner)`;
    if (both) err(msg, ids);
    else warn(msg, ids);
  }
}

// 11c) structural mapping: capabilities vs ARCHITECTURE.dsl tags (only when the file exists)
{
  const dslPath = join(root, "ARCHITECTURE.dsl");
  if (existsSync(dslPath)) {
    const dsl = lib.readText(dslPath).toLowerCase();
    const living = [];
    for (const cap of lib.listCapabilities(root)) {
      const m = String(cap.path).replace(/\\/g, "/").match(/^openspec\/specs\/(.+)\/spec\.md$/i);
      if (m) living.push(m[1]);
    }
    for (const capPath of living) {
      if (!dsl.includes("cap:" + capPath.toLowerCase())) {
        warn(`capability '${capPath}' is not tagged in ARCHITECTURE.dsl (cap:${capPath}) — run /diagram-sync`);
      }
    }
    const known = new Set(living.map((x) => x.toLowerCase()));
    const tags = [...new Set([...dsl.matchAll(/cap:[a-z0-9._-]+/g)].map((x) => x[0]))];
    for (const tag of tags) {
      if (!known.has(tag.slice(4))) warn(`ARCHITECTURE.dsl: tag '${tag}' references no living capability (stale?)`);
    }
  }
}

// 12) requirements and citations (optional: activates when the repo uses [REQ-...] IDs)
const rel = (f) => relative(root, f);
const livingIds = new Map();
for (const f of lib.walkMd(join(root, "openspec", "specs"))) {
  const seen = new Set();
  for (const id of lib.requirementIdsIn(lib.readText(f))) {
    if (seen.has(id)) err(`${rel(f)}: duplicate requirement ID in file → ${id}`);
    seen.add(id);
    if (livingIds.has(id)) err(`duplicate requirement ID across living specs → ${id} (${rel(livingIds.get(id))} and ${rel(f)})`);
    else livingIds.set(id, f);
  }
}
const changeIds = new Map();
const idOwner = new Map();
for (const c of changes) {
  const map = new Map();
  changeIds.set(c.id, map);
  for (const f of lib.walkMd(join(c.dir, "specs"))) {
    const seen = new Set();
    for (const id of lib.requirementIdsIn(lib.readText(f))) {
      if (seen.has(id)) err(`${c.id}: duplicate requirement ID in file → ${id} (${rel(f)})`, [c.id]);
      seen.add(id);
      map.set(id, f);
    }
  }
  for (const id of map.keys()) {
    if (idOwner.has(id) && idOwner.get(id) !== c.id) {
      warn(`ID ${id} touched by two active changes (${idOwner.get(id)}, ${c.id})`, [c.id]);
    } else {
      idOwner.set(id, c.id);
    }
  }
}
const allIds = new Set([
  ...livingIds.keys(),
  ...changes.filter((c) => ADVANCED.includes(c.status)).flatMap((c) => [...(changeIds.get(c.id) || new Map()).keys()]),
]);
for (const c of changes) {
  // Citations: change files; directories and glob targets expand to their code files.
  const files = [];
  for (const t of [...c.targets, ...c.tests]) {
    const ts = String(t);
    if (/[*?]/.test(ts)) {
      const base = ts.slice(0, ts.search(/[*?]/)).replace(/[\\/]+$/, "");
      if (!base) continue; // global pattern: not scannable
      const reT = lib.globToRegExp(ts);
      const baseAbs = normalize(join(root, base));
      let cand = [];
      try {
        if (existsSync(baseAbs) && statSync(baseAbs).isDirectory()) cand = lib.walkFiles(baseAbs);
      } catch {
        cand = [];
      }
      for (const f of cand) if (reT.test(lib.pathKey(relative(root, f)))) files.push(f);
      continue;
    }
    const p = normalize(join(root, ts));
    if (!existsSync(p)) continue;
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isFile()) files.push(p);
    else if (st.isDirectory()) files.push(...lib.walkFiles(p));
  }
  const cites = [];
  for (const f of [...new Set(files)]) cites.push(...lib.citationsIn(lib.readText(f)));
  for (const id of cites) {
    if (!allIds.has(id)) {
      const msg = `${c.id}: broken citation @cita ${id} — no such requirement (possible hallucination)`;
      if (["applying", "verified"].includes(c.status)) err(msg, [c.id]);
      else warn(msg, [c.id]);
    }
  }
  if (cites.length) {
    const cited = new Set(cites);
    for (const id of (changeIds.get(c.id) || new Map()).keys()) {
      if (!cited.has(id)) warn(`${c.id}: requirement without citation in its files → ${id}`, [c.id]);
    }
  }
}

// 13) deps: verified active change, archived folder, or compacted digest
{
  const activeById = new Map(changes.map((c) => [c.id, c]));
  for (const c of changes) {
    for (const dep of c.deps) {
      const depStr = String(dep);
      const act = activeById.get(depStr);
      if (act) {
        if (act.status !== "verified") warn(`${c.id}: dep '${depStr}' is active but in state '${act.status}' (not verified)`, [c.id]);
      } else if (!archiveResolves(depStr)) {
        err(`${c.id}: dep '${depStr}' does not exist (not active, not archived, not compacted)`, [c.id]);
      }
    }
  }
}

// 14) archive: unclosed waivers/decisions in archived changes
{
  const archiveDir = join(root, "openspec", "changes", "archive");
  if (existsSync(archiveDir)) {
    for (const name of readdirSync(archiveDir)) {
      const p = join(archiveDir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      const metaPath = join(p, ".openspec.yaml");
      if (!existsSync(metaPath)) continue;
      const m = lib.normalizeMeta(lib.parseYaml(lib.readText(metaPath)));
      const ws = lib.arr(m.waivers);
      const ds = lib.arr(m.open_decisions);
      const cs = lib.arr(m.conflicts);
      if (ws.length) {
        const expired = ws.filter((w) => {
          if (String(w.state || "").toLowerCase() !== "granted") return false;
          const expRaw = String(w.expires || "");
          const exp = expRaw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(expRaw) ? expRaw + "T23:59:59" : expRaw) : null;
          return !exp || Number.isNaN(exp.getTime()) || exp < new Date();
        });
        warn(`archive ${name}: ${ws.length} registered waiver(s) unclosed${expired.length ? ` (${expired.length} EXPIRED)` : ""}`);
      }
      if (ds.length) warn(`archive ${name}: ${ds.length} decision(s) pending at archive time`);
      if (cs.length) warn(`archive ${name}: ${cs.length} conflict(s) unapproved at archive time`);
    }
  }
}

// 15) test suite (optional; --tests-command does NOT produce green — see evidence)
let testsRecord = null;
const substituted = Boolean(explicitCmd);
if (wantTests) {
  if (explicitCmd && process.env.CI) {
    err("--tests-command forbidden in CI — use test_command (config) with --run-tests");
  } else if (!testsCmd) {
    warn("--run-tests without test_command configured (openspec/config.yaml: test_command)");
  } else if (/[;|&`$<>]/.test(testsCmd) && process.env.SPEC_GROWTH_ALLOW_SHELL_CMD !== "1") {
    err(`test_command with metacharacters requires SPEC_GROWTH_ALLOW_SHELL_CMD=1 — ${testsCmd}`);
  } else {
    let exit = 0;
    let tail = "";
    try {
      const out = execSync(testsCmd, {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        timeout: 15 * 60 * 1000,
        maxBuffer: 64 * 1024 * 1024,
      });
      tail = out.toString();
    } catch (e) {
      if (e && (e.code === "ENOBUFS" || e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER")) {
        exit = 1;
        tail = "output exceeded maxBuffer (64MB)";
      } else {
        exit = e && typeof e.status === "number" ? e.status : 1;
        tail = (e && e.stdout ? e.stdout.toString() : "") + (e && e.stderr ? e.stderr.toString() : "");
      }
    }
    testsRecord = { command: testsCmd, exit, substituted };
    if (exit !== 0) {
      err(`test suite RED — ${testsCmd}`); // global: not degradable by --scope
      const lines = tail.split(/\r?\n/).filter(Boolean);
      const last = lines.slice(-15).join("\n");
      if (last) warnings.push({ msg: `last lines of the suite:\n${last}`, ids: [] });
    }
  }
}

// 15b) --scope <id>: early validation (the real filter runs at the END, over the report only)
if (scopeId && !changes.some((c) => c.id === scopeId)) {
  err(`--scope: change '${scopeId}' does not exist`);
}

// (re-read close to use and write: minimizes lost-update with hook/another agent)
const prevEvidence = lib.readEvidence(root);

// 16) evidence: per-change merge (no global coupling); substituted != green
const now = new Date().toISOString();
const currentOk = (c) => !errors.some((e) => e.ids.includes(c.id)) && (!testsRecord || testsRecord.exit === 0);
const staleMemo = new Map();
function targetStaleness(c) {
  if (staleMemo.has(c.id)) return staleMemo.get(c.id);
  const list = [...c.targets, ...c.tests];
  let maxTs = 0;
  let nul = 0;
  for (const t of list) {
    const ts = lib.gitLastCommitTs(root, t);
    if (ts) maxTs = Math.max(maxTs, ts);
    else nul++;
  }
  const res = { maxTs, allNull: list.length > 0 && nul === list.length };
  staleMemo.set(c.id, res);
  return res;
}
const fpMemo = new Map();
function currentFp(c) {
  if (!fpMemo.has(c.id)) fpMemo.set(c.id, lib.targetsFingerprint(root, [...c.targets, ...c.tests]));
  return fpMemo.get(c.id);
}
// Freshness: content fingerprint first (survives commit-after-green, catches
// uncommitted edits); timestamps only as fallback (legacy evidence / unexpandable targets).
function evidenceStaleReason(c, green) {
  const fp = currentFp(c);
  if (green.files_hash && fp) {
    return green.files_hash === fp ? null : "code changed after the last green run";
  }
  const st = targetStaleness(c);
  if (st.allNull) return "freshness not verifiable (git absent/shallow)";
  if (st.maxTs && st.maxTs > Date.parse(green.at)) return "code changed after the last green run";
  return null;
}
// Green: only from a real run (--run-tests without substitution), green and error-free for the change.
// If the previously tested content is identical, the previous green is kept (not refreshed).
function mergedGreen(c) {
  const prevGreen =
    (prevEvidence && prevEvidence.changes && prevEvidence.changes[c.id] && prevEvidence.changes[c.id].green_tests) || null;
  const freshOk = testsRecord && !testsRecord.substituted && testsRecord.exit === 0 && currentOk(c);
  if (freshOk) {
    const fp = currentFp(c);
    if (prevGreen && fp && prevGreen.files_hash === fp) return prevGreen;
    return { at: now, ok: true, mode: "tests", files_hash: fp || null };
  }
  return prevGreen;
}
for (const c of changes) {
  if (c.status !== "verified") continue;
  if (!c.targets.length) warn(`${c.id}: verified without declared targets (freshness not evaluable)`, [c.id]);
  const green = mergedGreen(c);
  if (!green) {
    const msg = `${c.id}: 'verified' without local green evidence — run 'gate-check --run-tests'`;
    if (testsRecord) err(msg, [c.id]);
    else warn(`${msg} (in static mode it's a warning; in pre-archive it's an error)`, [c.id]);
    continue;
  }
  const reason = evidenceStaleReason(c, green);
  if (reason === "freshness not verifiable (git absent/shallow)") {
    warn(`${c.id}: evidence freshness not verifiable (git absent/shallow)`, [c.id]);
  } else if (reason) {
    warn(`${c.id}: STALE evidence (${reason})`, [c.id]);
  }
}

// 17) pre-archive <id>: archive preconditions
let preArchiveResult = null;
if (preArchiveId) {
  const c = changes.find((x) => x.id === preArchiveId);
  if (!c) {
    err(`pre-archive: change '${preArchiveId}' does not exist`);
  } else {
    if (c.status !== "verified") err(`pre-archive ${c.id}: status '${c.status}' — verified required`, [c.id]);
    const blockingW = c.waivers.filter(blameWaiver);
    if (blockingW.length) err(`pre-archive ${c.id}: ${blockingW.length} blocking waiver(s) (requested/expired)`, [c.id]);
    if (c.open_decisions.length) err(`pre-archive ${c.id}: ${c.open_decisions.length} pending decision(s)`, [c.id]);
    if (c.conflicts.length) err(`pre-archive ${c.id}: ${c.conflicts.length} unapproved conflict(s)`, [c.id]);
    if (c.kind === "architecture") warn(`pre-archive ${c.id}: kind architecture — did /diagram-sync run? (ARCHITECTURE.dsl)`, [c.id]);
    const findingsPath = join(c.dir, "findings.md");
    if (existsSync(findingsPath) && /^\s*[-*]\s+\[ \]/m.test(lib.readText(findingsPath))) {
      warn(`pre-archive ${c.id}: open findings in findings.md (did you resolve them?)`, [c.id]);
    }
    const tasksPath = join(c.dir, "tasks.md");
    if (existsSync(tasksPath) && /^\s*[-*]\s+\[ \]/m.test(lib.readText(tasksPath))) {
      warn(`pre-archive ${c.id}: open tasks in tasks.md (did you finish them?)`, [c.id]);
    }
    if (c.tech_brief) {
      const brief = briefIssues(c);
      if (brief.length) err(`pre-archive ${c.id}: tech brief incomplete — ${brief.join("; ")}`, [c.id]);
      const pend = signoffPending(c);
      const debtWaived = c.waivers.some((w) => String(w.type) === "comprehension-debt" && !blameWaiver(w));
      if (pend && !brief.length && !debtWaived) {
        err(`pre-archive ${c.id}: comprehension sign-off pending (${pend}) — run /spec-verify or grant a comprehension-debt waiver`, [c.id]);
      } else if (pend && debtWaived) {
        warn(`pre-archive ${c.id}: archived with comprehension-debt waiver (${pend})`, [c.id]);
      }
    }
    const green = mergedGreen(c);
    if (c.status === "verified") {
      if (!green) {
        err(`pre-archive ${c.id}: no green evidence — run 'gate-check --run-tests' before archiving`, [c.id]);
      } else {
        const reason = evidenceStaleReason(c, green);
        if (reason === "code changed after the last green run") {
          err(`pre-archive ${c.id}: STALE green evidence (${reason}) — re-run 'gate-check --run-tests' before archiving`, [c.id]);
        }
      }
    }
    const refCandidate = c.merged_as || c.gitref;
    if (!refCandidate) {
      if (lib.gitHead(root)) {
        err(`pre-archive ${c.id}: no gitref or merged_as — merge not verifiable (set gitref; after squash-merge: merged_as)`, [c.id]);
      } else {
        warn(`pre-archive ${c.id}: no gitref or merged_as — merge not verifiable (no git)`, [c.id]);
      }
    } else {
      const anc = lib.gitIsAncestor(root, refCandidate);
      if (anc === true) {
        const trackedNow = lib.listTrackedFiles(root) || [];
        const concrete = [];
        for (const t of c.targets) {
          const ts = String(t);
          if (!/[*?]/.test(ts)) concrete.push(ts);
          else {
            const reT = lib.globToRegExp(ts);
            concrete.push(...trackedNow.filter((f) => reT.test(lib.pathKey(f))));
          }
        }
        const uniq = [...new Set(concrete)];
        if (!uniq.length) {
          err(`pre-archive ${c.id}: no concrete files to verify the merge (empty targets or unmatched globs)`, [c.id]);
        } else {
          try {
            const diffOut = execFileSync("git", ["diff", "--name-only", `${refCandidate}..HEAD`, "--", ...uniq], {
              cwd: root,
              stdio: ["ignore", "pipe", "ignore"],
            })
              .toString()
              .trim();
            if (diffOut) {
              err(`pre-archive ${c.id}: '${refCandidate}' does not contain the current state of the targets (archived before the real merge?)`, [c.id]);
            }
          } catch {
            warn(`pre-archive ${c.id}: could not compare content against '${refCandidate}'`, [c.id]);
          }
        }
      } else if (anc === false) {
        if (c.merged_as) err(`pre-archive ${c.id}: merged_as ${c.merged_as} is not an ancestor of HEAD`, [c.id]);
        else {
          err(
            `pre-archive ${c.id}: gitref ${c.gitref} is not an ancestor of HEAD (not merged? — for squash-merge: 'merged_as: <squash commit sha>')`,
            [c.id]
          );
        }
      } else {
        const head = lib.gitHead(root);
        if (head) err(`pre-archive ${c.id}: ${c.merged_as ? "merged_as" : "gitref"} '${refCandidate}' invalid or ambiguous (git present, ref does not resolve)`, [c.id]);
        else warn(`pre-archive ${c.id}: could not verify the merge (git?)`, [c.id]);
      }
    }
    preArchiveResult = { id: c.id, ok: !errors.some((e) => e.ids.includes(c.id)) };
  }
}

// evidence (merge: keeps the last green run per change)
const changesEv = {};
for (const c of changes) {
  const prevRec = (prevEvidence && prevEvidence.changes && prevEvidence.changes[c.id]) || {};
  changesEv[c.id] = {
    last: { at: now, ok: currentOk(c), mode: testsRecord ? "tests" : "static", status: c.status },
    green_tests: mergedGreen(c) || prevRec.green_tests || null,
  };
}
const evidence = {
  generated_at: now,
  gate_ok: errors.length === 0,
  scope: scopeId || null,
  mode: testsRecord ? (testsRecord.substituted ? "tests-substituted" : "tests") : "static",
  tests: testsRecord,
  changes: changesEv,
};
lib.writeEvidence(root, evidence);

// scope: affects ONLY the report and exit; evidence and gate_ok were computed UNFILTERED
if (scopeId) {
  const inScope = (e) => e.ids.length === 0 || e.ids.includes(scopeId);
  for (const e of errors.filter((x) => !inScope(x))) {
    warnings.push({ msg: `(out of scope: ${e.ids.join(", ")}) ${e.msg}`, ids: e.ids });
  }
  errors.splice(0, errors.length, ...errors.filter(inScope));
}

// report
const errorMsgs = errors.map((e) => e.msg);
const warnMsgs = warnings.map((w) => w.msg);
if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        mode: evidence.mode,
        tests: testsRecord,
        pre_archive: preArchiveResult,
        errors: errorMsgs,
        warnings: warnMsgs,
      },
      null,
      2
    )
  );
} else {
  console.log(`Spec Growth · gate-check (${evidence.mode})${scopeId ? ` · scope: ${scopeId}` : ""} — ${changes.length} active change(s)`);
  console.log(`Errors: ${errors.length} · Warnings: ${warnings.length}\n`);
  if (errorMsgs.length) console.log(errorMsgs.map((e) => `  ✖ ${e}`).join("\n") + "\n");
  if (warnMsgs.length) console.log(warnMsgs.map((w) => `  ⚠ ${w}`).join("\n") + "\n");
  if (preArchiveResult) {
    console.log(
      preArchiveResult.ok
        ? `PRE-ARCHIVE ${preArchiveResult.id}: OK — you can archive (openspec archive ${preArchiveResult.id})`
        : `PRE-ARCHIVE ${preArchiveResult.id}: BLOCKED — fix the errors above`
    );
  }
  console.log(errors.length ? "GATE RED — fix before committing/merging." : "GATE GREEN.");
}
process.exit(errors.length ? 1 : 0);
