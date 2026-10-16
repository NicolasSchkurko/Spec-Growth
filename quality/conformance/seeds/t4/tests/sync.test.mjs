import test from "node:test";
import assert from "node:assert/strict";
import { markSynced, syncedBadge } from "../src/sync.js";

test("markSynced returns a marked copy without mutating the original", () => {
  const note = { text: "a" };
  const marked = markSynced(note);
  assert.equal(marked.synced, true);
  assert.equal(note.synced, undefined);
});

test("syncedBadge shows the label only when the flag is set", () => {
  assert.equal(syncedBadge({ synced: true }), "synced");
  assert.equal(syncedBadge({}), "");
});
