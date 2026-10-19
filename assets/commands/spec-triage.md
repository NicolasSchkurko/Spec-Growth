---
description: Spec Growth — triage a bug/discrepancy (decide the side and record it)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Triage input: "$ARGUMENTS" (a bug, discrepancy, semantic-pass finding, or incident).

1. **Two evidences, in parallel** — they do not depend on each other, so never run them one after the other:
   - `subagent` → **`spec-explainer`**, **`background: true`**: trace the observed behavior in the real code (`file:line`), **no note** — return the digest only.
   - `subagent` → **`spec-recon`**, **`background: true`**: which requirement covers that behavior, and whether a recorded decision already settles it.
   - If a child fails or times out, do that side yourself and say so.
   - When both return, `git status --porcelain` must show no change: these children are read-only by contract, and per-agent `permissions` are not enforced by this build (see `references/status.md`). If the tree moved, restore it and report it.
2. **State the discrepancy in one sentence**: "the code does X (`file:line`); the spec says Y (`REQ id` / no requirement)" — using the citations the children returned. Verify the key ones yourself before quoting them.
3. **ASK THE USER** — in **one message**, with both sides ready: *who is right, the code or the spec?* Give the options and your recommendation (marked as such). Do not continue without an answer.
4. **Record the decision** in `DECISIONS.md` (append): date · title · context · decision · consequences · refs (file:line + spec).
5. **Act on the decision**:
   - **Code is wrong** → create a `kind: fix` change with the correct requirement and its regression `[@test]` (the `/spec-add` flow).
   - **Spec is wrong** → create a change that MODIFIES the spec to the correct behavior: use `kind: fix` including a `[@test]` pointing at the existing test covering that behavior; if none exists, request a `deferred-test` waiver (the gate requires a regression on `fix`). If the code also needs adjusting, include both parts.
6. `node scripts/gates/build-board.mjs` and a final summary: the decision taken + the id of the created change. If the decision **contradicts a previous ADR or a living requirement**, the new change carries a **⚔ conflict** (`conflicts`) and awaits your explicit approval of the reversal before `verified`.

Golden rule: triage **never** auto-adds "the bug" to the spec. It specifies the **resulting contract**, with its test.
