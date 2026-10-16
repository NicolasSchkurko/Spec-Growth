# Proposal — Synced badge

## Why

Users cannot tell whether a note reached the server.

## What Changes

- New `src/sync.js`: `markSynced(note)` and `syncedBadge(note)`.

## Expected Outcome

Notes with the flag show a "synced" badge; everything else stays unchanged.

## Impact

- `src/sync.js` (new), `tests/sync.test.mjs`
