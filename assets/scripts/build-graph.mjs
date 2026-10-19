#!/usr/bin/env node
// Spec Growth — read-only inventory of what is NOT archived: the declared-deps
// graph plus every living capability and change in flight. The script is
// deterministic; `/spec-deps-graph` adds one plain line per item on top of this.
// Usage: node scripts/gates/build-graph.mjs [--root DIR]
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import * as lib from "./lib.mjs";

const args = process.argv.slice(2);
const getVal = (n) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
};
const root = normalize(getVal("--root") || lib.resolveRoot(process.cwd()) || process.cwd());
if (!existsSync(join(root, "openspec", "changes"))) {
  console.error(`openspec/changes/ not found under: ${root}`);
  process.exit(1);
}

const parseErrors = [];
const changes = lib.listChanges(root, parseErrors);
const { archived, digests, digestIds } = lib.listArchive(root);
const { edges, mermaid } = lib.dependencyGraph(changes, { archived, digestIds });

// Capabilities: the living owners and each change's delta (`provides:` frontmatter).
const living = lib.listCapabilities(root);
const changeCaps = new Map();
for (const c of changes) {
  const caps = [];
  for (const f of lib.walkMd(join(c.dir, "specs"))) {
    const fm = lib.normalizeMeta(lib.readFrontmatter(f));
    for (const id of lib.arr(fm.provides)) if (!caps.includes(id)) caps.push(id);
  }
  changeCaps.set(c.id, caps);
}
const depStatus = new Map(edges.map((e) => [`${e.to}\0${e.from}`, e.verified]));

const out = [];
out.push(`Spec graph · root: ${root}`);
out.push(
  `${changes.length} in flight · ${living.length} living spec(s) · archive: ${archived.length} change(s)` +
    (digests.length ? ` + ${digests.length} digest(s)` : "") +
    " (excluded)"
);
out.push("");
out.push("## Dependency graph (declared deps)");
out.push("");
out.push(mermaid ? "```mermaid\n" + mermaid + "```" : "_(no change declares deps)_");
out.push("");
out.push("## Living specs — the present contract (openspec/specs/)");
out.push("");
out.push(living.length ? living.map((cap) => `- ${cap.provides.join(", ")}  ·  ${cap.path}`).join("\n") : "_(none)_");
out.push("");
out.push("## Changes in flight (openspec/changes/)");
out.push("");
if (changes.length) {
  for (const c of changes) {
    out.push(`- [${c.status}] ${c.id} (${c.kind}) — ${c.title || "(no proposal title)"}`);
    const meta = [];
    if (c.targets.length) meta.push(`targets: ${c.targets.join(", ")}`);
    const caps = changeCaps.get(c.id);
    if (caps.length) meta.push(`provides: ${caps.join(", ")}`);
    if (c.deps.length) {
      meta.push(
        `deps: ${c.deps
          .map((d) => {
            const s = depStatus.get(`${c.id}\0${d}`);
            return `${d} (${s === true ? "verified" : s === false ? "unverified" : "unknown"})`;
          })
          .join(", ")}`
      );
    }
    if (c.tech_brief) meta.push("tech_brief: true");
    if (meta.length) out.push(`    ${meta.join(" · ")}`);
  }
} else {
  out.push("_(none)_");
}
if (parseErrors.length) {
  out.push("");
  out.push("## Warnings");
  out.push("");
  for (const pe of parseErrors) out.push(`- ${pe.id}: ${pe.file}${pe.line ? ` line ${pe.line}` : ""} — ${pe.text.slice(0, 70)}`);
}
process.stdout.write(out.join("\n") + "\n");
