#!/usr/bin/env node
// Conformance runner. Builds a pristine fixture repo per run, executes the real
// agent headless (`opencode run`), then scores it with check.mjs (+ optional
// cross-family LLM judge). Results land in runs/<task>/run<N>/.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CLI, DEFAULT_JUDGE, DEFAULT_MODEL, TASKS } from "./tasks.mjs";
import { checkRun } from "./check.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "template");
const SEEDS = join(HERE, "seeds");
const RUNS = join(HERE, "runs");

const CLI = process.env.OPENCODE_BIN || DEFAULT_CLI;
const TIMEOUT_MS = Number(process.env.CONF_TIMEOUT_MS || 600000);

// --- args ---
const argv = process.argv.slice(2);
const opts = { runs: null, conc: 3, judge: false, only: [], model: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--runs") opts.runs = Number(argv[++i]);
  else if (a === "--conc") opts.conc = Number(argv[++i]);
  else if (a === "--judge") opts.judge = true;
  else if (a === "--model") opts.model = argv[++i];
  else opts.only.push(a);
}
const MODEL = opts.model || process.env.CONF_MODEL || DEFAULT_MODEL;
const JUDGE = process.env.CONF_JUDGE || DEFAULT_JUDGE;

let selected = TASKS.filter((t) => !opts.only.length || opts.only.includes(t.id));
if (!selected.length) {
  console.error("No tasks selected. Available:", TASKS.map((t) => t.id).join(", "));
  process.exit(1);
}

// --- git helpers ---
const GIT_IDENT = ["-c", "user.name=conformance", "-c", "user.email=conformance@local"];
const g = (dir, args) => spawnSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
const gOut = (dir, args) => g(dir, args).stdout?.toString().trim() ?? "";

function removeDirRobust(dir) {
  for (let i = 0; i < 12; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return true;
    } catch {
      const until = Date.now() + 500; // Windows locks (watchers/AV) are transient
      while (Date.now() < until) {
        /* backoff */
      }
    }
  }
  return false;
}

function buildRepo(task, runBase) {
  let repo = join(runBase, "repo");
  if (existsSync(repo) && !removeDirRobust(repo)) {
    // a previous session's watcher still holds a handle: use a fresh sibling
    repo = join(runBase, `repo-${Date.now()}`);
  }
  cpSync(TEMPLATE, repo, { recursive: true });
  if (task.seed) cpSync(join(SEEDS, task.seed), repo, { recursive: true });
  g(repo, ["init", "-b", "main"]);
  g(repo, ["add", "-A"]);
  g(repo, [...GIT_IDENT, "commit", "-m", `seed: ${task.id}`]);
  if (task.pinGitref) {
    const sha = gOut(repo, ["rev-parse", "--short", "HEAD"]);
    const f = join(repo, "openspec", "changes", task.pinGitref, ".openspec.yaml");
    const text = readFileSync(f, "utf8").replace(/\r?\n*$/, "\n") + `gitref: ${sha}\n`;
    writeFileSync(f, text);
    g(repo, ["add", "-A"]);
    g(repo, [...GIT_IDENT, "commit", "-m", "pin gitref"]);
  }
  return repo;
}

// --- agent under test ---
function spawnAgent(cwd, message, model, timeoutMs, title) {
  return new Promise((resolve) => {
    const args = ["run", message, "--model", model, "--auto"];
    if (title) args.push("--title", title);
    let child;
    try {
      child = spawn(CLI, args, {
        cwd,
        env: { ...process.env, NO_COLOR: "1" },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      // Windows raises some spawn failures synchronously (e.g. EFTYPE).
      resolve({ stdout: "", stderr: `${(err && err.message) || err}\n`, code: "spawn-error", timedOut: false, durationMs: 0 });
      return;
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const started = Date.now();
    const killer = setTimeout(() => {
      timedOut = true;
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(killer);
      resolve({ stdout, stderr: `${stderr}${(err && err.message) || err}\n`, code: "spawn-error", timedOut: false, durationMs: Date.now() - started });
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      resolve({ stdout, stderr, code, timedOut, durationMs: Date.now() - started });
    });
  });
}

function parseJudgeJson(text) {
  // Preferred form: the instructed single JSON line, parsed as a whole, so braces
  // inside `reasons` are harmless.
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (!t.startsWith("{") || !t.endsWith("}")) continue;
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj.verdict === "string") return obj;
    } catch {
      /* keep scanning */
    }
  }
  // Fallback: a pretty-printed single object (previous behavior).
  const matches = [...text.matchAll(/\{[\s\S]*?\}/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(matches[i][0]);
      if (obj && typeof obj.verdict === "string") return obj;
    } catch {
      /* keep scanning */
    }
  }
  return null;
}

