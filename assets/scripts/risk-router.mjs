#!/usr/bin/env node
// Spec Growth — risk router (v1.5 prototype).
// Decides whether a change MAY take the FAST path (/spec-quick) or MUST take the
// full flow (/spec-add). Mechanical and read-only: it only reads openspec/config.yaml,
// the change metadata and the git filesystem. It fixes nothing and writes nothing.
//
// The router is the guardrail that keeps the fast path honest: /spec-quick is a
// low-risk path, not a shortcut around the gate. Anything the router sends to FULL
// keeps every existing invariant (human acceptance before code, protected zones,
// tech brief + comprehension sign-off, decisions, conflicts).
//
// Usage:
//   node scripts/gates/risk-router.mjs --kind fix --targets "src/a.js,src/b.js"
//   node scripts/gates/risk-router.mjs --id dark-mode
//   node scripts/gates/risk-router.mjs --kind feature --targets "src/**" --tech
//
// Judgment flags (the machine cannot see these; the agent must pass them truthfully):
//   --tech      touches persistence/state, concurrency, networking, platform SDKs or security
//   --dep       adds a dependency
//   --new-cap   creates a new capability
//   --conflict  contradicts an ADR, a living requirement or an in-force waiver
//   --decision  carries a question beyond the agent's authority
//
// Options: [--root DIR] [--max-roots N] [--json]
// Exit: 0 = FAST · 10 = FULL · 1 = usage error.

import { join, normalize } from "node:path";
import { existsSync } from "node:fs";
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
const root = normalize(getVal("--root") || lib.resolveRoot(process.cwd()) || process.cwd());
const maxRootsRaw = getVal("--max-roots") || process.env.SPEC_GROWTH_QUICK_MAX_ROOTS || "5";
const maxRoots = Number(maxRootsRaw);
if (!Number.isInteger(maxRoots) || maxRoots < 1) {
  console.error(`--max-roots must be a positive integer (got '${maxRootsRaw}')`);
  process.exit(1);
}

const KINDS = ["fix", "feature", "architecture", "refactor"];

// Inputs: either --id (an existing change) or --kind/--targets (a request not yet created).
let kind = getVal("--kind");
let targets = (getVal("--targets") || "")
  .split(",")
  .map((t) => lib.clean(t))
  .filter(Boolean);
let id = getVal("--id");
let conflicts = args.includes("--conflict");
let decisions = args.includes("--decision");
let tech = args.includes("--tech");

if (id) {
  const dir = join(root, "openspec", "changes", id);
  if (!existsSync(dir)) {
    console.error(`change '${id}' not found under ${join(root, "openspec", "changes")}`);
    process.exit(1);
  }
  const c = lib.readChange(root, id);
  kind = kind || c.kind;
  targets = targets.length ? targets : c.targets;
  tech = tech || c.tech_brief;
  conflicts = conflicts || c.conflicts.length > 0;
  decisions = decisions || c.open_decisions.length > 0;
}

if (!kind || !KINDS.includes(kind)) {
  console.error(`--kind must be one of ${KINDS.join("|")} (got '${kind || ""}')`);
  process.exit(1);
}
if (!targets.length) {
  console.error("--targets is empty — a change with no declared target cannot be routed");
  process.exit(1);
}

// --- rules: each one is a reason to take the FULL flow ---
const reasons = [];

if (kind === "architecture") {
  reasons.push("kind: architecture — design decisions and an ADR belong in the full flow");
}
if (tech) {
  reasons.push("touches persistence/state, concurrency, networking, platform SDKs or security → tech_brief + comprehension sign-off");
}
if (args.includes("--dep")) {
  reasons.push("adds a dependency → tech_brief + comprehension sign-off");
}
if (args.includes("--new-cap")) {
  reasons.push("creates a new capability → the folder name IS the capability id; pick it deliberately in /spec-add");
}
if (conflicts) {
  reasons.push("contradicts something already decided or written (⚔) → awaits an explicit reversal in DECISIONS.md");
}
if (decisions) {
  reasons.push("carries a question beyond the agent's authority (⏸) → open decision before verified");
}

// Protected zones: mechanical, glob-matched against openspec/config.yaml `protected:`.
const cfgErrors = [];
const cfg = lib.readConfig(root, cfgErrors);
for (const t of targets) {
  const zone = lib.matchZones(t, cfg.protectedZones);
  if (zone) reasons.push(`target '${t}' crosses the protected zone '${zone.glob}' → explicit human approval + ADR`);
}
for (const e of cfgErrors) {
  reasons.push(`openspec/config.yaml line ${e.line} not parsed — fix it before routing`);
}

// Spread: a wide change (many independent roots) is not "small".
const roots = new Set(
  targets.map((t) => {
    const key = lib.pathKey(t);
    const head = key.replace(/\/\*\*.*$/, "").replace(/^([^/]+)\/.*$/, "$1");
    return head || key;
  })
);
if (roots.size > maxRoots) {
  reasons.push(`${roots.size} distinct roots (> ${maxRoots}) — too broad for the fast path (SPEC_GROWTH_QUICK_MAX_ROOTS)`);
}

const verdict = reasons.length ? "FULL" : "FAST";

if (asJson) {
  console.log(JSON.stringify({ verdict, kind, targets, roots: [...roots], max_roots: maxRoots, reasons }, null, 2));
} else {
  console.log(`Spec Growth · risk-router — ${verdict}`);
  console.log(`kind: ${kind} · targets: ${targets.length} · roots: ${roots.size}/${maxRoots}`);
  if (reasons.length) {
    console.log("\nTake the FULL flow (/spec-add). Reasons:");
    for (const r of reasons) console.log(`  ✖ ${r}`);
  } else {
    console.log("\nLow-risk change: the FAST path (/spec-quick) is allowed.");
    console.log("The gate, the evidence and every human-only approval still apply.");
  }
}

process.exit(verdict === "FAST" ? 0 : 10);
