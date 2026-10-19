# INIT — bootstrap procedure

Assets live in this skill's base folder under `assets/`. Run in order and report each step.

## What it leaves in the repo

```
openspec/                  # specs/ · changes/(+archive) · schemas/spec-anchored · config.yaml · board.json · evidence.json
BOARD.md                   # generated
DECISIONS.md               # append-only (ADR-lite)
ARCHITECTURE.dsl           # C4 (Structurizr), once diagram-sync is used
scripts/gates/             # lib.mjs · gate-check.mjs · build-board.mjs · build-graph.mjs · compact-archive.mjs · build-map.mjs
.opencode/commands/        # spec-add · spec-triage · spec-apply · spec-verify · spec-explain · spec-deps-graph · spec-gate · spec-resolve · diagram-sync
.opencode/agents/          # spec-implementer · spec-gate · spec-auditor · spec-walkthrough · spec-recon · spec-explainer · spec-deps-graph · diagram-sync
docs/mechanisms/           # optional mechanism notes (from /spec-explain)
AGENTS.md                  # constitution (Spec Growth section)
```

## Procedure

1. **Preconditions**: git repo; `node --version` ≥ 20.19; `npm --version`. If something is missing, stop and report.
2. **OpenSpec**: `openspec --version`; if missing → `npm install -g @fission-ai/openspec@<version>` (pinned; avoid `@latest` for team/CI installs). Then `openspec init` (if not initialized), with OpenCode among the tools. Verify `openspec validate --all` runs.
3. **Code indexing** (defaults first; MCPs only when needed — pin a concrete reviewed version, never `@latest`):
   - **Default (small/medium repos)**: the **native LSP tool** — `"lsp": true` in the OpenCode config plus `OPENCODE_EXPERIMENTAL_LSP_TOOL=true`; language servers auto-install (e.g., `kotlin-ls` for Kotlin). Pair it with grep (literals) and `node scripts/gates/build-map.mjs` (orientation; the zero-dependency fallback for headless/CI).
   - **Large repos only** (multi-language, deep call graphs, structural queries hurting): `opencode mcp add codebase-memory --global -- npx -y codebase-memory-mcp@X.Y.Z`
   - Diagrams: `opencode mcp add structurizr --global --url https://mcp.structurizr.com/mcp` (hosted remote MCP: review its OAuth scopes before connecting; optional)
   - **Latency (ask, do not assume)**: this workflow is turn-based with a large fixed context (the skill, `AGENTS.md`, the specs) — exactly the case OpenCode's `warming` targets: it keeps the provider-side **prompt cache** alive across your pauses (`{"warming": true}`, off by default, ~7 extra billable requests per 30-minute window). Offer it as an **opt-in**; never enable it silently, and only when your providers cache prompts. The `compaction`/`snapshots` trade-offs and the rest: `docs/speed.md` → *Runtime settings*.
4. **Schema**: `openspec schema fork spec-driven spec-anchored` (if missing) + the patch in `assets/scaffold/schema-patch.md`; validate with `openspec schema validate spec-anchored`.
5. **Scaffold** (copy/merge from `assets/scaffold/`):
   - `config.yaml` → `openspec/config.yaml` (MERGE: do not overwrite existing keys or `protected:`)
   - `AGENTS.md` → append if it exists; create otherwise
   - `BOARD.md` and `DECISIONS.md` → repo root, only if missing
   - `assets/scripts/*` → `scripts/gates/`
6. **.gitignore**: merge `assets/scaffold/gitignore` into `.gitignore` (ignores the **generated** files: `BOARD.md`, `openspec/board.json`, `openspec/evidence.json`).
7. **Pre-commit hook (recommended)**: copy `assets/scaffold/hooks/pre-commit` to `.git/hooks/pre-commit` (executable). If the repo uses Husky (`core.hooksPath`), copy it to `.husky/pre-commit`.
8. **Commands and agents**: copy `assets/commands/*.md` → `.opencode/commands/` and `assets/agents/*.md` → `.opencode/agents/` (if they exist, ask before overwriting). The agents are not optional: `/spec-gate` and `/diagram-sync` route to them by id (`agent: spec-gate`, `agent: diagram-sync`), and `/spec-apply` + `/spec-verify` dispatch `spec-gate`, `spec-auditor` and `spec-walkthrough` as background children. A repo that ran an older INIT must copy `assets/agents/*` before using the new commands.
9. **Board**: `node scripts/gates/build-board.mjs`.
10. **Final report**: what was created, what to restart, and how to continue: `/spec-add <idea>`.

If something fails midway: do not leave the repo dirty; report what was done and what was not.
