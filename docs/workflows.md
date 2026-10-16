# Workflows

Recipes for the situations that actually come up.

## 1. A new feature

```mermaid
sequenceDiagram
    participant Dev as You
    participant Ag as Agent
    participant G as gate
    participant CI as CI
    Dev->>Ag: /spec-add "offline mode for notes"
    Ag->>Dev: proposal + delta spec + questions (a draft)
    Dev->>Ag: approve
    Ag->>Dev: /spec-apply → branch change/id, code + tests
    Ag->>G: gate-check --run-tests
    G-->>Ag: GATE GREEN (evidence recorded)
    Dev->>CI: push → CI runs gate-check --run-tests --diff main
    Dev->>Ag: merge → /spec-gate --pre-archive id
    Ag->>Dev: OK → openspec archive id
```

1. `/spec-add "<idea>"` — clarify, alternatives if a technical decision is embedded, draft created.
2. **You approve** (say it; the agent records `status: accepted` + `accepted_by`/`accepted_at`).
3. `/spec-apply <id>` — implementation on `change/<id>`; tests + gate with green evidence; `verified` when unblocked.
4. Push, review, merge. Update `gitref` (or `merged_as` for squash-merges).
5. `--pre-archive <id>` → OK → `openspec archive <id>`.

## 2. A bug (or a discrepancy)

```mermaid
flowchart TD
    B[bug / discrepancy] --> T["/spec-triage"]
    T --> Q{who is right?}
    Q -->|the code| F["kind: fix + regression [@test]"]
    Q -->|the spec| S["edit the spec; cite the existing test or request a deferred-test waiver"]
    F --> W[apply → verify → archive]
    S --> W
```

1. `/spec-triage "<symptom>"` — the agent reproduces, cites code and spec, and **asks you which side is right**.
2. The decision is recorded in `DECISIONS.md`; a `kind: fix` change is created with a regression test.
3. Apply → verify → archive as usual. If the fix contradicts an older decision, it carries a ⚔ conflict until you approve the reversal.

## 3. A refactor

Same flow as a feature, with `kind: refactor`. The contract does not change, so the green suite is the proof: a regression `[@test]` is mandatory, and `/spec-verify` watches for dead or duplicated behavior.

## 4. A change that touches a protected zone

1. `/spec-add` warns: "🔒 this will require your explicit approval".
2. You review the risk and **explicitly approve** (or not).
3. The agent records `human_approved: true` **and** appends the approval line to `DECISIONS.md`.
4. While `applying`, an unapproved zone touch is an error; after `verified`, regularize.

## 5. Requesting a waiver (and granting it)

1. The agent (or you) records the deviation in `.openspec.yaml`:

   ```yaml
   waivers:
     - type: deferred-test
       state: requested
       reason: "integration tests need the staging database"
   ```

2. It appears on the BOARD under ⚠. While `requested`, it **blocks** `verified` and `--pre-archive`.
3. You grant it — the agent records `state: granted` + `owner` + `expires` (a date you give). A valid granted waiver **enables**; its expiry is its closure.
4. Rejecting = removing the entry.

## 6. A conflict with a past decision ⚔

1. When creating or verifying a change, the agent finds that it contradicts an ADR or a living requirement and records it:

   ```yaml
   conflicts:
     - with: "DECISIONS.md#2026-10-01"
       what: "proposes SQLite against the Postgres decision"
       proposal: "revert the previous decision"
   ```

2. The BOARD shows it under ⏸ as a ⚔ item. Pending = no `verified`, no `--pre-archive`.
3. You approve the reversal explicitly → the agent removes the entry and appends the reversal ADR. Or you reject it and the change adapts.

## 7. Archiving and compaction

- Before archiving: `--pre-archive <id>` must be **OK** (verified · no blocking waivers · no decisions · no conflicts · merge verified against the current target state).
- `openspec archive <id>` moves the folder to `openspec/changes/archive/YYYY-MM-DD-<id>/`.
- Periodically: `node scripts/gates/compact-archive.mjs --days=90` (dry run) → review → `--apply`. Old folders become one line each in `archive/YYYY.md`; nothing dirty is ever deleted.
