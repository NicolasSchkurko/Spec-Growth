# Spec Delta — sync-badge

## Purpose

Show a "synced" badge on notes that reached the server.

## Requirements

### Requirement: badge rendering

`syncedBadge` SHALL return "synced" only for notes with the flag set.

[@test] `tests/sync.test.mjs`
