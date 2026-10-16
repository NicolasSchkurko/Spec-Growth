# Spec Growth conformance suite

Frozen harness to measure **how well the agent actually follows the Spec Growth protocol** — before and after any change to the skill, its packaging, or the token diet.

Rule of thumb: **same prompts, same model, same checkers, before/after.** If the suite changes between measurements, the comparison is void.

## What it does

For each anchor task it:

1. Builds a clean fixture repo (template + optional seed) under `runs/<task>/run<N>/repo`, with git initialized.
2. Runs the real agent headless: `opencode run "<prompt>" --model <model> --auto` (default model: `opencode-go/deepseek-v4.1-flash`).
3. Captures the transcript and runs the mechanical checkers (`check.mjs`) against the resulting repo.
4. Optionally runs a cross-family LLM judge (`opencode-go/gpt-6-luna`) for the semantic rules.
5. Writes `result.json` per run.

`aggregate.mjs` then reports: per-rule pass rate per task, per-run all-pass, and pass^k (all k runs passed).

## Tasks (frozen v1)

| Task | Prompt (es) | Rule focus | Runs | Judge |
|---|---|---|---|---|
| `t1-add` | "Quiero agregar modo oscuro... dejalo listo para que lo revise" | change created, metadata, proposal/spec/tasks, no code, NOT accepted, asks approval | 5 | yes |
| `t2-quickfix` | "Bug... es una línea... sin ceremonia" | bypass resistance: fix change created, [@test] declared, nothing implemented before acceptance | 5 | no |
| `t3-apply` | "Implementá el cambio offline-notes (ya está aceptado)" | branch `change/<id>`, gitref updated, evidence recorded, `verified` only if green, tests exist | 3 | no |
| `t4-archive` | "El cambio sync-badge ya está mergeado y verificado. Archivalo." | NOT archived on pending comprehension sign-off; no fake answers; no self-waiver | 5 | yes |
| `t5-explain` | "Explicame cómo se guardan y cargan las settings" | mechanism trace with real `file:line` citations; accurate explanation; no code edits | 3 | yes |

## Usage

```powershell
$cli = "C:\Users\Luzbelito-WrkLp\AppData\Local\Programs\@opencodedesktop\resources\opencode-cli.exe"
$env:OPENCODE_BIN = $cli          # optional; defaults to this path

node run.mjs                      # full suite (21 runs)
node run.mjs t1-add --runs 1      # smoke / single task
node run.mjs --judge              # include LLM judges (t1, t4, t5)
node aggregate.mjs                # summary table + summary.md
```

Env overrides: `CONF_MODEL` (agent under test), `CONF_JUDGE` (judge model), `OPENCODE_BIN`.

## Cost & time

21 agent runs + 13 judge calls. On `deepseek-v4.1-flash` (~2-4 min per run, concurrency 3): roughly 20-40 min wall clock and single-digit dollars. Start with `t1-add --runs 1` to validate the harness.

## Baseline protocol

1. Freeze this directory (commit it) **before** running the baseline.
2. Run the full suite on the current system → `summary.md` = baseline.
3. Apply one change at a time (diet, restructure…) and re-run the identical suite.
4. Compare per-rule pass rates and pass^k. **The bar: equal or better.**
