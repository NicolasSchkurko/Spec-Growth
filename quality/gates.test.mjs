// Functional tests for the gate scripts (no model calls, seconds).
//
//   node --test quality/gates.test.mjs
//
// Each test builds a throwaway repo from the conformance template, mutates the
// change tree, and runs the real script against it. The assertions are about the
// INVARIANTS the skill promises (exit code + what the report says), not about
// wording, so the suite survives cosmetic edits.

import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "conformance", "template");
const SCRIPTS = join(HERE, "..", "assets", "scripts");
const DECISIONS = `# Decisions\n\n## [2026-10-19] Approve the change (change: demo)\n- **Decision:** approved\n`;

const made = [];
function fixture(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "sg-gate-"));
  made.push(dir);
  cpSync(TEMPLATE, dir, { recursive: true });
  mutate?.(dir);
  return dir;
}

// Leave no throwaway repos behind (Windows keeps handles briefly; retry a few times).
test.after(() => {
  for (const dir of made) {
    for (let i = 0; i < 5; i++) {
      try {
        rmSync(dir, { recursive: true, force: true });
        break;
      } catch {
        /* retry */
      }
    }
  }
});

function run(script, root, args = []) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), "--root", root, ...args], {
    encoding: "utf8",
    timeout: 120000,
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}
const gate = (root, args) => run("gate-check.mjs", root, args);

const DELTA = `## ADDED Requirements

### Requirement: Demo [REQ-notes-9]

The system SHALL do the demo thing.

[@test] tests/notes.test.mjs
`;

// A change that is valid unless the test says otherwise.
function addChange(root, id = "demo", meta = {}, { proposal = true, delta = true } = {}) {
  const dir = join(root, "openspec", "changes", id);
  mkdirSync(join(dir, "specs", "notes"), { recursive: true });
  if (proposal) writeFileSync(join(dir, "proposal.md"), `# ${id}\n\n## Why\nTesting.\n`);
  if (delta) writeFileSync(join(dir, "specs", "notes", "spec.md"), DELTA);
  const yaml = {
    status: "applying",
    kind: "feature",
    targets: "[src/notes.js]",
    tests: "[tests/notes.test.mjs]",
    gitref: "abc1234",
    ...meta,
  };
  writeFileSync(
    join(dir, ".openspec.yaml"),
    Object.entries(yaml)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n") + "\n"
  );
  return dir;
}

function setConfig(root, protectedGlobs) {
  const file = join(root, "openspec", "config.yaml");
  const base = readFileSync(file, "utf8").replace(/protected:\s*\[\]/, "");
  writeFileSync(
    file,
    `${base}\nprotected:\n${protectedGlobs.map((g) => `  - glob: "${g}"\n    reason: "test zone"`).join("\n")}\n`
  );
}

// --- baseline ---

test("template with no changes: GATE GREEN", () => {
  const r = gate(fixture());
  assert.equal(r.code, 0);
  assert.match(r.out, /GATE GREEN/);
});

test("a valid change: GATE GREEN", () => {
  const r = gate(fixture((d) => addChange(d)));
  assert.equal(r.code, 0);
  assert.match(r.out, /GATE GREEN/);
});

// --- metadata invariants ---

test("invalid status is an error", () => {
  const r = gate(fixture((d) => addChange(d, "demo", { status: "done" })));
  assert.equal(r.code, 1);
  assert.match(r.out, /invalid status/i);
});

test("a change folder without proposal.md is an error", () => {
  const r = gate(fixture((d) => addChange(d, "demo", {}, { proposal: false })));
  assert.equal(r.code, 1);
  assert.match(r.out, /without proposal/i);
});

test("a requested waiver blocks verified (error, not warning)", () => {
  const r = gate(
    fixture((d) =>
      addChange(d, "demo", {
        status: "verified",
        waivers: '[{type: deferred-test, state: requested, reason: "pending"}]',
      })
    )
  );
  assert.equal(r.code, 1);
  assert.match(r.out, /waiver/i);
});

test("an expired granted waiver blocks too", () => {
  const r = gate(
    fixture((d) =>
      addChange(d, "demo", {
        status: "verified",
        waivers: '[{type: deferred-test, state: granted, owner: "x", expires: "2020-01-01"}]',
      })
    )
  );
  assert.equal(r.code, 1);
  assert.match(r.out, /waiver/i);
});

// --- protected zones ---

test("a protected zone without approval is an error", () => {
  const r = gate(
    fixture((d) => {
      addChange(d, "demo");
      setConfig(d, ["src/notes.js"]);
    })
  );
  assert.equal(r.code, 1);
  assert.match(r.out, /protected/i);
});