async function judgeRun(task, runBase, runDir) {
  const transcript = join(runBase, "transcript.txt");
  const message = [
    "You are an independent conformance judge. Do NOT modify anything.",
    `Read the agent transcript at: ${transcript}`,
    `The repository under test is at: ${runDir} (read files there if you need to verify claims).`,
    task.judge.rubric,
    'End your answer with EXACTLY one JSON line: {"verdict":"pass"|"fail","score":<0-5>,"reasons":"<one sentence>"}',
  ].join("\n\n");
  const runLabel = runBase.split(/[\\/]/).pop();
  const r = await spawnAgent(HERE, message, JUDGE, 300000, `conf judge ${task.id} ${runLabel}`);
  writeFileSync(join(runBase, "judge-transcript.txt"), r.stdout + "\n---STDERR---\n" + r.stderr);
  const parsed = parseJudgeJson(r.stdout);
  return parsed
    ? {
        rule: `judge.${task.id}`,
        pass: parsed.verdict === "pass",
        detail: `score=${parsed.score} ${parsed.reasons ?? ""}`.slice(0, 300),
      }
    : { rule: `judge.${task.id}`, pass: false, detail: "judge output unparsable" };
}

// --- one run ---
async function runOne(task, index) {
  const runBase = join(RUNS, task.id, `run${index + 1}`);
  mkdirSync(runBase, { recursive: true });
  const repo = buildRepo(task, runBase);
  // The commit the agent starts from: checkers measure "touched X" against it.
  writeFileSync(join(runBase, "base.txt"), gOut(repo, ["rev-parse", "HEAD"]) + "\n");

  const r = await spawnAgent(repo, task.prompt, MODEL, TIMEOUT_MS, `conf ${task.id} run${index + 1}`);
  writeFileSync(join(runBase, "transcript.txt"), r.stdout);
  writeFileSync(join(runBase, "stderr.txt"), r.stderr);

  const rules = await checkRun({ task, runDir: repo, runBase });
  if (opts.judge && task.judge) rules.push(await judgeRun(task, runBase, repo));

  const result = {
    task: task.id,
    run: index + 1,
    model: MODEL,
    exitCode: r.code,
    timedOut: r.timedOut,
    durationMs: r.durationMs,
    rules,
    allPass: rules.every((x) => x.pass),
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(join(runBase, "result.json"), JSON.stringify(result, null, 2));
  const failed = rules.filter((x) => !x.pass).map((x) => x.rule);
  console.log(
    `[${task.id} run${index + 1}] ${result.allPass ? "PASS" : "fail"} (${Math.round(
      r.durationMs / 1000
    )}s${r.timedOut ? ", TIMEOUT" : ""})${failed.length ? " — " + failed.join(", ") : ""}`
  );
  return result;
}

async function pool(items, conc, fn) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(conc, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// --- main ---
if (!existsSync(CLI)) {
  console.error(`CLI not found: ${CLI}\nSet OPENCODE_BIN to the opencode CLI executable.`);
  process.exit(1);
}

// Batch marker: aggregate.mjs uses it to exclude stale runs from earlier batches
// and to flag missing runs instead of silently shrinking pass^k.
for (const t of selected) {
  mkdirSync(join(RUNS, t.id), { recursive: true });
  writeFileSync(
    join(RUNS, t.id, "batch.json"),
    JSON.stringify({ startedAt: new Date().toISOString(), runs: opts.runs ?? t.runs, model: MODEL, judge: opts.judge }, null, 2)
  );
}
const jobs = selected.flatMap((t) =>
  Array.from({ length: opts.runs ?? t.runs }, (_, i) => [t, i])
);
console.log(
  `Conformance: ${selected.length} task(s), ${jobs.length} run(s) · model=${MODEL} · conc=${opts.conc} · judge=${opts.judge}`
);
const t0 = Date.now();
await pool(jobs, opts.conc, ([t, i]) => runOne(t, i));
console.log(`Done in ${Math.round((Date.now() - t0) / 60000)} min. Aggregate with: node aggregate.mjs`);
