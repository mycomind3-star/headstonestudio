import { z } from "zod";
import { designDocumentSchema, type DesignDocument } from "@headstone/schema";

export const draftStatusSchema = z.enum([
  "draft",
  "family_review",
  "family_change_requested",
  "family_approved",
  "vendor_review",
  "production_locked",
  "archived",
]);

export type DraftStatus = z.infer<typeof draftStatusSchema>;

const isoTimestampSchema = z.string().datetime({ offset: true });

const designDocumentInputSchema = designDocumentSchema;

const createDraftInputSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    design_document: designDocumentInputSchema,
    created_at: isoTimestampSchema,
    updated_at: isoTimestampSchema,
  })
  .strict();

const updateDraftInputSchema = z
  .object({
    title: z.string().min(1).optional(),
    design_document: designDocumentInputSchema.optional(),
    updated_at: isoTimestampSchema,
  })
  .strict();

const createVersionInputSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    created_at: isoTimestampSchema,
    created_by: z.string().min(1),
  })
  .strict();

const designVersionSchema = z
  .object({
    id: z.string().min(1),
    draft_id: z.string().min(1),
    version_number: z.number().int().positive(),
    label: z.string().min(1),
    design_document: designDocumentSchema,
    created_at: isoTimestampSchema,
    created_by: z.string().min(1),
  })
  .strict();

const designDraftSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    status: draftStatusSchema,
    design_document: designDocumentSchema,
    versions: z.array(designVersionSchema),
    created_at: isoTimestampSchema,
    updated_at: isoTimestampSchema,
    family_approved_at: isoTimestampSchema.nullable(),
    production_locked_at: isoTimestampSchema.nullable(),
    archived_at: isoTimestampSchema.nullable(),
  })
  .strict();

const autosaveEnvelopeSchema = z
  .object({
    draft: designDraftSchema,
    saved_at: isoTimestampSchema,
  })
  .strict();

export type CreateDraftInput = z.input<typeof createDraftInputSchema>;
export type UpdateDraftInput = z.input<typeof updateDraftInputSchema>;
export type CreateVersionInput = z.input<typeof createVersionInputSchema>;
export type DesignVersion = z.infer<typeof designVersionSchema>;
export type DesignDraft = z.infer<typeof designDraftSchema>;

export type AutosaveResult =
  | {
      ok: true;
      mode: "saved" | "recovered";
      draft: DesignDraft;
      storage_key: string;
      saved_at: string;
    }
  | {
      ok: false;
      mode: "rejected";
      storage_key: string;
      message: string;
    };

function cloneDesignDocument(document: DesignDocument): DesignDocument {
  return JSON.parse(JSON.stringify(document)) as DesignDocument;
}

function cloneDraft(draft: DesignDraft): DesignDraft {
  return {
    ...draft,
    design_document: cloneDesignDocument(draft.design_document),
    versions: draft.versions.map((version) => ({
      ...version,
      design_document: cloneDesignDocument(version.design_document),
    })),
  };
}

function assertEditableDraft(draft: DesignDraft): void {
  if (draft.status === "production_locked") {
    throw new Error("Draft is production locked and cannot be edited.");
  }
  if (draft.status === "archived") {
    throw new Error("Archived drafts cannot be edited.");
  }
}

function assertFamilyApprovalAllowed(draft: DesignDraft): void {
  if (draft.versions.length === 0) {
    throw new Error("Family approval requires at least one version.");
  }
}

function assertProductionLockAllowed(draft: DesignDraft): void {
  if (draft.status !== "family_approved" || draft.family_approved_at === null) {
    throw new Error("Production lock requires family approval first.");
  }
}

export function createDraft(input: CreateDraftInput): DesignDraft {
  const parsed = createDraftInputSchema.parse(input);

  return {
    id: parsed.id,
    title: parsed.title,
    status: "draft",
    design_document: parsed.design_document,
    versions: [],
    created_at: parsed.created_at,
    updated_at: parsed.updated_at,
    family_approved_at: null,
    production_locked_at: null,
    archived_at: null,
  };
}

