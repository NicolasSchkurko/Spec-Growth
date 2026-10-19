# Spec Growth

**Spec-anchored change management for [OpenCode](https://opencode.ai), built on OpenSpec.**

Specs are the living contract of the present; changes are the future in flight; `BOARD.md` is a generated view of both. The machine detects, the human decides.

The system exists for two failure modes of AI-assisted development: agents lose quality as their context fills up, and specs drift silently away from the code. Its answer: every behavior change travels through a change folder with machine-readable metadata, and the invariants live in a deterministic gate — not in prose an agent can forget.

## Quickstart

**Prerequisites:** Node ≥ 20.19 · git · the OpenSpec CLI (`@fission-ai/openspec`) · OpenCode.

**1. Install the skill** (global, once per machine):

```bash
git clone https://github.com/NicolasSchkurko/Spec-Growth.git ~/.config/opencode/skills/spec-growth
```

Windows (PowerShell):

```powershell
git clone https://github.com/NicolasSchkurko/Spec-Growth.git "$env:USERPROFILE\.config\opencode\skills\spec-growth"
```

**2. Bootstrap a repository:** open any git repository in OpenCode and say **"Start Spec Growth"**. The INIT checks the preconditions, installs or verifies OpenSpec, adds the missing MCPs (`codebase-memory`, Structurizr — only the absent ones), lays down the scaffold (`AGENTS.md`, `openspec/config.yaml`, the gate scripts, the pre-commit hook), copies the nine commands and regenerates the BOARD.

**3. Create your first change:** `/spec-add "<idea>"` → review and accept → `/spec-apply` → `/spec-verify` → merge → archive. The full walkthrough: [Workflows](docs/workflows.md).

## Commands

| Command | Role |
|---|---|
| `/spec-add` | Draft a change: proposal, delta spec, metadata, alternatives. No code |
| `/spec-triage` | Bug or discrepancy → you decide which side is right → fix change with a regression test |
| `/spec-apply` | Implement one change on its branch: tests + green evidence; writes the tech brief; asks for zone approvals |
| `/spec-verify` | Gate + adversarial semantic pass + teach-back for tech briefs (records your sign-off) |
| `/spec-explain` | Explain existing behavior with real `file:line` traces; proposes a refactor when the code is opaque |
| `/spec-gate` | Measure and record — static by default, `--run-tests` for evidence. Fixes nothing |
| `/spec-deps-graph` | What is not archived: the declared-deps graph + one line on what each living spec and change in flight does (read-only) |
| `/spec-resolve` | Walk through what awaits the human: approvals, decisions, conflicts, waivers |
| `/diagram-sync` | Diff the C4 model (`ARCHITECTURE.dsl`) against code and IaC |

The `bug-finder` skill runs alongside in **anchored mode**: it audits against the living specs and `DECISIONS.md`, and routes findings through `/spec-triage`.

## How it works

- **One path from idea to code:** every behavior change is a folder under `openspec/changes/<id>/` with a proposal, a delta spec, tasks and metadata (`kind`, `targets`, `tests`, `deps`, `gitref`).
- **`verified` is earned, not declared:** it requires a green `gate-check --run-tests` run recorded as local evidence — freshness by content fingerprint, so any later edit stales it while committing already-tested code does not.
- **Risky changes carry a tech brief:** persistence/state, concurrency, networking, platform SDKs, security or a new dependency → a plain-language `walkthrough.md` and a 3-question teach-back before your sign-off.
- **Deviations block closure:** waivers, open decisions and conflicts stay pending until the human resolves them, and every resolution lands in `DECISIONS.md`.
- **The BOARD shows what awaits you.** Specs own behavior, `ARCHITECTURE.dsl` owns structure, `DECISIONS.md` owns the why.

Details, diagrams and edge cases: [docs/](docs/README.md).

## Repository layout

```
SKILL.md            the canonical spec (router: glossary, operations, rules)
references/         INIT · scripts, flags & gate policy · implementation status & limits
docs/               concepts · lifecycle · gates · workflows · FAQ · evidence · security
assets/commands/    the nine commands copied into a repo by the INIT
assets/scripts/     gate-check.mjs · build-board.mjs · build-graph.mjs · compact-archive.mjs · build-map.mjs · lib.mjs
assets/scaffold/    AGENTS.md · config.yaml · pre-commit hook · schema patch
quality/            the conformance suite and its recorded results
```

## Status

**v1.4** — adds `/spec-deps-graph` (the declared-deps graph plus a one-line inventory of what the non-archived specs do, on a free background model); quotes every `rules:` item in the scaffold `config.yaml` (OpenSpec used to drop the `proposal` rules in silence) and documents how to split a capability; hardened through adversarial audit rounds and validated by a frozen conformance suite ([`quality/conformance/`](quality/conformance/README.md)) with a measured token diet. What is implemented, and what is deliberately not, lives in `SKILL.md` → [`references/status.md`](references/status.md); the research base and the consolidated limits are in [Evidence & limits](docs/evidence.md).

## License

MIT — see [LICENSE](LICENSE). The codebase map (`build-map.mjs`) is adapted from [Ponytail](https://github.com/DietrichGebert/ponytail) (MIT); see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Security

Static security scan (SkillSpector, NVIDIA): **MEDIUM/CAUTION, no HIGH/CRITICAL findings** — findings and triage in [docs/security.md](docs/security.md). Re-scan after changes; a new HIGH/CRITICAL is a blocker.
