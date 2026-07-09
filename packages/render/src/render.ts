import { designDocumentSchema, designElementSchema, type DesignDocument, type DesignElement } from "@headstone/schema";

export interface SvgBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

const unitSuffix: Record<DesignDocument["units"], string> = {
  in: "in",
  mm: "mm",
};

const materialPalette: Record<string, { fill: string; stroke: string; ink: string }> = {
  bahama_blue_granite: { fill: "#61778b", stroke: "#425261", ink: "#f9f5ef" },
  jet_black_granite: { fill: "#242327", stroke: "#4d4952", ink: "#f6f0e8" },
  rose_pink_granite: { fill: "#cf9ca4", stroke: "#9d7179", ink: "#2f2726" },
  limestone: { fill: "#ddd3c2", stroke: "#b3a794", ink: "#2f2922" },
  polished: { fill: "#a7a196", stroke: "#7f786f", ink: "#1f1a17" },
};

const fontFamilies: Record<string, string> = {
  memorial_serif_1: "Georgia, 'Times New Roman', serif",
  memorial_block_1: "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif",
  memorial_script_1: "'Brush Script MT', 'Snell Roundhand', cursive",
};

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(3));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatLength(value: number, units: DesignDocument["units"]): string {
  return `${formatNumber(value)}${unitSuffix[units]}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cloneDocument(document: DesignDocument): DesignDocument {
  return JSON.parse(JSON.stringify(document)) as DesignDocument;
}

function getMaterialPalette(material: string) {
  return materialPalette[material] ?? { fill: "#c8c1b4", stroke: "#938b7d", ink: "#231f1a" };
}

function getTextFamily(font: string): string {
  return fontFamilies[font] ?? "Georgia, 'Times New Roman', serif";
}

function getInkColor(document: DesignDocument): string {
  return getMaterialPalette(document.face.material).ink;
}

function buildStonePath(document: DesignDocument): string {
  const { width, height, shape } = document.face;

  if (shape === "heart") {
    const scaleX = width / 100;
    const scaleY = height / 100;
    return [
      `M ${50 * scaleX} ${90 * scaleY}`,
      `C ${10 * scaleX} ${70 * scaleY}, ${0 * scaleX} ${40 * scaleY}, ${24 * scaleX} ${24 * scaleY}`,
      `C ${36 * scaleX} ${16 * scaleY}, ${46 * scaleX} ${23 * scaleY}, ${50 * scaleX} ${33 * scaleY}`,
      `C ${54 * scaleX} ${23 * scaleY}, ${64 * scaleX} ${16 * scaleY}, ${76 * scaleX} ${24 * scaleY}`,
      `C ${100 * scaleX} ${40 * scaleY}, ${90 * scaleX} ${70 * scaleY}, ${50 * scaleX} ${90 * scaleY}`,
      "Z",
    ].join(" ");
  }

  if (shape === "serpentine_top" || shape === "upright_serpentine_top") {
    const shoulderY = shape === "upright_serpentine_top" ? height * 0.14 : height * 0.18;
    const archHeight = shape === "upright_serpentine_top" ? height * 0.02 : height * 0.04;
    const leftArch = width * 0.18;
    const rightArch = width * 0.82;

    return [
      `M 0 ${height}`,
      `L 0 ${shoulderY}`,
      `C 0 ${archHeight} ${width * 0.12} ${archHeight} ${leftArch} ${shoulderY}`,
      `C ${width * 0.38} ${shoulderY + height * 0.02} ${width * 0.62} ${shoulderY + height * 0.02} ${width * 0.5} ${archHeight}`,
      `C ${width * 0.68} ${shoulderY} ${width * 0.88} ${archHeight} ${rightArch} ${shoulderY}`,
      `L ${width} ${shoulderY}`,
      `L ${width} ${height}`,
      "Z",
    ].join(" ");
  }

  return `M 0 0 H ${width} V ${height} H 0 Z`;
}

function createShapeElement(document: DesignDocument): string {
  const palette = getMaterialPalette(document.face.material);
  const path = buildStonePath(document);
  const strokeWidth = Math.max(0.04, Math.min(document.face.width, document.face.height) * 0.008);
  return [
    `<path d="${path}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="${formatNumber(strokeWidth)}" />`,
  ].join("");
}

