import { z } from "zod";

const isoTimestampSchema = z.string().datetime({ offset: true });

export const vendorProductionReviewStatusSchema = z.enum([
  "not_started",
  "in_review",
  "needs_changes",
  "ready_for_production_prep",
  "revoked",
]);

export type VendorProductionReviewStatus = z.infer<typeof vendorProductionReviewStatusSchema>;

export const vendorProductionReviewChecklistKeySchema = z.enum([
  "family_approval_confirmed",
  "name_spelling_checked",
  "birth_date_checked",
  "death_date_checked",
  "epitaph_checked",
  "layout_checked",
  "safe_margins_checked",
  "artwork_checked",
  "material_size_checked",
  "production_method_checked",
  "proof_pdf_checked",
  "understands_not_exported_for_production",
]);

export type VendorProductionReviewChecklistKey = z.infer<typeof vendorProductionReviewChecklistKeySchema>;

const editableVendorProductionReviewStatusSchema = z.enum(["not_started", "in_review", "needs_changes"]);

const vendorProductionReviewChecklistItemSchema = z
  .object({
    key: vendorProductionReviewChecklistKeySchema,
    checked: z.boolean(),
  })
  .strict();

const vendorProductionReviewChecklistSchema = z.array(vendorProductionReviewChecklistItemSchema);

export const vendorProductionReviewSchema = z
  .object({
    id: z.string().min(1),
    versionId: z.string().min(1),
    status: vendorProductionReviewStatusSchema,
    reviewedByLabel: z.string().min(1),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    checklist: vendorProductionReviewChecklistSchema,
    notes: z.string(),
    readyAt: isoTimestampSchema.optional(),
    revokedAt: isoTimestampSchema.optional(),
    revokedReason: z.string().min(1).optional(),
  })
  .strict();

const vendorProductionReviewInputSchema = z
  .object({
    id: z.string().min(1),
    versionId: z.string().min(1),
    status: editableVendorProductionReviewStatusSchema.optional(),
    reviewedByLabel: z.string().min(1),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    checklist: vendorProductionReviewChecklistSchema,
    notes: z.string(),
  })
  .strict();

const updateVendorProductionReviewInputSchema = z
  .object({
    reviewedByLabel: z.string().min(1).optional(),
    updatedAt: isoTimestampSchema,
    checklist: vendorProductionReviewChecklistSchema.optional(),
    notes: z.string().optional(),
    status: editableVendorProductionReviewStatusSchema.optional(),
  })
  .strict();

const revokeVendorProductionReviewInputSchema = z
  .object({
    revokedAt: isoTimestampSchema,
    revokedReason: z.string().min(1),
  })
  .strict();

export interface VendorProductionReviewChecklistItem {
  key: VendorProductionReviewChecklistKey;
  checked: boolean;
}

export interface VendorProductionReview {
  id: string;
  versionId: string;
  status: VendorProductionReviewStatus;
  reviewedByLabel: string;
  createdAt: string;
  updatedAt: string;
  checklist: VendorProductionReviewChecklistItem[];
  notes: string;
  readyAt?: string;
  revokedAt?: string;
  revokedReason?: string;
}

export interface CreateVendorProductionReviewInput {
  id: string;
  versionId: string;
  status?: Exclude<VendorProductionReviewStatus, "ready_for_production_prep" | "revoked">;
  reviewedByLabel: string;
  createdAt: string;
  updatedAt: string;
  checklist: VendorProductionReviewChecklistItem[];
  notes: string;
}

export interface UpdateVendorProductionReviewInput {
  reviewedByLabel?: string;
  updatedAt: string;
  checklist?: VendorProductionReviewChecklistItem[];
  notes?: string;
  status?: Exclude<VendorProductionReviewStatus, "ready_for_production_prep" | "revoked">;
}

export interface RevokeVendorProductionReviewInput {
  revokedAt: string;
  revokedReason: string;
}

const vendorProductionReviewsEnvelopeSchema = z
  .object({
    reviews: z.array(
      vendorProductionReviewSchema,
    ),
    saved_at: isoTimestampSchema,
  })
  .strict();

export type VendorProductionReviewsEnvelope = z.infer<typeof vendorProductionReviewsEnvelopeSchema>;

