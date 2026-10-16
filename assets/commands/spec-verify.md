---
description: Spec Growth — verify (gate + semantic audit + persisted findings + comprehension teach-back)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Verification requested: "$ARGUMENTS" (empty = all active changes).

1. **Mechanical gate**: `node scripts/gates/gate-check.mjs --run-tests` (records green evidence; if you do not want to run the suite right now, run static and say so). Report errors and warnings verbatim.
2. **Semantic pass** (advisory; over active changes and their `targets`):
   - Read each delta spec and the code of its targets (use the codebase-memory graph if available).
   - Look for four classes of drift: (a) requirements without an implementation; (b) implemented behavior no spec describes; (c) tests that prove something other than what is declared; (d) **opaque implementation** — cryptic names, unexplained framework magic, deep nesting, undeclared implicit persistence or side effects (code → text audit).
   - For each finding: **evidence** (`file:line` + requirement), severity, and proposed action. Class (d) findings can propose a `kind: refactor` change (with its regression `[@test]`).
3. **Comprehension** (only for changes with `tech_brief: true`): this part is the human's turn.
   - If `walkthrough.md` does not exist, say so — it is written in `/spec-apply`; do not invent it here.
   - If its `## Cognitive sign-off` still has `TODO(human)`: ask the 3 questions in the chat, one at a time, in the plainest language. The answers must be the human's own words (free recall — no multiple choice, no leading).
   - Validate each answer against the real code (cite `file:line`). Correct: transcribe it into the walkthrough. Vague or wrong: explain the actual mechanism (teach), then ask again — **max 2 rounds**.
   - On success (the human explicitly confirms they understood): set the `understood_by` + `understood_at` keys in `.openspec.yaml` (repo convention: bare or `x-`) — their sentence, your record.
   - If after 2 rounds it does not land: do not fake it. Offer (a) keep it pending until understood, or (b) the human grants a `comprehension-debt` waiver (`owner` + `expires`, recorded in `DECISIONS.md`).
4. **Never edit specs or code in this pass.** Findings become:
   - a **`requested` waiver** (with a reason) if the code consciously deviates from a rule → `.openspec.yaml`, awaiting your decision;
   - a **decision request** if the gap needs a decision beyond the agent's authority;
   - a **⚔ conflict** (`conflicts`) if the code or the spec contradicts a previous ADR/requirement and the reversal must be approved;
   - **`/spec-triage`** if it is a discrepancy that needs the side decided (code vs spec);
   - **Citations**: report requirements without `@cita` (if the project uses IDs) and propose adding them where missing in new code. Broken citations are detected by the gate.
5. **Persistence**: if there were findings, write `openspec/changes/<id>/findings.md` with one `- [ ] <finding> — <evidence>` per item (and `- [x]` for resolved ones). The gate warns if an `applying`/`verified` change has open findings — or open tasks. If there were no findings, do not create the file.
6. Regenerate the board (`node scripts/gates/build-board.mjs`) and deliver the report: gate + findings + comprehension state + proposals (waivers/decisions/triage) + next steps.

Note: the blocking part is the mechanical gate (hook/CI); this pass is the safety net for what the tests do not cover — and the comprehension step is the safety net for what the tests cannot.