function createSafeAreaOverlay(document: DesignDocument): string {
  const bounds = getSafeAreaBounds(document);
  return [
    `<rect x="${formatNumber(bounds.x)}" y="${formatNumber(bounds.y)}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" rx="0.12" fill="none" stroke="${getInkColor(document)}" stroke-opacity="0.35" stroke-width="0.04" stroke-dasharray="0.35 0.22" />`,
  ].join("");
}

function normalizeTextLines(content: string): string[] {
  return content.split(/\r?\n/);
}

function createTextMarkup(textBlock: Extract<DesignElement, { type: "text" }>, document: DesignDocument): string {
  const lines = normalizeTextLines(textBlock.content);
  const lineHeight = textBlock.size_in * 1.18;
  const startY = textBlock.y_in - ((lines.length - 1) * lineHeight) / 2;
  const palette = getMaterialPalette(document.face.material);
  const anchor = textBlock.align === "left" ? "start" : textBlock.align === "right" ? "end" : "middle";

  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="${formatNumber(textBlock.x_in)}" dy="${formatNumber(dy)}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return [
    `<text x="${formatNumber(textBlock.x_in)}" y="${formatNumber(startY)}" text-anchor="${anchor}" dominant-baseline="alphabetic" font-family="${escapeXml(getTextFamily(textBlock.font))}" font-size="${formatNumber(textBlock.size_in)}" fill="${palette.ink}" direction="${textBlock.direction}" unicode-bidi="plaintext" transform="rotate(${formatNumber(textBlock.rotation_deg)} ${formatNumber(textBlock.x_in)} ${formatNumber(textBlock.y_in)})" xml:space="preserve" letter-spacing="0.01em">`,
    tspans,
    `</text>`,
  ].join("");
}

function createSymbolPlaceholder(symbol: Extract<DesignElement, { type: "symbol" }>, document: DesignDocument): string {
  const palette = getMaterialPalette(document.face.material);
  const size = Math.max(0.6, symbol.scale * 1.2);
  const half = size / 2;
  const label = symbol.asset_id.replace(/^sym_/, "").replaceAll("_", " ");

  return [
    `<g transform="translate(${formatNumber(symbol.x_in)} ${formatNumber(symbol.y_in)}) rotate(${formatNumber(symbol.rotation_deg)})">`,
    `<rect x="${formatNumber(-half)}" y="${formatNumber(-half)}" width="${formatNumber(size)}" height="${formatNumber(size)}" rx="${formatNumber(size * 0.18)}" fill="none" stroke="${palette.ink}" stroke-width="0.04" stroke-dasharray="0.18 0.1" />`,
    `<path d="M ${formatNumber(-half * 0.55)} 0 H ${formatNumber(half * 0.55)} M 0 ${formatNumber(-half * 0.55)} V ${formatNumber(half * 0.55)}" fill="none" stroke="${palette.ink}" stroke-width="0.04" stroke-linecap="round" />`,
    `<text x="0" y="${formatNumber(half + 0.16)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${formatNumber(Math.max(0.18, size * 0.16))}" fill="${palette.ink}" xml:space="preserve">${escapeXml(label)}</text>`,
    `</g>`,
  ].join("");
}

