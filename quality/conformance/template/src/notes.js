// In-memory notes store (fixture app).

const notes = [];

export function addNote(text) {
  notes.push({ text, createdAt: new Date().toISOString() });
}

export function listNotes() {
  return notes.slice();
}

export function clearNotes() {
  notes.length = 0;
}
