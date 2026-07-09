import { describe, expect, it } from "vitest";
import {
  analyzeApprovalReadiness,
  analyzeCompleteness,
  analyzeDesignDraft,
  analyzeProductionReadiness,
  createGentleWordingSuggestions,
  suggestNextActions,
} from "./index";
import {
  createDraft,
  createVersion,
  transitionDraftStatus,
} from "@headstone/core";
import { designDocumentFixtures, type DesignDocument } from "@headstone/schema";

const baseNow = "2026-07-09T22:00:00.000Z";
const validDocument = designDocumentFixtures[0]!;
const secondDocument = designDocumentFixtures[1]!;

function makeDraft(document: DesignDocument = validDocument) {
  return createDraft({
    id: "draft_agent_1",
    title: "Agent memorial",
    design_document: document,
    created_at: baseNow,
    updated_at: baseNow,
  });
}

function makeApprovedDraft() {
  const draft = createVersion(makeDraft(), {
    id: "version_1",
    label: "Family review",
    created_at: "2026-07-09T22:01:00.000Z",
    created_by: "user_1",
  }).draft;

  return transitionDraftStatus(draft, "family_approved", "2026-07-09T22:02:00.000Z");
}

function makeVendorReviewedDraft() {
  const familyApproved = makeApprovedDraft();
  return transitionDraftStatus(familyApproved, "vendor_review", "2026-07-09T22:03:00.000Z");
}

describe("agent", () => {
  it("returns useful guidance for a valid draft", () => {
    const response = analyzeDesignDraft({
      mode: "family_guidance",
      draft: makeDraft(),
    });

    expect(response.findings.length).toBeGreaterThan(0);
    expect(response.suggested_actions.length).toBeGreaterThan(0);
    expect(response.summary.length).toBeGreaterThan(0);
  });

  it("returns a blocker for an invalid draft", () => {
    const response = analyzeDesignDraft({
      mode: "family_guidance",
      draft: { not_a_draft: true },
    });

    expect(response.findings[0]?.severity).toBe("blocker");
  });

  it("detects a missing name", () => {
    const noNameDocument: DesignDocument = {
      ...validDocument,
      elements: validDocument.elements.filter((element) => element.type !== "text" || element.field !== "name"),
    };

    const findings = analyzeCompleteness({
      mode: "family_guidance",
      draft: makeDraft(noNameDocument),
    });

    expect(findings.some((finding) => finding.id === "missing-name")).toBe(true);
  });

  it("detects missing dates", () => {
    const noDatesDocument: DesignDocument = {
      ...secondDocument,
      elements: secondDocument.elements.filter((element) => element.type !== "text" || element.field !== "dates"),
    };

    const findings = analyzeCompleteness({
      mode: "family_guidance",
      draft: makeDraft(noDatesDocument),
    });

    expect(findings.some((finding) => finding.id === "missing-birth-date")).toBe(true);
    expect(findings.some((finding) => finding.id === "missing-death-date")).toBe(true);
  });

  it("returns a warning for a long epitaph", () => {
    const longEpitaphDocument: DesignDocument = {
      ...validDocument,
      elements: [
        ...validDocument.elements,
        {
          id: "el_epitaph",
          type: "text",
          field: "epitaph",
          content:
            "A long epitaph that keeps going and going and going and includes more than one hundred and twenty characters so it should be flagged for review.",
          font: "memorial_script_1",
          size_in: 0.72,
          x_in: 12,
          y_in: 8.2,
          rotation_deg: 0,
          align: "center",
          direction: "auto",
        },
      ],
    };

    const findings = analyzeCompleteness({
      mode: "family_guidance",
      draft: makeDraft(longEpitaphDocument),
    });

    expect(findings.some((finding) => finding.id === "long-epitaph")).toBe(true);
  });

  it("blocks production readiness before family approval", () => {
    const findings = analyzeProductionReadiness({
      mode: "production_review",
      draft: makeDraft(),
    });

    expect(findings.some((finding) => finding.id === "needs-family-approval")).toBe(true);
  });

  it("blocks production readiness before vendor review", () => {
    const findings = analyzeProductionReadiness({
      mode: "production_review",
      draft: makeApprovedDraft(),
    });

    expect(findings.some((finding) => finding.id === "needs-vendor-review")).toBe(true);
  });

  it("does not suggest editing a locked draft", () => {
    const lockedDraft = transitionDraftStatus(
      makeApprovedDraft(),
      "production_locked",
      "2026-07-09T22:04:00.000Z",
    );

    const actions = suggestNextActions({
      mode: "production_review",
      draft: lockedDraft,
    });

    expect(actions.some((action) => /edit/i.test(action.label) || /edit/i.test(action.description))).toBe(false);
  });

  it("does not mutate input", () => {
    const draft = makeDraft();
    const before = JSON.stringify(draft);

    analyzeDesignDraft({
      mode: "family_guidance",
      draft,
    });

    expect(JSON.stringify(draft)).toBe(before);
  });

  it("keeps wording suggestions calm and non-salesy", () => {
    const advice = createGentleWordingSuggestions({
      mode: "wording_help",
      draft: makeDraft(),
    });

    const text = advice.map((item) => `${item.title} ${item.message}`).join(" ");
    expect(text).not.toMatch(/buy|sale|limited|offer|upgrade|urgent/i);
  });
});
