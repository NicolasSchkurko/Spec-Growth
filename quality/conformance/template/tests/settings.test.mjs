import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, resetSettingsCache, saveSettings } from "../src/settings.js";

function freshPath() {
  return join(mkdtempSync(join(tmpdir(), "notes-fixture-")), "settings.json");
}

test("loadSettings returns defaults when no file exists", () => {
  process.env.NOTES_SETTINGS_PATH = freshPath();
  resetSettingsCache();
  const s = loadSettings();
  assert.equal(s.theme, "light");
  assert.equal(s.fontSize, 14);
});

test("saveSettings persists and merges over defaults", () => {
  process.env.NOTES_SETTINGS_PATH = freshPath();
  resetSettingsCache();
  saveSettings({ theme: "dark" });
  resetSettingsCache();
  const s = loadSettings();
  assert.equal(s.theme, "dark");
  assert.equal(s.autosave, true);
});
