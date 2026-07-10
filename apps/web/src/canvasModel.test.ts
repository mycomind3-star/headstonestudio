import { describe, expect, it } from "vitest";
import { createDraft, createVersion } from "@headstone/core";
import { designDocumentFixtures, type DesignDocument } from "@headstone/schema";
import {
  getCanvasElementDescriptor,
  isCanvasElementOutsideSafeArea,
  moveCanvasElement,
  setCanvasElementPosition,
  updateEditableDocumentFields,
} from "./canvasModel";

function getTextElement(document: DesignDocument, elementId: string) {
  return document.elements.find(
    (element): element is Extract<(typeof document.elements)[number], { type: "text" }> =>
      element.type === "text" && element.id === elementId,
  );
}

describe("canvasModel", () => {
  it("moves only the selected element and preserves the original document", () => {
    const draft = createDraft({
      id: "draft-canvas-001",
      title: "Canvas test",
      design_document: designDocumentFixtures[0]!,
      created_at: "2026-07-10T18:00:00.000Z",
      updated_at: "2026-07-10T18:00:00.000Z",
    });
    const original = JSON.parse(JSON.stringify(draft.design_document));

    const moved = moveCanvasElement(draft.design_document, "el_name", 0.5, 0.25);

    expect(moved).not.toBe(draft.design_document);
    expect(moved.elements.find((element) => element.id === "el_name")?.x_in).toBeCloseTo(12.5);
    expect(moved.elements.find((element) => element.id === "el_dates")?.x_in).toBe(
      draft.design_document.elements.find((element) => element.id === "el_dates")?.x_in,
    );
    expect(draft.design_document).toEqual(original);
  });

  it("keeps moved layouts valid and updates only the target element position", () => {
    const document = designDocumentFixtures[1]!;
    const moved = setCanvasElementPosition(document, "el_name", 13, 3.5);

    expect(moved.face).toEqual(document.face);
    expect(moved.elements.find((element) => element.id === "el_name")?.x_in).toBeCloseTo(11.8675);
    expect(moved.elements.find((element) => element.id === "el_etch")?.x_in).toBe(
      document.elements.find((element) => element.id === "el_etch")?.x_in,
    );
  });

  it("preserves old proof snapshots after later movement", () => {
    const draft = createDraft({
      id: "draft-canvas-002",
      title: "Canvas test",
      design_document: designDocumentFixtures[0]!,
      created_at: "2026-07-10T18:00:00.000Z",
      updated_at: "2026-07-10T18:00:00.000Z",
    });
    const { draft: versionedDraft, version } = createVersion(draft, {
      id: "version-canvas-001",
      label: "Proof v1",
      created_at: "2026-07-10T18:05:00.000Z",
      created_by: "local_editor",
    });
    const movedDraft = moveCanvasElement(versionedDraft.design_document, "el_name", 0.5, 0.25);

    expect(getTextElement(version.design_document, "el_name")?.content).toBe("MARGARET A. HOLLOWAY");
    expect(movedDraft.elements.find((element) => element.id === "el_name")?.x_in).toBeCloseTo(12.5);
    expect(getTextElement(version.design_document, "el_name")?.x_in).toBeCloseTo(12);
  });

  it("detects when an element is outside the safe area", () => {
    const descriptor = getCanvasElementDescriptor(designDocumentFixtures[0]!, "el_name");
    expect(descriptor).not.toBeNull();
    const moved = setCanvasElementPosition(designDocumentFixtures[0]!, "el_name", 1, 1);
    expect(isCanvasElementOutsideSafeArea(moved, "el_name")).toBe(true);
  });

  it("keeps editable field updates valid after movement", () => {
    const moved = moveCanvasElement(designDocumentFixtures[0]!, "el_name", 0.4, 0.2);
    const updated = updateEditableDocumentFields(moved, {
      name: "MARGARET A. HOLLOWAY",
      birth_date: "1947",
      death_date: "2026",
      epitaph: "Beloved Mother",
    });

    expect(updated.elements.find((element) => element.id === "el_name")?.x_in).toBeCloseTo(
      moved.elements.find((element) => element.id === "el_name")?.x_in ?? 0,
    );
    expect(getTextElement(updated, "el_name")?.content).toBe("MARGARET A. HOLLOWAY");
  });
});
