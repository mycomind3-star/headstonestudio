import { z } from "zod";
import { type ProofVersionDiffField } from "./proofComparison";

const isoTimestampSchema = z.string().datetime({ offset: true });
const proofVersionDiffFieldSchema = z.enum([
  "name",
  "birth_date",
  "death_date",
  "epitaph",
  "shape",
  "layout",
  "material",
  "text_block",
  "symbol",
  "photo_etch",
  "custom_art",
  "border",
]);

export const proofReviewNoteTypeSchema = z.enum([
  "general",
  "name_review",
  "date_review",
  "epitaph_review",
  "layout_review",
  "artwork_review",
  "production_question",
]);

export const proofReviewNoteStatusSchema = z.enum(["open", "resolved", "dismissed"]);

export type ProofReviewNoteType = z.infer<typeof proofReviewNoteTypeSchema>;
export type ProofReviewNoteStatus = z.infer<typeof proofReviewNoteStatusSchema>;

export interface ProofReviewNote {
  id: string;
  versionId: string;
  diffItemId?: string;
  diffField?: ProofVersionDiffField;
  type: ProofReviewNoteType;
  status: ProofReviewNoteStatus;
  body: string;
  createdAt: string;
  updatedAt: string;
  createdByLabel: string;
}

export interface CreateProofReviewNoteInput {
  id: string;
  versionId: string;
  diffItemId?: string;
  diffField?: ProofVersionDiffField;
  type: ProofReviewNoteType;
  body: string;
  createdAt: string;
  updatedAt: string;
  createdByLabel: string;
}

export interface UpdateProofReviewNoteInput {
  diffItemId?: string;
  diffField?: ProofVersionDiffField;
  type?: ProofReviewNoteType;
  body?: string;
  updatedAt: string;
  createdByLabel?: string;
}

export const createProofReviewNoteInputSchema = z
  .object({
    id: z.string().min(1),
    versionId: z.string().min(1),
    diffItemId: z.string().min(1).optional(),
    diffField: proofVersionDiffFieldSchema.optional(),
    type: proofReviewNoteTypeSchema,
    body: z.string().min(1),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    createdByLabel: z.string().min(1),
  })
  .strict();

export const updateProofReviewNoteInputSchema = z
  .object({
    diffItemId: z.string().min(1).optional(),
    diffField: proofVersionDiffFieldSchema.optional(),
    type: proofReviewNoteTypeSchema.optional(),
    body: z.string().min(1).optional(),
    updatedAt: isoTimestampSchema,
    createdByLabel: z.string().min(1).optional(),
  })
  .strict();

export const proofReviewNoteSchema = z
  .object({
    id: z.string().min(1),
    versionId: z.string().min(1),
    diffItemId: z.string().min(1).optional(),
    diffField: proofVersionDiffFieldSchema.optional(),
    type: proofReviewNoteTypeSchema,
    status: proofReviewNoteStatusSchema,
    body: z.string().min(1),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    createdByLabel: z.string().min(1),
  })
  .strict();

const proofReviewNotesEnvelopeSchema = z
  .object({
    notes: z.array(proofReviewNoteSchema),
    saved_at: isoTimestampSchema,
  })
  .strict();

export type ProofReviewNotesEnvelope = z.infer<typeof proofReviewNotesEnvelopeSchema>;

function buildProofReviewNote(
  note: {
    id: string;
    versionId: string;
    type: ProofReviewNoteType;
    status: ProofReviewNoteStatus;
    body: string;
    createdAt: string;
    updatedAt: string;
    createdByLabel: string;
    diffItemId: string | undefined;
    diffField: ProofVersionDiffField | undefined;
  },
): ProofReviewNote {
  const result: ProofReviewNote = {
    id: note.id,
    versionId: note.versionId,
    type: note.type,
    status: note.status,
    body: note.body,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    createdByLabel: note.createdByLabel,
  };

  if (note.diffItemId !== undefined) {
    result.diffItemId = note.diffItemId;
  }

  if (note.diffField !== undefined) {
    result.diffField = note.diffField;
  }

  return result;
}

