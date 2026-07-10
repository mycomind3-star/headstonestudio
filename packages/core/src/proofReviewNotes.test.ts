import { describe, expect, it } from "vitest";
import {
  createProofReviewNote,
  dismissProofReviewNote,
  listOpenReviewNotes,
  listReviewNotesForVersion,
  recoverProofReviewNotes,
  resolveProofReviewNote,
  updateProofReviewNote,
} from "./index";

const baseNow = "2026-07-09T22:00:00.000Z";

function makeNoteInput(overrides = {}) {
  return {
    id: "note_1",
    versionId: "version_1",
    type: "general" as const,
    body: "Please review this wording.",
    createdAt: baseNow,
    updatedAt: baseNow,
    createdByLabel: "Local reviewer",
    ...overrides,
  };
}

describe("proof review notes", () => {
  it("creates a valid general note", () => {
    const note = createProofReviewNote(makeNoteInput());

    expect(note.status).toBe("open");
    expect(note.versionId).toBe("version_1");
    expect(note.body).toContain("review");
  });

  it("rejects an empty body", () => {
    expect(() =>
      createProofReviewNote({
        ...makeNoteInput(),
        body: "",
      }),
    ).toThrow();
  });

  it("rejects a missing versionId", () => {
    expect(() =>
      createProofReviewNote({
        ...makeNoteInput(),
        versionId: "",
      }),
    ).toThrow();
  });

  it("updates a note without mutating the original", () => {
    const note = createProofReviewNote(makeNoteInput({ diffField: "name" }));
    const before = JSON.stringify(note);

    const updated = updateProofReviewNote(note, {
      body: "Please confirm the spelling of the name.",
      updatedAt: "2026-07-09T22:05:00.000Z",
      createdByLabel: "Staff",
    });

    expect(JSON.stringify(note)).toBe(before);
    expect(updated.body).toContain("spelling");
    expect(updated.createdByLabel).toBe("Staff");
  });

  it("resolves a note", () => {
    const note = createProofReviewNote(makeNoteInput());
    const resolved = resolveProofReviewNote(note, "2026-07-09T22:06:00.000Z");

    expect(resolved.status).toBe("resolved");
    expect(resolved.updatedAt).toBe("2026-07-09T22:06:00.000Z");
  });

  it("dismisses a note", () => {
    const note = createProofReviewNote(makeNoteInput());
    const dismissed = dismissProofReviewNote(note, "2026-07-09T22:07:00.000Z");

    expect(dismissed.status).toBe("dismissed");
    expect(dismissed.updatedAt).toBe("2026-07-09T22:07:00.000Z");
  });

  it("lists only open notes", () => {
    const openNote = createProofReviewNote(makeNoteInput({ id: "note_open" }));
    const resolved = resolveProofReviewNote(createProofReviewNote(makeNoteInput({ id: "note_resolved" })), "2026-07-09T22:06:00.000Z");
    const dismissed = dismissProofReviewNote(createProofReviewNote(makeNoteInput({ id: "note_dismissed" })), "2026-07-09T22:07:00.000Z");

    expect(listOpenReviewNotes([openNote, resolved, dismissed])).toEqual([openNote]);
  });

  it("lists notes for a single version", () => {
    const first = createProofReviewNote(makeNoteInput({ id: "note_1", versionId: "version_1" }));
    const second = createProofReviewNote(makeNoteInput({ id: "note_2", versionId: "version_2" }));

    expect(listReviewNotesForVersion([first, second], "version_1")).toEqual([first]);
  });

  it("rejects invalid note recovery data", () => {
    const recovered = recoverProofReviewNotes("not valid json");

    expect(recovered.ok).toBe(false);
    if (!recovered.ok) {
      expect(recovered.message).toMatch(/could not restore/i);
    }
  });
});
