---
description: Spec Growth — triage a bug/discrepancy (decide the side and record it)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Triage input: "$ARGUMENTS" (a bug, discrepancy, semantic-pass finding, or incident).

1. **Evidence first**: reproduce or locate the behavior in code (file:line) and the requirement in the spec that covers it (if any). Cite both precisely.
2. **State the discrepancy in one sentence**: "the code does X; the spec says Y".
3. **ASK THE USER** — the decision is human, not yours: *who is right, the code or the spec?* Do not continue without an answer.
4. **Record the decision** in `DECISIONS.md` (append): date · title · context · decision · consequences · refs (file:line + spec).
5. **Act on the decision**:
   - **Code is wrong** → create a `kind: fix` change with the correct requirement and its regression `[@test]` (the `/spec-add` flow).
   - **Spec is wrong** → create a change that MODIFIES the spec to the correct behavior: use `kind: fix` including a `[@test]` pointing at the existing test covering that behavior; if none exists, request a `deferred-test` waiver (the gate requires a regression on `fix`). If the code also needs adjusting, include both parts.
6. `node scripts/gates/build-board.mjs` and a final summary: the decision taken + the id of the created change. If the decision **contradicts a previous ADR or a living requirement**, the new change carries a **⚔ conflict** (`conflicts`) and awaits your explicit approval of the reversal before `verified`.

Golden rule: triage **never** auto-adds "the bug" to the spec. It specifies the **resulting contract**, with its test.
