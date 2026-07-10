import { getSafeAreaBounds } from "@headstone/render";
import { designDocumentSchema, type DesignDocument, type DesignElement } from "@headstone/schema";
import { type EditableFields } from "./editorModel";

export interface CanvasElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface CanvasElementDescriptor {
  id: string;
  type: "text" | "symbol" | "photo_etch" | "custom_art";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation_deg: number;
  bounds: CanvasElementBounds;
  safeAreaWarning: boolean;
}

const editableTextFieldLabels: Record<string, string> = {
  name: "Person name",
  birth_date: "Birth date",
  death_date: "Death date",
  dates: "Dates",
  epitaph: "Epitaph",
};

function cloneDesignDocument(document: DesignDocument): DesignDocument {
  return JSON.parse(JSON.stringify(document)) as DesignDocument;
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.min(Math.max(value, min), max);
}

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(3));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function getTextBounds(textElement: Extract<DesignElement, { type: "text" }>): CanvasElementBounds {
  const lines = textElement.content.split(/\r?\n/);
  const longestLineLength = Math.max(...lines.map((line) => line.trim().length), 1);
  const textWidth = Math.max(textElement.size_in * 1.8, longestLineLength * textElement.size_in * 0.58);
  const textHeight = Math.max(lines.length * textElement.size_in * 1.15, textElement.size_in * 1.2);

  return {
    x: textElement.x_in - textWidth / 2,
    y: textElement.y_in - textHeight / 2,
    width: textWidth,
    height: textHeight,
    right: textElement.x_in + textWidth / 2,
    bottom: textElement.y_in + textHeight / 2,
  };
}

function getSymbolBounds(symbol: Extract<DesignElement, { type: "symbol" }>): CanvasElementBounds {
  const size = Math.max(0.6, symbol.scale * 1.2);
  return {
    x: symbol.x_in - size / 2,
    y: symbol.y_in - size / 2,
    width: size,
    height: size,
    right: symbol.x_in + size / 2,
    bottom: symbol.y_in + size / 2,
  };
}

function getPhotoEtchBounds(element: Extract<DesignElement, { type: "photo_etch" }>): CanvasElementBounds {
  return {
    x: element.x_in - element.width_in / 2,
    y: element.y_in - element.height_in / 2,
    width: element.width_in,
    height: element.height_in,
    right: element.x_in + element.width_in / 2,
    bottom: element.y_in + element.height_in / 2,
  };
}

function getCustomArtBounds(element: Extract<DesignElement, { type: "custom_art" }>): CanvasElementBounds {
  return {
    x: element.x_in - element.width_in / 2,
    y: element.y_in - element.height_in / 2,
    width: element.width_in,
    height: element.height_in,
    right: element.x_in + element.width_in / 2,
    bottom: element.y_in + element.height_in / 2,
  };
}

function getElementBounds(document: DesignDocument, element: Extract<DesignElement, { type: "text" | "symbol" | "photo_etch" | "custom_art" }>): CanvasElementBounds {
  if (element.type === "text") {
    return getTextBounds(element);
  }

  if (element.type === "symbol") {
    return getSymbolBounds(element);
  }

  if (element.type === "photo_etch") {
    return getPhotoEtchBounds(element);
  }

  return getCustomArtBounds(element);
}

function createTextPlacement(document: DesignDocument, field: "name" | "dates" | "epitaph") {
  const width = document.face.width;
  const height = document.face.height;

  if (field === "name") {
    return {
      font: "memorial_serif_1",
      size_in: Math.max(0.82, height * 0.11),
      x_in: width / 2,
      y_in: height * 0.28,
      align: "center" as const,
      direction: "auto" as const,
      rotation_deg: 0,
    };
  }

  if (field === "dates") {
    return {
      font: "memorial_block_1",
      size_in: Math.max(0.56, height * 0.07),
      x_in: width / 2,
      y_in: height * 0.46,
      align: "center" as const,
      direction: "auto" as const,
      rotation_deg: 0,
    };
  }

  return {
    font: "memorial_script_1",
    size_in: Math.max(0.54, height * 0.06),
    x_in: width / 2,
    y_in: height * 0.64,
    align: "center" as const,
    direction: "auto" as const,
    rotation_deg: 0,
  };
}

function createTextElement(
  document: DesignDocument,
  field: "name" | "dates" | "epitaph",
  content: string,
): Extract<DesignElement, { type: "text" }> {
  const existing = document.elements.find(
    (candidate): candidate is Extract<DesignElement, { type: "text" }> =>
      candidate.type === "text" && candidate.field === field,
  );

  if (existing) {
    return {
      ...existing,
      content,
    };
  }

  const placement = createTextPlacement(document, field);
  return {
    id: `editor_${field}`,
    type: "text",
    field,
    content,
    font: placement.font,
    size_in: placement.size_in,
    x_in: placement.x_in,
    y_in: placement.y_in,
    rotation_deg: placement.rotation_deg,
    align: placement.align,
    direction: placement.direction,
  };
}

function composeDateRange(fields: EditableFields): string {
  return [fields.birth_date.trim(), fields.death_date.trim()].filter(Boolean).join(" - ");
}

function isMovableElement(
  element: DesignElement,
): element is Extract<DesignElement, { type: "text" | "symbol" | "photo_etch" | "custom_art" }> {
  return element.type === "text" || element.type === "symbol" || element.type === "photo_etch" || element.type === "custom_art";
}

