---
description: Spec Growth — resolve human pendings (approvals, decisions, conflicts, waivers)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Goal: process what awaits the human — **the human decides at every point**.

1. Read `openspec/board.json` (the generated index: pending approvals, decisions, conflicts and `requested` waivers). If there are none: say so and stop. 🧠 comprehension sign-offs are **not** resolved here — they happen in `/spec-verify` (point there when they are pending).
2. **Ask in ONE round, not one by one**: put every pending into a **single `question` call** — one question per pending, with the minimal context, the options, and your recommendation explicitly marked as a recommendation. Batch up to **6** per call; with more, ask those six and say how many remain. A free-form answer is always valid. **The decision is the human's**: never invent it, never assume it by silence, never apply it "in general". An item the human does not answer **stays pending**.
3. With each answer, apply it to that change's `.openspec.yaml`:
   - 🔒 Protected zone approved → `human_approved: true` **plus a line in `DECISIONS.md` with 'approved'/'aprobado' mentioning the change id as a word** (the gate requires it; a rejection line does not work)
   - ⏸ Decision resolved → remove the entry from `open_decisions`
   - ⚔ Conflict approved → remove the entry from `conflicts` + an ADR recording the **reversal** (which previous decision/requirement is replaced, and why)
   - ⚠ Waiver granted → `state: granted` + `owner` + `expires` (the date comes from the human; if not given, ask for it). **Granting enables**: a valid waiver does not block; its expiry is its closure. Rejected → remove the waiver from the change
   - 🚫 Change rejected → `status: rejected` + `reason` (the gate requires the reason)
   - ⏭ Change superseded → `status: superseded` + `superseded_by: <id>` (the gate requires it)
4. Record **every** resolution in `DECISIONS.md` (ADR-lite: date, context, decision, consequences, refs).
5. Regenerate the board (`node scripts/gates/build-board.mjs`) and report: resolved + what remains pending.

Rules: a resolution without an ADR does not count; never resolve on your own; if the human changes their mind about something already resolved, record the new decision (append-only). Batching the ask is a speed decision, never a consent shortcut: each answer must be explicit and attributable to its item.
