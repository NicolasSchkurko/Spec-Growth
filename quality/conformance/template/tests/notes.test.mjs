import test from "node:test";
import assert from "node:assert/strict";
import { addNote, clearNotes, listNotes } from "../src/notes.js";

test("addNote stores a note and listNotes returns it", () => {
  clearNotes();
  addNote("buy milk");
  const all = listNotes();
  assert.equal(all.length, 1);
  assert.equal(all[0].text, "buy milk");
});

test("listNotes returns a copy, not the internal array", () => {
  clearNotes();
  addNote("a");
  const copy = listNotes();
  copy.pop();
  assert.equal(listNotes().length, 1);
});
