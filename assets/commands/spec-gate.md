---
description: Spec Growth — mechanical gate (static by default; --run-tests for green evidence)
agent: general
model: opencode-go/space-bunny
subagent: true
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Goal: **measure, do not fix**. You run as a **background subagent**: no conversation context — work from the repo root, ask nothing, return a concise result.

1. Default (fast, the pre-commit one): `node scripts/gates/gate-check.mjs`.
2. Full verification (CI / before moving to `verified`): `node scripts/gates/gate-check.mjs --run-tests` — runs `test_command` and records **green test evidence**.
3. Useful modes: `--scope <id>` (local focus: reds **from other** changes become warnings — ideal for your commit) · `--pre-archive <id>` (archive preconditions: verified · no blocking waivers · no decisions · no conflicts · tech brief complete + signed off · merge verified by `gitref`/`merged_as`) · `--diff <base>` (protected files touched without approval — for CI) · `--json` · `--root DIR`.
4. Report the result verbatim (errors and warnings as they come out) and regenerate the board: `node scripts/gates/build-board.mjs`.
5. Closing: GATE GREEN/RED + what awaits the human (🔒 approvals · ⏸ decisions · ⚔ conflicts · ⚠ waivers · 🧠 comprehension sign-offs).

Rules: nothing is fixed here (implement → `/spec-apply`; discrepancies → `/spec-triage`). `--tests-command "CMD"` runs in **tests-substituted** mode and produces NO green evidence; it is forbidden in CI.
