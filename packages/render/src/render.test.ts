import { describe, expect, it } from "vitest";
import {
  getDesignBounds,
  getSafeAreaBounds,
  renderDesignDocumentToSvg,
} from "./index";
import { designDocumentFixtures } from "@headstone/schema";

const fixture = designDocumentFixtures[0]!;

describe("render", () => {
  it("renders a valid fixture to svg", () => {
    const svg = renderDesignDocumentToSvg(fixture);

    expect(svg).toContain("<svg");
    expect(svg).toContain("<title id=\"design-title\">");
    expect(svg).toContain("design-face-clip");
  });

  it("rejects an invalid document", () => {
    expect(() =>
      renderDesignDocumentToSvg({
        ...fixture,
        unexpected: true,
      }),
    ).toThrow();
  });

  it("renders the same fixture identically twice", () => {
    const first = renderDesignDocumentToSvg(fixture);
    const second = renderDesignDocumentToSvg(fixture);

    expect(first).toBe(second);
  });

  it("does not mutate the input document", () => {
    const original = JSON.stringify(fixture);

    renderDesignDocumentToSvg(fixture);

    expect(JSON.stringify(fixture)).toBe(original);
  });

  it("calculates the safe area bounds correctly", () => {
    const bounds = getSafeAreaBounds(fixture);

    expect(bounds).toEqual({
      x: 0.75,
      y: 0.75,
      width: 22.5,
      height: 10.5,
      right: 23.25,
      bottom: 11.25,
    });
  });

  it("matches the svg dimensions to the design document", () => {
    const svg = renderDesignDocumentToSvg(fixture);
    const bounds = getDesignBounds(fixture);

    expect(svg).toContain(`width="${bounds.width}in"`);
    expect(svg).toContain(`height="${bounds.height}in"`);
    expect(svg).toContain(`viewBox="0 0 ${bounds.width} ${bounds.height}"`);
  });
});