const checklistOrder = vendorProductionReviewChecklistKeySchema.options;

function normalizeChecklistItems(items: readonly VendorProductionReviewChecklistItem[]): VendorProductionReviewChecklistItem[] {
  const parsedItems = vendorProductionReviewChecklistSchema.parse(items) as VendorProductionReviewChecklistItem[];
  const uniqueKeys = new Set(parsedItems.map((item) => item.key));

  if (parsedItems.length !== checklistOrder.length || uniqueKeys.size !== checklistOrder.length) {
    throw new Error("Vendor review checklist must include every required item exactly once.");
  }

  return checklistOrder.map((key) => {
    const item = parsedItems.find((entry) => entry.key === key);
    if (!item) {
      throw new Error("Vendor review checklist must include every required item exactly once.");
    }

    return {
      key: item.key,
      checked: item.checked,
    };
  });
}

function buildVendorProductionReview(review: {
  id: string;
  versionId: string;
  status: VendorProductionReviewStatus;
  reviewedByLabel: string;
  createdAt: string;
  updatedAt: string;
  checklist: VendorProductionReviewChecklistItem[];
  notes: string;
  readyAt: string | undefined;
  revokedAt: string | undefined;
  revokedReason: string | undefined;
}): VendorProductionReview {
  const result: VendorProductionReview = {
    id: review.id,
    versionId: review.versionId,
    status: review.status,
    reviewedByLabel: review.reviewedByLabel,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    checklist: review.checklist.map((item) => ({
      key: item.key,
      checked: item.checked,
    })),
    notes: review.notes,
  };

  if (review.readyAt !== undefined) {
    result.readyAt = review.readyAt;
  }

  if (review.revokedAt !== undefined) {
    result.revokedAt = review.revokedAt;
  }

  if (review.revokedReason !== undefined) {
    result.revokedReason = review.revokedReason;
  }

  return result;
}

function parseVendorProductionReview(review: unknown): VendorProductionReview {
  const parsed = vendorProductionReviewSchema.parse(review);

  return buildVendorProductionReview({
    id: parsed.id,
    versionId: parsed.versionId,
    status: parsed.status,
    reviewedByLabel: parsed.reviewedByLabel,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    checklist: normalizeChecklistItems(parsed.checklist),
    notes: parsed.notes,
    readyAt: parsed.readyAt,
    revokedAt: parsed.revokedAt,
    revokedReason: parsed.revokedReason,
  });
}

function isAllChecklistChecked(checklist: readonly VendorProductionReviewChecklistItem[]): boolean {
  return checklist.every((item) => item.checked);
}

export function createVendorProductionReview(input: CreateVendorProductionReviewInput): VendorProductionReview {
  const parsed = vendorProductionReviewInputSchema.parse(input);
  const checklist = normalizeChecklistItems(parsed.checklist);

  return buildVendorProductionReview({
    id: parsed.id,
    versionId: parsed.versionId,
    status: parsed.status ?? "not_started",
    reviewedByLabel: parsed.reviewedByLabel,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    checklist,
    notes: parsed.notes,
    readyAt: undefined,
    revokedAt: undefined,
    revokedReason: undefined,
  });
}

export function updateVendorProductionReview(
  review: VendorProductionReview,
  input: UpdateVendorProductionReviewInput,
): VendorProductionReview {
  const parsedReview = parseVendorProductionReview(review);
  const parsedInput = updateVendorProductionReviewInputSchema.parse(input);

  return buildVendorProductionReview({
    id: parsedReview.id,
    versionId: parsedReview.versionId,
    status: parsedInput.status ?? parsedReview.status,
    reviewedByLabel: parsedInput.reviewedByLabel ?? parsedReview.reviewedByLabel,
    createdAt: parsedReview.createdAt,
    updatedAt: parsedInput.updatedAt,
    checklist: parsedInput.checklist ? normalizeChecklistItems(parsedInput.checklist) : parsedReview.checklist,
    notes: parsedInput.notes ?? parsedReview.notes,
    readyAt: parsedReview.readyAt,
    revokedAt: parsedReview.revokedAt,
    revokedReason: parsedReview.revokedReason,
  });
}

