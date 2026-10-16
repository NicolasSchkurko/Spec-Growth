# Restructure phase — plan

Goal: cut the token footprint of every Spec Growth session without lowering conformance.
Two levers, both validated against the frozen suite + `tokens.mjs`.

## 1. Subagent routing (per-command, V2)

V2 commands support `agent`, `model` and `subagent: true` (background child session).
Model resolution: command `model` > agent model > session model. The parent keeps its
context; the child returns only its result. (Verified in `opencode.ai/v2/docs/commands`.)

| Command | Route | Why |
|---|---|---|
| `/spec-gate` | **child** (`subagent: true`, cheap model) | Deterministic script + short report; no reason to spend parent context |
| `/diagram-sync` | **child** (mid-cheap model) | Structurizr MCP output is noisy; isolate it from the operator session |
| `/spec-resolve` | **parent** (interactive) | Human decisions belong in the operator session; optionally a child "collector" pre-gathers BOARD items |
| `/spec-verify` | parent for teach-back; the semantic scan MAY run as a child | Teach-back is the comprehension moment — best model + continuity |
| `/spec-explain` | parent | Pedagogic output the human reads in-session; quality matters |
| `/spec-add` · `/spec-triage` · `/spec-apply` | parent | Interactive + core work |

Candidate cheap models on this machine: `opencode-go/space-bunny`, `opencode/big-pickle`,
`opencode-go/qwen3.8-flash`, `opencode-go/beam-free`, `opencode-go/longcat-2.5-preview-free`,
`opencode/gpt-5.4-nano`. Pick per task after a conformance check.

Rationale (2026-10-16 incident): the operator session accumulated ~104M tokens and hit the
provider's input limit mid-work — subagent isolation is the structural answer, not just cost.

## 2. Skill packaging (progressive disclosure)

- `SKILL.md` becomes a router (workflow + invariants) with one-level `references/`
  (templates, schemas, gate matrix). Target: ≲2k tokens on activation.
- Commands stay thin; procedures live in the skill; scripts keep the invariants.
- The literal `spec-*` triggers stay in the description — t5 regression lesson: triggers
  are load-bearing, and the conformance suite verifies them.

## Validation

- Same frozen suite + `tokens.mjs` per task; bar = equal or better on every rule.
- New anchor task candidate: `t6-gate` (concise gate report; parent context untouched).
- Judge stays cross-family (`opencode-go/gpt-6-luna`).
