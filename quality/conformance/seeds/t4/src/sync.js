export function markSynced(note) {
  return { ...note, synced: true };
}

export function syncedBadge(note) {
  return note.synced ? "synced" : "";
}