function getSafeAreaWarning(document: DesignDocument, bounds: CanvasElementBounds): boolean {
  const safeBounds = getSafeAreaBounds(document);
  return (
    bounds.x < safeBounds.x ||
    bounds.y < safeBounds.y ||
    bounds.right > safeBounds.right ||
    bounds.bottom > safeBounds.bottom
  );
}

export function getCanvasElementDescriptors(document: DesignDocument): CanvasElementDescriptor[] {
  const parsed = designDocumentSchema.parse(document);

  return parsed.elements.flatMap((element) => {
    if (!isMovableElement(element)) {
      return [];
    }

    const bounds = getElementBounds(parsed, element);
    const label =
      element.type === "text"
        ? editableTextFieldLabels[element.field ?? ""] ?? "Text"
        : element.type === "symbol"
          ? `Symbol ${element.asset_id.replace(/^sym_/, "").replaceAll("_", " ")}`
          : element.type === "photo_etch"
            ? "Photo etch"
            : `Artwork ${element.format.toUpperCase()}`;

    return [
      {
        id: element.id,
        type: element.type,
        label,
        x: element.x_in,
        y: element.y_in,
        width: bounds.width,
        height: bounds.height,
        rotation_deg: element.rotation_deg,
        bounds,
        safeAreaWarning: getSafeAreaWarning(parsed, bounds),
      },
    ];
  });
}

export function getCanvasElementDescriptor(
  document: DesignDocument,
  elementId: string,
): CanvasElementDescriptor | null {
  return getCanvasElementDescriptors(document).find((element) => element.id === elementId) ?? null;
}

export function updateEditableDocumentFields(document: DesignDocument, fields: EditableFields): DesignDocument {
  const parsed = designDocumentSchema.parse(document);
  const nextElements: DesignElement[] = [];
  const nameContent = fields.name.trim();
  const datesContent = composeDateRange(fields);
  const epitaphContent = fields.epitaph.trim();
  let sawName = false;
  let sawDates = false;
  let sawEpitaph = false;

  for (const element of parsed.elements) {
    if (element.type !== "text") {
      nextElements.push(element);
      continue;
    }

    if (element.field === "name") {
      sawName = true;
      if (nameContent) {
        nextElements.push({
          ...element,
          content: nameContent,
        });
      }
      continue;
    }

    if (element.field === "dates") {
      sawDates = true;
      if (datesContent) {
        nextElements.push({
          ...element,
          content: datesContent,
        });
      }
      continue;
    }

    if (element.field === "epitaph") {
      sawEpitaph = true;
      if (epitaphContent) {
        nextElements.push({
          ...element,
          content: epitaphContent,
        });
      }
      continue;
    }

    nextElements.push(element);
  }

  if (nameContent && !sawName) {
    nextElements.push(createTextElement(parsed, "name", nameContent));
  }

  if (datesContent && !sawDates) {
    nextElements.push(createTextElement(parsed, "dates", datesContent));
  }

  if (epitaphContent && !sawEpitaph) {
    nextElements.push(createTextElement(parsed, "epitaph", epitaphContent));
  }

  return {
    ...parsed,
    elements: nextElements,
  };
}

export function setCanvasElementPosition(
  document: DesignDocument,
  elementId: string,
  nextX: number,
  nextY: number,
): DesignDocument {
  const parsed = designDocumentSchema.parse(document);
  const nextDocument = cloneDesignDocument(parsed);
  const element = nextDocument.elements.find(
    (candidate): candidate is Extract<
      DesignElement,
      { type: "text" | "symbol" | "photo_etch" | "custom_art" }
    > => isMovableElement(candidate) && candidate.id === elementId,
  );

  if (!element) {
    return nextDocument;
  }

  const bounds = getElementBounds(parsed, element);
  const faceWidth = parsed.face.width;
  const faceHeight = parsed.face.height;
  const minX = bounds.width >= faceWidth ? faceWidth / 2 : bounds.width / 2;
  const maxX = bounds.width >= faceWidth ? faceWidth / 2 : faceWidth - bounds.width / 2;
  const minY = bounds.height >= faceHeight ? faceHeight / 2 : bounds.height / 2;
  const maxY = bounds.height >= faceHeight ? faceHeight / 2 : faceHeight - bounds.height / 2;

  element.x_in = clamp(nextX, minX, maxX);
  element.y_in = clamp(nextY, minY, maxY);

  return designDocumentSchema.parse(nextDocument);
}

export function moveCanvasElement(
  document: DesignDocument,
  elementId: string,
  deltaX: number,
  deltaY: number,
): DesignDocument {
  const parsed = designDocumentSchema.parse(document);
  const element = parsed.elements.find(
    (candidate): candidate is Extract<DesignElement, { type: "text" | "symbol" | "photo_etch" | "custom_art" }> =>
      isMovableElement(candidate) && candidate.id === elementId,
  );

  if (!element) {
    return cloneDesignDocument(parsed);
  }

  return setCanvasElementPosition(parsed, elementId, element.x_in + deltaX, element.y_in + deltaY);
}

export function getCanvasElementLabel(descriptor: CanvasElementDescriptor): string {
  return `${descriptor.label} · x ${formatNumber(descriptor.x)} · y ${formatNumber(descriptor.y)}`;
}

export function isCanvasElementOutsideSafeArea(
  document: DesignDocument,
  elementId: string,
): boolean {
  const descriptor = getCanvasElementDescriptor(document, elementId);
  return descriptor ? descriptor.safeAreaWarning : false;
}
