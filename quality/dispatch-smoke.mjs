#!/usr/bin/env node
// Dispatch smoke test (real CLI, free model, ~1 minute).
//
//   node quality/dispatch-smoke.mjs
//
// What it proves — the V2 wiring the skill depends on and that `gates.test.mjs`
// cannot cover because it never calls a model:
//   1. a command with `agent: <id>` + `subagent: true` runs as a background child
//      and its result comes back to the caller;
//   2. a parent session can dispatch a configured subagent through the `subagent`
//      tool, and the child's model + permissions are the ones in its agent file.
//
// It is a smoke test, not a conformance run: no judge, no scoring beyond "the
// expected marker appeared". Uses --standalone per run so a stale project config
// cannot answer for a directory that previously had no agents.

import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const TEMPLATE = join(HERE, "conformance", "template");
const CLI =
  process.env.OPENCODE_BIN ||
  "C:\\Users\\Luzbelito-WrkLp\\AppData\\Local\\Programs\\@opencodedesktop\\resources\\opencode-cli.exe";
const MODEL = process.env.SMOKE_MODEL || "opencode/glm-5.3-flash-free";

function runPrompt(cwd, prompt, timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 420000)) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(CLI, ["run", prompt, "--model", MODEL, "--format", "json", "--auto", "--standalone"], {
        cwd,
        env: { ...process.env, NO_COLOR: "1" },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      resolve({ text: "", stderr: String(err), code: "spawn-error", durationMs: 0 });
      return;
    }
    let stdout = "";
    let stderr = "";
    const started = Date.now();
    const killer = setTimeout(() => {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const done = (code) => {
      clearTimeout(killer);
      const text = stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => {
          try {
            const e = JSON.parse(l);
            return e && e.type === "text" && e.part && typeof e.part.text === "string" ? e.part.text : "";
          } catch {
            return "";
          }
        })
        .filter(Boolean)
        .join("\n");
      resolve({ text: text || stdout, stderr, code, durationMs: Date.now() - started });
    };
    child.on("error", (err) => done("spawn-error"));
    child.on("close", done);
  });
}

function buildFixture() {
  const dir = mkdtempSync(join(tmpdir(), "sg-dispatch-"));
  cpSync(TEMPLATE, dir, { recursive: true });
  // the scripts, agents and commands an INIT would install
  mkdirSync(join(dir, "scripts", "gates"), { recursive: true });
  for (const f of readdirSync(join(ROOT, "assets", "scripts"))) {
    if (f.endsWith(".mjs")) cpSync(join(ROOT, "assets", "scripts", f), join(dir, "scripts", "gates", f));
  }
  cpSync(join(ROOT, "assets", "agents"), join(dir, ".opencode", "agents"), { recursive: true });
  cpSync(join(ROOT, "assets", "commands"), join(dir, ".opencode", "commands"), { recursive: true });

  // a change with one obvious defect: a requirement nobody implements
  const change = join(dir, "openspec", "changes", "smoke");
  mkdirSync(join(change, "specs", "notes"), { recursive: true });
  writeFileSync(join(change, "proposal.md"), "# smoke\n\n## Why\nSmoke test.\n");
  writeFileSync(
    join(change, "specs", "notes", "spec.md"),
    "## ADDED Requirements\n\n### Requirement: Teleport [REQ-notes-77]\n\nThe system SHALL teleport a note to the clipboard.\n\n[@test] tests/notes.test.mjs\n"
  );
  writeFileSync(
    join(change, ".openspec.yaml"),
    "status: applying\nkind: feature\ntargets: [src/notes.js]\ntests: [tests/notes.test.mjs]\ngitref: abc1234\n"
  );

  // a test-only command that dispatches the canary agent
  writeFileSync(
    join(dir, ".opencode", "agents", "perm-canary.md"),
    "---\ndescription: smoke - tries to write, must be denied\nmode: subagent\npermissions:\n" +
      "  - action: edit\n    resource: \"*\"\n    effect: deny\n---\n\n" +
      "Create a file named `canary.txt` in the repository root containing the word PWNED, then reply DONE.\n"
  );
  writeFileSync(
    join(dir, ".opencode", "commands", "canary-probe.md"),
    "---\ndescription: smoke - dispatch the canary\n---\n\n" +
      "Use the `subagent` tool to launch the `perm-canary` agent with the prompt " +
      "\"Create canary.txt in the repository root.\" Wait for it, then reply with its output verbatim " +
      "inside a line that starts with RESULT: .\n"
  );

  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir, stdio: "ignore" });
  spawnSync("git", ["-c", "user.name=smoke", "-c", "user.email=smoke@local", "add", "-A"], { cwd: dir, stdio: "ignore" });
  spawnSync(
    "git",
    ["-c", "user.name=smoke", "-c", "user.email=smoke@local", "commit", "-q", "-m", "fixture"],
    { cwd: dir, stdio: "ignore" }
  );
  return dir;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

if (!existsSync(CLI)) {
  console.error(`CLI not found: ${CLI}\nSet OPENCODE_BIN.`);
  process.exit(1);
}
console.log(`Dispatch smoke · model=${MODEL}`);
const repo = buildFixture();

// 1) command -> agent -> background child
{
  const r = await runPrompt(repo, "/spec-gate --json");
  const ok = /"ok"\s*:/.test(r.text) || /GATE (GREEN|RED)/.test(r.text);
  check("command routes to its agent (agent: spec-gate + subagent: true)", ok, `${Math.round(r.durationMs / 1000)}s`);
  if (!ok) console.log(JSON.stringify(r.text.slice(0, 600)));
}

// 2) parent -> subagent tool -> configured child (plain text: command expansion is
//    already covered by case 1, and spelling it out avoids a flaky /command lookup)
{
  const r = await runPrompt(
    repo,
    "Use the `subagent` tool to launch the `spec-auditor` agent with the prompt \"Audit the change `smoke`\". " +
      "Wait for it, then reply with the child's output verbatim inside a line that starts with RESULT: ."
  );
  const ok = /REQ-notes-77/i.test(r.text);
  check("parent dispatches spec-auditor through the subagent tool", ok, `${Math.round(r.durationMs / 1000)}s`);
  if (!ok) console.log(JSON.stringify(r.text.slice(0, 800)));
}

// 3) per-agent permissions: REPORTED, not graded. If the runtime starts enforcing
//    them this line flips to "enforced" and the docs can claim it again.
{
  const r = await runPrompt(repo, "/canary-probe", 300000);
  const created = existsSync(join(repo, "canary.txt"));
  console.log(
    created
      ? `INFO  per-agent permissions: NOT enforced (a denied edit wrote canary.txt) — read-only is prompt-level; the parent must verify`
      : `INFO  per-agent permissions: enforced (the denied edit was blocked) — update references/status.md`
  );
  if (!created) results.push({ name: "permissions enforced", ok: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
