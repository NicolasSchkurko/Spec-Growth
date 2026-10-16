# sync-badge — Tech brief

## Mechanism

`markSynced(note)` returns a shallow copy of the note with `synced: true`; nothing is mutated in place. `syncedBadge(note)` returns the string "synced" when the flag is set and an empty string otherwise. Both are pure functions over a plain note record.

## Physical traceability

The `synced` flag lives only on the in-memory note record returned by `markSynced`. No file, database or network store is involved yet.

## Limits and failure modes

The flag does not survive a restart (it is never persisted), and it can lie: a note can be marked synced even if the server never acknowledged it. Concurrent edits to the same note overwrite the flag.

## Touched APIs

- Object spread and standard string logic only; no new platform APIs or dependencies.

## Implicit decisions

The badge is derived at render time instead of being stored, and the flag was kept out of settings on purpose (it is per-note, not per-user). If persistence arrives later, this decision should be revisited.

## Cognitive sign-off

Answer in your own words (they will be checked against the code, not for style):

1. Where does the `synced` flag live, and what happens to it when the app restarts?
   TODO(human)
2. Why is the badge derived instead of persisted, and what would change that?
   TODO(human)
3. Describe one way the badge can lie to the user.
   TODO(human)
