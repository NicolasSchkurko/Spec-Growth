#!/usr/bin/env node
// Spec Growth — mechanical gate for the ORDER: acceptance BEFORE code.
//
// Usage: accept-check.mjs [--root DIR] [--json] <change-id>
//   exit 0  → the change is accepted to receive code (status accepted/applying/verified
//             with a human sign-off; tech-brief changes also need teach-back sign-off).
//   exit 1  → BLOCKED: do not write any code for it yet. The blocker is a fact, not
//             a suggestion: get the human's acceptance first (their sentence, your record).
//
// Honesty note: permissions are NOT enforced in this OpenCode build, so no script can
// physically stop every path. What this gate buys, per the eval evidence, is that the
// sanctioned paths themselves refuse to proceed — the implementer runs this first and
// stops on non-zero. Prompt discipline alone does NOT survive user pressure (eval
// t2-quickfix, pass^k); the mechanism is the part that does.
import { basename, join, normalize } from "node:path";
import { existsSync } from "node:fs";
import { readChange, resolveRoot } from "./lib.mjs";

const args = process.argv.slice(2);
const getVal = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes("--json");
let id = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root") {
    i++;
    continue;
  }
  if (args[i] === "--json") continue;
  if (!args[i].startsWith("--")) {
    id = args[i];
    break;
  }
}

const fail = (msg) => {
  process.stderr.write(`BLOCKED: ${msg}\n`);
  process.stderr.write("Do not write code for this change yet. Get the human's acceptance first, record it, then re-run this check.\n");
  process.exit(1);
};

if (!id) fail("usage: accept-check.mjs [--root DIR] <change-id>");
const root = normalize(getVal("--root") || resolveRoot(process.cwd()) || process.cwd());
if (!existsSync(join(root, "openspec", "changes", id))) fail(`change '${id}' does not exist (openspec/changes/${join(id, "proposal.md")})`);

const c = readChange(root, id, []);

if (c.status === "draft") {
  const brief = c.tech_brief
    ? c.understood_by
      ? "the tech brief teach-back is signed off, the human still has to ACCEPT the change"
      : "the tech brief has no teach-back sign-off yet (understood_by/understood_at)"
    : "the human has not accepted it yet";
  fail(`change '${id}' is still draft — ${brief}`);
}

if (c.tech_brief && !c.human_approved && !c.accepted_by && !c.understood_by) {
  fail(`change '${id}' (${c.status}) is marked x-tech_brief: true but carries no sign-off at all`);
}

if (!c.accepted_by || !c.accepted_at) {
  fail(`change '${id}' (${c.status}) has no acceptance on record (accepted_by / accepted_at in .openspec.yaml)`);
}

if (asJson) console.log(JSON.stringify({ ok: true, id, status: c.status, accepted_by: c.accepted_by, accepted_at: c.accepted_at }, null, 2));
else console.log(`OK ${id}: acceptance on record (${c.accepted_by}, ${c.accepted_at}) — code may start.`);
process.exit(0);
