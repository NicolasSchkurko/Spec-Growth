#!/usr/bin/env node
// Aggregates runs/*/result.json into per-rule pass rates, per-run all-pass and
// pass^k per task. Writes summary.md next to this file.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");

if (!existsSync(RUNS)) {
  console.log("No runs/ directory yet.");
  process.exit(0);
}

const rows = [];
for (const task of readdirSync(RUNS)) {
  const taskDir = join(RUNS, task);
  if (!existsSync(taskDir)) continue;
  for (const run of readdirSync(taskDir)) {
    const f = join(taskDir, run, "result.json");
    if (existsSync(f)) rows.push(JSON.parse(readFileSync(f, "utf8")));
  }
}
if (!rows.length) {
  console.log("No results yet.");
  process.exit(0);
}

const byTask = {};
for (const r of rows) (byTask[r.task] ??= []).push(r);

let md = `# Conformance summary\n\nGenerated: ${new Date().toISOString()} · model: ${rows[0].model} · runs: ${rows.length}\n\n`;

for (const [task, rs] of Object.entries(byTask).sort()) {
  const k = rs.length;
  const allPassRuns = rs.filter((r) => r.allPass).length;
  const passk = allPassRuns === k ? "YES" : "NO";
  md += `## ${task} — pass^${k}: ${passk} (${allPassRuns}/${k} runs all-pass)\n\n`;
  md += `| rule | pass rate | fails |\n|---|---|---|\n`;
  const taskRules = [...new Set(rs.flatMap((r) => r.rules.map((x) => x.rule)))].sort();
  for (const rule of taskRules) {
    const total = rs.filter((r) => r.rules.some((x) => x.rule === rule)).length;
    const passed = rs.filter((r) => r.rules.some((x) => x.rule === rule && x.pass)).length;
    md += `| ${rule} | ${passed}/${total} | ${total - passed} |\n`;
  }
  md += "\n";
  const failing = rs.filter((x) => !x.allPass);
  if (failing.length) {
    for (const r of failing) {
      const bad = r.rules.filter((x) => !x.pass);
      md += `- run${r.run} (${Math.round(r.durationMs / 1000)}s${
        r.timedOut ? ", TIMEOUT" : ""
      }): ${bad.map((b) => `\`${b.rule}\` — ${b.detail || "no detail"}`).join("; ")}\n`;
    }
    md += "\n";
  }
}

writeFileSync(join(HERE, "summary.md"), md);
console.log(md);
