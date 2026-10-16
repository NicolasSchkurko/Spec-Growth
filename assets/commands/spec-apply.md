---
description: Spec Growth — apply a pending change (green evidence, citations, approvals, pre-archive)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Apply the change: "$ARGUMENTS" (id). **One change at a time.**

**Preconditions** (if any fails, stop and report):
- The change exists and its `.openspec.yaml` has `status: accepted` (if `draft`: ask for human approval; on approval: `status: accepted` + `accepted_by` + `accepted_at`).
- Its `deps` are archived or verified (the gate checks this).
- **Clean context**: implement in a fresh session (or one deliberately compacted) — long context degrades execution. Do not drag along the session where you discussed the design.
- **Protected zone**: if any `target` crosses `protected:` in `openspec/config.yaml` and there is no `human_approved: true` → **ask for human approval BEFORE implementing**. On approval: `human_approved: true` + ADR in `DECISIONS.md`.
- **Open decisions**: if there are unresolved `open_decisions`, warn that the change cannot reach `verified` until they are resolved (you may implement; closure stays pending).
- **⚔ Conflicts**: if the change has unapproved `conflicts`, you may implement, but it will not reach `verified` (and `--pre-archive` blocks it) until the human approves the reversal (remove the entry + ADR).

**Failure protocol (mid-apply)**: if the approach proves unviable (incompatible API, breaks unrelated tests, wrong reading of a requirement) → **STOP**; do not keep patching over a broken attempt. Restore a clean state (`git restore .` or discard the uncommitted work), set `.openspec.yaml` back to `accepted` (or `blocked` + `reason` if it needs a decision), report what failed and why, and retry in a fresh session with a revised plan. Never leave the tree half-done.

**Execution:**
1. `git checkout -b change/<id>` (continue on it if it already exists). When committing, update `gitref` in `.openspec.yaml` to the **branch tip** (`git rev-parse --short HEAD`) — this is what `--pre-archive` verifies against **HEAD** (squash-merge: use `merged_as: <squash commit sha>`).
2. Implement `tasks.md` task by task. Write the tests for each missing `[@test]`. If the project uses **requirement IDs**, cite what you cover in tests/code: `@cita REQ-…` (a citation to a nonexistent ID is a gate error — hallucination detector).
3. Update `.openspec.yaml`: `status: applying`.
4. **Tech brief** (only if `tech_brief: true` — or if you find it should be: the change touches persistence/state, concurrency, networking, platform SDKs, security or a new dependency → add the flag and say so in the report): write `openspec/changes/<id>/walkthrough.md` in **plain language** (a future reader who does not know this code must understand it; no jargon). Structure:
   - `## Mechanism` — step by step, from the triggering event to the stored/shown result.
   - `## Physical traceability` — where the data/state lives (files, preferences, database, keys), who reads/writes it, its lifecycle.
   - `## Limits and failure modes` — forced close, data/cache deleted, concurrency, no network.
   - `## Touched APIs` — every framework/library API added or changed: 1–2 sentences (what it is, why this one).
   - `## Implicit decisions` — defaults, threading, error handling, migrations you chose while implementing.
   - `## Cognitive sign-off` — 3 questions **specific to this change** (never generic): (1) where the state lives and who touches it; (2) what happens in a real failure; (3) which files/functions to change to extend this. Answers start as `TODO(human)` — the human answers them in `/spec-verify`.
5. Run tests + gate: `node scripts/gates/gate-check.mjs --run-tests` (uses `test_command`; records the **green evidence**). Fix red and repeat. Without a configured `test_command`, run the suite by hand and report it: the gate will require green evidence for `verified`.
6. **Mandatory report to the user** (fixed, short format):
   - Change: `<id>` (kind)
   - Per requirement: requirement (ID if present) → files touched (`file:line`) → the test proving it → state
   - Protected zone: approval (yes/no/n-a) · Open waivers · Pending decisions · Conflicts · Citations (broken / uncited, if applicable)
   - Tech brief: written / pending (only when flagged)
   - Gate result + recorded evidence (`evidence.json`)
   - Open questions / decisions taken during implementation
7. **`verified` only if**: green gate **with test evidence** + no blocking waivers (requested/expired) + no pending decisions + no unapproved conflicts + (protected zone → approved **with its id in `DECISIONS.md`**). Otherwise it stays `applying` with the list of blockers. (A pending tech brief or comprehension sign-off is a warning only — it blocks `--pre-archive`, not `verified`.)
8. If the change is `kind: architecture`: suggest `/diagram-sync` before archiving.
9. **Pre-archive** (after merge, before archiving): `node scripts/gates/gate-check.mjs --pre-archive <id>` must be **OK** (verified · no waivers · no decisions · no conflicts · tech brief complete + comprehension sign-off · `gitref` merged). Only then: `openspec archive <id>`.

**At the end, state**: review the diff, merge, and only then archive with the preconditions OK.