export function markVendorReviewReady(review: VendorProductionReview, updatedAt: string): VendorProductionReview {
  const parsedReview = parseVendorProductionReview(review);
  const parsedUpdatedAt = isoTimestampSchema.parse(updatedAt);

  if (parsedReview.status === "revoked") {
    throw new Error("Revoked vendor reviews cannot be marked ready.");
  }

  if (!isAllChecklistChecked(parsedReview.checklist)) {
    throw new Error("Vendor review can be marked ready only after every checklist item is checked.");
  }

  return buildVendorProductionReview({
    id: parsedReview.id,
    versionId: parsedReview.versionId,
    status: "ready_for_production_prep",
    reviewedByLabel: parsedReview.reviewedByLabel,
    createdAt: parsedReview.createdAt,
    updatedAt: parsedUpdatedAt,
    checklist: parsedReview.checklist,
    notes: parsedReview.notes,
    readyAt: parsedUpdatedAt,
    revokedAt: parsedReview.revokedAt,
    revokedReason: parsedReview.revokedReason,
  });
}

export function revokeVendorProductionReview(
  review: VendorProductionReview,
  input: RevokeVendorProductionReviewInput,
): VendorProductionReview {
  const parsedReview = parseVendorProductionReview(review);
  const parsedInput = revokeVendorProductionReviewInputSchema.parse(input);

  return buildVendorProductionReview({
    id: parsedReview.id,
    versionId: parsedReview.versionId,
    status: "revoked",
    reviewedByLabel: parsedReview.reviewedByLabel,
    createdAt: parsedReview.createdAt,
    updatedAt: parsedInput.revokedAt,
    checklist: parsedReview.checklist,
    notes: parsedReview.notes,
    readyAt: parsedReview.readyAt,
    revokedAt: parsedInput.revokedAt,
    revokedReason: parsedInput.revokedReason,
  });
}

export function isVendorReviewReady(review: VendorProductionReview): boolean {
  const parsedReview = parseVendorProductionReview(review);
  return parsedReview.status === "ready_for_production_prep" && isAllChecklistChecked(parsedReview.checklist);
}

export function listVendorReviewsForVersion(
  reviews: readonly VendorProductionReview[],
  versionId: string,
): VendorProductionReview[] {
  const parsedVersionId = z.string().min(1).parse(versionId);
  return reviews.filter((review) => review.versionId === parsedVersionId);
}

export function getLatestVendorReviewForVersion(
  reviews: readonly VendorProductionReview[],
  versionId: string,
): VendorProductionReview | null {
  const versionReviews = listVendorReviewsForVersion(reviews, versionId);

  if (versionReviews.length === 0) {
    return null;
  }

  return [...versionReviews].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return left.updatedAt < right.updatedAt ? 1 : -1;
    }

    if (left.createdAt !== right.createdAt) {
      return left.createdAt < right.createdAt ? 1 : -1;
    }

    return left.id < right.id ? 1 : -1;
  })[0] ?? null;
}

export function serializeVendorProductionReviews(
  reviews: readonly VendorProductionReview[],
  savedAt = new Date().toISOString(),
): string {
  const parsedReviews = z.array(vendorProductionReviewSchema).parse(reviews).map((review) => parseVendorProductionReview(review));
  const parsedSavedAt = isoTimestampSchema.parse(savedAt);

  return JSON.stringify({
    reviews: parsedReviews,
    saved_at: parsedSavedAt,
  });
}

export function recoverVendorProductionReviews(
  raw: string | null,
  storageKey = "headstone-design-studio:vendor-production-reviews:v1",
): { ok: true; reviews: VendorProductionReview[]; storage_key: string } | { ok: false; storage_key: string; message: string } {
  if (raw === null) {
    return {
      ok: false,
      storage_key: storageKey,
      message: "No saved vendor reviews were found.",
    };
  }

  try {
    const parsed = vendorProductionReviewsEnvelopeSchema.parse(JSON.parse(raw));
    return {
      ok: true,
      storage_key: storageKey,
      reviews: parsed.reviews.map((review) => parseVendorProductionReview(review as VendorProductionReview)),
    };
  } catch {
    return {
      ok: false,
      storage_key: storageKey,
      message: "We could not restore the saved vendor reviews. The draft was left unchanged.",
    };
  }
}
