# FAQ

## Approvals and decisions

**How do I approve a change?**
Two equivalent ways. Tell the agent "approved" (or run `/spec-resolve` and answer its questions in one round) — it writes the records for you. Or edit them yourself: to **accept**, in the change's `.openspec.yaml` set `status: accepted`, `accepted_by: "<name>"`, `accepted_at: "<date>"`. Everything else (protected zones, waivers, decisions, conflicts) is itemized in [Lifecycle → What to record](lifecycle.md#what-to-record-for-each-kind-of-approval).

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

**Why are `/spec-apply` and `/spec-verify` the slow ones — can they be faster?**
They were slow because they did independent work **one thing after another, inside the session**: the test suite then the tech brief; and in verify, the semantic pass change by change and only then the teach-back. Now they **dispatch**: `/spec-apply` launches the suite and the walkthrough drafter together in the background; `/spec-verify` launches the gate plus **one read-only auditor per active change** (capped at 6) and does the teach-back while they run. `/spec-add` and `/spec-triage` are batched the same way (a `spec-recon` survey runs while you answer; triage adds a `spec-explainer` for the code side), and `/spec-resolve` asks every pending in **one round** instead of one by one. What is not relaxed: the gate, the green evidence, the protected zones, the waivers, the decisions and the sign-offs are unchanged, no child can approve or decide, an unanswered item stays pending, and the parent **vets every finding and every `file:line` before you see it**. Details, costs and how to measure it: [Speed](speed.md).

**My commands feel slow between turns. Is there a setting for that?**
Yes: OpenCode's **`warming`** (`{"warming": true}`) keeps the provider-side **prompt cache** alive while you pause, by sending a periodic keep-alive request. A Spec Growth session re-sends a large fixed context (the skill, `AGENTS.md`, the specs) on every command, so a cold cache is exactly what makes the next command feel sluggish. It is **off by default** and the requests are **billable** (about 7 extra in a 30-minute pause), so enable it when your provider caches prompts and your pauses are long. The related trade-offs (`compaction` is lossy; `snapshots` costs I/O per step but powers `/undo`) are in [Speed](speed.md) → *Runtime settings*.

**Who wrote `walkthrough.md` — the agent or a child?**
`/spec-apply` hands it to the `spec-walkthrough` child, which writes **only inside `openspec/changes/`** (the `status`/`tech_brief` keys and `walkthrough.md`) and returns what it did. The parent then **verifies every `file:line` it claims before reporting it** — a wrong brief is the parent's responsibility, not the child's. The human's answers and the `understood_by`/`understood_at` sign-off are always the parent's, in `/spec-verify`.

**Why did `/spec-verify` not re-run the test suite?**
Because the evidence was already fresh: the fingerprint of the change's `targets` + `tests` matched the recorded green run, so re-running would prove the same thing. It ran static (`--scope <id>`) and said so (`reused fresh evidence: <id>`). If anything changed, the gate reports `STALE evidence` and the suite runs again — before `--pre-archive`, or in CI, it always runs.

**How do I see everything that awaits me right now?**
`BOARD.md` (regenerate with `node scripts/gates/build-board.mjs`) or run `/spec-resolve`. Sections: 🔒 approvals · ⏸ decisions and ⚔ conflicts · 🧠 comprehension sign-offs · in progress · drafts · waivers · Capabilities · Dependency graph · blocked · archive · warnings.

**How do I see which specs exist and how they depend on each other?**
Run `/spec-deps-graph`: it renders the declared-deps graph and adds one plain line on what each spec that is **not archived** does (the living ones plus the changes in flight). It is read-only and runs on a free background model, so it costs you no session context. The raw inventory alone: `node scripts/gates/build-graph.mjs`.

## Models

**Why is the auditor on a free model, and how do I know it is good enough?**
Because a detector's output is **vetted by the parent before it reaches you**, and the alternative is paying full price for a read pass. "Good enough" cannot be eyeballed — "the hard part with these routers is deciding the cheap model is good enough without already knowing the answer" — and Anthropic's own Explore subagent **stopped** using the cheap model, so a read-only agent is not automatically safe on one. The practical rules: the pin lives in one line per agent (`.opencode/agents/<id>.md` → `model:`), moving it is trivial, and **risky work escalates** — `kind: architecture` and tech-brief changes are audited in-session or on a stronger model, and the implementer always runs on your session model. If you want data before switching, run the frozen conformance suite with the candidate model — same bar as any other change: equal or better.

**Can I change which model runs the background work?**
Yes. `/spec-gate`, `/spec-deps-graph` and `/diagram-sync` run as **background child sessions**, and `/spec-apply` + `/spec-verify` + `/spec-add` + `/spec-triage` + `/spec-explain` dispatch their long work to the `spec-gate`, `spec-auditor`, `spec-walkthrough`, `spec-recon` and `spec-explainer` children — **all of them on one free model** (`opencode/glm-5.3-flash-free`), so there is no paid/free mix to confuse. One caveat learned the hard way: a model that `opencode models` lists may not answer (`Model unavailable`, or `Insufficient account funds` on the pay-as-you-go provider) — probe it once before pinning agents to it. `spec-implementer` is the deliberate exception: it declares no `model:` and runs on your session model. The model and the permissions live in the **agent file**: `.opencode/agents/` — `spec-implementer.md`, `spec-gate.md`, `spec-auditor.md`, `spec-walkthrough.md`, `spec-recon.md`, `spec-explainer.md`, `spec-deps-graph.md`, `diagram-sync.md` — `model: provider/model#variant` plus a `permissions:` list (the auditor and the recon declare `edit`/`shell` denied; the explainer may write `docs/mechanisms/`). One caveat, measured: **this OpenCode build does not enforce agent `permissions`** — a denied edit still wrote a file in `quality/dispatch-smoke.mjs`. The read-only roles hold because their prompt says so **and** because the parent checks `git status` / `git diff` when they return; do not treat the permissions block as a sandbox. The command in `.opencode/commands/` only routes: `agent: <id>` + `subagent: true` (and a `model:` there overrides the agent's). One exception worth knowing: **`spec-implementer` declares no `model:` on purpose**, so it runs on **the same model as your session** — the code is the core work and you chose that model for it; do not pin it. Delete a `model` line on any other agent to make it inherit too. Commands and agents reload automatically, no restart. The interactive part of every command (`add`, `triage`, `apply`, `verify`, `explain`, `resolve`) always stays on your session model — the assumption is that it is your most capable one. Full table: `SKILL.md` → *Model routing*.

## About

**Is Spec Growth based on research?**
Partly, and it says which part: the comprehension mechanisms (tech brief, teach-back, expressivity rules, `/spec-explain`) map to recent GenAI-assisted SE studies on comprehension debt, explanation gates, skill formation and cognitive-load-aware refactoring — novice-heavy populations, so the mechanisms transfer but the effect sizes do not. The rest is engineering practice from audit rounds. Full map and caveats: [Evidence & limits](evidence.md).

**Do the docs go stale?**
The system's own honesty rule applies to itself: `SKILL.md` (→ `references/status.md`) carries the implementation-status section, and if a script changes, the skill and these documents are updated together.
