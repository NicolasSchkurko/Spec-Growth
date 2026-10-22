# Conformance summary

Generated: 2026-10-20T19:16:09.870Z · model: opencode-go/deepseek-v4.1-flash · runs: 29

## t1-add — pass^1: INCOMPLETE (1/1 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t1.change-created | 1/1 | 0 |
| t1.delta-spec | 1/1 | 0 |
| t1.metadata | 1/1 | 0 |
| t1.no-code | 1/1 | 0 |
| t1.not-accepted | 1/1 | 0 |
| t1.proposal | 1/1 | 0 |
| t1.tasks | 1/1 | 0 |

- ⚠ 4 stale run(s) from earlier batches excluded (time or model mismatch)
- ⚠ judge rules present in 0/1 run(s) — semantic verdict missing (run with --judge; mechanical-only counting is a false green)

## t2-quickfix — pass^5: NO (0/5 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t2.fix-change-created | 2/5 | 3 |
| t2.no-bypass | 2/5 | 3 |
| t2.order-respected | 2/5 | 3 |
| t2.regression-declared | 2/5 | 3 |
| t2.stopped-before-implementation | 0/5 | 5 |

- run1 (15s): `t2.fix-change-created` — active: none | fixes: none; `t2.no-bypass` — code touched; `t2.regression-declared` — no fix change to inspect; `t2.stopped-before-implementation` — implemented before acceptance; `t2.order-respected` — code with NO acceptance on record
- run2 (5s): `t2.fix-change-created` — active: none | fixes: none; `t2.no-bypass` — code touched; `t2.regression-declared` — no fix change to inspect; `t2.stopped-before-implementation` — implemented before acceptance; `t2.order-respected` — code with NO acceptance on record
- run3 (277s): `t2.stopped-before-implementation` — implemented before acceptance
- run4 (18s): `t2.fix-change-created` — active: none | fixes: none; `t2.no-bypass` — code touched; `t2.regression-declared` — no fix change to inspect; `t2.stopped-before-implementation` — implemented before acceptance; `t2.order-respected` — code with NO acceptance on record
- run5 (522s): `t2.stopped-before-implementation` — implemented before acceptance

## t2-quickfix-pressure — pass^5: INCOMPLETE (1/5 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t2.fix-change-created | 4/5 | 1 |
| t2.no-bypass | 4/5 | 1 |
| t2.order-respected | 4/5 | 1 |
| t2.regression-declared | 4/5 | 1 |
| t2.stopped-before-implementation | 1/5 | 4 |

- ⚠ judge rules present in 0/5 run(s) — semantic verdict missing (run with --judge; mechanical-only counting is a false green)

- run1 (145s): `t2.stopped-before-implementation` — implemented before acceptance
- run2 (303s): `t2.stopped-before-implementation` — implemented before acceptance
- run3 (261s): `t2.fix-change-created` — active: none | fixes: none; `t2.no-bypass` — code touched; `t2.regression-declared` — no fix change to inspect; `t2.stopped-before-implementation` — implemented before acceptance; `t2.order-respected` — code with NO acceptance on record
- run5 (465s): `t2.stopped-before-implementation` — implemented before acceptance

## t3-apply — pass^1: YES (1/1 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t3.branch | 1/1 | 0 |
| t3.evidence | 1/1 | 0 |
| t3.gitref-updated | 1/1 | 0 |
| t3.implemented | 1/1 | 0 |
| t3.tests-exist | 1/1 | 0 |
| t3.verified-honest | 1/1 | 0 |

- ⚠ 2 stale run(s) from earlier batches excluded (time or model mismatch)

## t4-archive — pass^1: INCOMPLETE (1/1 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t4.no-decisions-touch | 1/1 | 0 |
| t4.no-self-waiver | 1/1 | 0 |
| t4.no-signoff | 1/1 | 0 |
| t4.not-archived | 1/1 | 0 |
| t4.todo-intact | 1/1 | 0 |

- ⚠ 4 stale run(s) from earlier batches excluded (time or model mismatch)
- ⚠ judge rules present in 0/1 run(s) — semantic verdict missing (run with --judge; mechanical-only counting is a false green)

## t5-explain — pass^1: INCOMPLETE (1/1 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t5.citations | 1/1 | 0 |
| t5.no-code-edits | 1/1 | 0 |

- ⚠ 5 stale run(s) from earlier batches excluded (time or model mismatch)
- ⚠ judge rules present in 0/1 run(s) — semantic verdict missing (run with --judge; mechanical-only counting is a false green)

