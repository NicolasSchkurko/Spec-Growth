# Concepts

The vocabulary of Spec Growth. Every term has **exactly one owner** in the repository; this page defines each term and says where it lives.

## The change

The unit of work: a folder under `openspec/changes/<id>/` containing a proposal, delta specs, tasks, and a metadata file (`.openspec.yaml`) that the gates read.

**Kinds** — what the change is:

| Kind | Meaning | Extra requirement |
|---|---|---|
| `feature` | New behavior | — |
| `fix` | Corrects behavior that contradicts the spec | A regression `[@test]` is mandatory |
| `architecture` | Structural change | `design.md` expected; `/diagram-sync` suggested |
| `refactor` | Same behavior, different structure | A regression `[@test]` is mandatory (the green suite is the proof) |

**States** — where the change is:

`draft → accepted → applying → verified`, with exits `blocked`, `rejected`, `superseded`. `verified` is **earned, never declared**: it requires green test evidence. See [Lifecycle & approvals](lifecycle.md).

## The `.openspec.yaml` file (annotated)

```yaml
kind: feature                  # fix | feature | architecture | refactor
status: applying               # draft → accepted → applying → verified (or blocked/rejected/superseded)
targets:                       # files/directories this change owns (globs allowed); drives overlaps and zones
  - app/src/main/java/com/x/darkmode
tests:                         # test files/dirs; used for evidence staleness
  - app/src/test/java/com/x/DarkModeTest.kt
deps:                          # changes that must land first; overlap between them counts as sequenced
  - ui-kit
gitref: a1b2c3d                # branch tip when committed; --pre-archive verifies the merge with it
# merged_as: 9f8e7d6          # squash-merge alternative: the squash commit sha
waivers: []                    # see Waivers
open_decisions: []             # see Decision requests
conflicts: []                  # see Conflicts
# human_approved: true         # only for protected zones, after explicit human approval + ADR
# accepted_by: "Nicolas"       # recorded when the human accepts the change
# accepted_at: "2026-10-16"
# tech_brief: true             # persistence/state/concurrency/network/SDK/security/new dep → walkthrough + comprehension sign-off
# understood_by: "Nicolas"     # recorded after the /spec-verify teach-back
# understood_at: "2026-10-16"
```

> Custom metadata keys are accepted both bare (`kind`) and `x-`-prefixed (`x-kind`). OpenSpec ≥ 1.14 strict validation recommends the prefix for custom keys; the gate reads both forms.

## Evidence

Evidence is the local record that verification actually happened. `gate-check --run-tests` executes the project's `test_command` and stores a `green_tests` entry per change in `openspec/evidence.json` — local, git-ignored, **never committed**. Green is recorded only for changes with no gate errors.

- **Green only comes from a real run.** `--tests-command` runs in **substituted** mode and never produces green.
- **Freshness is a content fingerprint** of the change's `targets` and `tests`. Any later edit — even uncommitted — marks the evidence **stale**. Committing right after a green run does **not** stale it, because content, not time, is what is compared; timestamps are only the fallback. Line endings are normalized (CRLF/LF), so a checkout that rewrites files on Windows does not invalidate the evidence either.
- **Evidence is per-clone.** It is a local signal; the barrier that counts is CI running `--run-tests`.

Stale green is a warning in static mode and an error before archiving.

## Tech brief (comprehension)

Changes that touch persistence/state, concurrency, networking, platform SDKs, security or add a dependency declare `tech_brief: true`. At apply, the agent writes `walkthrough.md` with:

- the **mechanism**, step by step;
- **physical traceability** — where the data lives;
- **limits and failure modes**;
- **touched APIs**;
- the **implicit decisions** taken while implementing;
- 3 change-specific questions, answered as `TODO(human)`.

In `/spec-verify` you answer those 3 questions in your own words (free recall). The agent validates each answer against the real code, corrects misconceptions, and allows at most 2 rounds. The sign-off is your answers transcribed into the walkthrough, plus `understood_by` / `understood_at` in `.openspec.yaml`.

