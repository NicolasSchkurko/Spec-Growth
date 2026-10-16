#!/usr/bin/env node
// Re-scores EXISTING runs with the current checkers (no agent runs repeated).
// Use when a checker fix or fixture fix lands: `node recheck.mjs [taskId ...]`.
// Rewrites each run's result.json and keeps any judge rules it already had.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TASKS } from "./tasks.mjs";
import { checkRun } from "./check.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const wanted = process.argv.slice(2);
const tasks = TASKS.filter((t) => !wanted.length || wanted.includes(t.id));

for (const task of tasks) {
  const taskDir = join(RUNS, task.id);
  if (!existsSync(taskDir)) continue;
  for (const run of readdirSync(taskDir)) {
    const runBase = join(taskDir, run);
    const resultPath = join(runBase, "result.json");
    if (!existsSync(resultPath)) continue;
    let repo = join(runBase, "repo");
    if (!existsSync(repo)) {
      const cand = readdirSync(runBase).find((d) => d.startsWith("repo"));
      if (cand) repo = join(runBase, cand);
    }
    if (!existsSync(repo)) {
      console.log(`[${task.id} ${run}] skipped (no repo dir)`);
      continue;
    }
    const result = JSON.parse(readFileSync(resultPath, "utf8"));
    const rules = await checkRun({ task, runDir: repo, runBase });
    const judgeRules = (result.rules || []).filter((r) => r.rule.startsWith("judge."));
    result.rules = [...rules, ...judgeRules];
    result.allPass = result.rules.every((x) => x.pass);
    result.recheckedAt = new Date().toISOString();
    writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`[${task.id} ${run}] ${result.allPass ? "PASS" : "fail"}`);
  }
}
