#!/usr/bin/env node
// Per-run token usage for conformance runs, read from the OpenCode session DB
// (read-only). Maps sessions to runs by directory (agent runs) and title
// (judges), taking the newest session per slot. Writes tokens.md.

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { DatabaseSync } from "node:sqlite";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const DB = process.env.OPENCODE_DB || join(homedir(), ".local", "share", "opencode", "opencode.db");

if (!existsSync(DB)) {
  console.error(`Session DB not found: ${DB} (set OPENCODE_DB to override)`);
  process.exit(1);
}

const slots = [];
if (existsSync(RUNS)) {
  for (const task of readdirSync(RUNS)) {
    const taskDir = join(RUNS, task);
    if (!task.startsWith("t") || !existsSync(taskDir)) continue;
    for (const run of readdirSync(taskDir)) {
      if (existsSync(join(taskDir, run, "result.json"))) slots.push({ task, run });
    }
  }
}
if (!slots.length) {
  console.log("No runs with result.json yet.");
  process.exit(0);
}

const db = new DatabaseSync(DB, { readOnly: true });
const rows = db
  .prepare(
    `SELECT id, title, directory, model, tokens_input, tokens_output, tokens_reasoning,
            tokens_cache_read, tokens_cache_write, cost, time_created
     FROM session_v2 WHERE title LIKE 'conf %' ORDER BY time_created ASC`
  )
  .all();

const norm = (s) => String(s || "").replace(/\\/g, "/").toLowerCase();
const n = (v) => Number(v || 0);
const total = (r) =>
  r
    ? n(r.tokens_input) + n(r.tokens_output) + n(r.tokens_reasoning) + n(r.tokens_cache_read) + n(r.tokens_cache_write)
    : 0;
const iso = (ms) => (ms ? new Date(Number(ms)).toISOString().slice(5, 16).replace("T", " ") : "?");

function pick(slot) {
  const needle = `/quality/conformance/runs/${slot.task}/${slot.run}/repo`.toLowerCase();
  const agent = rows.filter((r) => norm(r.directory).includes(needle)).pop() || null;
  const judge = rows.filter((r) => r.title === `conf judge ${slot.task} ${slot.run}`).pop() || null;
  return { agent, judge };
}

let md = `# Conformance token usage\n\nDB: ${DB}\n\n`;
md += `| task | run | agent in | agent out | cache read | cache write | agent total | judge total | agent session | started |\n`;
md += `|---|---|---|---|---|---|---|---|---|---|\n`;

const perTask = new Map();
for (const slot of slots.sort((a, b) => a.task.localeCompare(b.task) || a.run.localeCompare(b.run))) {
  const { agent, judge } = pick(slot);
  md += `| ${slot.task} | ${slot.run} | ${n(agent?.tokens_input)} | ${n(agent?.tokens_output)} | ${n(
    agent?.tokens_cache_read
  )} | ${n(agent?.tokens_cache_write)} | ${total(agent)} | ${total(judge)} | ${
    agent ? agent.id : "not found"
  } | ${iso(agent?.time_created)} |\n`;
  if (!perTask.has(slot.task)) perTask.set(slot.task, []);
  perTask.get(slot.task).push({ aTotal: total(agent), jTotal: total(judge) });
}

md += `\n## Per task (mean per run)\n\n| task | runs | mean agent total | mean judge total |\n|---|---|---|---|\n`;
const mean = (arr) => Math.round(arr.reduce((s, x) => s + x, 0) / Math.max(1, arr.length));
for (const [task, list] of [...perTask.entries()].sort()) {
  md += `| ${task} | ${list.length} | ${mean(list.map((x) => x.aTotal))} | ${mean(list.map((x) => x.jTotal))} |\n`;
}

writeFileSync(join(HERE, "tokens.md"), md);
console.log(md);