test("protected zone + human_approved + ADR approves it", () => {
  const r = gate(
    fixture((d) => {
      addChange(d, "demo", { human_approved: "true" });
      setConfig(d, ["src/notes.js"]);
      writeFileSync(join(d, "DECISIONS.md"), DECISIONS);
    })
  );
  assert.equal(r.code, 0, r.out);
});

// --- evidence and tests ---

test("--run-tests runs the suite and records green evidence", () => {
  const root = fixture((d) => addChange(d));
  const r = gate(root, ["--run-tests"]);
  assert.equal(r.code, 0, r.out);
  const ev = JSON.parse(readFileSync(join(root, "openspec", "evidence.json"), "utf8"));
  assert.equal(ev.mode, "tests");
  assert.equal(ev.tests.exit, 0);
  const green = ev.changes.demo.green_tests;
  assert.ok(green, "green_tests recorded");
  assert.equal(green.ok, true);
  assert.ok(green.files_hash, "freshness fingerprint recorded");
});

test("--json reports ok + errors as valid JSON", () => {
  const root = fixture((d) => addChange(d, "demo", { status: "nope" }));
  const r = gate(root, ["--json"]);
  const parsed = JSON.parse(r.out);
  assert.equal(parsed.ok, false);
  assert.ok(Array.isArray(parsed.errors) && parsed.errors.length > 0);
});

test("--pre-archive without green evidence is BLOCKED", () => {
  const r = gate(fixture((d) => addChange(d, "demo", { status: "verified" })), ["--pre-archive", "demo"]);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /PRE-ARCHIVE demo: BLOCKED/);
});

// --- scoped tests (--tests-of) ---

function setScope(root, cmd) {
  const file = join(root, "openspec", "config.yaml");
  writeFileSync(file, `${readFileSync(file, "utf8")}\ntest_command_scope: "${cmd}"\n`);
}

test("--tests-of runs only the change's tests, records no green and writes no evidence", () => {
  const root = fixture((d) => {
    addChange(d);
    setScope(d, "node --test {tests}");
  });
  const r = gate(root, ["--tests-of", "demo"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /tests-scoped/);
  assert.match(r.out, /Scoped run/i);
  assert.ok(!existsSync(join(root, "openspec", "evidence.json")), "a scoped run must not write evidence");
});

test("--tests-of without test_command_scope is an error", () => {
  const r = gate(fixture((d) => addChange(d)), ["--tests-of", "demo"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /test_command_scope/);
});

test("a scoped run never satisfies verified", () => {
  const root = fixture((d) => {
    addChange(d, "demo", { status: "verified" });
    setScope(d, "node --test {tests}");
  });
  const r = gate(root, ["--tests-of", "demo"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /without local green evidence/i);
});

test("--tests-of and --run-tests are mutually exclusive", () => {
  const root = fixture((d) => {
    addChange(d);
    setScope(d, "node --test {tests}");
  });
  const r = gate(root, ["--tests-of", "demo", "--run-tests"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /mutually exclusive/i);
});

test("--tests-of refuses a test path with shell characters", () => {
  const root = fixture((d) => {
    addChange(d, "demo", { tests: '[tests/notes.test.mjs; rm -rf /]' });
    setScope(d, "node --test {tests}");
  });
  const r = gate(root, ["--tests-of", "demo"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /unsafe characters/i);
});

// --- generated views ---

test("build-board generates BOARD.md and board.json", () => {
  const root = fixture((d) => addChange(d));
  const r = run("build-board.mjs", root);
  assert.equal(r.code, 0, r.out);
  assert.ok(existsSync(join(root, "BOARD.md")));
  const board = JSON.parse(readFileSync(join(root, "openspec", "board.json"), "utf8"));
  assert.ok(board, "board.json is valid JSON");
});

test("build-graph exits 0 and mentions the living capability", () => {
  const r = run("build-graph.mjs", fixture());
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /notes/);
});

test("compact-archive on a repo with no archive is a no-op, not an error", () => {
  const root = fixture((d) => addChange(d));
  const r = run("compact-archive.mjs", root, ["--days=90"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /nothing to compact/i);
});

test("compact-archive dry run lists an old archive and deletes nothing", () => {
  const root = fixture((d) => {
    const old = join(d, "openspec", "changes", "archive", "2020-01-01-old");
    mkdirSync(old, { recursive: true });
    writeFileSync(join(old, ".openspec.yaml"), "status: verified\nkind: feature\n");
    writeFileSync(join(old, "proposal.md"), "# old\n");
  });
  const r = run("compact-archive.mjs", root, ["--days=90"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /2020-01-01-old/);
  assert.ok(
    existsSync(join(root, "openspec", "changes", "archive", "2020-01-01-old")),
    "dry run must not delete the folder"
  );
});
