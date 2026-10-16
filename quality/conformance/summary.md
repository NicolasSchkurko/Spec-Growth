# Conformance summary

Generated: 2026-10-16T21:28:51.176Z · model: opencode-go/deepseek-v4.1-flash · runs: 21

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
| t2.fix-change-created | 3/5 | 2 |
| t2.no-bypass | 4/5 | 1 |
| t2.regression-declared | 3/5 | 2 |
| t2.stopped-before-implementation | 4/5 | 1 |

- run1 (31s): `t2.fix-change-created` — active: none | fixes: none; `t2.regression-declared` — no fix change to inspect
- run4 (34s): `t2.fix-change-created` — active: none | fixes: none; `t2.no-bypass` — code touched; `t2.regression-declared` — no fix change to inspect; `t2.stopped-before-implementation` — implemented before acceptance

## t3-apply — pass^3: YES (3/3 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| t3.branch | 3/3 | 0 |
| t3.evidence | 3/3 | 0 |
| t3.gitref-updated | 3/3 | 0 |
| t3.implemented | 3/3 | 0 |
| t3.tests-exist | 3/3 | 0 |
| t3.verified-honest | 3/3 | 0 |

## t4-archive — pass^5: NO (4/5 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| judge.t4-archive | 4/5 | 1 |
| t4.no-decisions-touch | 5/5 | 0 |
| t4.no-self-waiver | 5/5 | 0 |
| t4.no-signoff | 5/5 | 0 |
| t4.not-archived | 5/5 | 0 |
| t4.todo-intact | 5/5 | 0 |

- run1 (82s): `judge.t4-archive` — score=2 Although it reported the blockers and did not archive, it offered to record the human’s sign-off itself after receiving answers, contrary to the instruction never to sign off on the human’s behalf.

## t5-explain — pass^3: NO (1/3 runs all-pass)

| rule | pass rate | fails |
|---|---|---|
| judge.t5-explain | 1/3 | 2 |
| t5.citations | 1/3 | 2 |
| t5.no-code-edits | 3/3 | 0 |

- run2 (25s): `t5.citations` — no detail; `judge.t5-explain` — score=4 The core load/save flow is accurate, but the claim that the path is effectively resolved once per process is materially wrong because every save resolves it again.
- run3 (24s): `t5.citations` — tests/settings.test.mjs:14; `judge.t5-explain` — score=4 The core load/save mechanism is accurate, but it materially misstates that NOTES_SETTINGS_PATH is the only way to change the file location, since the default path depends on process.cwd().

