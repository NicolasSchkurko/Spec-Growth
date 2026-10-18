# Spec Growth

**Spec-anchored change management for [OpenCode](https://opencode.ai), built on OpenSpec.**

Specs are the living contract of the present. Changes are the future in flight. The BOARD is a generated view of both. The machine detects; the human decides.

The system fights two failure modes of AI-assisted development: agents lose quality as their context fills up, and specs silently drift away from the code. Its answers: every behavior change goes through a change folder with machine-readable metadata, and the invariants live in a deterministic gate — not in prose the agent can forget.

## Quickstart

**Prerequisites:** Node ≥ 20.19 · git · the OpenSpec CLI (`@fission-ai/openspec`) · OpenCode.

### 1. Install the skill

Global, once per machine:

```bash
git clone https://github.com/NicolasSchkurko/Spec-Growth.git ~/.config/opencode/skills/spec-growth
```

Windows (PowerShell):

```powershell
git clone https://github.com/NicolasSchkurko/Spec-Growth.git "$env:USERPROFILE\.config\opencode\skills\spec-growth"
```

### 2. Bootstrap a repository

Open any git repository in OpenCode and say **"Start Spec Growth"**. The INIT procedure:

1. checks the preconditions (git, Node, npm);
2. installs or verifies the OpenSpec CLI and adds the missing MCPs (`codebase-memory`, Structurizr) — only the ones that are absent;
3. forks the `spec-anchored` schema and applies the patch;
4. lays down the scaffold: `AGENTS.md`, `openspec/config.yaml`, `BOARD.md`, `DECISIONS.md`, the gate scripts and the pre-commit hook;
5. copies the eight commands into `.opencode/commands/`;
6. regenerates the BOARD.

### 3. Create your first change

`/spec-add "<idea>"`. Review the draft, accept it, then `/spec-apply` → `/spec-verify` → merge → archive. The detailed walkthrough is in [Workflows](docs/workflows.md).

## How it works

- **Every behavior change is a change folder** — `openspec/changes/<id>/` — with a proposal, a delta spec, tasks, and metadata in `.openspec.yaml`: `kind`, `targets`, `tests`, `deps`, `gitref`. This is the only path from "we want this" to "this exists".
- **`verified` is earned, not declared.** It requires a green `gate-check --run-tests` run, recorded as local evidence. Freshness is a **content fingerprint**: any later edit — even uncommitted — marks the evidence stale; committing code that was already tested does not. (`--tests-command` runs in substituted mode and never produces green.)
- **Risky changes carry a tech brief.** A change that touches persistence/state, concurrency, networking, platform SDKs, security or adds a dependency declares `tech_brief: true`. The agent writes `walkthrough.md` in plain language (mechanism, where the state physically lives, limits, APIs, implicit decisions), and `/spec-verify` walks you through 3 change-specific questions — a teach-back — before your sign-off is recorded.
- **Deviations are explicit, and every one of them blocks closure:** waivers (`requested` → `granted`, with owner and expiry), open decisions, and conflicts with something already decided or written. Each resolution is recorded in `DECISIONS.md`.
- **High-risk areas are protected.** Globs under `protected:` in `openspec/config.yaml` (auth, persistence, external APIs) require the human's explicit approval, recorded in the change **and** cross-checked against `DECISIONS.md`.
- **Capabilities are spec folders.** `openspec/specs/<capability>/` is the capability `cap:<capability>`; components in `ARCHITECTURE.dsl` carry matching `cap:` tags, checked in both directions. The BOARD renders the declared-dependency graph.
- **A dependency-free Node gate enforces all of it** — on pre-commit, in CI, and before archiving. `BOARD.md` (generated, git-ignored) is the human view; `openspec/board.json` is the machine index.

## Commands

| Command | Role |
|---|---|
| `/spec-add` | Create a change: proposal, delta spec, metadata, technical alternatives. Does not write code |
| `/spec-triage` | Bug or discrepancy → you decide which side is right → ADR + `fix` change with a regression test |
| `/spec-apply` | Implement one change on its branch: tests + gate with green evidence; writes the tech brief when flagged; asks for approval on protected zones |
| `/spec-verify` | Gate + adversarial semantic pass + **comprehension teach-back** for tech briefs: asks the 3 questions, validates your answers against the code, records the sign-off |
| `/spec-explain` | Explain existing behavior: traces the real path (`file:line`), mechanism + Mermaid, anchors a note in `docs/mechanisms/`, proposes a `refactor` when the code is opaque |
| `/spec-gate` | Measure and record (static by default, `--run-tests` for evidence). Fixes nothing |
| `/spec-resolve` | Resolve what awaits the human: approvals, decisions, conflicts, waivers |
| `/diagram-sync` | Diff the C4 model (`ARCHITECTURE.dsl`) against code and IaC |

The `bug-finder` skill works alongside in **anchored mode**: it audits against the living specs and `DECISIONS.md`, classifies findings (spec violation · spec silent · contradicts decision), and routes each one through `/spec-triage`.

## Gate modes

| Flag | Purpose |
|---|---|
| *(none)* | **Static** — the pre-commit mode; runs in seconds and produces no green |
| `--run-tests` | Runs `test_command` and records **green evidence** — the CI/verification mode |
| `--pre-archive <id>` | Archive preconditions: verified · no blocking waivers/decisions/conflicts · tech brief complete + signed off · fresh green evidence · merge verified against the current target state |
| `--diff <base>` | Protected files touched without approval, plus code files unclaimed by any active change (scope drift), against a git base — for CI |
| `--scope <id>` | Local focus: reds from other changes become warnings. Affects the report only, never the evidence |
| `--tests-command "CMD"` | Substituted test mode: records evidence but never green; forbidden in CI |

`compact-archive.mjs --days=90 [--apply]` collapses old archived changes into per-year digests and refuses to delete content that is dirty or uncommitted.

## Repository layout

```
SKILL.md            the canonical spec: glossary, operations, rules — a router over references/
references/         INIT procedure · scripts, flags & gate policy · implementation status & limits
docs/               how it works, with diagrams: concepts · lifecycle · gates · workflows · FAQ · evidence
assets/commands/    the eight commands copied into a repo by the INIT
assets/scripts/     gate-check.mjs · build-board.mjs · compact-archive.mjs · lib.mjs
assets/scaffold/    AGENTS.md · config.yaml · pre-commit hook · schema patch · seeds
quality/            the conformance suite and its recorded results (baseline, token diet, restructure)
```

## Documentation

Detailed docs live in [`docs/`](docs/README.md):

- [Concepts](docs/concepts.md) — the vocabulary, and where each artifact lives
- [Lifecycle & approvals](docs/lifecycle.md) — how a change moves from idea to archive, and exactly what to record for each approval
- [Gates](docs/gates.md) — what the gate checks, the modes and flags, and the CI policy
- [Workflows](docs/workflows.md) — step-by-step recipes: feature, bug triage, refactor, protected zone, waiver, conflict
- [FAQ](docs/faq.md) — short answers to the questions that come up first
- [Evidence & limits](docs/evidence.md) — what the approach is based on, what transfers (and what does not), and the consolidated known limits

## Evidence & limits

The system is research-backed, and it says which part. The core architecture follows **The Spec Growth Engine** (Grabowski, [arXiv:2606.27045](https://arxiv.org/abs/2606.27045)); the comprehension mechanisms map to GenAI-SE studies on comprehension debt, explanation gates, skill formation and cognitive-load-aware refactoring; and direct 2026 empirical work supports the spec → test → evidence chain. The same page records the critiques the approach attracts — waterfall risk, output-vs-outcome, determinism — and the consolidated known limits: [docs/evidence.md](docs/evidence.md).

## Status

**v1.3**, hardened through adversarial audit rounds (v0.5 → v1.3) and validated by a frozen conformance suite ([`quality/conformance/`](quality/conformance/README.md)) with a measured token diet. The token-saving mechanics — the reuse-first ladder, the compact codebase map (`build-map.mjs`) and the "what you skipped" reply rule — are **based on [Ponytail](https://github.com/DietrichGebert/ponytail)'s implementation** (MIT). What is implemented — and what is deliberately not — lives in `SKILL.md` → [`references/status.md`](references/status.md). The honest limits, in short:

- evidence is local and unsigned — the barrier that counts is CI running `--run-tests`;
- `--scope` affects the local report only;
- flag-based approvals rely on agent discipline plus the `DECISIONS.md` cross-check;
- the comprehension sign-off is a ritual record — its value is the teach-back conversation, not the checkbox.

Since v1.2, `/spec-gate` and `/diagram-sync` run as background subagents on a cheap model; interactive commands inherit the session model (see `SKILL.md` → *Model routing*).

## License

MIT — see [LICENSE](LICENSE). The codebase map (`build-map.mjs`) is adapted from [Ponytail](https://github.com/DietrichGebert/ponytail) (MIT); see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Security

Static security scan (SkillSpector, NVIDIA): **MEDIUM/CAUTION, no HIGH/CRITICAL findings** — findings and triage in [docs/security.md](docs/security.md). Re-scan after changes; a new HIGH/CRITICAL is a blocker.

