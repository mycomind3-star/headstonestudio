import { describe, expect, it } from "vitest";
import { createDraft, createVersion } from "@headstone/core";
import { designDocumentFixtures } from "@headstone/schema";
import { renderDesignDocumentToSvg } from "@headstone/render";
import { createProofDocument, createProofFileName, createProofTranscript } from "./proof";

function createDocumentWithText(content: string) {
  const fixture = JSON.parse(JSON.stringify(designDocumentFixtures[0]!));
  const nameElement = fixture.elements.find((element: { type: string; field?: string }) => element.type === "text" && element.field === "name");
  const datesElement = fixture.elements.find((element: { type: string; field?: string }) => element.type === "text" && element.field === "dates");
  const epitaphElement = fixture.elements.find((element: { type: string; field?: string }) => element.type === "text" && element.field === "epitaph");

  if (nameElement) {
    nameElement.content = content;
  }
  if (datesElement) {
    datesElement.content = "1947 - 2026";
  }
  if (epitaphElement) {
    epitaphElement.content = "Beloved mother";
  } else {
    fixture.elements.push({
      id: "el_epitaph",
      type: "text",
      field: "epitaph",
      content: "Beloved mother",
      font: "memorial_script_1",
      size_in: 0.75,
      x_in: 12,
      y_in: 6.6,
      rotation_deg: 0,
      align: "center",
      direction: "auto",
    });
  }

  return fixture;
}

function buildProofVersion() {
  const designDocument = createDocumentWithText("Margaret A. Holloway");
  const draft = createDraft({
    id: "draft_1",
    title: "Serpentine memorial",
    design_document: designDocument,
    created_at: "2026-07-10T19:00:00.000Z",
    updated_at: "2026-07-10T19:00:00.000Z",
  });

  return createVersion(draft, {
    id: "version_1",
    label: "Proof v1",
    created_at: "2026-07-10T20:00:00.000Z",
    created_by: "local_editor",
  }).version;
}

describe("proof documents", () => {
  it("uses the selected proof version snapshot and rejects mismatched drafts", () => {
    const proofVersion = buildProofVersion();
    const workingDraftDocument = createDocumentWithText("Changed name");

    expect(() =>
      createProofDocument({
        proofVersion,
        designDocument: workingDraftDocument,
        renderedSvg: renderDesignDocumentToSvg(workingDraftDocument),
        createdAt: "2026-07-10T21:00:00.000Z",
        createdByLabel: "Staff",
      }),
    ).toThrow(/snapshot/i);
  });

  it("includes the memorial text transcript", () => {
    const proofVersion = buildProofVersion();
    const proof = createProofDocument({
      proofVersion,
      designDocument: proofVersion.design_document,
      renderedSvg: renderDesignDocumentToSvg(proofVersion.design_document),
      createdAt: "2026-07-10T21:00:00.000Z",
      createdByLabel: "Staff",
    });

    const transcript = createProofTranscript(proof);

    expect(transcript).toContain("Name: Margaret A. Holloway");
    expect(transcript).toContain("Birth date: 1947");
    expect(transcript).toContain("Death date: 2026");
    expect(transcript).toContain("Epitaph: Beloved mother");
  });

  it("always includes proof warnings", () => {
    const proofVersion = buildProofVersion();
    const proof = createProofDocument({
      proofVersion,
      designDocument: proofVersion.design_document,
      renderedSvg: renderDesignDocumentToSvg(proofVersion.design_document),
      createdAt: "2026-07-10T21:00:00.000Z",
      createdByLabel: "Staff",
    });

    expect(proof.warnings.map((warning) => warning.message)).toEqual(
      expect.arrayContaining([
        "Proof only — not production-ready.",
        "Family approval does not replace vendor production review.",
        "Names, dates, spelling, layout, and artwork should be reviewed carefully before production.",
      ]),
    );
  });

  it("produces a deterministic safe file name", () => {
    const proofVersion = buildProofVersion();
    const proof = createProofDocument({
      proofVersion,
      designDocument: proofVersion.design_document,
      renderedSvg: renderDesignDocumentToSvg(proofVersion.design_document),
      createdAt: "2026-07-10T21:00:00.000Z",
      createdByLabel: "Staff",
    });

    expect(createProofFileName(proof)).toBe("proof-margaret-a-holloway-version_1.pdf");
  });

  it("does not mutate its inputs", () => {
    const proofVersion = buildProofVersion();
    const designDocumentBefore = JSON.stringify(proofVersion.design_document);
    const versionBefore = JSON.stringify(proofVersion);

    createProofDocument({
      proofVersion,
      designDocument: proofVersion.design_document,
      renderedSvg: renderDesignDocumentToSvg(proofVersion.design_document),
      createdAt: "2026-07-10T21:00:00.000Z",
      createdByLabel: "Staff",
    });

    expect(JSON.stringify(proofVersion.design_document)).toBe(designDocumentBefore);
    expect(JSON.stringify(proofVersion)).toBe(versionBefore);
  });

  it("rejects invalid design documents", () => {
    const proofVersion = buildProofVersion();
    const invalidDesignDocument = {
      ...proofVersion.design_document,
      face: {
        ...proofVersion.design_document.face,
        width: 0,
      },
    };

    expect(() =>
      createProofDocument({
        proofVersion,
        designDocument: invalidDesignDocument,
        renderedSvg: renderDesignDocumentToSvg(proofVersion.design_document),
        createdAt: "2026-07-10T21:00:00.000Z",
        createdByLabel: "Staff",
      } as never),
    ).toThrow();
  });
});
