# Implementation status, known limits, evidence base, assumptions

**Implemented and verified by the scripts (adversarial audit/engineering rounds v0.5→v1.2):**
- v1.2.1: **checker fixes (audit round)** — `--pre-archive` is blocked by any global error (a red suite included) · touched-file measurement against the change's base commit: committed edits and renames count, and a failed git measurement fails the rule instead of reading as clean · `aggregate` excludes stale batches and declares `pass^k` only for complete batches (judged tasks require their judge rules) · the evidence fingerprint normalizes CRLF/LF, so checkout churn no longer stales · `deps` resolve by exact id · judge JSON parsed as a full line (braces inside `reasons` are harmless) · `t4.todo-intact` scoped to the sign-off · full 40-hex `gitref` accepted · spawn failures recorded as `spawn-error` in `result.json`.
- v1.2: **restructure** — `SKILL.md` is a **router**: INIT/layout, scripts/flags/policy and this status page moved to `references/` (progressive disclosure) · **model routing**: `/spec-gate` and `/diagram-sync` run as background subagents on `opencode-go/space-bunny`; interactive commands inherit the session model · validated against the conformance suite (`quality/` in the repo).
- v1.0: **tech brief / comprehension** (`tech_brief: true` → `walkthrough.md` + sign-off; warnings until `--pre-archive`, where an incomplete brief or missing sign-off is an error; a `comprehension-debt` waiver excuses the sign-off; never blocks `verified`) · **`/spec-explain`** (8th command: trace `file:line` + mechanism note + refactor proposals) · **content-fingerprint evidence freshness** (commit-after-green stays valid; later edits — even uncommitted — are STALE) · **glob-aware** zone ownership and `@cita` scan · **tasks.md** open-check warning · **`--pre-archive` requires a verifiable merge ref** · **section-aware `adrApproves`** (id in the heading, approval below) · **change-scoped pre-commit hook** (`change/<id>` branches) · **declared-deps Mermaid graph** in BOARD.md (archived deps resolved) · `--diff` flags code files unclaimed by any active change · domain-based technical-alternatives trigger · mid-apply failure protocol · **capabilities active** (folder → `cap:<folder>`; `ARCHITECTURE.dsl` tag mapping checked both ways; new-capability collisions detected; BOARD **Capabilities** section).
- v0.9: **kind `refactor`** (requires a regression `[@test]`, like `fix`) · **⚔ conflicts** (`conflicts` in `.openspec.yaml`: they block `verified` and `--pre-archive` until approval + ADR; the BOARD shows them) · **deps-sequenced overlaps** (direct or transitive) → warning instead of error, in gate and board · **native `x-` key support** (metadata accepted bare or `x-`-prefixed — OpenSpec ≥1.14 strict validation recommends the prefix) · **glob-aware target existence** (no false positives on `**` targets) · one overlap report per target pair (no duplicate spam) · quieter `config.yaml` parsing (nested OpenSpec-owned sections are not reported) · `bug-finder` integrated in anchored mode (external skill).
- Base v0.8: **`--scope` is report-only** (evidence and `gate_ok` are computed unfiltered; a red suite is global and non-degradable; `evidence.json` records `scope`) · approval ADR requires **a line with an approval verb + the id as a word** (a rejection line does not approve) · zones detect **untracked** files (`git ls-files --others`) · `--pre-archive` expands targets to **concrete files** (empty or unmatched glob → error) · `granted` waivers with >180-day validity warn; expired ones in `archive/` are reported · `walkMd` no longer excludes `build/target/out` under `openspec/` · block parser with real dedent · `writeAtomic` with retry/cleanup and fallback (Windows/AV) · text/tracked/glob caches and expansion cap (2000) · evidence re-read close to the write.
- Earlier rounds (v0.5–v0.7): `--tests-command` → `tests-substituted` (no green) and forbidden in CI; committed `evidence.json` → error; per-change evidence refresh; zones checked over real changed files; `merged_as`/`gitref` must contain the current target state; overlap is an error only with `applying` work; drafts do not legitimate requirement IDs; caps compared case-insensitively; staleness includes tests; compact `--force` never deletes dirty content; `test_command` metacharacters require `SPEC_GROWTH_ALLOW_SHELL_CMD=1`; pinned versions in INIT.

**NOT implemented (deliberate, v1.2):**
- Evidence signing/attestation (HMAC/OIDC): rejected by majority (single-dev); documented as a limit.
- Orphan-code / undeclared-dependency detection over the import graph (advisory semantic pass + codebase-memory).
- Consumer migration on breaking changes; auto-archive; a generated CI workflow (documented policy, not an asset).

**Evidence base**: the v1.0 comprehension axis is grounded in recent GenAI-assisted SE research (comprehension debt, explanation gates, skill formation, cognitive-load-aware refactoring) — predominantly novice-study populations: mechanisms transfer, effect sizes do not. Full map and caveats in the repo's `docs/evidence.md`.

**Known limits:**
- Evidence is local and per-clone, and **not tamper-proof** (unsigned): the real barrier is running `--run-tests` in CI.
- The parser is strict with `.openspec.yaml`; `config.yaml` reports unparsed lines as warnings (frontmatter is lenient by design).
- Flags (`human_approved`, `granted`, `accepted_by`) can be written by an agent if it proposes to; for `human_approved` and waivers the gate now requires the **cross-checked ADR** in `DECISIONS.md` (a line with 'approved'/'aprobado' + id as a word), plus manual discipline for the rest.
- The comprehension sign-off is a ritual record: the gate checks that the walkthrough exists, is complete, and that the sign-off keys are set — **not that understanding happened**. The real mechanism is the interactive teach-back in `/spec-verify`: keep it conversational (free recall, code-cited validation), never a checkbox session.
- `--scope` downgrades foreign reds to warnings **in the report only** (evidence and `gate_ok` are computed unfiltered); a red suite is global and non-degradable. For CI, run **without** scope.
- Citations: scope = targets+tests (directories expanded to code files).
- Zones: untracked files are detected via `git ls-files --others`; git-ignored files remain invisible.
- Subagent routing: background children return only their result; if a child fails or times out, the parent must retry or fall back to running the command in-session.

> This document is a claim: if a script changes, this section is updated.

## Assumptions to verify (spike)

- `.openspec.yaml` tolerates extra keys without breaking `openspec validate`; the gate accepts metadata **bare or `x-`-prefixed** natively (the prefixed form wins when both are present; OpenSpec ≥1.14 strict validation recommends `x-`). Repos pick one convention and stick to it.
- `openspec schema fork` exists in the installed version.
- `opencode mcp add` syntax (local `--` / remote `--url`).
- The project's `test_command` (Android: `./gradlew test`).
- Structurizr's remote MCP is available; Docker alternative (`structurizr/mcp`).
- Command frontmatter `agent`/`model`/`subagent` behaves as documented in V2 (child session, model fallback order); the routing was not yet exercised headless.
