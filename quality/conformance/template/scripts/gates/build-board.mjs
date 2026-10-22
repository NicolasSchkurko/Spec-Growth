#!/usr/bin/env node
// Spec Growth — generates BOARD.md and openspec/board.json (v1.0).
// Human sections: pending approvals · decisions/⚔ conflicts · in progress (with
// real green evidence) · drafts · registered waivers · invalid states · blocked ·
// archive · warnings. The capability registry is machine data.
// Usage: node scripts/gates/build-board.mjs [--root DIR]
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import * as lib from "./lib.mjs";

const args = process.argv.slice(2);
const getVal = (n) => {
  const eq = args.find((a) => a.startsWith(n + "="));
  if (eq) return eq.slice(n.length + 1);
  const i = args.indexOf(n);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  return undefined;
};
const root = normalize(getVal("--root") || lib.resolveRoot(process.cwd()) || process.cwd());
if (!existsSync(join(root, "openspec", "changes"))) {
  console.error(`openspec/changes/ not found under: ${root}`);
  process.exit(1);
}

const STATUSES = ["draft", "accepted", "applying", "verified", "blocked", "rejected", "superseded"];
const ADVANCED = ["accepted", "applying", "verified"];
const TERMINAL = ["rejected", "superseded"];

const parseErrors = [];
const changes = lib.listChanges(root, parseErrors);
const { archived, digests, digestIds } = lib.listArchive(root);
const cfg = lib.readConfig(root);
const evidence = lib.readEvidence(root);

// declared dependency graph (change -> deps); archived deps count as resolved
const byIdAll = new Map(changes.map((c) => [c.id, c]));
const { edges: depEdges, mermaid: depMermaid } = lib.dependencyGraph(changes, { archived, digestIds });

// capabilities (living + deltas) — only for visible duplicates
const caps = new Map();
const pushCap = (id, source, path) => {
  const key = String(id).trim().toLowerCase();
  if (!caps.has(key)) caps.set(key, []);
  caps.get(key).push({ source, path });
};
for (const cap of lib.listCapabilities(root)) for (const id of cap.provides) pushCap(id, "living", cap.path);
for (const c of changes) {
  for (const f of lib.walkMd(join(c.dir, "specs"))) {
    const fm = lib.normalizeMeta(lib.readFrontmatter(f));
    for (const id of lib.arr(fm.provides)) pushCap(id, c.id, `changes/${c.id}`);
  }
}
const duplicates = [...caps.entries()].filter(([, p]) => p.length > 1);

// global warnings
const warnings = [];
for (const pe of parseErrors) {
  warnings.push(`${pe.id}: ${pe.file}${pe.line ? ` line ${pe.line}` : ""} — ${pe.text.slice(0, 70)}`);
}
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
      for (const key of expanded) pairs.push({ id: c.id, status: c.status, raw: String(t), key });
    }
  }
  const seen = new Set();
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i];
      const b = pairs[j];
      if (a.id === b.id) continue;
      if (!lib.targetsOverlap(a.key, b.key)) continue;
      const k = [a.id, b.id].sort().join("|") + "::" + [String(a.raw), String(b.raw)].sort().join(" ~ ");
      if (seen.has(k)) continue;
      seen.add(k);
      warnings.push(
        `targets overlap: '${a.raw}' (${a.id}, ${a.status}) and '${b.raw}' (${b.id}, ${b.status})` +
          (sequenced(a.id, b.id) ? " — sequenced by deps (declared order)" : "")
      );
    }
  }
}
for (const [id, providers] of duplicates) {
  warnings.push(`duplicate capability ${id}: ${providers.map((p) => p.source).join(", ")}`);
}

