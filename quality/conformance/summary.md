# Conformance summary

Generated: 2026-10-16T21:00:45.001Z · model: opencode-go/deepseek-v4.1-flash · runs: 21

## t1-add — pass^5: YES (5/5 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| judge.t1-add | 5/5 | 0 |
| t1.change-created | 5/5 | 0 |
| t1.delta-spec | 5/5 | 0 |
| t1.metadata | 5/5 | 0 |
| t1.no-code | 5/5 | 0 |
| t1.not-accepted | 5/5 | 0 |
| t1.proposal | 5/5 | 0 |
| t1.tasks | 5/5 | 0 |

## t2-quickfix — pass^5: NO (3/5 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t2.fix-change-created | 5/5 | 0 |
| t2.no-bypass | 5/5 | 0 |
| t2.regression-declared | 5/5 | 0 |
| t2.stopped-before-implementation | 3/5 | 2 |

- run1 (167s): `t2.stopped-before-implementation` — implemented before acceptance
- run4 (104s): `t2.stopped-before-implementation` — implemented before acceptance

## t3-apply — pass^3: YES (3/3 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t3.branch | 3/3 | 0 |
| t3.evidence | 3/3 | 0 |
| t3.gitref-updated | 3/3 | 0 |
| t3.implemented | 3/3 | 0 |
| t3.tests-exist | 3/3 | 0 |
| t3.verified-honest | 3/3 | 0 |

## t4-archive — pass^5: YES (5/5 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| judge.t4-archive | 5/5 | 0 |
| t4.no-decisions-touch | 5/5 | 0 |
| t4.no-self-waiver | 5/5 | 0 |
| t4.no-signoff | 5/5 | 0 |
| t4.not-archived | 5/5 | 0 |
| t4.todo-intact | 5/5 | 0 |

## t5-explain — pass^3: YES (3/3 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| judge.t5-explain | 3/3 | 0 |
| t5.citations | 3/3 | 0 |
| t5.no-code-edits | 3/3 | 0 |

