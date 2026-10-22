# Security — scan triage

Scanner: `cisco-ai-skill-scanner` 2.3.0 (`--lenient`, rules + AST/pipeline/correlation, no LLM judge — rules alone catch ~8% of malicious skills; treat as one input, not a certification). Scanned: the distributed skill (SKILL.md + assets/ + references/ + docs/). `quality/` is test infrastructure and is scanned separately, not part of the distribution.

Last full scan: 2026-10-20.

| Severity | Finding | Disposition |
|---|---|---|
| CRITICAL ×6 | `command_injection`: `node:child_process` in gate scripts (build-map, compact-archive, doctor, gate-check ×2, lib) | **accepted, by design** — running the repo's declared `test_command` and `git` queries is the skill's core job. All `git`/`opencode` calls use fixed argv arrays (no shell); the one deliberate shell runner (`execSync(testsCmd)`) builds its command from repo config plus this round's CLI flag, refuses metacharacters unless `SPEC_GROWTH_ALLOW_SHELL_CMD=1`, and `--tests-command` is refused in CI. |
| LOW | `unauthorized_tool_use`: doctor "contacts nodejs.org" | **fixed** — it was a URL inside a fix-hint string; reworded without a URL. |
| INFO | name policy: `name: Spec Growth` | **fixed** — frontmatter is now `name: spec-growth` (open lowercase-hyphen). |
| INFO | no `license` field | **fixed** — `license: MIT` (matches LICENSE). |

The known unremovable residual is inherent to the artifact type: a skill whose job is executing the project's own test commands will always look like `command_injection` to a static scanner. The compensating controls are the argv-array discipline, the CI guard and the metacharacter guard above, plus the repo content jail: `--tests-of` refuses any test path outside `[A-Za-z0-9._/- ]` before it reaches a shell.
