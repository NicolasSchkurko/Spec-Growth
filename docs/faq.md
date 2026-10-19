# FAQ

## Approvals and decisions

**How do I approve a change?**
Two equivalent ways. Tell the agent "approved" (or run `/spec-resolve` and answer item by item) — it writes the records for you. Or edit them yourself: to **accept**, in the change's `.openspec.yaml` set `status: accepted`, `accepted_by: "<name>"`, `accepted_at: "<date>"`. Everything else (protected zones, waivers, decisions, conflicts) is itemized in [Lifecycle → What to record](lifecycle.md#what-to-record-for-each-kind-of-approval).

**Do I have to write something in `DECISIONS.md` myself?**
Not normally — the agent writes it when you approve. A plain accept needs no ADR at all. A **protected zone** does: `human_approved: true` plus an approval line in `DECISIONS.md` mentioning the change id as a word. Decision and conflict resolutions also get their ADR, so the "why" survives.

**Decision request or conflict — what's the difference?**
A **decision request** asks for something **not yet decided** (beyond the agent's authority). A **conflict ⚔** points at something **already decided or written** that the change would overturn. Both block `verified`; both end with an ADR.

## The gate and evidence

**Why does the gate say "verified without local green evidence"?**
`verified` is earned by a green `gate-check --run-tests` run. In static mode (pre-commit) the missing green is only a warning; before archiving it is an error. Run `--run-tests`.

**Why does it say my green evidence is STALE?**
The content of the change's `targets` or `tests` changed after the last recorded green run — even an uncommitted edit. Committing the already-tested code does **not** stale it: freshness is a content fingerprint (timestamps are only the fallback), and line endings are normalized (CRLF/LF), so a `git checkout` that rewrites files on Windows does not stale it either. Re-run `gate-check --run-tests`.

**Can I commit with a red gate?**
The pre-commit hook blocks it. If the reds are from *other* changes, use `--scope <id>` for your local commit — it downgrades foreign reds to warnings, and **only in the report**: the evidence stays honest. CI always runs unscoped.

**What is `--tests-command` for, then?**
It runs a substitute command in `tests-substituted` mode, for convenience or experiments. It records evidence but **never green**, and it is forbidden in CI.

**Why isn't `evidence.json` committed?**
It is a local, per-clone signal by design; committing it is a gate error. The barrier that counts is CI running `--run-tests`.

## Comprehension

**What is `walkthrough.md`, and what happens if I don't understand a change?**
Changes that touch persistence/state, concurrency, networking, platform SDKs, security or add a dependency are flagged `tech_brief: true`: the agent explains the mechanism in the change's `walkthrough.md`, and `/spec-verify` walks you through 3 questions in your own words (a teach-back — the agent validates your answers against the code and corrects you; max 2 rounds). The gate warns until the sign-off, and errors before archiving — or you grant a `comprehension-debt` waiver (owner + expiry) if you consciously accept the debt.

## Waivers

**Someone granted a waiver with a far-away expiry. Is that fine?**
It is allowed, but the gate warns when a granted waiver has more than 180 days of validity, and expired waivers inside `archive/` are reported. A waiver is a dated debt, not a permanent exemption.

## Capabilities

**Why does it warn "capability X is not tagged in ARCHITECTURE.dsl"?**
A living capability (a spec folder, `cap:<capability>`) is realized by no component of the C4 model. Run `/diagram-sync` to tag the components that implement it. The reverse warning means a tag references a capability that no longer exists (stale).

## Day to day

**A one-line fix feels heavier than just vibecoding it. Can it be faster?**
Yes: `/spec-quick` is the low-risk fast path. It batches the whole loop (create → accept → implement → gate) into **one interaction and one turn**, instead of one turn per step, and asks a tech brief's 3 questions together. The guardrail is `risk-router.mjs`: architecture, protected zones, persistence/concurrency/network/SDK/security, a new dependency or capability, conflicts and open decisions all send the change back to the full flow (`/spec-add`). The gate, the green evidence and every human-only record are identical — the fast path removes round-trips, not checks. Details: [Speed](speed.md).

**Why did `/spec-verify` not re-run the test suite?**
Because the evidence was already fresh: the fingerprint of the change's `targets` + `tests` matched the recorded green run, so re-running would prove the same thing. It ran static (`--scope <id>`) and said so. If anything changed, the gate reports `STALE evidence` and the suite runs again — before `--pre-archive`, or in CI, it always runs.

**How do I see everything that awaits me right now?**
`BOARD.md` (regenerate with `node scripts/gates/build-board.mjs`) or run `/spec-resolve`. Sections: 🔒 approvals · ⏸ decisions and ⚔ conflicts · 🧠 comprehension sign-offs · in progress · drafts · waivers · Capabilities · Dependency graph · blocked · archive · warnings.

**How do I see which specs exist and how they depend on each other?**
Run `/spec-deps-graph`: it renders the declared-deps graph and adds one plain line on what each spec that is **not archived** does (the living ones plus the changes in flight). It is read-only and runs on a free background model, so it costs you no session context. The raw inventory alone: `node scripts/gates/build-graph.mjs`.

## Models

**Can I change which model runs `/spec-gate`, `/spec-deps-graph` or `/diagram-sync`?**
Yes. Those run as **background subagents** (`/spec-gate` and `/diagram-sync` on a cheap model, `opencode-go/space-bunny`; `/spec-deps-graph` on a free model, `opencode/space-bunny-free`), so their work never pollutes your session. Change it in the command's frontmatter — `.opencode/commands/spec-gate.md` (or `spec-deps-graph.md`, `diagram-sync.md`): `model: provider/model#variant` and `subagent: true|false` (or `agent: <id>` to route via another agent). Commands reload automatically, no restart needed. Remove the `model` line to fall back to the agent's model, then to your session's model. The interactive commands (`add`, `triage`, `apply`, `verify`, `explain`, `resolve`) always inherit your session model — the assumption is that it is your most capable one. Full table: `SKILL.md` → *Model routing*.

## About

**Is Spec Growth based on research?**
Partly, and it says which part: the comprehension mechanisms (tech brief, teach-back, expressivity rules, `/spec-explain`) map to recent GenAI-assisted SE studies on comprehension debt, explanation gates, skill formation and cognitive-load-aware refactoring — novice-heavy populations, so the mechanisms transfer but the effect sizes do not. The rest is engineering practice from audit rounds. Full map and caveats: [Evidence & limits](evidence.md).

**Do the docs go stale?**
The system's own honesty rule applies to itself: `SKILL.md` (→ `references/status.md`) carries the implementation-status section, and if a script changes, the skill and these documents are updated together.
