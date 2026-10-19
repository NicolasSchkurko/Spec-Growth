---
description: Spec Growth — add a change (spec) with alternatives, expected outcome, protected zones and decisions
---

You are operating the **Spec Growth** system in this repository (load the `spec-growth` skill if you need details). Goal: create a new change under `openspec/changes/` from: "$ARGUMENTS". **Do NOT write code in this step.**

1. **Dispatch the recon immediately** — `subagent` → **`spec-recon`**, **`background: true`**, with the raw request. It surveys existing contracts, reuse candidates, protected zones, overlaps in flight and prior decisions while you talk to the human. Do not read `BOARD.md`, `board.json` or the specs yourself for this: that is the child's job, and it runs in parallel with step 2.

2. **Ask everything in ONE message** (never one question per turn): the clarifications (max 4 — what and for whom; acceptance criteria; and for `feature`/`architecture` the **outcome**: *"what result do you expect and how will we know it was worth it?"*) **plus** the phrasing that makes a single answer enough: *"if it is as I understood, say so and I will draft the change — it still waits for your acceptance before any code."* Choose `kind` = `fix` | `feature` | `architecture` | `refactor` and justify it in one line (a `refactor` does not change behavior: its proof is the green suite + a regression `[@test]`).

3. **When the answers and the recon are in** (if the child failed, do the survey yourself and say so):
   - **Option 0 — reuse**: use the recon's **reuse candidates** — does something already solve this? Then "use contract, do not rebuild".
   - **Technical alternatives** — mandatory when the change touches **persistence/state, concurrency, networking, platform SDKs, security/auth, or a new dependency/library** — even when the request names no technology (that is exactly the case where it matters); skip only for a trivial `fix`. Build the table from the recon's evidence (existing capability, repo size, zones the change touches): **2–3 alternatives** (including the requested one) evaluated against requirements; actual repo size/context (e.g. if it stores huge amounts of data, contrast SQLite vs MySQL/Postgres with that evidence); cost; risks; reversibility; which zones/invariants it touches. Present a **short table** (option · why yes · why not · recommendation) and ask the human to choose — **in the same message** when the recon already answers the open questions. **The decision is human.**
   - If a decision **exceeds your authority** and the human has not decided: record an **open decision** (`open_decisions: [{question, target, proposal}]`).
   - If the request **contradicts something already decided or written** (an ADR in `DECISIONS.md`, a living requirement, an in-force waiver) — the recon's **prior decisions** section is the evidence: record a **⚔ conflict** (`conflicts: [{with, what, proposal}]`) — it is approved explicitly (reversal + ADR) before `verified`.
   - Record the result: an "Alternatives considered" section in `proposal.md`; if it is a real architecture decision → consider `kind: architecture` + an ADR in `DECISIONS.md`.

4. **Protected zones**: cross the `targets` against the recon's **likely targets / touched zones** and `protected:` in `openspec/config.yaml`. If they touch a zone: warn *"🔒 this will require your explicit approval (human_approved)"*.

5. **Create the change**: `openspec new change <kebab-id>` (schema `spec-anchored`). Write:
   - `proposal.md`: why + what (short) + "Expected outcome" (if applicable) + "Alternatives considered" (if applicable).
   - `specs/<capability>/spec.md`: delta with Requirements (SHALL) and concrete WHEN/THEN scenarios. **Every requirement carries a `[@test] <path>` line.** If the project uses **requirement IDs** (check living specs), assign `[REQ-<capability>-<n>]` to new ones and preserve existing IDs. Tests/code may cite them with `@cita REQ-…` (optional; enables the broken-citation/hallucination detector). If this change **creates a new capability** (no `openspec/specs/<capability>/` exists yet), the folder name IS the capability id (`cap:<capability>`) — choose it deliberately; the gate errors when two advanced changes create the same one (warning between drafts).
   - `tasks.md`: verifiable checklist. If large, propose the **riskiest first vertical slice** (hardest-first).
   - `design.md`: ONLY if `kind: architecture`.

6. **Metadata**: fill `.openspec.yaml` with `kind`, `targets`, `tests`, `deps`, `gitref: <git rev-parse --short HEAD>` (respect the repo's key convention: bare or `x-`-prefixed — the gate accepts both; OpenSpec ≥1.14 strict validation recommends `x-`); `waivers` / `open_decisions` / `conflicts` only when they apply. Add `tech_brief: true` when the change touches **persistence/state, concurrency, networking, platform SDKs, security/auth or a new dependency** — and a short **"State and persistence mechanism"** block to `proposal.md` (in plain words: where and how the data will live, reusing what already exists). The brief is approved with the change; without it the change cannot be archived.

7. **Overlaps**: use the recon's **overlaps with changes in flight**. If another active change claims a shared `target`, warn and propose a plan. If you declare the **dependency** (`deps`), the gate treats the overlap as **sequenced** (warning, not error); if independent, sequence them or replan.

8. **Validate & board**: `openspec validate <id> --strict` and `node scripts/gates/build-board.mjs`.

9. **Final summary**: id, kind, capabilities, targets, protected zones affected (if any), open decisions (if any), expected outcome, alternatives considered (if any) — plus the recon's **unknowns** that the human should clear — and that it stays `status: draft` awaiting **human approval** (on approval: `status: accepted` + `accepted_by` + `accepted_at`).

Rules: one change per idea; no code here; `[@test]` mandatory for `kind: fix`/`refactor`; alternatives mandatory when the request carries a decision; `tech_brief` flagged for persistence/state, concurrency, networking, platform SDKs, security or a new dependency → walkthrough + comprehension sign-off before archiving. The recon is advisory: verify its citations before you rely on them, and never let a child's digest stand in for the human's answer.
