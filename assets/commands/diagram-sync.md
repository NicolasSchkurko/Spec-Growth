---
description: Spec Growth — sync the C4 diagram with code reality
---

You are operating **Spec Growth** (load the `spec-growth` skill for details). You are syncing `ARCHITECTURE.dsl` (Structurizr, C4 model) against reality.

**Authoritative sources** (in order): code (graph if available) + IaC/manifests. **NEVER** documentation or previous diagrams as a source of truth.

1. If `ARCHITECTURE.dsl` does not exist: propose a minimal workspace (system + detected containers/components) and ask for approval before creating it.
2. Detect **structural changes** since the last sync: new components/services, new dependencies, new queues/external APIs, deployment changes. (Do not re-sync for internal refactors.)
3. **Capability tags**: every component that realizes a living capability (`openspec/specs/<capability>/`) carries the tag `cap:<capability>` (a component can realize several, comma-separated). The gate warns when a living capability is untagged anywhere or when a tag references no capability — fix those here, never by hand-editing specs.
4. Propose a **DIFF** of the DSL — never rewrite from scratch. Preserve human descriptions, annotations and existing tags: the intent lives there.
5. Validate with the Structurizr MCP (`-dsl` validate) and export if the repo uses it (`-mermaid` / `-plantuml`).
6. Show the diff to the user; apply only with approval. If there was a real architectural decision, record it in `DECISIONS.md`.

Rule: the diagram is **derived** from reality and preserves human intent; differences become **decisions**, not silences.
