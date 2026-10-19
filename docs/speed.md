# Speed: the fast path

Spec Growth is slower than vibecoding on purpose — the ceremony buys recorded evidence and a gate that no agent can forget. But most of the slowdown was **round-trips**, not checks: the same change paid for the same ceremony twice, and every human decision was its own turn.

This page is the diagnosis and the answer: `/spec-quick`, the guardrail that decides when it applies, and how to measure whether it actually helped.

## Where the time went

For a small change (one file, one test) the old flow was:

| # | Step | Round-trip with the human | Suite run |
|---|---|---|---|
| 1 | `/spec-add` → ends `draft` | ✋ approve | — |
| 2 | `/spec-apply` → preconditions, implement, gate | ✋ protected zone (if any) | ✅ `--run-tests` |
| 3 | `/spec-verify` → gate + teach-back | ✋✋✋ 3 questions, **one at a time** | ✅ `--run-tests` (again) |
| 4 | push / merge | ✋ | — |
| 5 | `gate-check --pre-archive` → `openspec archive` | ✋ | — |

Seven-ish human turns to land a one-line change, plus the whole test suite twice. Three causes:

1. **Ceremony duplicated as turns.** `/spec-add` builds the change and stops for approval; `/spec-apply` is a second command that re-reads the state and asks again. The human's one decision costs two turns of setup.
2. **The teach-back was serialized.** Three comprehension questions, one message each, for tech briefs.
3. **The suite ran twice.** `/spec-apply` records green, then `/spec-verify` runs `--run-tests` again even when the fingerprint proves nothing changed.

None of that was a *check*. The gate, the `[@test]` rules, the citations and the human-only records were never the slow part.

## The fast path

**`/spec-quick`** runs the same system in fewer turns:

1. **Route first.** `node scripts/gates/risk-router.mjs` decides `FAST` or `FULL` from `kind`, `targets` and the protected zones. `FULL` → hand off to `/spec-add`, unchanged.
2. **One interaction.** Clarifying questions, alternatives and the approval request go out **in a single message**, with the approval phrased to cover create + accept + apply.
3. **One turn.** On the explicit yes: create the change, record the acceptance, branch, implement, test, `gate-check --run-tests`, board — in the same turn.
4. **Teach-back in one message.** If a tech brief appears, the 3 questions go together (still free recall, still validated against the code, still the human's words).

For a small change that is **1 human turn instead of ~7**.

## The guardrail: `risk-router.mjs`

The fast path is a *low-risk* path, not a shortcut around the gate. The router is mechanical and read-only; `FULL` on any of:

- `kind: architecture`
- a target crossing `protected:` in `openspec/config.yaml`
- `--tech` — persistence/state, concurrency, networking, platform SDKs, security
- `--dep` — a new dependency
- `--new-cap` — creates a capability
- `--conflict` / `--decision` — contradicts a decision, or needs one
- more than `SPEC_GROWTH_QUICK_MAX_ROOTS` distinct roots (default 5)

```bash
node scripts/gates/risk-router.mjs --kind fix --targets "src/notes.js"     # exit 0  → FAST
node scripts/gates/risk-router.mjs --kind feature --targets "src/sync.js" --tech  # exit 10 → FULL
```

Exit `0` = FAST, `10` = FULL, `1` = usage error. `--json` for machines; `--id <change>` re-routes an existing change (reading `kind`, `targets`, `tech_brief`, `conflicts`, `open_decisions`).

## What is NOT relaxed

Nothing that the machine or the human owns:

- **No self-approval.** No explicit sentence from the human → no change folder, no code. The router never creates anything.
- **The gate.** `--run-tests` green evidence is still required for `verified`; the fingerprint still stales it.
- **Protected zones, waivers, decisions, conflicts, sign-offs.** Human-only, exactly as in the full flow — the router routes them away from the fast path.
- **`--pre-archive`.** Archiving still needs the merge verified and every blocker closed.

## Reusing fresh evidence (no second suite run)

`/spec-verify` on a change whose green evidence is **fresh** (the fingerprint of `targets` + `tests` matches the recorded run) may run the gate **static** (`--scope <id>`) instead of `--run-tests`, and say so. The machine keeps the honesty: if anything changed, the gate itself reports `STALE evidence`, so the shortcut cannot lie. Re-run the suite when the fingerprint moved, before archiving, or in CI.

## How to measure it (protocol)

The bar is the same as everywhere in this repo: **equal or better, or it is a regression.**

**Cheap, do it first — turn count.** Take 3 real small changes and count human turns and suite runs. Old flow ≥ 5 turns / 2 suite runs; fast path should be 1–2 turns / 1 suite run.

**Real, before merging — conformance.** The frozen suite (`quality/conformance/`) guards the *defaults*: `t1-add` and `t2-quickfix` assert that a plain request still stops at `draft` and still asks before coding. `/spec-quick` is opt-in, so those must stay green. A new anchor task (`t6-quick`) should cover the fast path itself: given "arreglá esto, es una línea" with explicit "dale, aplicalo", the agent routes, approves once, implements, and reaches a gate with evidence — without self-approving anything. Add it to `tasks.mjs` and re-run the suite (the template needs `.opencode/commands/spec-quick.md` for the fixture).

**Wall clock.** `durationMs` per run is already recorded in each `result.json`; compare medians for the fast path vs the full flow on the same prompt.

## Status

Prototype (branch `experiment/fast-path`). `/spec-quick` and `risk-router.mjs` are new and additive; the existing commands, the gate and the frozen suite are untouched.
