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

**Execution:**
1. `git checkout -b change/<id>` (continue on it if it already exists). When committing, update `gitref` in `.openspec.yaml` to the **branch tip** (`git rev-parse --short HEAD`) — this is what `--pre-archive` verifies against **HEAD** (squash-merge: use `merged_as: <squash commit sha>`).
2. Implement `tasks.md` task by task. Write the tests for each missing `[@test]`. If the project uses **requirement IDs**, cite what you cover in tests/code: `@cita REQ-…` (a citation to a nonexistent ID is a gate error — hallucination detector).
3. Update `.openspec.yaml`: `status: applying`.
4. Run tests + gate: `node scripts/gates/gate-check.mjs --run-tests` (uses `test_command`; records the **green evidence**). Fix red and repeat. Without a configured `test_command`, run the suite by hand and report it: the gate will require green evidence for `verified`.
5. **Mandatory report to the user** (fixed, short format):
   - Change: `<id>` (kind)
   - Per requirement: requirement (ID if present) → files touched (`file:line`) → the test proving it → state
   - Protected zone: approval (yes/no/n-a) · Open waivers · Pending decisions · Conflicts · Citations (broken / uncited, if applicable)
   - Gate result + recorded evidence (`evidence.json`)
   - Open questions / decisions taken during implementation
6. **`verified` only if**: green gate **with test evidence** + no blocking waivers (requested/expired) + no pending decisions + no unapproved conflicts + (protected zone → approved **with its id in `DECISIONS.md`**). Otherwise it stays `applying` with the list of blockers.
7. If the change is `kind: architecture`: suggest `/diagram-sync` before archiving.
8. **Pre-archive** (after merge, before archiving): `node scripts/gates/gate-check.mjs --pre-archive <id>` must be **OK** (verified · no waivers · no decisions · no conflicts · `gitref` merged). Only then: `openspec archive <id>`.

**At the end, state**: review the diff, merge, and only then archive with the preconditions OK.
