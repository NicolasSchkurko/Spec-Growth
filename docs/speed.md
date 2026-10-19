# Speed: what each command dispatches

The system's cost was never the checks — it was **serial waiting inside the session**: the test suite blocking while nothing else happened, the semantic pass crawling change by change, the recon reading specs while you sat waiting to be asked a question, three comprehension questions sent as three messages, every pending approval presented one at a time.

All nine commands were reviewed. `/spec-apply` and `/spec-verify` were the worst; `/spec-add`, `/spec-triage`, `/spec-explain`, `/spec-resolve` and `/spec-deps-graph` each had their own serial wait. The answer is the same everywhere and it is **not** to skip checks: run the independent work in **parallel child sessions**, and ask the human everything you need **in one round**.

There is also a runtime layer that costs nothing to change: OpenCode's `warming`, `compaction` and `snapshots` settings (below).

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
| `spec-gate` | subagent | `opencode/glm-5.3-flash-free` | `BOARD.md`/`board.json` (via the script) |
| `spec-auditor` | subagent, read-only | `opencode/glm-5.3-flash-free` | nothing |
| `spec-walkthrough` | subagent, confined | `opencode/glm-5.3-flash-free` | `openspec/changes/**` only |
| `spec-recon` | subagent, read-only | `opencode/glm-5.3-flash-free` | nothing |
| `spec-explainer` | subagent, confined | `opencode/glm-5.3-flash-free` | `docs/mechanisms/**` only |
| `spec-deps-graph` | subagent, read-only | `opencode/glm-5.3-flash-free` | nothing |
| `diagram-sync` | subagent, read-only | `opencode/glm-5.3-flash-free` | nothing |

Every mechanical child shares one free model — `opencode/glm-5.3-flash-free` — so there is no paid/free mix to confuse when you read a log or move a pin. The pin lives in one line per agent (`.opencode/agents/<id>.md` → `model:`), so switching is a one-line edit plus a probe (below).

**A model in the list is not necessarily runnable.** `opencode models` shows what exists; it does not prove the endpoint answers. Probe before pinning — this repo found `Model unavailable` (a `-free` id that the console lists but the install does not route) and `Insufficient account funds` (a model on the pay-as-you-go provider with no balance) only after pointing agents at them.

```powershell
opencode run "Reply with exactly: OK" --model <provider>/<model> --auto --standalone
```

### What each command dispatches

| Command | In the session | Dispatched (in one batch) |
|---|---|---|
| `/spec-add` | the single round of questions + the draft | `spec-recon` (reuse, zones, overlaps, prior decisions) |
| `/spec-triage` | the one question ("who is right?") + the decision | `spec-explainer` (code side) **and** `spec-recon` (spec side) |
| `/spec-apply` | the brief, the approvals, the join | `spec-implementer`, then `spec-gate` + `spec-walkthrough` |
| `/spec-verify` | the teach-back, the vetted report | `spec-gate` + one `spec-auditor` per change |
| `/spec-explain` | the delivery (verified, in its own words) | `spec-explainer` (one per independent behavior, cap 3) |
| `/spec-resolve` | the single ask + the records | — (one `question` round replaces N turns) |
| `/spec-gate` · `/spec-deps-graph` · `/diagram-sync` | — | the command *is* the child (`agent: <id>` + `subagent: true`) |

`/spec-gate`, `/spec-deps-graph` and `/diagram-sync` are thin commands — one definition per worker lives in `.opencode/agents/`, used both by a human typing the command and by a parent dispatching work.

### The rules that make batching safe

Two of these could go wrong quietly, so they are stated in the commands themselves:

- **Batching what you ask is allowed; assuming the answer is not.** `/spec-add` sends the clarifications *and* the "if it is as I understood, say so" in one message; `/spec-resolve` puts every pending into one `question` call. In both, each answer must be explicit and attributable to its item, and an unanswered item stays pending.
- **A child's output is a claim.** The parent checks the implementer's diff against the brief, the walkthrough's `file:line`s against the code, and the auditor's findings before relaying them. Nothing human-only (approval, waiver, sign-off, decision) is ever a child's to make.

## What is NOT relaxed

- **No self-approval.** Protected zones, waivers, decisions, conflicts and comprehension sign-offs remain human-only; no child can record one.
- **No assumed consent.** Batching the ask is a speed decision; an unanswered item stays pending and silence never approves.
- **The gate.** `verified` still needs green `--run-tests` evidence; the fingerprint still stales it.
- **Evidence freshness.** Skipping a redundant suite run happens only when the fingerprint proves the recorded green run still covers the code.
- **One implementation worker per change.** The parent or the `spec-implementer` child, never both and never two children: parallel writers on one branch lose work. Only the independent read-only work is parallel.

## What the research says (and what it warns about)

The design is not invented here; it follows the published practice for orchestrator-worker systems, with the caveats attached:

