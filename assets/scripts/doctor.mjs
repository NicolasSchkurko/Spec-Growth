#!/usr/bin/env node
// Spec Growth — environment preflight (like `claude doctor`, which OpenCode does not ship).
//
// Usage: node scripts/gates/doctor.mjs [--root DIR] [--models]
//   Required: node >= 18, git. Fails (exit 1) with a fix hint if missing.
//   Optional: opencode CLI, Structurizr CLI, MCP servers — a missing optional DEGRADES
//   (reported with a clear "what you lose"), never blocks.
//   --models: additionally checks `opencode models` and reports the count (slow; probing
//   runnable-ness per model is the session command's own preflight, not this check).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const quietTry = (cmd, cbArgs = ["--version"]) => {
  try {
    return execFileSync(cmd, cbArgs, { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
};

const rows = [];
const add = (state, label, detail, hint) => {
  rows.push({ state, label, detail, hint });
  return state === "fail";
};
let failed = false;
const fail = () => (failed = true);

const nodeVer = process.version;
const nodeMajor = Number(nodeVer.slice(1).split(".")[0]);
if (nodeMajor >= 18) add("ok", `node ${nodeVer}`);
else {
  add("fail", `node ${nodeVer} — Spec Growth needs node >= 18`, "install a current LTS node (https://nodejs.org)");
  fail();
}

if (quietTry("git")) add("ok", "git present");
else {
  add("fail", "git not found — every gate check (diff, ancestors, gitref) needs it", "install git and make sure it is on PATH");
  fail();
}

let opencodeVer = quietTry("opencode");
let opencodePath = opencodeVer ? "opencode (PATH)" : null;
if (!opencodeVer && process.env.LOCALAPPDATA) {
  const local = join(process.env.LOCALAPPDATA, "Programs", "@opencodedesktop", "resources", "opencode-cli.exe");
  if (existsSync(local)) {
    opencodePath = local;
    opencodeVer = quietTry(local) || "local install";
  }
}
if (opencodeVer) add("ok", `opencode CLI ${opencodeVer.split("\n")[0]} — ${opencodePath}`);
else add("degraded", "opencode CLI not found on PATH or in the desktop app — model-routing, session agents and `/spec-*` commands need it", "install OpenCode (npm i -g opencode-ai) and re-check");

if (args.includes("--models") && opencodePath) {
  try {
    const models = execFileSync(opencodePath === "opencode (PATH)" ? "opencode" : opencodePath, ["models"], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] }).toString();
    add("ok", `models listed: ${models.split("\n").filter(Boolean).length} (runnability is probed per-model at dispatch time)`);
  } catch {
    add("degraded", "`opencode models` failed — check `opencode auth`", undefined);
  }
}

const structurizr = quietTry("structurizr", ["help"]);
if (structurizr) add("ok", "Structurizr CLI present (tech-brief diagrams)");
else add("degraded", "Structurizr CLI not found — `/spec-tech-brief` falls back to Mermaid diagrams", "optional; install the Structurizr CLI if you want native briefs");

const root = existsSync(join(process.cwd(), "openspec")) ? process.cwd() : null;
if (root) {
  const changes = readdirSync(join(root, "openspec", "changes")).filter((n) => n !== "archive").length;
  add("ok", `Spec Growth repo detected (${root}) — ${changes} active change(s)`);
} else {
  add("degraded", "no openspec/ in this directory — run the skill here only after `/spec-init`", undefined);
}

for (const r of rows) {
  const mark = r.state === "ok" ? "✅" : r.state === "degraded" ? "⚠️ " : "❌";
  console.log(`${mark} ${r.label}${r.detail ? ` — ${r.detail}` : ""}${r.hint ? `\n   fix: ${r.hint}` : ""}`);
}
console.log(failed ? "\nDOCTOR: RED — required tooling missing; do not start a Spec Growth flow." : "\nDOCTOR: OK (degraded warnings are acceptable).");
process.exit(failed ? 1 : 0);
