import { describe, expect, it } from "vitest";
import { createDraft, createVersion, updateDraft } from "@headstone/core";
import { designDocumentFixtures } from "@headstone/schema";
import { renderDesignDocumentToSvg } from "@headstone/render";
import { createExportFileName, createExportManifest, createSvgExportCandidate } from "./export";

function createProofSnapshot() {
  const now = "2026-07-10T18:00:00.000Z";
  const fixture = designDocumentFixtures[0]!;
  const draft = createDraft({
    id: "draft_export_001",
    title: "Export test",
    design_document: fixture,
    created_at: now,
    updated_at: now,
  });
  const { draft: nextDraft, version } = createVersion(draft, {
    id: "version_export_001",
    label: "Proof v1",
    created_at: now,
    created_by: "local_editor",
  });

  return {
    draft: nextDraft,
    version,
    renderedSvg: renderDesignDocumentToSvg(version.design_document),
  };
}

describe("createSvgExportCandidate", () => {
  it("exports the selected proof version snapshot, not later draft edits", () => {
    const { draft, version, renderedSvg } = createProofSnapshot();
    const input = {
      selectedProofVersion: version,
      designDocument: version.design_document,
      renderedSvg,
      createdAt: "2026-07-10T18:05:00.000Z",
      createdByLabel: "Staff",
    } as const;

    const candidate = createSvgExportCandidate(input);
    const updatedDraft = updateDraft(draft, {
      title: "Changed after export",
      design_document: {
        ...draft.design_document,
        elements: draft.design_document.elements.map((element) =>
          element.type === "text" && element.field === "name"
            ? { ...element, content: "UPDATED NAME" }
            : element,
        ),
      },
      updated_at: "2026-07-10T18:06:00.000Z",
    });

    expect(updatedDraft.design_document.elements[0]).not.toEqual(version.design_document.elements[0]);
    expect(candidate.files.find((file) => file.name === "design-document.json")?.content).toContain(
      "MARGARET A. HOLLOWAY",
    );
    expect(candidate.files.find((file) => file.name === "design-document.json")?.content).not.toContain(
      "UPDATED NAME",
    );
  });

  it("includes the SVG candidate, design document JSON, transcript, manifest, and warnings", () => {
    const { version, renderedSvg } = createProofSnapshot();
    const candidate = createSvgExportCandidate({
      selectedProofVersion: version,
      designDocument: version.design_document,
      renderedSvg,
      createdAt: "2026-07-10T18:05:00.000Z",
      createdByLabel: "Staff",
      familyApprovalSummary: "1 active family approval",
      vendorReviewSummary: "1 active vendor review",
    });

    expect(candidate.files.map((file) => file.name)).toEqual([
      "memorial-design-candidate.svg",
      "design-document.json",
      "manifest.json",
      "transcript.txt",
      "warnings.txt",
    ]);
    expect(candidate.files[0]?.downloadName).toMatch(/^memorial-design-candidate-/);
    expect(candidate.manifest).toContain('"export_type": "local_svg_candidate"');
    expect(candidate.transcript).toContain("MARGARET A. HOLLOWAY");
    expect(candidate.warnings).toHaveLength(4);
  });

  it("creates deterministic and filesystem-safe file names", () => {
    const { version, renderedSvg } = createProofSnapshot();
    const input = {
      selectedProofVersion: version,
      designDocument: version.design_document,
      renderedSvg,
      createdAt: "2026-07-10T18:05:00.000Z",
      createdByLabel: "Staff",
    } as const;

    const first = createExportFileName(input);
    const second = createExportFileName(input);

    expect(first).toBe(second);
    expect(first).toMatch(/^memorial-design-candidate-[a-z0-9-]+-[a-z0-9-]+\.svg$/);
    expect(first).not.toContain(" ");
    expect(first).not.toContain("/");
  });

  it("rejects invalid design documents and does not mutate inputs", () => {
    const { version, renderedSvg } = createProofSnapshot();
    const input = {
      selectedProofVersion: version,
      designDocument: version.design_document,
      renderedSvg,
      createdAt: "2026-07-10T18:05:00.000Z",
      createdByLabel: "Staff",
    };
    const snapshot = JSON.parse(JSON.stringify(input));

    expect(() => {
      createSvgExportCandidate({
        ...input,
        designDocument: {
          ...version.design_document,
          elements: [],
        },
      });
    }).toThrow();

    expect(input).toEqual(snapshot);
  });

  it("exports a manifest from the same selected proof version snapshot", () => {
    const { version, renderedSvg } = createProofSnapshot();
    const manifest = createExportManifest({
      selectedProofVersion: version,
      designDocument: version.design_document,
      renderedSvg,
      createdAt: "2026-07-10T18:05:00.000Z",
      createdByLabel: "Staff",
    });

    expect(manifest).toContain("\"proof_version\"");
    expect(manifest).toContain("MARGARET A. HOLLOWAY");
  });
});