export function updateDraft(
  draft: DesignDraft,
  input: UpdateDraftInput,
): DesignDraft {
  const parsedDraft = designDraftSchema.parse(draft);
  assertEditableDraft(parsedDraft);
  const parsedInput = updateDraftInputSchema.parse(input);

  return {
    ...cloneDraft(parsedDraft),
    title: parsedInput.title ?? parsedDraft.title,
    design_document: parsedInput.design_document ?? parsedDraft.design_document,
    updated_at: parsedInput.updated_at,
  };
}

export function createVersion(
  draft: DesignDraft,
  input: CreateVersionInput,
): { draft: DesignDraft; version: DesignVersion } {
  const parsedDraft = designDraftSchema.parse(draft);
  const parsedInput = createVersionInputSchema.parse(input);
  assertEditableDraft(parsedDraft);

  const version: DesignVersion = {
    id: parsedInput.id,
    draft_id: parsedDraft.id,
    version_number: parsedDraft.versions.length + 1,
    label: parsedInput.label,
    design_document: cloneDesignDocument(parsedDraft.design_document),
    created_at: parsedInput.created_at,
    created_by: parsedInput.created_by,
  };

  return {
    draft: {
      ...cloneDraft(parsedDraft),
      versions: [...parsedDraft.versions, version],
      updated_at: parsedInput.created_at,
    },
    version,
  };
}

export function transitionDraftStatus(
  draft: DesignDraft,
  nextStatus: DraftStatus,
  transitionedAt: string,
): DesignDraft {
  const parsedDraft = designDraftSchema.parse(draft);
  const parsedTransitionedAt = isoTimestampSchema.parse(transitionedAt);

  if (parsedDraft.status === "archived" && nextStatus !== "archived") {
    throw new Error("Archived drafts cannot change status.");
  }
  if (parsedDraft.status === "production_locked" && nextStatus !== "archived") {
    throw new Error("Production locked drafts can only be archived.");
  }

  if (nextStatus === "family_approved") {
    assertFamilyApprovalAllowed(parsedDraft);
  }

  if (nextStatus === "production_locked") {
    assertProductionLockAllowed(parsedDraft);
  }

  return {
    ...cloneDraft(parsedDraft),
    status: nextStatus,
    family_approved_at:
      nextStatus === "family_approved"
        ? parsedTransitionedAt
        : parsedDraft.family_approved_at,
    production_locked_at:
      nextStatus === "production_locked"
        ? parsedTransitionedAt
        : parsedDraft.production_locked_at,
    archived_at:
      nextStatus === "archived" ? parsedTransitionedAt : parsedDraft.archived_at,
    updated_at: parsedTransitionedAt,
  };
}

export function saveDraftAutosave(
  draft: DesignDraft,
  storageKey = "headstone-design-studio:draft-autosave:v1",
  savedAt = new Date().toISOString(),
): AutosaveResult {
  const parsedDraft = designDraftSchema.parse(draft);
  const parsedSavedAt = isoTimestampSchema.parse(savedAt);
  return {
    ok: true,
    mode: "saved",
    storage_key: storageKey,
    saved_at: parsedSavedAt,
    draft: parsedDraft,
  };
}

export function recoverDraftAutosave(
  raw: string | null,
  storageKey = "headstone-design-studio:draft-autosave:v1",
): AutosaveResult {
  if (raw === null) {
    return {
      ok: false,
      mode: "rejected",
      storage_key: storageKey,
      message: "No saved draft was found.",
    };
  }

  try {
    const parsed = autosaveEnvelopeSchema.parse(JSON.parse(raw));
    return {
      ok: true,
      mode: "recovered",
      storage_key: storageKey,
      saved_at: parsed.saved_at,
      draft: parsed.draft,
    };
  } catch {
    return {
      ok: false,
      mode: "rejected",
      storage_key: storageKey,
      message: "We could not restore the saved draft. The last saved copy was not loaded.",
    };
  }
}

export function serializeDraftAutosave(
  draft: DesignDraft,
  savedAt = new Date().toISOString(),
): string {
  const result = saveDraftAutosave(draft, "headstone-design-studio:draft-autosave:v1", savedAt);
  if (!result.ok) {
    throw new Error(result.message);
  }

  return JSON.stringify({
    draft: result.draft,
    saved_at: result.saved_at,
  });
}

export { createDraftInputSchema, updateDraftInputSchema, createVersionInputSchema, designDraftSchema, designVersionSchema };