A missing or incomplete brief/sign-off is a warning, and an error before archiving. A valid `comprehension-debt` waiver excuses the missing sign-off; the walkthrough itself is still required. The gate verifies the ritual — the value is the teach-back conversation.

## Waivers

A waiver is a registered permission to deviate from a rule. The agent can only *request* one; **only the human grants** it.

| Field | Notes |
|---|---|
| `type` | `known-gap` · `deferred-test` · `pending-external-evidence` · `frontier-stub` · `comprehension-debt` |
| `state` | `requested` (pending — **blocks** `verified`) or `granted` |
| `owner` | Who granted it (required when `granted`) |
| `expires` | Mandatory date (required when `granted`); the expiry is its closure |
| `reason` | Required when `requested` |

A **valid granted** waiver does not block: it enables the deviation until its expiry. A `requested` or expired waiver blocks `verified` and `--pre-archive`.

## Decision requests

A question that exceeds the agent's authority, recorded as `open_decisions: [{question, target, proposal}]`. While it is pending, the change cannot reach `verified`. The answer is recorded in `DECISIONS.md` and the entry is removed.

## Conflicts ⚔

A conflict is a change that **contradicts something already decided or written**: an ADR in `DECISIONS.md`, a living requirement, or an in-force waiver. It is recorded as `conflicts: [{with, what, proposal}]`. Pending = no `verified`, no `--pre-archive`. Approval is an explicit human reversal, recorded as an ADR; then the entry is removed.

*Decision request vs. conflict:* a decision request asks for something **not yet decided**; a conflict points at something **already decided** that this change would overturn.

## Protected zones

High-risk or outward-facing areas, declared by the human in `openspec/config.yaml`:

```yaml
protected:
  - glob: "app/src/main/**/storage/**"
    reason: "persistence — user data"
```

Touching one requires `human_approved: true` **plus** an approval entry in `DECISIONS.md`: the change id and the approval word (`approved`/`aprobado`) in the same `##` section — normally the id in the heading and the approval below. A `rejected`/`not approved` line does not count. The flag alone is not enough; the gate cross-checks both. The check runs over the declared `targets` **and** over real changed files (working tree, staged, untracked).

## Capabilities

A capability is the `openspec/specs/<capability>/` folder — id `cap:<capability>`. The optional frontmatter `provides: [cap:x]` aliases it. Exactly one owner: duplicates are a gate error once the change advances (a draft only warns), and two active changes cannot create the same new capability.

Components in `ARCHITECTURE.dsl` carry the tag `cap:<capability>`. The gate checks the mapping in both directions: an untagged capability → run `/diagram-sync`; a tag with no capability → stale. The BOARD shows the registry in its **Capabilities** section.

## Requirement IDs and citations (optional)

Specs may carry stable IDs — `[REQ-<capability>-<n>]` — and code or tests may cite them with `@cita REQ-…`. When the project uses IDs, the gate validates duplicates (within a file or across living specs) and broken citations: a citation to a nonexistent ID is an error — the **hallucination detector**. Per-project opt-in: "missing citation" notices activate once the change already cites.

## Where everything lives

| Data | Source | Seen by |
|---|---|---|
| Status, targets, tests, deps, waivers, decisions, conflicts, approval, tech brief flags | the change's `.openspec.yaml` | machine (gates) |
| Protected zones | `openspec/config.yaml` → `protected:` | human |
| Capabilities (`cap:`) | spec folder (+ optional `provides:`) · `cap:` tags in `ARCHITECTURE.dsl` | machine + human |
| Walkthrough (tech brief) | `changes/<id>/walkthrough.md` + sign-off keys | human |
| Mechanism notes | `docs/mechanisms/` (from `/spec-explain`) | human |
| Evidence | `openspec/evidence.json` (generated) | machine |
| Board | `BOARD.md` (generated) | human |
| Machine index | `openspec/board.json` (generated) | machine |
| Resolved decisions | `DECISIONS.md` (append-only) | human |
