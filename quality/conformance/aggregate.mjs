#!/usr/bin/env node
// Aggregates runs/*/result.json into per-rule pass rates, per-run all-pass and
// pass^k per task. Writes summary.md next to this file.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TASKS } from "./tasks.mjs";

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

for (const [task, rs0] of Object.entries(byTask).sort()) {
  const tdef = TASKS.find((t) => t.id === task);

  // Batch marker written by run.mjs at batch start: excludes stale runs from earlier
  // batches and flags missing ones — a crashed run must not shrink pass^k silently.
  let batch = null;
  const batchFile = join(RUNS, task, "batch.json");
  if (existsSync(batchFile)) {
    try {
      batch = JSON.parse(readFileSync(batchFile, "utf8"));
    } catch {
      batch = null;
    }
  }
  const notes = [];
  let rs = rs0;
  if (batch && batch.startedAt) {
    // Same batch = finished after the marker AND (if known) same model: guards against
    // two concurrent invocations for the same task mixing their results.
    const sameBatch = (r) =>
      r.finishedAt &&
      r.finishedAt >= batch.startedAt &&
      (!batch.model || !r.model || r.model === batch.model);
    const stale = rs0.filter((r) => !sameBatch(r));
    rs = rs0.filter(sameBatch);
    if (stale.length) notes.push(`${stale.length} stale run(s) from earlier batches excluded (time or model mismatch)`);
  } else if (rs0.length) {
    notes.push("no batch marker for this task (runs from different batches may be mixed — re-run to regenerate)");
  }
  const planned = Number(batch && batch.runs) || (tdef ? tdef.runs : null);
  const complete = !planned || rs.length === planned;
  if (planned && rs.length < planned) notes.push(`${planned - rs.length} planned run(s) missing (crashed before result.json?)`);
  if (planned && rs.length > planned) notes.push(`${rs.length - planned} extra run(s) beyond the plan`);

  const k = rs.length;
  const allPassRuns = rs.filter((r) => r.allPass).length;
  const judged = Boolean(tdef && tdef.judge);
  const judgeRuns = rs.filter((r) => r.rules.some((x) => x.rule === `judge.${task}`)).length;
  if (judged && judgeRuns < k) {
    notes.push(
      `judge rules present in ${judgeRuns}/${k} run(s) — semantic verdict missing (run with --judge; mechanical-only counting is a false green)`
    );
  }
  const passk = complete && (!judged || judgeRuns === k) ? (allPassRuns === k ? "YES" : "NO") : "INCOMPLETE";
  md += `## ${task} — pass^${k}: ${passk} (${allPassRuns}/${k} runs all-pass)\n\n`;
  md += `| rule | pass rate | fails |\n|---|---|---|\n`;
  const taskRules = [...new Set(rs.flatMap((r) => r.rules.map((x) => x.rule)))].sort();
  for (const rule of taskRules) {
    const total = rs.filter((r) => r.rules.some((x) => x.rule === rule)).length;
    const passed = rs.filter((r) => r.rules.some((x) => x.rule === rule && x.pass)).length;
    md += `| ${rule} | ${passed}/${total} | ${total - passed} |\n`;
  }
  md += "\n";
  for (const n of notes) md += `- ⚠ ${n}\n`;
  if (notes.length) md += "\n";
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
