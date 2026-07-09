import { describe, expect, it } from "vitest";
import {
  designDocumentFixtures,
  designDocumentSchema,
  parseDesignDocument,
} from "./index";

describe("designDocumentSchema", () => {
  it("accepts seeded memorial design fixtures", () => {
    for (const fixture of designDocumentFixtures) {
      const parsed = designDocumentSchema.parse(fixture);
      expect(parsed).toEqual(fixture);
    }
  });

  it("rejects unknown top-level keys", () => {
    const result = designDocumentSchema.safeParse({
      ...designDocumentFixtures[0],
      unexpected: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
    }
  });

  it("rejects invalid element geometry", () => {
    const result = designDocumentSchema.safeParse({
      ...designDocumentFixtures[0],
      elements: [
        {
          id: "el_bad",
          type: "text",
          content: "Invalid",
          font: "memorial_serif_1",
          size_in: 0,
          x_in: 12,
          y_in: 3,
          rotation_deg: 0,
          align: "center",
          direction: "auto",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("size_in"))).toBe(true);
    }
  });

  it("rejects invalid document units", () => {
    expect(() =>
      parseDesignDocument({
        ...designDocumentFixtures[1],
        units: "px",
      }),
    ).toThrowError();
  });
});
