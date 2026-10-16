# Spec Growth

Spec-anchored change management for [OpenCode](https://opencode.ai), built on OpenSpec.

Specs are the living contract of the present. Changes are the future in flight. The BOARD is a generated view of both. The machine detects; the human decides.

## How it works

- Every behavior change goes through a change folder (`openspec/changes/<id>`) with metadata: `kind`, `targets`, `tests`, `deps`, `gitref`.
- `verified` is earned, not declared: it requires a green `gate-check --run-tests` run, recorded as local evidence (freshness is a **content fingerprint**: edits count, committing unchanged code does not). (`--tests-command` runs in substituted mode and never produces green.)
- Changes that touch persistence/state, concurrency, networking, platform SDKs, security or add a dependency declare `tech_brief: true`: the agent writes `walkthrough.md` (mechanism, physical traceability, limits, APIs, implicit decisions) and you sign it off in `/spec-verify` with a short teach-back.
- Deviations are explicit: waivers (`requested` → `granted`, with owner and expiry), open decisions, and conflicts that contradict something already decided or written. All of them block closure until the human resolves them, and every resolution is recorded in `DECISIONS.md`.
- Protected zones (auth, persistence, external APIs) require explicit human approval, cross-checked against the decision log.
- Capabilities are the spec folders (`cap:<capability>`); components in `ARCHITECTURE.dsl` carry `cap:` tags (checked both ways) and the BOARD renders the declared-dependency graph.
- A dependency-free Node gate (`gate-check.mjs`) runs on pre-commit, in CI, and before archiving. `BOARD.md` is generated and git-ignored; `openspec/board.json` is the machine index.

## Requirements

Node ≥ 20.19 · git · the OpenSpec CLI (`@fission-ai/openspec`) · OpenCode.

The optional MCPs (`codebase-memory`, Structurizr) are added by the INIT only when missing.

## Install

Clone as a global OpenCode skill:

```bash
git clone https://github.com/NicolasSchkurko/Spec-Growth.git ~/.config/opencode/skills/spec-growth
```

Windows (PowerShell):

```powershell
git clone https://github.com/NicolasSchkurko/Spec-Growth.git "$env:USERPROFILE\.config\opencode\skills\spec-growth"
```

## Bootstrap a repository

In any git repository, ask the agent: **"Start Spec Growth"**. The INIT procedure (detailed in `SKILL.md`):

1. checks preconditions (git, Node, npm)
2. installs or verifies the OpenSpec CLI and adds the missing MCPs
3. forks the `spec-anchored` schema and applies the patch
4. lays down the scaffold: `AGENTS.md`, `openspec/config.yaml`, `BOARD.md`, `DECISIONS.md`, the gate scripts and the pre-commit hook
5. copies the eight commands into `.opencode/commands/`
6. regenerates the BOARD

## Commands

| Command | Role |
|---|---|
| `/spec-add` | Create a change: proposal, delta spec, metadata, technical alternatives. No code |
| `/spec-triage` | Bug or discrepancy → decide the side (human) → ADR + `fix` change with a regression test |
| `/spec-apply` | Implement one change on its branch: tests + gate with green evidence; writes the tech brief (`walkthrough.md`) when flagged; asks for approval on protected zones |
| `/spec-verify` | Gate + adversarial semantic pass + **comprehension teach-back** for tech briefs: asks the 3 questions, validates your answers against the code, records the sign-off |
| `/spec-explain` | Explain existing behavior: traces the real path (`file:line`), mechanism + Mermaid, anchors a note in `docs/mechanisms/`, proposes a `refactor` when opaque |
| `/spec-gate` | Measure and record (static or `--run-tests`). Fixes nothing |
| `/spec-resolve` | Resolve what awaits the human: approvals, decisions, conflicts, waivers |
| `/diagram-sync` | Diff the C4 model (`ARCHITECTURE.dsl`) against code and IaC |

Works alongside the `bug-finder` skill in **anchored mode**: it audits against the living specs and `DECISIONS.md`, classifies findings (spec violation · spec silent · contradicts decision) and routes each one through `/spec-triage`.

## Gate modes

| Flag | Purpose |
|---|---|
| *(none)* | Static gate — the pre-commit mode (seconds) |
| `--run-tests` | Run `test_command` and record green evidence — the CI/verification mode |
| `--scope <id>` | Local focus: reds from other changes become warnings. Affects the report only, never the evidence |
| `--pre-archive <id>` | Archive preconditions: verified · no blocking waivers/decisions/conflicts · tech brief complete + comprehension signed off · fresh green evidence · merge verified against the current target state |
| `--diff <base>` | Protected files touched without approval, plus code files unclaimed by any active change (scope drift), against a git base — for CI |
| `--tests-command "CMD"` | Substituted test mode: never produces green; forbidden in CI |

`compact-archive.mjs --days=90 [--apply]` collapses old archived changes into per-year digests; it refuses to delete content that is dirty or uncommitted.

## Repository layout

```
SKILL.md            the canonical spec: glossary, INIT, operations, rules, status and limits
docs/               how it works, with diagrams: concepts · lifecycle & approvals · gates · workflows · FAQ
assets/commands/    the eight commands copied into a repo by the INIT
assets/scripts/     gate-check.mjs · build-board.mjs · compact-archive.mjs · lib.mjs
assets/scaffold/    AGENTS.md · config.yaml · pre-commit hook · schema patch · seeds
```

## Documentation

Detailed docs live in [`docs/`](docs/README.md), with diagrams:

- [Concepts](docs/concepts.md) — the vocabulary and where everything lives
- [Lifecycle & approvals](docs/lifecycle.md) — how a change moves from idea to archive, and exactly what to record for each approval
- [Gates](docs/gates.md) — what the gate checks, the modes and flags, and the CI policy
- [Workflows](docs/workflows.md) — step-by-step recipes: feature, bug triage, refactor, protected zone, waiver, conflict
- [FAQ](docs/faq.md) — short answers to the first questions
- [Evidence & limits](docs/evidence.md) — the research the comprehension gate is based on, what transfers (and what does not), and the consolidated known limits

## Evidence & limits

This system is research-backed, and it says how: the core architecture follows **The Spec Growth Engine** (Grabowski, [arXiv:2606.27045](https://arxiv.org/abs/2606.27045)); the v1.0 comprehension mechanisms map to GenAI-SE studies on comprehension debt, explanation gates, skill formation and cognitive-load-aware refactoring; and there is direct 2026 empirical support (spec-driven test generation, external checklists > self-checks). The page also records the critiques the approach attracts — waterfall risk, output-vs-outcome, determinism — and the consolidated known limits: [docs/evidence.md](docs/evidence.md).

## Status

**v1.2.** Iterated through adversarial audit rounds and empirical validation (v0.5 → v1.2), including a frozen conformance suite (`quality/` in this repo) and a measured token diet. The current state of what is implemented, and its known limits, lives in `SKILL.md` → `references/status.md`. Notable limits: evidence is local and unsigned (the real barrier is CI running `--run-tests`); `--scope` affects the local report only; flag-based approvals rely on agent discipline plus the ADR cross-check; the comprehension sign-off is a ritual record — the value is the teach-back conversation, not the checkbox. Since v1.2, `/spec-gate` and `/diagram-sync` run as background subagents on a cheap model; interactive commands inherit the session model (see `SKILL.md` → *Model routing*).
