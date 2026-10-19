# Spec Growth — Documentation

How the system works, why it works that way, and how to operate it day to day.
Canonical source of truth: [`../SKILL.md`](../SKILL.md); if a script changes, the skill and these documents are updated together.

## The 30-second version

1. Every behavior change becomes a **change folder** under `openspec/changes/<id>/`, with metadata in `.openspec.yaml`.
2. The agent implements it on a branch; `verified` is **earned** only with a green `gate-check --run-tests` run, recorded as local **evidence** (freshness by content fingerprint).
3. Changes that touch persistence, state, concurrency, networking, platform SDKs, security or add a dependency declare `tech_brief: true`: the agent explains the mechanism in `walkthrough.md`, and you sign it off with a short teach-back in `/spec-verify` before archiving.
4. Anything that deviates from the rules — a waiver, an open decision, a conflict with a past decision — **blocks closure** until the human resolves it, and every resolution is recorded in `DECISIONS.md`.
5. `BOARD.md` (generated, git-ignored) shows exactly what awaits the human at any moment: approvals, decisions, comprehension sign-offs, capabilities, the dependency graph. For the read-only overview of what is **not archived** — the declared-deps graph plus one line per spec — run `/spec-deps-graph`.
6. The heavy work runs **in parallel child sessions**: `/spec-apply` and `/spec-verify` dispatch the test suite, the per-change semantic audit and the tech brief, and join the results — the checks are identical, the waiting is not. See [Speed](speed.md).

## The documents

| Document | What you will find |
|---|---|
| [Concepts](concepts.md) | The vocabulary: changes, evidence, tech briefs, waivers, decisions, conflicts, protected zones, capabilities |
| [Lifecycle & approvals](lifecycle.md) | How a change moves from idea to archive — and exactly what to record for each approval |
| [Gates](gates.md) | What the mechanical gate checks, the modes and flags, and the CI policy |
| [Workflows](workflows.md) | Step-by-step recipes: feature, bug triage, refactor, protected zone, waiver, conflict, archiving, `/spec-explain`, `/spec-deps-graph` |
| [Speed](speed.md) | Why apply/verify were slow, the parallel child sessions they dispatch, what is not relaxed, and how to measure it |
| [FAQ](faq.md) | Short answers to the questions that come up first |
| [Evidence & limits](evidence.md) | The primary source, the empirical support (and its caveats), the critiques, and the consolidated known limits |
| [Security](security.md) | The SkillSpector scan, its findings and their triage |