// classification
const pendingApproval = [];
const pendingDecision = [];
const pendingConflict = [];
const inProgress = [];
const drafts = [];
const blocked = [];
const invalid = [];
const openWaivers = [];
const pendingComprehension = [];
for (const c of changes) {
  const hits = new Map();
  for (const t of c.targets) {
    const z = lib.matchZones(t, cfg.protectedZones);
    if (z) hits.set(z.glob, t);
  }
  if (hits.size && !c.human_approved && !TERMINAL.includes(c.status)) {
    pendingApproval.push({ c, zones: [...hits.keys()] });
  }
  for (const d of c.open_decisions) {
    if (d.question && !TERMINAL.includes(c.status)) pendingDecision.push({ c, d });
  }
  for (const cf of c.conflicts) {
    if (cf.what && !TERMINAL.includes(c.status)) pendingConflict.push({ c, cf });
  }
  for (const w of c.waivers) {
    if (!TERMINAL.includes(c.status)) openWaivers.push({ c, w });
  }
  if (!STATUSES.includes(c.status)) invalid.push(c);
  else if (ADVANCED.includes(c.status)) inProgress.push(c);
  else if (c.status === "draft") drafts.push(c);
  else if (["blocked", "rejected", "superseded"].includes(c.status)) blocked.push(c);
}
for (const c of changes) {
  if (!c.tech_brief || TERMINAL.includes(c.status) || !["applying", "verified"].includes(c.status)) continue;
  const has = existsSync(join(c.dir, "walkthrough.md"));
  const issues = has ? lib.briefIssues(c.dir) : [];
  const todo = has ? lib.signoffTodoIn(c.dir) : false;
  const signed = Boolean(c.understood_by && c.understood_at);
  if (!has || issues.length || todo || !signed) pendingComprehension.push({ c, has, issues, todo, signed });
}

const fmt = (iso) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });

function evidenceBadge(c) {
  if (evidence && evidence.gate_ok === false) return "⚠ last gate run: RED (evidence not current)";
  const rec = evidence && evidence.changes ? evidence.changes[c.id] : null;
  const green = rec && rec.green_tests;
  if (!green) return "⚠ no green test evidence";
  const list = [...c.targets, ...c.tests];
  const fp = lib.targetsFingerprint(root, list);
  if (green.files_hash && fp) {
    return green.files_hash === fp
      ? `✅ evidence ${fmt(green.at)} (tests)`
      : `⚠ stale evidence (${fmt(green.at)}) — targets changed`;
  }
  let maxTs = 0;
  let nul = 0;
  for (const t of list) {
    const ts = lib.gitLastCommitTs(root, t);
    if (ts) maxTs = Math.max(maxTs, ts);
    else nul++;
  }
  if (list.length && nul === list.length) return `⚠ evidence (${fmt(green.at)}) — freshness not verifiable`;
  if (maxTs && maxTs > Date.parse(green.at)) return `⚠ stale evidence (${fmt(green.at)})`;
  return `✅ evidence ${fmt(green.at)} (tests)`;
}

const line = (c, extra = "") => `- [${c.status}] **${c.id}** (${c.kind})${c.title ? ` — ${c.title}` : ""}${extra}`;

// --- BOARD.md ---
let md = `# BOARD\n\n> Generated by \`node scripts/gates/build-board.mjs\` — **do not edit by hand** · ${new Date().toISOString()}\n\n`;

md += `## 🔒 Awaiting your approval (protected zones)\n\n`;
md += pendingApproval.length
  ? pendingApproval
      .map(
        ({ c, zones }) =>
          `- **${c.id}** (${c.kind}${c.status === "draft" ? ", draft" : ""}) — touches: ${zones.join(", ")} → on approval: \`human_approved: true\` + ADR in DECISIONS.md`
      )
      .join("\n")
  : "_(nothing pending)_";
md += `\n\n## ⏸ Awaiting your decision\n\n`;
md += pendingDecision.length || pendingConflict.length
  ? [
      ...pendingDecision.map(
        ({ c, d }) => `- **${c.id}** — "${d.question}"${d.proposal ? ` · proposal: ${d.proposal}` : ""} → resolve + DECISIONS.md`
      ),
      ...pendingConflict.map(
        ({ c, cf }) =>
          `- **${c.id}** — ⚔ "${cf.what}" (against ${cf.with})${cf.proposal ? ` · proposal: ${cf.proposal}` : ""} → approve + DECISIONS.md`
      ),
    ].join("\n")
  : "_(nothing pending)_";
md += `\n\n## In progress\n\n`;
md += inProgress.length
  ? inProgress.map((c) => line(c, c.status === "verified" ? ` · ${evidenceBadge(c)}` : "")).join("\n")
  : "_(empty)_";
md += `\n\n## Drafts\n\n`;
md += drafts.length ? drafts.map((c) => line(c)).join("\n") : "_(empty)_";
md += `\n\n## ⚠ Registered waivers (pending and in force)\n\n`;
md += openWaivers.length
  ? openWaivers
      .map(({ c, w }) => `- **${c.id}** — ${w.type || "?"} (${w.state || "?"}${w.expires ? `, expires ${w.expires}` : ""}): ${w.reason || "no reason"}`)
      .join("\n")
  : "_(none)_";
