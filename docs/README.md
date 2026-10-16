# Spec Growth — Documentation

This folder explains how the system works, why it works that way, and how to operate it day to day.

| Document | What you will find |
|---|---|
| [Concepts](concepts.md) | The vocabulary: changes, evidence, waivers, decisions, conflicts, protected zones, capabilities |
| [Lifecycle & approvals](lifecycle.md) | How a change moves from idea to archive — and exactly how approvals are recorded and checked |
| [Gates](gates.md) | What the mechanical gate checks, the modes and flags, and the CI policy |
| [Workflows](workflows.md) | Step-by-step recipes: feature, bug triage, refactor, protected zone, waiver, conflict |
| [FAQ](faq.md) | Short answers to the questions that come up first |

Canonical source of truth: [`../SKILL.md`](../SKILL.md). If a script changes, the skill and these documents are updated together.

## The 30-second version

1. Every behavior change becomes a **change folder** under `openspec/changes/<id>/` with metadata in `.openspec.yaml`.
2. The agent implements it on a branch; `verified` is **earned** only with a green `gate-check --run-tests` run recorded as local **evidence**.
3. Anything that deviates from the rules — a waiver, an open decision, a conflict with a past decision — **blocks closure** until the human resolves it, and every resolution is recorded in `DECISIONS.md`.
4. `BOARD.md` (generated, git-ignored) shows exactly what awaits the human at any moment.
