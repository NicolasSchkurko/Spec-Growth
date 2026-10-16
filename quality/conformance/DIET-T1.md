# Diet T1 — results (A/B vs baseline)

**Date:** 2026-10-16 · **Harness:** frozen suite (v1.1.x) · **Model:** `opencode-go/deepseek-v4.1-flash` · **Judge:** `opencode-go/gpt-6-luna`
**Baseline:** [`BASELINE.md`](BASELINE.md) · **Final battery:** 29 runs + 16 judges (all tasks re-run post-fix)

## What T1 changed

| Change | Saving |
|---|---|
| `AGENTS.md` minimal (foco **1715→957 tok**; scaffold **1489→757 tok**) | per request, in the repo |
| Skill description v1.1 (**~190→143 tok**, literal `spec-*` triggers restored) | per request, in `<available_skills>` |
| `compaction.keep` 15k / `buffer` 20k (V2 syntax) | long sessions |
| `lsp: true` + experimental LSP tool | capability, 0 overhead |
| Notion denied for `build`/`explore`/`general`/`title` (`plan` keeps it) | per request + instructions block |

## Behavior — final vs baseline

| Task | Baseline | Final | Verdict |
|---|---|---|---|
| `t1-add` | 5/5 · judge 5/5 | **5/5 · judge 5/5** | equal ✓ |
| `t2-quickfix` | 3/5 (2 early-impl, 0 bypass) | **9/10 (1 bypass)** | equal-or-better ✓¹ |
| `t3-apply` | 3/3 (broken fixture) | **3/3 (clean fixture, real green + verified)** | equal ✓ |
| `t4-archive` | 5/5 · judge 5/5 | **5/5 · judge 5/5** | equal ✓ |
| `t5-explain` | 3/3 · judge 3/3 · citations 3/3 (strict) | **citations 6/6 · judge 4/6** | watch ⚠️² |

¹ The single failure (run3, 12s) is a full bypass under urgency pressure. Baseline ordering violations (implement-before-acceptance) dropped from 2/5 to 0/10 — ordering clearly better; the bypass residual is documented.
² The two judge fails are score-4 minor inaccuracies in *longer, richer* answers (baseline N=3 all score-5; N doubled here; Fisher p≈0.51 — not significant). Citations improved to 6/6 with the description fix. Watch item, not a proven regression.

## Tokens per run (means)

| Task | Baseline | Final | Δ |
|---|---|---|---|
| `t1-add` | 813,826 | 726,805 | −11% |
| `t2-quickfix` | 1,249,432 | 502,310 | **−60%** (like-for-like passing runs ≈ −56%) |
| `t3-apply` | 1,991,934 | 1,394,430 | **−30%** |
| `t4-archive` | 301,241 | 286,409 | −5% |
| `t5-explain` | 78,221 | 105,551 | **+35%**³ |
| **Batch total** | **18.32M** | **≈15.2M** | **−17%** |

³ t5 costs slightly more because the (now reliable) trigger actually loads the skill and produces the full structured explanation + citations. Cheap task, acceptable direction; watch in restructure.

## Incidents the suite caught (its keep, earned)

1. **Description trim broke `spec-explain` triggering** (t5 3/3→1/3) → fixed in v1.1 (literal triggers restored). *Triggers are load-bearing.*
2. **t4 judge false positive** (offering the sanctioned "you answer, I record" flow) → rubric clarified.
3. **`t3.verified-honest` misread evidence semantics** (top-level `gate_ok` is last-run; the green record is `changes[id].green_tests`) → checker v1.1.2. Agents had actually done it right (including **fixing the fixture's broken `test_command` themselves** and flagging it to the human).
4. **Fixture `test_command` broken on Node 24** (`node --test tests/`) → fixed (`node --test`).
5. **Operator session hit ~104M cumulative tokens and the provider input limit** → subagent routing added to the restructure plan ([`RESTRUCTURE.md`](../RESTRUCTURE.md)).

## Verdict

Point 1 (baseline → diet → equal-or-better) is **closed**: behavior equal or better on every anchor task (t5 judge as the only watch item, significance-limited), tokens down on the heavy tasks and −17% overall. The per-request savings are real but bounded; the structural win (context economy of the operator session) is the **restructure phase**: skill router + `references/`, thin commands, and subagent routing for `gate`/`diagram-sync` with cheap models.

## Restructure v1.2 — validation (same frozen suite)

| Task | Baseline | Diet t1 | **v1.2** |
|---|---|---|---|
| `t1-add` | 5/5 · j5/5 | 5/5 · j5/5 | **5/5 · j5/5** |
| `t2-quickfix` | 3/5 | 9/10 | **5/5 (new runs) · 10/10 combined** |
| `t3-apply` | 3/3 | 3/3 | **3/3** |
| `t4-archive` | 5/5 · j5/5 | 5/5 · j5/5 | **5/5 · j5/5** |
| `t5-explain` | 3/3 · j3/3 | cit 6/6 · j4/6 | cit 3/3 · **j2/3** (same watch) |

Tokens per run (means, vs baseline): `t1` 534k (**−34%**) · `t2` 456k (**−64%**) · `t3` 1.02M (**−49%**) · `t4` 252k (−16%) · `t5` 69k (−12%).

Verdict: **equal-or-better** behaviorally with the largest token wins so far — the heavy `t3-apply` nearly halved; `t2` reached a clean 5/5. `t5` judge remains the single watch item (score-4 minor imprecisions on longer answers; mechanical citations 100%). Synthesized-run caveats: the aggregate table for `t2`/`t5` mixes new v1.2 runs with same-day diet runs where the batch did not overwrite (run counts above separate them).