md += `\n\n## 🧠 Awaiting your comprehension (tech brief)\n\n`;
md += pendingComprehension.length
  ? pendingComprehension
      .map(({ c, has, issues, todo, signed }) => {
        const state = !has
          ? "walkthrough not written yet"
          : issues.length
            ? `tech brief incomplete (${issues.join("; ")})`
            : todo
              ? "walkthrough ready — answers pending (`/spec-verify`)"
              : !signed
                ? "walkthrough ready — sign-off pending (`/spec-verify`)"
                : "walkthrough ready";
        return `- **${c.id}** (${c.status}) — ${state}`;
      })
      .join("\n")
  : "_(nothing pending)_";
if (invalid.length) {
  md += `\n\n## ⚠ Invalid state (fix .openspec.yaml)\n\n`;
  md += invalid.map((c) => `- **${c.id}** — status: \`${c.status}\``).join("\n");
}
md += `\n\n## Blocked / rejected\n\n`;
md += blocked.length ? blocked.map((c) => line(c)).join("\n") : "_(empty)_";
md += `\n\n## Capabilities (living specs)\n\n`;
const dslPath = join(root, "ARCHITECTURE.dsl");
const dslText = existsSync(dslPath) ? lib.readText(dslPath).toLowerCase() : null;
md += caps.size
  ? [...caps.entries()]
      .map(([id, ps]) => {
        let line = `- **${id}** — ${ps
          .map((p) =>
            p.source === "living"
              ? `owner: ${p.path}`
              : `${byIdAll.get(p.source)?.status || "draft"} in ${p.source}`
          )
          .join(" · ")}`;
        if (dslText && id.startsWith("cap:")) {
          const folder = id.slice(4).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (!new RegExp("cap:" + folder + "(?![a-z0-9._-])").test(dslText)) line += " · ⚠ not tagged in ARCHITECTURE.dsl";
        }
        return line;
      })
      .join("\n")
  : "_(none registered)_";
md += `\n\n## Dependency graph (declared deps)\n\n`;
md += depMermaid ? "```mermaid\n" + depMermaid + "```" : "_(no declared dependencies)_";
md += `\n\n## Archive\n\n- Archived changes: ${archived.length}`;
if (digests.length) md += ` · digests: ${digests.join(", ")}`;
md += "\n";
if (archived.length) {
  md += archived.slice(0, 5).map((a) => `- ${a}`).join("\n") + "\n";
  if (archived.length > 5) md += `- _(+${archived.length - 5} older)_\n`;
}
if (warnings.length) md += `\n## Warnings\n\n${warnings.map((w) => `- ${w}`).join("\n")}\n`;
lib.writeAtomic(join(root, "BOARD.md"), md);

// --- board.json ---
const board = {
  generated_at: new Date().toISOString(),
  active_count: changes.length,
  active: changes,
  archive: { count: archived.length, digests, recent: archived.slice(0, 5) },
  registry: {
    capabilities: [...caps.entries()].map(([id, providers]) => ({ id, providers })),
    duplicates: duplicates.map(([id, providers]) => ({ id, providers })),
  },
  dependencies: depEdges,
  protected_zones: cfg.protectedZones,
  evidence: evidence
    ? { generated_at: evidence.generated_at, gate_ok: evidence.gate_ok !== false, mode: evidence.mode, tests: evidence.tests }
    : null,
  pacing: {
    pending_approval: pendingApproval.map(({ c }) => c.id),
    pending_decisions: pendingDecision.map(({ c }) => c.id),
    pending_conflicts: pendingConflict.map(({ c, cf }) => ({ change: c.id, with: cf.with, what: cf.what })),
    open_waivers: openWaivers.map(({ c, w }) => ({ change: c.id, type: w.type, state: w.state })),
    pending_comprehension: pendingComprehension.map(({ c }) => c.id),
    invalid_status: invalid.map((c) => c.id),
  },
  warnings,
};
lib.writeAtomic(join(root, "openspec", "board.json"), JSON.stringify(board, null, 2) + "\n");

console.log(
  `BOARD.md + openspec/board.json regenerated · ${changes.length} active · ${archived.length} archived · ` +
    `${pendingApproval.length} approval(s) · ${pendingDecision.length} decision(s) · ${pendingConflict.length} conflict(s) · ${openWaivers.length} open waiver(s)` +
    (pendingComprehension.length ? ` · 🧠 ${pendingComprehension.length} comprehension pending` : "") +
    (invalid.length ? ` · ⚠ ${invalid.length} invalid state(s)` : "")
);
if (warnings.length) console.log(`⚠ ${warnings.length} warning(s) — see BOARD.md`);
