---
description: Spec Growth — resolve human pendings (approvals, decisions, conflicts, waivers)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Goal: process what awaits the human — **the human decides at every point**.

1. Read `BOARD.md` (and `openspec/board.json`). If there are no pendings (🔒 approvals, ⏸ decisions, ⚔ conflicts, ⚠ `requested` waivers): say so and stop.
2. Present the pendings grouped, **one by one**: minimal context, options, and your recommendation if you have one (marked as a recommendation, not a decision). **The decision is the human's**: do not invent it, do not assume it by silence, do not apply it "in general".
3. With each answer, apply the change to the corresponding change's `.openspec.yaml`:
   - 🔒 Protected zone approved → `human_approved: true` **plus a line in `DECISIONS.md` with 'approved'/'aprobado' mentioning the change id as a word** (the gate requires it; a rejection line does not work)
   - ⏸ Decision resolved → remove the entry from `open_decisions`
   - ⚔ Conflict approved → remove the entry from `conflicts` + an ADR recording the **reversal** (which previous decision/requirement is replaced, and why)
   - ⚠ Waiver granted → `state: granted` + `owner` + `expires` (the date comes from the human; if not given, ask for it). **Granting enables**: a valid waiver does not block; its expiry is its closure. Rejected → remove the waiver from the change
   - 🚫 Change rejected → `status: rejected` + `reason` (the gate requires the reason)
   - ⏭ Change superseded → `status: superseded` + `superseded_by: <id>` (the gate requires it)
4. Record **every** resolution in `DECISIONS.md` (ADR-lite: date, context, decision, consequences, refs).
5. Regenerate the board (`node scripts/gates/build-board.mjs`) and report: resolved + what remains pending (if the human did not answer something, it stays pending — do not close it).

Rules: a resolution without an ADR does not count; never resolve on your own; if the human changes their mind about something already resolved, record the new decision (append-only).