function createPhotoEtchPlaceholder(
  element: Extract<DesignElement, { type: "photo_etch" }>,
  document: DesignDocument,
): string {
  const palette = getMaterialPalette(document.face.material);
  const rx = element.shape === "oval" ? element.width_in / 2 : element.width_in * 0.08;
  const ry = element.shape === "oval" ? element.height_in / 2 : element.height_in * 0.08;
  const label = "Photo etch";

  return [
    `<g transform="translate(${formatNumber(element.x_in)} ${formatNumber(element.y_in)}) rotate(${formatNumber(element.rotation_deg)})">`,
    `<rect x="${formatNumber(-element.width_in / 2)}" y="${formatNumber(-element.height_in / 2)}" width="${formatNumber(element.width_in)}" height="${formatNumber(element.height_in)}" rx="${formatNumber(rx)}" ry="${formatNumber(ry)}" fill="none" stroke="${palette.ink}" stroke-width="0.04" stroke-dasharray="0.22 0.14" />`,
    `<path d="M ${formatNumber(-element.width_in / 2)} ${formatNumber(-element.height_in / 2)} L ${formatNumber(element.width_in / 2)} ${formatNumber(element.height_in / 2)} M ${formatNumber(element.width_in / 2)} ${formatNumber(-element.height_in / 2)} L ${formatNumber(-element.width_in / 2)} ${formatNumber(element.height_in / 2)}" fill="none" stroke="${palette.ink}" stroke-width="0.04" stroke-linecap="round" opacity="0.7" />`,
    `<text x="0" y="${formatNumber(element.height_in / 2 + 0.18)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${formatNumber(Math.max(0.18, Math.min(element.width_in, element.height_in) * 0.13))}" fill="${palette.ink}" xml:space="preserve">${label}</text>`,
    `</g>`,
  ].join("");
}

function createCustomArtPlaceholder(
  element: Extract<DesignElement, { type: "custom_art" }>,
  document: DesignDocument,
): string {
  const palette = getMaterialPalette(document.face.material);
  const label = `Custom art ${element.format.toUpperCase()}`;

  return [
    `<g transform="translate(${formatNumber(element.x_in)} ${formatNumber(element.y_in)}) rotate(${formatNumber(element.rotation_deg)})">`,
    `<rect x="${formatNumber(-element.width_in / 2)}" y="${formatNumber(-element.height_in / 2)}" width="${formatNumber(element.width_in)}" height="${formatNumber(element.height_in)}" rx="${formatNumber(Math.min(element.width_in, element.height_in) * 0.08)}" fill="none" stroke="${palette.ink}" stroke-width="0.04" stroke-dasharray="0.18 0.1" />`,
    `<path d="M ${formatNumber(-element.width_in * 0.35)} ${formatNumber(-element.height_in * 0.1)} C ${formatNumber(-element.width_in * 0.2)} ${formatNumber(-element.height_in * 0.38)} ${formatNumber(element.width_in * 0.2)} ${formatNumber(-element.height_in * 0.38)} ${formatNumber(element.width_in * 0.35)} ${formatNumber(-element.height_in * 0.1)} C ${formatNumber(element.width_in * 0.28)} ${formatNumber(element.height_in * 0.26)} ${formatNumber(-element.width_in * 0.28)} ${formatNumber(element.height_in * 0.26)} ${formatNumber(-element.width_in * 0.35)} ${formatNumber(-element.height_in * 0.1)} Z" fill="none" stroke="${palette.ink}" stroke-width="0.04" />`,
    `<text x="0" y="${formatNumber(element.height_in / 2 + 0.18)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${formatNumber(Math.max(0.18, Math.min(element.width_in, element.height_in) * 0.12))}" fill="${palette.ink}" xml:space="preserve">${escapeXml(label)}</text>`,
    `</g>`,
  ].join("");
}

function createBorderPlaceholder(element: Extract<DesignElement, { type: "border" }>, document: DesignDocument): string {
  const palette = getMaterialPalette(document.face.material);
  const inset = element.inset_in;
  const stroke = element.stroke_in;
  const width = document.face.width - inset * 2;
  const height = document.face.height - inset * 2;

  return [
    `<rect x="${formatNumber(inset)}" y="${formatNumber(inset)}" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="${formatNumber(Math.max(0.18, inset * 0.2))}" fill="none" stroke="${palette.ink}" stroke-width="${formatNumber(stroke)}" />`,
    `<text x="${formatNumber(document.face.width / 2)}" y="${formatNumber(document.face.height - inset - 0.25)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${formatNumber(Math.max(0.18, stroke * 1.4))}" fill="${palette.ink}" xml:space="preserve">${escapeXml(element.style_id)}</text>`,
  ].join("");
}

function renderElement(document: DesignDocument, element: DesignElement): string {
  if (element.type === "text") {
    return createTextMarkup(element, document);
  }
  if (element.type === "symbol") {
    return createSymbolPlaceholder(element, document);
  }
  if (element.type === "photo_etch") {
    return createPhotoEtchPlaceholder(element, document);
  }
  if (element.type === "custom_art") {
    return createCustomArtPlaceholder(element, document);
  }
  return createBorderPlaceholder(element, document);
}

