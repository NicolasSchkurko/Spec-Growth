# Concepts

The vocabulary of Spec Growth. Every term has **exactly one owner** in the repository; this page explains what each one is and where it lives.

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

`draft → accepted → applying → verified`, with exits `blocked`, `rejected`, `superseded`. `verified` is **earned**, never declared: it requires green test evidence. See [Lifecycle & approvals](lifecycle.md).

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

`verified` is not a claim; it is a record. `gate-check --run-tests` executes the project's `test_command` and stores a `green_tests` entry per change in `openspec/evidence.json` — local, git-ignored, **never committed**. Green is recorded only for changes with no gate errors.

- Green only comes from a real run. `--tests-command` runs in **substituted** mode and never produces green.
- Evidence goes **stale** when the content of the change's `targets` or `tests` changes after the recorded run — even an uncommitted edit. Committing right after a green run does **not** stale it: freshness is a **content fingerprint** (timestamps are only the fallback) and line endings are normalized (CRLF/LF). Stale green is a warning in static mode and an error before archiving.
- Evidence is per-clone: it is a local signal; the barrier that counts is CI running `--run-tests`.

## Tech brief (comprehension)

Changes that touch persistence/state, concurrency, networking, platform SDKs, security or a new dependency declare `tech_brief: true`. At apply, the agent writes `walkthrough.md` — mechanism step by step, physical traceability (where the data lives), limits and failure modes, touched APIs, implicit decisions — plus 3 change-specific questions. In `/spec-verify` you answer them in your own words (free recall; the agent validates against the code and corrects misconceptions, max 2 rounds). The sign-off is your answers transcribed + `understood_by`/`understood_at`.

Missing or incomplete brief/sign-off: warning; error before archiving. A valid `comprehension-debt` waiver excuses the missing sign-off (the walkthrough itself is still required). The gate verifies the ritual — the value is the teach-back conversation.

## Waivers

A registered permission to deviate from a rule. The agent can only *request*; **only the human grants**.

| Field | Notes |
|---|---|
| `type` | `known-gap` · `deferred-test` · `pending-external-evidence` · `frontier-stub` · `comprehension-debt` |
| `state` | `requested` (pending — blocks `verified`) or `granted` |
| `owner` | Who granted it (required when `granted`) |
| `expires` | Mandatory date (required when `granted`); the expiry is its closure |
| `reason` | Required when `requested` |

A **valid granted** waiver does not block. A `requested` or expired one blocks `verified` and `--pre-archive`.

## Decision requests

A question that exceeds the agent's authority, recorded in `open_decisions: [{question, target, proposal}]`. While it is pending, the change cannot reach `verified`. The answer is recorded in `DECISIONS.md` and the entry is removed.

## Conflicts ⚔

A change that **contradicts something already decided or written**: an ADR in `DECISIONS.md`, a living requirement, an in-force waiver. Recorded as `conflicts: [{with, what, proposal}]`. Pending = no `verified`, no `--pre-archive`. Approval is an explicit human reversal, recorded as an ADR; then the entry is removed.

*Decision request vs. conflict:* a decision request asks for something **not yet decided**; a conflict points at something **already decided** that this change would overturn.

## Protected zones

High-risk or outward-facing areas, declared by the human in `openspec/config.yaml`:

```yaml
protected:
  - glob: "app/src/main/**/storage/**"
    reason: "persistence — user data"
```

Touching one requires `human_approved: true` **plus** an approval entry in `DECISIONS.md`: the change id and the approval word (`approved`/`aprobado`) in the same `##` section — the id is normally in the heading with the approval below; a `rejected`/`not approved` line does not count (the flag alone is not enough — the gate cross-checks both). The check runs over the declared `targets` **and** over real changed files (working tree, staged, untracked).

## Capabilities

A capability is the `openspec/specs/<capability>/` folder — id `cap:<capability>`; the optional frontmatter `provides: [cap:x]` aliases it. Exactly one owner: duplicates are a gate error once the change advances (a draft only warns), and two active changes cannot create the same new capability. Components in `ARCHITECTURE.dsl` carry the tag `cap:<capability>`; the gate checks the mapping in both directions (an untagged capability → run `/diagram-sync`; a tag with no capability → stale). The BOARD shows the registry in its **Capabilities** section.

## Requirement IDs and citations (optional)

Specs may carry stable IDs — `[REQ-<capability>-<n>]` — and code/tests may cite them with `@cita REQ-…`. When the project uses IDs, the gate validates duplicates and broken citations (a citation to a nonexistent requirement is an error — the hallucination detector).

## Where everything lives

| Data | Source | Seen by |
|---|---|---|
| Status, targets, tests, deps, waivers, decisions, conflicts, approval, tech brief flags | the change's `.openspec.yaml` | machine (gates) |
| Protected zones | `openspec/config.yaml` → `protected:` | human |
| Capabilities | spec folder (+ optional `provides:`) · `cap:` tags in `ARCHITECTURE.dsl` | machine + human |
| Walkthrough (tech brief) | `changes/<id>/walkthrough.md` + sign-off keys | human |
| Mechanism notes | `docs/mechanisms/` (from `/spec-explain`) | human |
| Evidence | `openspec/evidence.json` (generated) | machine |
| Board | `BOARD.md` (generated) | human |
| Machine index | `openspec/board.json` (generated) | machine |
| Resolved decisions | `DECISIONS.md` (append-only) | human |
