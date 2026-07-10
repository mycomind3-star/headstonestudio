import { describe, expect, it } from "vitest";
import {
  compareDesignDocuments,
  compareDesignVersions,
  compareDraftToLatestVersion,
  createDraft,
  createVersion,
} from "./index";
import { designDocumentFixtures } from "@headstone/schema";

const firstFixture = designDocumentFixtures[0]!;
const secondFixture = designDocumentFixtures[1]!;
const epitaphFixture = designDocumentFixtures[2]!;
const baseNow = "2026-07-09T22:00:00.000Z";

function makeDraft(document = firstFixture) {
  return createDraft({
    id: "draft_compare_1",
    title: "Comparison memorial",
    design_document: document,
    created_at: baseNow,
    updated_at: baseNow,
  });
}

describe("proof comparison", () => {
  it("detects name changes as critical", () => {
    const nextDocument = {
      ...firstFixture,
      elements: firstFixture.elements.map((element) =>
        element.type === "text" && element.field === "name"
          ? { ...element, content: "MARGARET A. HOLLOWAY JR." }
          : element,
      ),
    };

    const diff = compareDesignDocuments(firstFixture, nextDocument);

    expect(diff.items.some((item) => item.field === "name" && item.severity === "critical")).toBe(true);
  });

  it("detects birth date changes as critical", () => {
    const nextDocument = {
      ...firstFixture,
      elements: firstFixture.elements.map((element) =>
        element.type === "text" && element.field === "dates"
          ? { ...element, content: "1948 - 2026" }
          : element,
      ),
    };

    const diff = compareDesignDocuments(firstFixture, nextDocument);

    expect(diff.items.some((item) => item.field === "birth_date" && item.severity === "critical")).toBe(true);
  });

  it("detects death date changes as critical", () => {
    const nextDocument = {
      ...firstFixture,
      elements: firstFixture.elements.map((element) =>
        element.type === "text" && element.field === "dates"
          ? { ...element, content: "1947 - 2027" }
          : element,
      ),
    };

    const diff = compareDesignDocuments(firstFixture, nextDocument);

    expect(diff.items.some((item) => item.field === "death_date" && item.severity === "critical")).toBe(true);
  });

  it("detects epitaph changes as important", () => {
    const nextDocument = {
      ...epitaphFixture,
      elements: epitaphFixture.elements.map((element) =>
        element.type === "text" && element.field === "epitaph"
          ? { ...element, content: "Always remembered" }
          : element,
      ),
    };

    const diff = compareDesignDocuments(epitaphFixture, nextDocument);

    expect(diff.items.some((item) => item.field === "epitaph" && item.severity === "important")).toBe(true);
  });

  it("returns an empty diff when nothing changed", () => {
    const diff = compareDesignDocuments(firstFixture, firstFixture);

    expect(diff.changed).toBe(false);
    expect(diff.items).toHaveLength(0);
  });

  it("rejects invalid documents", () => {
    expect(() =>
      compareDesignDocuments(
        { ...firstFixture, unexpected: true },
        secondFixture,
      ),
    ).toThrow();
  });

  it("does not mutate the input documents", () => {
    const before = JSON.stringify(firstFixture);
    const after = JSON.stringify(secondFixture);

    compareDesignDocuments(firstFixture, secondFixture);

    expect(JSON.stringify(firstFixture)).toBe(before);
    expect(JSON.stringify(secondFixture)).toBe(after);
  });

  it("returns null when a draft has no proof versions", () => {
    expect(compareDraftToLatestVersion(makeDraft())).toBeNull();
  });

  it("compares proof versions directly", () => {
    const first = createVersion(makeDraft(), {
      id: "version_1",
      label: "Initial proof",
      created_at: "2026-07-09T22:01:00.000Z",
      created_by: "user_1",
    }).version;
    const second = createVersion(
      {
        ...makeDraft(),
        design_document: secondFixture,
      },
      {
        id: "version_2",
        label: "Second proof",
        created_at: "2026-07-09T22:02:00.000Z",
        created_by: "user_1",
      },
    ).version;

    const diff = compareDesignVersions(first, second);

    expect(diff.items.length).toBeGreaterThan(0);
  });
});
