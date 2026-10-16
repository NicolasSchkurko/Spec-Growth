#!/usr/bin/env node
// Retro-runs the LLM judge for EXISTING runs that lack a judge rule
// (used when a batch ran without --judge, or after a rubric fix).
// Usage: node judge-only.mjs [taskId ...]
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CLI, DEFAULT_JUDGE, TASKS } from "./tasks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const CLI = process.env.OPENCODE_BIN || DEFAULT_CLI;
const JUDGE = process.env.CONF_JUDGE || DEFAULT_JUDGE;

function spawnAgent(cwd, message, model, timeoutMs, title) {
  return new Promise((resolve) => {
    const args = ["run", message, "--model", model, "--auto"];
    if (title) args.push("--title", title);
    const child = spawn(CLI, args, {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
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
    child.on("close", (code) => {
      clearTimeout(killer);
      resolve({ stdout, stderr, code, timedOut, durationMs: Date.now() - started });
    });
  });
}

function parseJudgeJson(text) {
  const matches = [...text.matchAll(/\{[\s\S]*?\}/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(matches[i][0]);
      if (typeof obj.verdict === "string") return obj;
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

const wanted = process.argv.slice(2);
const tasks = TASKS.filter((t) => t.judge && (!wanted.length || wanted.includes(t.id)));
const jobs = [];
for (const task of tasks) {
  const taskDir = join(RUNS, task.id);
  if (!existsSync(taskDir)) continue;
  for (const run of readdirSync(taskDir)) {
    const runBase = join(taskDir, run);
    const resultPath = join(runBase, "result.json");
    if (!existsSync(resultPath)) continue;
    const result = JSON.parse(readFileSync(resultPath, "utf8"));
    if ((result.rules || []).some((r) => r.rule === `judge.${task.id}`)) continue;
    let repo = join(runBase, "repo");
    if (!existsSync(repo)) {
      const cand = readdirSync(runBase).find((d) => d.startsWith("repo"));
      if (cand) repo = join(runBase, cand);
    }
    if (!existsSync(repo)) continue;
    jobs.push({ task, runBase, repo, result, resultPath });
  }
}

console.log(`${jobs.length} judge(s) to run`);
let next = 0;
const worker = async () => {
  while (next < jobs.length) {
    const j = jobs[next++];
    const rule = await judgeRun(j.task, j.runBase, j.repo);
    const rules = j.result.rules.filter((r) => r.rule !== rule.rule);
    rules.push(rule);
    j.result.rules = rules;
    j.result.allPass = rules.every((x) => x.pass);
    writeFileSync(j.resultPath, JSON.stringify(j.result, null, 2));
    console.log(
      `[${j.task.id} ${j.runBase.split(/[\\/]/).pop()}] judge ${rule.pass ? "PASS" : "fail"} :: ${rule.detail}`
    );
  }
};
await Promise.all([worker(), worker(), worker()]);
console.log("done");
