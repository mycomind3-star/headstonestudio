import { describe, expect, it } from "vitest";
import {
  createDraft,
  createVersion,
  recoverDraftAutosave,
  transitionDraftStatus,
  updateDraft,
} from "./index";
import { designDocumentFixtures } from "@headstone/schema";

const baseNow = "2026-07-09T22:00:00.000Z";
const firstFixture = designDocumentFixtures[0]!;
const secondFixture = designDocumentFixtures[1]!;

function makeDraft() {
  return createDraft({
    id: "draft_1",
    title: "Holloway memorial",
    design_document: firstFixture,
    created_at: baseNow,
    updated_at: baseNow,
  });
}

describe("core domain", () => {
  it("creates a draft with a valid design document", () => {
    const draft = makeDraft();
    expect(draft.status).toBe("draft");
    expect(draft.design_document.face.shape).toBe("serpentine_top");
  });

  it("rejects invalid design documents when creating a draft", () => {
    const invalidDocument = {
      ...firstFixture,
      unknown: true,
    } as any;

    expect(() =>
      createDraft({
        id: "draft_bad",
        title: "Broken memorial",
        design_document: invalidDocument,
        created_at: baseNow,
        updated_at: baseNow,
      } as Parameters<typeof createDraft>[0]),
    ).toThrow();
  });

  it("updates a draft into a new valid working state", () => {
    const draft = makeDraft();
    const updated = updateDraft(draft, {
      title: "Holloway memorial v2",
      design_document: secondFixture,
      updated_at: "2026-07-09T22:01:00.000Z",
    });

    expect(updated.title).toBe("Holloway memorial v2");
    expect(updated.design_document.face.shape).toBe("flat_grass_marker");
    expect(updated.status).toBe("draft");
  });

  it("snapshots the design document when creating a version", () => {
    const draft = makeDraft();
    const result = createVersion(draft, {
      id: "version_1",
      label: "Initial review",
      created_at: "2026-07-09T22:02:00.000Z",
      created_by: "user_1",
    });

    expect(result.version.version_number).toBe(1);
    expect(result.version.design_document).toEqual(draft.design_document);
    expect(result.draft.versions).toHaveLength(1);
  });

  it("prevents editing once production is locked", () => {
    const reviewed = createVersion(makeDraft(), {
      id: "version_1",
      label: "Approved draft",
      created_at: "2026-07-09T22:02:00.000Z",
      created_by: "user_1",
    }).draft;
    const approved = transitionDraftStatus(
      reviewed,
      "family_approved",
      "2026-07-09T22:03:00.000Z",
    );
    const locked = transitionDraftStatus(
      approved,
      "production_locked",
      "2026-07-09T22:04:00.000Z",
    );

    expect(() =>
      updateDraft(locked, {
        title: "Should fail",
        updated_at: "2026-07-09T22:05:00.000Z",
      }),
    ).toThrow(/production locked/i);
  });

  it("requires at least one version before family approval", () => {
    expect(() =>
      transitionDraftStatus(makeDraft(), "family_approved", "2026-07-09T22:03:00.000Z"),
    ).toThrow(/at least one version/i);
  });

  it("requires family approval before production lock", () => {
    const withVersion = createVersion(makeDraft(), {
      id: "version_1",
      label: "Initial review",
      created_at: "2026-07-09T22:02:00.000Z",
      created_by: "user_1",
    }).draft;

    expect(() =>
      transitionDraftStatus(
        withVersion,
        "production_locked",
        "2026-07-09T22:04:00.000Z",
      ),
    ).toThrow(/family approval/i);
  });

  it("rejects invalid localStorage recovery", () => {
    const invalidJson = recoverDraftAutosave("not valid json");
    expect(invalidJson.ok).toBe(false);
    if (!invalidJson.ok) {
      expect(invalidJson.message).toMatch(/could not restore/i);
    }
  });
});
