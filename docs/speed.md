# Speed: apply and verify

`/spec-add`, the approvals and the archive are fine — this page is about the two commands that were slow: **`/spec-apply`** and **`/spec-verify`**. Both were doing long, independent work **serially inside the session**, and paying context for it. The answer is not to skip checks: it is to run the independent work in **parallel child sessions**.

## Where the time went

**`/spec-apply`**, after the code was written, did this in one thread:

| Work | Depends on | Waits for |
|---|---|---|
| `gate-check --run-tests` (the whole suite) | the finished code | — |
| `walkthrough.md` (read the diff, read the files, explain the mechanism) | the finished code | — |
| the report | both | both |

The suite and the walkthrough have **nothing to do with each other**, and the agent sat idle through both. The walkthrough is also the one step that drags a lot of files into the session's context — exactly the context the rest of the apply needs.

**`/spec-verify`** was worse: the semantic pass (read every delta spec, read the code of every target, look for four classes of drift) ran **change by change, in the session, in series**, on top of the gate, and only then came the teach-back.

## The design

Both commands now **dispatch and join**. They stay in the session — they own the code, the judgment and the human's answers — and the long, independent, read-only work goes to child sessions that return a compact result and never pollute the parent's context.

Two things make this safe and honest:

- **Children are scoped, not trusted.** The auditor is **read-only by permission** (`edit`, `shell` and `subagent` denied): "the machine detects, the human decides". The implementer may write code, but never `openspec/**`, `.git/**` or `.env*` — and only inside the files the brief names. The walkthrough drafter writes **only inside `openspec/changes/`**, with `edit` and never `write`, and only the `status`/`tech_brief` keys plus its own file.
- **The parent is accountable.** The implementer's diff is checked against the brief before anything else; the walkthrough is verified claim by claim (`file:line`) before the parent reports it; the findings the auditor returns are vetted before being relayed. A child that invents evidence, widens the blast radius or forgets a test is a finding about the child.

### `/spec-apply`

1. **Orient**, then hand the implementation to **`spec-implementer`** (foreground) with a precise brief: the goal per requirement, the **allowed files** (`targets` + `tests`), and the constraints. The child is a *fresh context by construction* — which is exactly what the skill already asked for ("clean context when implementing"), now enforced instead of requested. Risky changes (`kind: architecture`, protected zones, anything that would need a question mid-way) are implemented **in the session**: a child has nobody to ask.
2. **One implementation worker per change** — parent or child, never both. The parent then checks the diff against the brief (`git diff --stat`: nothing outside `targets`/`tests`).
3. As soon as the code and tests are verified, launch **in one batch**: the gate (`spec-gate`, background) and, if it is a tech brief, the drafter (`spec-walkthrough`, background) — it sets `tech_brief: true`/`status: applying` and writes `walkthrough.md`.
4. Board regeneration while they run.
5. **Join**: read the implementer's report against the diff (scope creep, a missing test, an unlabelled shortcut → send it back or finish it), then the gate verbatim (fix red → repeat), then verify the walkthrough against the real code.

The trade is explicit: the parent stops writing code and becomes the **orchestrator and the verifier**. It keeps the approvals, the brief and the final judgment, and its context never holds the implementation's file reads or test output.

### `/spec-verify`

1. Launch **in one batch**: the gate (background) and **one `spec-auditor` child per active change** (background, cap 6; beyond that, group by capability). A large or risky change is audited in-session, or by editing the agent's `model:`.
2. **While they run**, do the human part: the comprehension teach-back, with the 3 questions asked **together in one message** (still free recall, still validated against the real code — it was three sequential messages before).
3. **Join and vet**: check each finding's `file:line`, drop what does not hold, then persist `findings.md`, propose waivers/decisions/conflicts, regenerate the board.

### What runs where

| Agent | Mode | Model | Writes |
|---|---|---|---|
| `spec-implementer` | subagent | **the parent session's model** (no `model:` declared — the core work runs on the same model you chose) | code + tests, only inside the brief's files; `openspec/**` denied |
| `spec-gate` | subagent | `opencode-go/space-bunny` | `BOARD.md`/`board.json` (via the script) |
| `spec-auditor` | subagent, read-only | `opencode-go/space-bunny` | nothing |
| `spec-walkthrough` | subagent, confined | `opencode-go/space-bunny` | `openspec/changes/**` only |
| `diagram-sync` | subagent, read-only | `opencode-go/space-bunny` | nothing |

`/spec-gate` and `/diagram-sync` are now thin commands (`agent: <id>`, `subagent: true`) — one definition, in `.opencode/agents/`, used both by a human typing the command and by a parent dispatching work.

## What is NOT relaxed

- **No self-approval.** Protected zones, waivers, decisions, conflicts and comprehension sign-offs remain human-only; no child can record one.
- **The gate.** `verified` still needs green `--run-tests` evidence; the fingerprint still stales it.
- **Evidence freshness.** Skipping a redundant suite run happens only when the fingerprint proves the recorded green run still covers the code.
- **One implementation worker per change.** The parent or the `spec-implementer` child, never both and never two children: parallel writers on one branch lose work. Only the independent read-only work is parallel.

## How to measure it

Same bar as everywhere in this repo: **equal or better, or it is a regression.**

**Cheap, do it first.** For one change with a tech brief, time the apply with the gate and the walkthrough in series versus dispatched. The wall clock should drop by roughly the smaller of the two (they overlap), and — the part that matters for quality — the parent's context should grow much less, because the suite output and the walkthrough's file reads no longer land in it. For verify, do the same with 2–3 active changes: serial audit versus fan-out.

**Real, before merging.** Re-run the frozen suite (`quality/conformance/`). The defaults are what it guards, and the dispatch must not change them: `t1-add` and `t2-quickfix` must still stop at `draft` and still ask before coding; `t3-apply` must still update `gitref` and only reach `verified` with green evidence; `t4-archive` must still refuse to archive on a missing sign-off. A task worth adding is an apply/verify one that asserts the **parent did not trust a child**: a walkthrough with a wrong `file:line` must be caught, not reported.

**Known cost.** Children are extra model calls: the wall clock improves, the token bill may not. The audit runs in a fresh context that reads the delta spec and the target code again — that is the price of keeping those reads out of the parent. Keep fan-out capped, and prefer `--scope <id>` over a full re-run when the evidence is fresh.

## Status

Prototype (branch `experiment/fast-path`). The two commands, the five agents and the INIT wiring are new; the gate, the scripts and the frozen suite are untouched. Not yet measured against the suite.
