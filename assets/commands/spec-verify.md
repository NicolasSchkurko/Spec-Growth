---
description: Spec Growth — verify (parallel audit + gate + comprehension teach-back)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Verification requested: "$ARGUMENTS" (empty = all active changes). **Stay in this session**: the heavy reading is dispatched to children; the human part is yours.

1. **Dispatch in one batch** — the pieces are independent, so they run together and never in series:
   - **Gate**: `subagent` → **`spec-gate`**, **`background: true`**, prompt `--run-tests` (records green evidence). If `openspec/evidence.json` already holds a **fresh** green run for a change (the fingerprint of its `targets` + `tests` matches — `/spec-apply` just recorded it and nothing changed since), run that change static with `--scope <id>` instead: re-running the suite would prove exactly what the fingerprint already proves. Re-run `--run-tests` whenever the fingerprint moved, before `--pre-archive`, or in CI.
   - **Audit**: **one `spec-auditor` child per active change**, `background: true`, prompt = the change id. Cap the fan-out at **6** children: with more active changes, group them by capability and send one child per group. A change that is large or risky (`kind: architecture`, many targets) is audited **in this session** instead — or with a stronger model (edit `.opencode/agents/spec-auditor.md`, key `model:`; it is cheap by default on purpose).
   - If a child fails or times out, run that piece yourself and say so.
2. **While they run, do the human part** — the comprehension teach-back, for changes with `tech_brief: true`:
   - If `walkthrough.md` does not exist, say so — it is written in `/spec-apply`; do not invent it here.
   - If its `## Cognitive sign-off` still has `TODO(human)`: ask the 3 questions **together, in one message**, in the plainest language. Free recall: no multiple choice, no leading.
   - Validate each answer against the real code (cite `file:line`). Correct → transcribe it into the walkthrough. Vague or wrong → explain the actual mechanism (teach), then ask again — **max 2 rounds**.
   - On success (the human explicitly confirms they understood): set the `understood_by` + `understood_at` keys in `.openspec.yaml` (repo convention: bare or `x-`) — their sentence, your record.
   - If after 2 rounds it does not land: do not fake it. Offer (a) keep it pending until understood, or (b) the human grants a `comprehension-debt` waiver (`owner` + `expires`, recorded in `DECISIONS.md`).
3. **Join and vet the findings — and check the tree.** The audit is **advisory**: read each finding, check its `file:line` before relaying it, and drop the ones that do not hold — a child that invented evidence is a finding about the child, not about the code. Then run `git status --porcelain`: an auditor must not have changed anything. If something changed, restore those paths and report it. **The per-agent `permissions` are a declaration, not runtime enforcement in this build** (see `references/status.md`), so the tree is the control. The four classes: (a) requirements without an implementation; (b) implemented behavior no spec describes; (c) tests that prove something other than what is declared; (d) **opaque implementation** — cryptic names, unexplained framework magic, deep nesting, undeclared implicit persistence or side effects.
4. **Never edit specs or code in this pass.** Each surviving finding becomes:
   - a **`requested` waiver** (with a reason) if the code consciously deviates from a rule → `.openspec.yaml`, awaiting your decision;
   - a **decision request** if the gap needs a decision beyond the agent's authority;
   - a **⚔ conflict** (`conflicts`) if the code or the spec contradicts a previous ADR/requirement and the reversal must be approved;
   - **`/spec-triage`** if it is a discrepancy that needs the side decided (code vs spec);
   - **Citations**: report requirements without `@cita` (if the project uses IDs) and propose adding them where missing in new code. Broken citations are the gate's job.
5. **Persistence**: if there were surviving findings, write `openspec/changes/<id>/findings.md` with one `- [ ] <finding> — <evidence>` per item (and `- [x]` for resolved ones). The gate warns if an `applying`/`verified` change has open findings — or open tasks. If there were no findings, do not create the file.
6. Regenerate the board (`node scripts/gates/build-board.mjs`) and deliver the report: gate + findings + comprehension state + proposals (waivers/decisions/triage) + next steps.

Note: the blocking part is the mechanical gate (hook/CI); this pass is the safety net for what the tests do not cover — and the comprehension step is the safety net for what the tests cannot. The audit runs on a cheap read-only child on purpose; the judgment (vetting the findings, teaching, recording) stays with you and the human.
