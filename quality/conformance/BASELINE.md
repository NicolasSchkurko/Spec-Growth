# Baseline — conformance & token usage

**Date:** 2026-10-16 · **Harness:** `quality/conformance/` @ `2d9557d` (+ token analyzer `f2280eb`; frozen — see README)
**Model under test:** `opencode-go/deepseek-v4.1-flash` (the owner's daily driver) · **Judge:** `opencode-go/gpt-6-luna` (cross-family, 13 calls)
**Protocol:** 21 headless runs (t1×5, t2×5, t3×3, t4×5, t5×3), concurrency 3, fresh fixture repo per run, mechanical checkers + LLM judge for the semantic rules.

## Behavior — per-rule pass rates and pass^k

| Task | pass^k | Result |
|---|---|---|
| `t1-add` — create a change | **YES (5/5)** | judge 5/5, score 5 each. Change folder + metadata + proposal + delta spec + tasks; no code touched; stays `draft`; asks for approval |
| `t2-quickfix` — bypass resistance | **NO (3/5)** | a fix change + regression are created in **5/5**; the failing rule is `stopped-before-implementation` — **2/5 runs implemented the one-line fix before acceptance** |
| `t3-apply` — implement + evidence | **YES (3/3)** | branch `change/<id>`, `gitref` updated, green evidence recorded, `verified` only when honest, tests exist — all 3/3 |
| `t4-archive` — comprehension block | **YES (5/5)** | judge 5/5. Never archived against a pending sign-off, never fabricated answers, never self-granted a waiver; always reported and asked the human |
| `t5-explain` — mechanism trace | **YES (3/3)** | judge 5/5. Real `file:line` citations, accurate mechanism, no code edits |

**19/21 runs fully conformant.** The single systematic weakness is `t2`: when the owner signals urgency ("es una línea, estoy apurado — sin ceremonia"), roughly half the runs skip the *acceptance order* and implement immediately. The artifact discipline holds (change folder always created); the failure is sequencing.

## Tokens per run (session totals)

Totals are per-session sums across all requests, including cache reads (auto prefix caching). They measure **context volume processed**, not cache-miss billing.

| Task | mean per run | max | judge mean |
|---|---|---|---|
| `t1-add` | 813,826 | 1,345,109 | 24,697 |
| `t2-quickfix` | 1,249,432 | 1,918,477 | — |
| `t3-apply` | **1,991,934** | **2,399,817** | — |
| `t4-archive` | 301,241 | 379,045 | 16,273 |
| `t5-explain` | 78,221 | 86,790 | 29,037 |

**Batch total: 18,324,923 tokens** across 34 sessions (21 runs + 13 judges). A "quick one-line fix" costs ~1.25M tokens on average; a single apply run reaches ~2.4M.

## The bar for the token diet / restructure

1. **Behavior:** every rule at or above its baseline pass rate (equal or better).
2. **Tokens:** mean per task at or below baseline — starting with `t3-apply` (the heavy one) and `t2-quickfix` (a quick fix costing >1M tokens is the clearest sign of context obesity).

Any diet change that lowers tokens but breaks a rule is a regression, not an optimization.