- **Orchestrator-worker, workers that do not coordinate.** Anthropic's multi-agent research system ("How we built our multi-agent research system", Jun 2025) uses a lead agent that decomposes and spawns parallel subagents which report back. Our parents stay in the session and dispatch; children never talk to each other.
- **Delegation needs a brief, not a hint.** The same post: each subagent needs "an objective, an output format, guidance on the tools and sources to use, and clear task boundaries" — without them agents "duplicate work, leave gaps". That is why every agent here declares a fixed output shape and why the implementer gets the allowed files and the goal per requirement explicitly.
- **Parallel calls are the speed lever.** They report cutting research time "by up to 90%" by launching subagents in parallel and using several tools in parallel inside each one. It is why the commands launch in one batch and the agents are told to read in parallel instead of one file per step.
- **Multi-agent is expensive, and worse at coding.** Agents use ~4× the tokens of chat and multi-agent systems ~15×, so it "requires tasks where the value is high enough to pay"; and "most coding tasks involve fewer truly parallelizable tasks than research". Hence: fan out the **read-only** work (survey, audit, trace, suite) and keep **one** implementation writer.
- **A fresh child pays to re-learn what you already know** (Claude Code subagent guidance: *"a subagent starts fresh and spends time gathering context that your main thread already has"*). That is why the implementer's brief must be self-contained and why `kind: architecture`, protected zones and anything needing a mid-way question stay in the session, and why a tiny explain topic is traced in-session.
- **Artifacts beat the telephone.** Anthropic's appendix recommends having subagents persist structured output and hand back "lightweight references"; that is exactly `spec-walkthrough` (writes `walkthrough.md`, returns what it wrote) and `spec-explainer` (writes the mechanism note, returns a digest).
- **Do not let one slow child block the report.** Their list of lessons includes synchronous fan-out as a bottleneck; here a child that fails or times out is re-run or done in-session, and the report says so.
- **Evaluate the end state, with small samples first.** They start evals at ~20 cases and use an LLM judge for free-form output — the frozen conformance suite is the same idea, and it is where any of this must prove itself.

## Which model runs a child (and how to change it)

The pin is a decision, and the honest state of the art is that nobody can eyeball it from a log: "the hard part with these routers is deciding the cheap model is *good enough* without already knowing the answer" ([HN, Rayline](https://news.ycombinator.com/item?id=48448372)). Two forum data points keep it honest:

- **The vendors backtracked on the cheap read-only agent.** Anthropic's built-in Explore subagent "no longer runs on Haiku — it uses your main model". That is exactly the job of `spec-recon` and `spec-explainer`, so "search agents run cheap" is a habit, not a law.
- **Routing across models can cost more than it saves.** Changing the model between parent and child "can invalidate caches that make the model cheaper" (r/LLMDevs) — which interacts with `warming` above: the session model's cache is warmed, a child on another model starts cold.

So the pin is one model, stated in one place per agent, and easy to move: `.opencode/agents/<id>.md` → `model:`. To compare candidates, probe them — a model in the list is not necessarily runnable:

```powershell
opencode models
opencode run "Reply with exactly: OK" --model <provider>/<model> --auto --standalone
```

What is *not* up for grabs is the split: **risky work escalates** — `kind: architecture` and tech-brief changes are audited in-session or on a stronger model, and `spec-implementer` never gets a cheap pin (it declares no `model:` and runs on the session model). And whatever a cheap child returns, the parent vets it before it reaches you: a detector that invents a `file:line` costs more than one that stays silent.

## Runtime settings (OpenCode V2)

These are configuration, not skill logic, and they change the wall clock without touching a single check:

- **`warming` — the one worth turning on.** OpenCode can send a periodic keep-alive request so the **provider-side prompt cache stays warm** while you pause between prompts: `{"warming": true}` (defaults: after 4 minutes idle, for up to 30 minutes; ~7 extra requests per window). A Spec Growth session re-sends a large fixed context (the skill, `AGENTS.md`, the specs) on every command, so a cold cache is exactly what makes the next command feel slow. It is **off by default** and it is **not free** — the requests are real and billable, so enable it when your providers cache prompts and your pauses are long.
- **`compaction` (auto, lossy).** It summarizes older conversation with the session's model. Since v1.5 the implementation runs in a fresh child, so the parent stays short and compacts less — a quality benefit as much as a speed one. If a session *does* get long, raise `compaction.keep.tokens` when recent details matter.
- **`snapshots` (on by default).** OpenCode captures files before and after each model step to power `/undo`; it can include the full contents of tracked files. On a large repo that is real I/O per step. Measure it on your repo before changing it: `{"snapshots": false}` speeds up steps and **stops `/undo` from restoring files** (conversation rollback still works).

INIT should offer `warming` explicitly (opt-in, with the cost note) rather than enabling it silently.

## How to measure it

Same bar as everywhere in this repo: **equal or better, or it is a regression.**

**Cheap, do it first.** Time one change end to end and count the human turns. Before: `/spec-add` asked questions, then asked for approval; `/spec-apply` ran the suite and then wrote the tech brief; `/spec-verify` asked three questions one at a time. After: one round in `/spec-add`, the suite and the brief overlapping, the three questions together. Also watch the parent's context: it should grow far less now that the implementation, the trace and the audit read files in someone else's window.

**Real, before merging.** Re-run the frozen suite (`quality/conformance/`). What it guards must not move: `t1-add` and `t2-quickfix` still stop at `draft` and still ask before coding; `t3-apply` still updates `gitref` and only reaches `verified` with green evidence; `t4-archive` still refuses to archive on a missing sign-off; `t5-explain` still cites real `file:line` (now through a child — a good test of the vetted delivery). Tasks worth adding: one that asserts the **parent did not trust a child** (a walkthrough with a wrong `file:line` must be caught), and one that asserts `/spec-resolve` **batches without assuming** an answer.

**Known cost.** Children are extra model calls: the wall clock improves, the token bill may not (~15× is the published order of magnitude for multi-agent systems). Keep fan-out capped, keep the mechanical children on the cheap model, and prefer `--scope <id>` over a full re-run when the evidence is fresh.

## Status

Prototype (branch `experiment/fast-path`). Six commands dispatch, eight agents exist, and the runtime settings are documented; the gate, the scripts and the frozen suite are untouched. Not yet measured against the suite.