export function getDesignBounds(document: unknown): SvgBounds {
  const parsed = designDocumentSchema.parse(document);
  return {
    x: 0,
    y: 0,
    width: parsed.face.width,
    height: parsed.face.height,
    right: parsed.face.width,
    bottom: parsed.face.height,
  };
}

export function getSafeAreaBounds(document: unknown): SvgBounds {
  const parsed = designDocumentSchema.parse(document);
  const margin = parsed.guides.safe_margin_in;
  const width = Math.max(0, parsed.face.width - margin * 2);
  const height = Math.max(0, parsed.face.height - margin * 2);
  return {
    x: margin,
    y: margin,
    width,
    height,
    right: margin + width,
    bottom: margin + height,
  };
}

export function renderShapeToSvg(document: unknown): string {
  const parsed = designDocumentSchema.parse(document);
  const bounds = getDesignBounds(parsed);
  const palette = getMaterialPalette(parsed.face.material);
  const path = buildStonePath(parsed);
  const strokeWidth = Math.max(0.04, Math.min(bounds.width, bounds.height) * 0.008);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatLength(bounds.width, parsed.units)}" height="${formatLength(bounds.height, parsed.units)}" viewBox="0 0 ${formatNumber(bounds.width)} ${formatNumber(bounds.height)}" role="img" aria-label="Memorial stone shape">`,
    `<path d="${path}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="${formatNumber(strokeWidth)}" />`,
    `</svg>`,
  ].join("");
}

export function renderTextBlockToSvg(textBlock: unknown): string {
  const parsed = designElementSchema.parse(textBlock);
  if (parsed.type !== "text") {
    throw new Error("Expected a text element.");
  }

  const defaultDocument = designDocumentSchema.parse({
    units: "in",
    face: { width: parsed.x_in * 2 || 1, height: parsed.y_in * 2 || 1, depth: 1, shape: "flat_grass_marker", material: "polished", finish: "polished" },
    elements: [],
    guides: { safe_margin_in: 0.5 },
  });

  return createTextMarkup(parsed, defaultDocument);
}

export function renderSymbolToSvg(symbol: unknown): string {
  const parsed = designElementSchema.parse(symbol);
  if (parsed.type !== "symbol") {
    throw new Error("Expected a symbol element.");
  }

  const defaultDocument = designDocumentSchema.parse({
    units: "in",
    face: { width: parsed.x_in * 2 || 1, height: parsed.y_in * 2 || 1, depth: 1, shape: "flat_grass_marker", material: "polished", finish: "polished" },
    elements: [],
    guides: { safe_margin_in: 0.5 },
  });

  return createSymbolPlaceholder(parsed, defaultDocument);
}

export function renderDesignDocumentToSvg(document: unknown): string {
  const parsed = designDocumentSchema.parse(document);
  const bounds = getDesignBounds(parsed);
  const title =
    parsed.elements.find(
      (element): element is Extract<DesignElement, { type: "text" }> =>
        element.type === "text" && element.field === "name",
    )?.content ?? "Memorial design preview";
  const clipId = "design-face-clip";
  const stonePath = buildStonePath(parsed);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatLength(bounds.width, parsed.units)}" height="${formatLength(bounds.height, parsed.units)}" viewBox="0 0 ${formatNumber(bounds.width)} ${formatNumber(bounds.height)}" role="img" aria-labelledby="design-title design-desc">`,
    `<title id="design-title">${escapeXml(title)}</title>`,
    `<desc id="design-desc">Deterministic memorial draft preview with safe area overlay.</desc>`,
    `<defs><clipPath id="${clipId}"><path d="${stonePath}" /></clipPath></defs>`,
    createShapeElement(parsed),
    `<g clip-path="url(#${clipId})">`,
    parsed.elements.map((element) => renderElement(parsed, element)).join(""),
    createSafeAreaOverlay(parsed),
    `</g>`,
    `</svg>`,
  ].join("");
}