export function createProofReviewNote(input: CreateProofReviewNoteInput): ProofReviewNote {
  const parsed = createProofReviewNoteInputSchema.parse(input);

  return buildProofReviewNote({
    id: parsed.id,
    versionId: parsed.versionId,
    type: parsed.type,
    status: "open",
    body: parsed.body,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    createdByLabel: parsed.createdByLabel,
    diffItemId: parsed.diffItemId,
    diffField: parsed.diffField,
  });
}

export function updateProofReviewNote(
  note: ProofReviewNote,
  input: UpdateProofReviewNoteInput,
): ProofReviewNote {
  const parsedNote = proofReviewNoteSchema.parse(note);
  const parsedInput = updateProofReviewNoteInputSchema.parse(input);

  return buildProofReviewNote({
    id: parsedNote.id,
    versionId: parsedNote.versionId,
    type: parsedInput.type ?? parsedNote.type,
    status: parsedNote.status,
    body: parsedInput.body ?? parsedNote.body,
    createdAt: parsedNote.createdAt,
    updatedAt: parsedInput.updatedAt,
    createdByLabel: parsedInput.createdByLabel ?? parsedNote.createdByLabel,
    diffItemId: parsedInput.diffItemId ?? parsedNote.diffItemId,
    diffField: parsedInput.diffField ?? parsedNote.diffField,
  });
}

export function resolveProofReviewNote(note: ProofReviewNote, updatedAt: string): ProofReviewNote {
  const parsedNote = proofReviewNoteSchema.parse(note);
  const parsedUpdatedAt = isoTimestampSchema.parse(updatedAt);

  return buildProofReviewNote({
    id: parsedNote.id,
    versionId: parsedNote.versionId,
    type: parsedNote.type,
    status: "resolved",
    body: parsedNote.body,
    createdAt: parsedNote.createdAt,
    updatedAt: parsedUpdatedAt,
    createdByLabel: parsedNote.createdByLabel,
    diffItemId: parsedNote.diffItemId,
    diffField: parsedNote.diffField,
  });
}

export function dismissProofReviewNote(note: ProofReviewNote, updatedAt: string): ProofReviewNote {
  const parsedNote = proofReviewNoteSchema.parse(note);
  const parsedUpdatedAt = isoTimestampSchema.parse(updatedAt);

  return buildProofReviewNote({
    id: parsedNote.id,
    versionId: parsedNote.versionId,
    type: parsedNote.type,
    status: "dismissed",
    body: parsedNote.body,
    createdAt: parsedNote.createdAt,
    updatedAt: parsedUpdatedAt,
    createdByLabel: parsedNote.createdByLabel,
    diffItemId: parsedNote.diffItemId,
    diffField: parsedNote.diffField,
  });
}

export function listOpenReviewNotes(notes: readonly ProofReviewNote[]): ProofReviewNote[] {
  return notes.filter((note) => note.status === "open");
}

export function listReviewNotesForVersion(notes: readonly ProofReviewNote[], versionId: string): ProofReviewNote[] {
  const parsedVersionId = z.string().min(1).parse(versionId);
  return notes.filter((note) => note.versionId === parsedVersionId);
}

export function serializeProofReviewNotes(
  notes: readonly ProofReviewNote[],
  savedAt = new Date().toISOString(),
): string {
  const parsedNotes = z.array(proofReviewNoteSchema).parse(notes) as ProofReviewNote[];
  const parsedSavedAt = isoTimestampSchema.parse(savedAt);

  return JSON.stringify({
    notes: parsedNotes,
    saved_at: parsedSavedAt,
  });
}

export function recoverProofReviewNotes(
  raw: string | null,
  storageKey = "headstone-design-studio:review-notes:v1",
): { ok: true; notes: ProofReviewNote[]; storage_key: string } | { ok: false; storage_key: string; message: string } {
  if (raw === null) {
    return {
      ok: false,
      storage_key: storageKey,
      message: "No saved review notes were found.",
    };
  }

  try {
    const parsed = proofReviewNotesEnvelopeSchema.parse(JSON.parse(raw));
    return {
      ok: true,
      storage_key: storageKey,
      notes: parsed.notes as ProofReviewNote[],
    };
  } catch {
    return {
      ok: false,
      storage_key: storageKey,
      message: "We could not restore the saved review notes. The draft was left unchanged.",
    };
  }
}
