---
description: Spec Growth — verify (gate + semantic audit + persisted findings)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Verification requested: "$ARGUMENTS" (empty = all active changes).

1. **Mechanical gate**: `node scripts/gates/gate-check.mjs --run-tests` (records green evidence; if you do not want to run the suite right now, run static and say so). Report errors and warnings verbatim.
2. **Semantic pass** (advisory; over active changes and their `targets`):
   - Read each delta spec and the code of its targets (use the codebase-memory graph if available).
   - Look for three classes of drift: (a) requirements without an implementation; (b) implemented behavior no spec describes; (c) tests that prove something other than what is declared.
   - For each finding: **evidence** (`file:line` + requirement), severity, and proposed action.
3. **Never edit specs or code in this pass.** Findings become:
   - a **`requested` waiver** (with a reason) if the code consciously deviates from a rule → `.openspec.yaml`, awaiting your decision;
   - a **decision request** if the gap needs a decision beyond the agent's authority;
   - a **⚔ conflict** (`conflicts`) if the code or the spec contradicts a previous ADR/requirement and the reversal must be approved;
   - **`/spec-triage`** if it is a discrepancy that needs the side decided (code vs spec);
   - **Citations**: report requirements without `@cita` (if the project uses IDs) and propose adding them where missing in new code. Broken citations are detected by the gate.
4. **Persistence**: if there were findings, write `openspec/changes/<id>/findings.md` with one `- [ ] <finding> — <evidence>` per item (and `- [x]` for resolved ones). The gate warns if an `applying`/`verified` change has open findings. If there were no findings, do not create the file.
5. Regenerate the board (`node scripts/gates/build-board.mjs`) and deliver the report: gate + findings + proposals (waivers/decisions/triage) + next steps.

Note: the blocking part is the mechanical gate (hook/CI); this pass is the safety net for what tests do not cover.
