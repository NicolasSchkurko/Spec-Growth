// Settings persistence (fixture app): defaults merged over a JSON file,
// in-memory cache, path overridable via NOTES_SETTINGS_PATH.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DEFAULTS = { theme: "light", fontSize: 14, autosave: true };

let cache = null;

function settingsPath() {
  return process.env.NOTES_SETTINGS_PATH ?? join(process.cwd(), ".notes", "settings.json");
}

export function loadSettings() {
  if (cache) return { ...cache };
  const path = settingsPath();
  if (!existsSync(path)) {
    cache = { ...DEFAULTS };
    return { ...cache };
  }
  const stored = JSON.parse(readFileSync(path, "utf8"));
  cache = { ...DEFAULTS, ...stored };
  return { ...cache };
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2));
  cache = next;
  return { ...next };
}

export function resetSettingsCache() {
  cache = null;
}
