---
description: Spec Growth — explain existing behavior (trace the real mechanism, anchor a note, propose a refactor if opaque)
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). Explain: "$ARGUMENTS" (a behavior, a data flow or an area of the code — e.g. "how settings are persisted", "where the dashboard numbers come from").

1. **Scope it, then dispatch** — the trace is read-heavy, so it belongs in a fresh child unless you already have the files in hand:
   - One coherent path → `subagent` → **`spec-explainer`** (**foreground**) with the topic, whether to anchor the note (`docs/mechanisms/<topic>.md`) and any area hints you already know.
   - Several **independent** behaviors named in the request → one child each, **cap 3**, then merge.
   - Tiny topic (a single function or file you can already name) → trace it **in this session**: a child would spend time re-gathering what you have.
   - If the child fails or times out, do the trace yourself and say so.
2. **Verify, then deliver in your own words**: read the note (or the digest), check the **key hops** yourself (`file:line`), and resolve or report every `unclear:` the child left. The human asked *you*: never relay a child's prose unread. If the topic maps to no spec, say so plainly (it may deserve `/spec-triage` or `/spec-add`).
3. **Deliver the explanation** in the plainest language (the human may not know this part of the stack):
   - Step-by-step mechanism (event → … → result).
   - Physical traceability: files, preferences/database/keys, lifecycle (when created, updated, deleted).
   - Limits and failure modes: forced close, data/cache cleared, concurrency, no network.
   - Touched APIs: the framework/library APIs involved, 1–2 sentences each (what it is, why it is used here).
   - A **Mermaid** flow diagram of the data path.
4. **Anchor the note** (recommended when the behavior was hard to explain): `docs/mechanisms/<topic>.md` — the child writes it when the brief asks; otherwise you do. If a living spec covers the behavior, link the note from the change/context around it — **never paste implementation prose into the spec itself** (the spec is the contract; mechanism notes are documentation).
5. **Act on what you find**:
   - Behavior not described by any requirement → propose `/spec-add` (or `/spec-triage` if code and spec disagree).
   - Code that is confusing (misleading names, deep nesting, undeclared persistence, framework magic) → propose a `kind: refactor` change via `/spec-add` (with its regression `[@test]`).
   - Nothing to do? Say it plainly: the behavior is spec'd and clean.
6. Do **not** edit code or specs in this command. This is understanding, not changing.
