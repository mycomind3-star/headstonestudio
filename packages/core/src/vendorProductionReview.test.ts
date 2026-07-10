import { describe, expect, it } from "vitest";
import {
  createVendorProductionReview,
  getLatestVendorReviewForVersion,
  isVendorReviewReady,
  listVendorReviewsForVersion,
  markVendorReviewReady,
  recoverVendorProductionReviews,
  revokeVendorProductionReview,
  serializeVendorProductionReviews,
  updateVendorProductionReview,
  vendorProductionReviewChecklistKeySchema,
} from "./index";

const baseNow = "2026-07-09T22:00:00.000Z";
const nextNow = "2026-07-09T22:05:00.000Z";
const checklistKeys = vendorProductionReviewChecklistKeySchema.options;

function createChecklist(checked: boolean) {
  return checklistKeys.map((key) => ({
    key,
    checked,
  }));
}

function createReview(overrides: Partial<Parameters<typeof createVendorProductionReview>[0]> = {}) {
  return createVendorProductionReview({
    id: "vendor_review_1",
    versionId: "version_1",
    reviewedByLabel: "Staff",
    createdAt: baseNow,
    updatedAt: baseNow,
    checklist: createChecklist(false),
    notes: "Check the proof carefully.",
    ...overrides,
  });
}

describe("vendor production review", () => {
  it("creates a valid vendor review", () => {
    const review = createReview();

    expect(review.status).toBe("not_started");
    expect(review.checklist).toHaveLength(checklistKeys.length);
    expect(review.reviewedByLabel).toBe("Staff");
  });

  it("rejects a missing versionId", () => {
    expect(() =>
      createVendorProductionReview({
        id: "vendor_review_bad",
        versionId: "",
        reviewedByLabel: "Staff",
        createdAt: baseNow,
        updatedAt: baseNow,
        checklist: createChecklist(false),
        notes: "",
      }),
    ).toThrow();
  });

  it("rejects an empty reviewer label", () => {
    expect(() =>
      createVendorProductionReview({
        id: "vendor_review_bad",
        versionId: "version_1",
        reviewedByLabel: "",
        createdAt: baseNow,
        updatedAt: baseNow,
        checklist: createChecklist(false),
        notes: "",
      }),
    ).toThrow();
  });

  it("rejects an incomplete checklist", () => {
    expect(() =>
      createVendorProductionReview({
        id: "vendor_review_bad",
        versionId: "version_1",
        reviewedByLabel: "Staff",
        createdAt: baseNow,
        updatedAt: baseNow,
        checklist: createChecklist(false).slice(0, -1),
        notes: "",
      }),
    ).toThrow(/every required item/i);
  });

  it("rejects unknown fields", () => {
    expect(() =>
      createVendorProductionReview({
        id: "vendor_review_bad",
        versionId: "version_1",
        reviewedByLabel: "Staff",
        createdAt: baseNow,
        updatedAt: baseNow,
        checklist: createChecklist(false),
        notes: "",
        unexpected: true,
      } as any),
    ).toThrow();
  });

  it("marks ready only when every checklist item is checked", () => {
    const incomplete = createReview();
    expect(() => markVendorReviewReady(incomplete, nextNow)).toThrow(/every checklist item/i);

    const complete = createReview({ checklist: createChecklist(true) });
    const ready = markVendorReviewReady(complete, nextNow);

    expect(ready.status).toBe("ready_for_production_prep");
    expect(ready.readyAt).toBe(nextNow);
    expect(isVendorReviewReady(ready)).toBe(true);
  });

  it("revokes a review only with a reason", () => {
    const review = createReview({ checklist: createChecklist(true) });
    expect(() =>
      revokeVendorProductionReview(review, {
        revokedAt: nextNow,
        revokedReason: "",
      }),
    ).toThrow(/reason/i);
  });

  it("treats revoked reviews as not ready", () => {
    const review = createReview({ checklist: createChecklist(true) });
    const ready = markVendorReviewReady(review, nextNow);
    const revoked = revokeVendorProductionReview(ready, {
      revokedAt: "2026-07-09T22:10:00.000Z",
      revokedReason: "Need to revisit the proof snapshot.",
    });

    expect(revoked.status).toBe("revoked");
    expect(isVendorReviewReady(revoked)).toBe(false);
  });

  it("does not mutate the original review when updating or revoking", () => {
    const review = createReview({ checklist: createChecklist(true) });
    const updated = updateVendorProductionReview(review, {
      updatedAt: nextNow,
      notes: "Updated notes",
      reviewedByLabel: "Local reviewer",
      status: "in_review",
    });
    const revoked = revokeVendorProductionReview(review, {
      revokedAt: "2026-07-09T22:10:00.000Z",
      revokedReason: "Incorrect version selected.",
    });

    expect(review.updatedAt).toBe(baseNow);
    expect(review.status).toBe("not_started");
    expect(review.notes).toBe("Check the proof carefully.");
    expect(updated.updatedAt).toBe(nextNow);
    expect(updated.reviewedByLabel).toBe("Local reviewer");
    expect(revoked.status).toBe("revoked");
    expect(review.status).toBe("not_started");
  });

  it("filters reviews by version and returns the latest one", () => {
    const otherReview = createReview({
      id: "vendor_review_2",
      versionId: "version_2",
      createdAt: "2026-07-09T22:01:00.000Z",
      updatedAt: "2026-07-09T22:01:00.000Z",
    });
    const olderReview = createReview({
      id: "vendor_review_0",
      createdAt: "2026-07-09T21:59:00.000Z",
      updatedAt: "2026-07-09T21:59:00.000Z",
    });
    const newerReview = updateVendorProductionReview(olderReview, {
      updatedAt: nextNow,
      notes: "Newer review notes",
    });

    const reviews = [otherReview, olderReview, newerReview];

    expect(listVendorReviewsForVersion(reviews, "version_1")).toHaveLength(2);
    expect(listVendorReviewsForVersion(reviews, "version_2")).toHaveLength(1);
    expect(getLatestVendorReviewForVersion(reviews, "version_1")?.updatedAt).toBe(nextNow);
  });

  it("serializes and rejects invalid recovery safely", () => {
    const serialized = serializeVendorProductionReviews([createReview({ checklist: createChecklist(true) })], baseNow);

    expect(serialized).toContain("vendor_review_1");

    const invalid = recoverVendorProductionReviews("not valid json");
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.message).toMatch(/could not restore/i);
    }
  });
});
