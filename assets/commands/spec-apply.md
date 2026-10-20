---
description: Spec Growth — apply a pending change (green evidence, citations, approvals, pre-archive)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Apply the change: "$ARGUMENTS" (id). **One change at a time.** You own the plan, the approvals and the final judgment; the children you launch implement from your brief, read, or write inside the change folder — never decide.

**Preconditions** (if any fails, stop and report):
- The change exists and its `.openspec.yaml` has `status: accepted` (if `draft`: ask for human approval; on approval: `status: accepted` + `accepted_by` + `accepted_at`).
- Its `deps` are archived or verified (the gate checks this).
- **Clean context**: implement in a fresh session (or one deliberately compacted) — long context degrades execution. Do not drag along the session where you discussed the design. The children are fresh by construction.
- **Protected zone**: if any `target` crosses `protected:` in `openspec/config.yaml` and there is no `human_approved: true` → **ask for human approval BEFORE implementing**. On approval: `human_approved: true` + ADR in `DECISIONS.md`.
- **Open decisions**: if there are unresolved `open_decisions`, warn that the change cannot reach `verified` until they are resolved (you may implement; closure stays pending).
- **⚔ Conflicts**: if the change has unapproved `conflicts`, you may implement, but it will not reach `verified` (and `--pre-archive` blocks it) until the human approves the reversal (remove the entry + ADR).

**Failure protocol (mid-apply)**: if the approach proves unviable (incompatible API, breaks unrelated tests, wrong reading of a requirement) → **STOP**; do not keep patching over a broken attempt. Restore a clean state (`git restore .` or discard the uncommitted work), set `.openspec.yaml` back to `accepted` (or `blocked` + `reason` if it needs a decision), report what failed and why, and retry in a fresh session with a revised plan. Never leave the tree half-done.

**Execution:**
1. `git checkout -b change/<id>` (continue on it if it already exists). When committing, update the `gitref` key in `.openspec.yaml` (repo key convention: bare or `x-`) to the **branch tip** (`git rev-parse --short HEAD`) — this is what `--pre-archive` verifies against **HEAD** (squash-merge: use `merged_as: <squash commit sha>`). `gitref` is yours alone: no child touches it.
2. **Orient before exploring**: the native **LSP tool** for symbols (`findReferences`/`workspaceSymbol`), grep for literals; `codebase-memory` in large repos when connected; `node scripts/gates/build-map.mjs` as the zero-dependency fallback. Open a file only when you need its details.
3. **Write the brief, then dispatch the implementation** to `subagent` → **`spec-implementer`** (**foreground**; a child cannot ask questions, so you wait for it). The brief carries: change id + branch, the goal **per requirement**, the **allowed files** (`.openspec.yaml` → `targets`) and the **test files** (`tests`), the reuse-first ladder, and the constraints from `proposal.md` / the delta spec. Orient first so the brief names the real files.
   - **Implement in this session instead** if the change is `kind: architecture`, touches a protected zone, or you would have to ask the human something mid-implementation. Any open decision, missing approval or unresolved "which option" must be settled **before** dispatching: the child has no one to ask. If you find yourself wanting to ask, ask first.
   - **If the agent is not installed** (`Agent not found` — an older INIT, or `assets/agents/` never copied), do the implementation here with the same rules and say so in the report: the flow must work on a repo that predates v1.5.
   - **One implementation worker per change, always**: you or the child, never both, never two children. Parallel writers on one branch lose work; the parallelism belongs to the read-only work (step 5).
4. **Verify the child's diff before trusting it**: `git diff --stat` — every changed file must be inside `targets`/`tests`; a file outside is a **finding, not a fix**. Check that each `[@test]` has its test and each claimed requirement has its `@cita` where the repo uses IDs. **The implementer's deny list (`openspec/**`, `.git/**`, `.env*`) is a declaration, not enforcement in this build** (see `references/status.md`): `git status` / `git diff --stat` is the control, so revert anything out of scope and report it. Then set `status: applying` (the walkthrough child writes the same key — whichever runs first; never any other status here).
5. **Dispatch the long poles in parallel** — as soon as the code and the tests are verified, in **one batch**, because they do not touch the same files and neither must wait for the other. Before this step, while code is still being written, `node scripts/gates/gate-check.mjs --tests-of <id>` runs **only this change's declared tests** (needs `test_command_scope` in the config): fast feedback, no green evidence, writes nothing. The `--run-tests` below is what earns `verified`.
   - `subagent` → **`spec-gate`**, prompt `--run-tests`, **`background: true`** — the suite runs while you keep working.
   - Only if `tech_brief: true` (or you just found out it should be: the change touches persistence/state, concurrency, networking, platform SDKs, security or a new dependency → say so in the report): `subagent` → **`spec-walkthrough`**, **`background: true`**. Hand it a complete brief: change id, `kind`, `targets`, `tests`, the diff base, and the instruction to set `tech_brief: true` + `status: applying` and write `walkthrough.md`. It writes inside the change folder and returns what it wrote.
   - If a child fails or times out, re-run it, or do that work yourself and say so.
6. `node scripts/gates/build-board.mjs` while you wait.
7. **Join — you are accountable for whatever a child wrote**:
   - **Implementer**: read its report against the diff. Scope creep, a missing test or a shortcut without its `shortcut: <limit>, <when to upgrade>` note → send it back with a sharper brief, or finish it yourself.
   - **Gate**: read the output **verbatim**. Red → fix and return to step 5.
   - **Walkthrough**: open `walkthrough.md` and **verify every `file:line` it claims against the real code**; chase every `unclear:` and every mechanism that looks invented — a wrong brief is your report, not the child's. Confirm `tech_brief: true` is present and the 3 questions are `TODO(human)`. Fix the file yourself if needed.
8. **Mandatory report to the user** (fixed, short format):
   - Change: `<id>` (kind)
   - Per requirement: requirement (ID if present) → files touched (`file:line`) → the test proving it → state
   - Protected zone: approval (yes/no/n-a) · Open waivers · Pending decisions · Conflicts · Citations (broken / uncited, if applicable)
   - Tech brief: written / pending (only when flagged) — and who wrote it (you / the child) + what you verified
   - Gate result + recorded evidence (`evidence.json`)
   - Open questions / decisions taken during implementation
9. **`verified` only if**: green gate **with test evidence** + no blocking waivers (requested/expired) + no pending decisions + no unapproved conflicts + (protected zone → approved **with its id in `DECISIONS.md`**). Otherwise it stays `applying` with the list of blockers. (A pending tech brief or comprehension sign-off is a warning only — it blocks `--pre-archive`, not `verified`.)
10. If the change is `kind: architecture` **or creates a new capability**: suggest `/diagram-sync` before archiving (capability tags live in `ARCHITECTURE.dsl`).
11. **Pre-archive** (after merge, before archiving): `node scripts/gates/gate-check.mjs --pre-archive <id>` must be **OK** (verified · no blocking waivers · no decisions · no conflicts · tech brief complete + comprehension sign-off · `gitref` merged). Only then: `openspec archive <id>`.

**Non-negotiables — check them before you report** (a child never does these for you, so they are yours even when the implementation was dispatched):
- the branch is named **exactly** `change/<id>` — not `spec/…`, not `feat/…`, not `feature/…`;
- the commit that carries the work updated `gitref` to the branch tip (or `merged_as` on a squash merge);
- every requirement has its test, and where the repo uses IDs, its `@cita`;
- if a dispatched piece could not run (agent not installed, child failed), you did it in this session and the report says so.

**At the end, state**: review the diff, merge, and only then archive with the preconditions OK. Close with one or two lines: what you skipped or did not check, and any risk.
