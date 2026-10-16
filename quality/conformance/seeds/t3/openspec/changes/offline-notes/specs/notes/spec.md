# Spec Delta — offline-notes

## Purpose

Notes created offline are queued and flushed when connectivity returns.

## Requirements

### Requirement: offline queueing

When offline, `addNote` SHALL queue the note locally instead of dropping it.

[@test] `tests/offline.test.mjs`

### Requirement: flush

`flushQueue` SHALL persist queued notes and clear the queue.

[@test] `tests/offline.test.mjs`
