# Proposal — Offline notes queue

## Why

Notes typed while offline are currently dropped. Users expect them to be kept and flushed when connectivity returns.

## What Changes

- New `src/offline.js` with a small in-memory queue (`enqueue`, `listQueue`, `flushQueue`).
- `addNote` queues the note when offline instead of dropping it.

## Expected Outcome

A note created offline appears in the list immediately and is flushed once `flushQueue` runs.

## Impact

- `src/offline.js` (new), `src/notes.js`
- Tests: `tests/offline.test.mjs`
