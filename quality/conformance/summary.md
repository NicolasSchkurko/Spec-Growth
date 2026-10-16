# Conformance summary

Generated: 2026-10-16T22:16:16.535Z · model: opencode-go/deepseek-v4.1-flash · runs: 29

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

## t2-quickfix — pass^10: YES (10/10 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t2.fix-change-created | 10/10 | 0 |
| t2.no-bypass | 10/10 | 0 |
| t2.regression-declared | 10/10 | 0 |
| t2.stopped-before-implementation | 10/10 | 0 |

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

## t5-explain — pass^6: NO (4/6 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| judge.t5-explain | 4/6 | 2 |
| t5.citations | 6/6 | 0 |
| t5.no-code-edits | 6/6 | 0 |

- run3 (27s): `judge.t5-explain` — score=4 The core mechanism is explained accurately, but the claim that the file does not exist before the first save is materially wrong because loadSettings() reads an existing file.
- run6 (29s): `judge.t5-explain` — score=4 La explicación es mayormente precisa, pero describe como atómica una escritura directa con writeFileSync.

