---
description: Spec Growth — add a change (spec) with alternatives, expected outcome, protected zones and decisions
---

You are operating the **Spec Growth** system in this repository (load the `spec-growth` skill if you need details). Goal: create a new change under `openspec/changes/` from: "$ARGUMENTS". **Do NOT write code in this step.**

1. **Context**: read `BOARD.md` and `openspec/board.json` (capability registry). If the code graph (codebase-memory) is available, consult it for the existing stack; otherwise read the relevant `openspec/specs/` (and their `[REQ-…]` IDs) and the project dependencies.

2. **Clarify** (max 4 questions): what and for whom; acceptance criteria. Choose `kind` = `fix` | `feature` | `architecture` | `refactor` and justify it in one line (a `refactor` does not change behavior: its proof is the green suite + a regression `[@test]`). For `feature`/`architecture`, ask for the **outcome**: *"what result do you expect and how will we know it was worth it?"* — recorded as "Expected outcome" in `proposal.md`; if unclear, note it as an open doubt (it does not block).

3. **Technical alternatives** — mandatory when the change touches **persistence/state, concurrency, networking, platform SDKs, security/auth, or a new dependency/library** — even when the request names no technology (that is exactly the case where it matters); skip only for a trivial `fix`. If it applies:
   - **Option 0 — reuse**: search the capability registry (`provides: [cap:x]`) and the graph: does something already solve this? If so: "use contract, do not rebuild".
   - Propose **2–3 alternatives** (including the requested one) evaluated against: requirements; actual repo size/context (e.g., if it stores huge amounts of data, contrast SQLite vs MySQL/Postgres with that evidence); cost; risks; reversibility; which zones/invariants it touches.
   - Present a **short table** (option · why yes · why not · recommendation) and ask the human to choose. **The decision is human.**
   - If a decision **exceeds your authority** and the human has not decided: record an **open decision** (`open_decisions: [{question, target, proposal}]`).
   - If the request **contradicts something already decided or written** (an ADR in `DECISIONS.md`, a living requirement, an in-force waiver): record a **⚔ conflict** (`conflicts: [{with, what, proposal}]`) — it is approved explicitly (reversal + ADR) before `verified`.
   - Record the result: an "Alternatives considered" section in `proposal.md`; if it is a real architecture decision → consider `kind: architecture` + an ADR in `DECISIONS.md`.

4. **Protected zones**: cross the `targets` against `protected:` in `openspec/config.yaml`. If they touch a zone: warn *"🔒 this will require your explicit approval (human_approved)"*.

5. **Create the change**: `openspec new change <kebab-id>` (schema `spec-anchored`). Write:
   - `proposal.md`: why + what (short) + "Expected outcome" (if applicable) + "Alternatives considered" (if applicable).
   - `specs/<capability>/spec.md`: delta with Requirements (SHALL) and concrete WHEN/THEN scenarios. **Every requirement carries a `[@test] <path>` line.** If the project uses **requirement IDs** (check living specs), assign `[REQ-<capability>-<n>]` to new ones and preserve existing IDs. Tests/code may cite them with `@cita REQ-…` (optional; enables the broken-citation/hallucination detector).
   - `tasks.md`: verifiable checklist. If large, propose the **riskiest first vertical slice** (hardest-first).
   - `design.md`: ONLY if `kind: architecture`.

6. **Metadata**: fill `.openspec.yaml` with `kind`, `targets`, `tests`, `deps`, `gitref: <git rev-parse --short HEAD>`; `waivers` / `open_decisions` / `conflicts` only when they apply.

7. **Overlaps**: if another active change claims a shared `target`, warn and propose a plan. If you declare the **dependency** (`deps`), the gate treats the overlap as **sequenced** (warning, not error); if independent, sequence them or replan.

8. **Validate & board**: `openspec validate <id> --strict` and `node scripts/gates/build-board.mjs`.

9. **Final summary**: id, kind, capabilities, targets, protected zones affected (if any), open decisions (if any), expected outcome, alternatives considered (if any), and that it stays `status: draft` awaiting **human approval** (on approval: `status: accepted` + `accepted_by` + `accepted_at`).

Rules: one change per idea; no code here; `[@test]` mandatory for `kind: fix`/`refactor`; alternatives mandatory when the request carries a decision.
