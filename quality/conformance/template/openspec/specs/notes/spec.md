# notes Specification

## Purpose

Capture short text notes in memory and list them in insertion order.

## Requirements

### Requirement: note capture

The app SHALL store each note with a creation timestamp and list them in insertion order.

[@test] `tests/notes.test.mjs`

### Requirement: list isolation

`listNotes` SHALL return a copy so callers cannot mutate the internal array.

[@test] `tests/notes.test.mjs`
