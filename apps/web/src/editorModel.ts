import { designDocumentFixtures, type DesignDocument, type DesignElement } from "@headstone/schema";

export type EditableFieldKey = "name" | "birth_date" | "death_date" | "epitaph";

export interface EditableFields {
  name: string;
  birth_date: string;
  death_date: string;
  epitaph: string;
}

export interface MemorialTemplate {
  id: string;
  title: string;
  design_document: DesignDocument;
}

const editableTextFields = new Set(["name", "dates", "epitaph"]);

export const memorialTemplates: readonly MemorialTemplate[] = [
  {
    id: "serpentine-top",
    title: "Serpentine memorial",
    design_document: designDocumentFixtures[0]!,
  },
  {
    id: "flat-marker",
    title: "Flat marker memorial",
    design_document: designDocumentFixtures[1]!,
  },
  {
    id: "upright-serpentine",
    title: "Hebrew memorial",
    design_document: designDocumentFixtures[2]!,
  },
  {
    id: "heart",
    title: "Pet memorial",
    design_document: designDocumentFixtures[3]!,
  },
];

export function cloneDesignDocument(document: DesignDocument): DesignDocument {
  return JSON.parse(JSON.stringify(document)) as DesignDocument;
}

function textElementContent(document: DesignDocument, field: string): string {
  const element = document.elements.find(
    (candidate): candidate is Extract<DesignElement, { type: "text" }> =>
      candidate.type === "text" && candidate.field === field,
  );

  return element?.content.trim() ?? "";
}

function splitDateRange(content: string): { birth_date: string; death_date: string } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { birth_date: "", death_date: "" };
  }

  const parts = trimmed.split(/\s[-–—]\s/);
  if (parts.length >= 2) {
    return {
      birth_date: parts[0]?.trim() ?? "",
      death_date: parts.slice(1).join(" - ").trim(),
    };
  }

  return { birth_date: trimmed, death_date: "" };
}

function composeDateRange(fields: EditableFields): string {
  return [fields.birth_date.trim(), fields.death_date.trim()].filter(Boolean).join(" - ");
}

function sameFace(left: DesignDocument["face"], right: DesignDocument["face"]): boolean {
  return (
    left.width === right.width &&
    left.height === right.height &&
    left.depth === right.depth &&
    left.shape === right.shape &&
    left.material === right.material &&
    left.finish === right.finish
  );
}

function defaultTextPlacement(
  document: DesignDocument,
  field: "name" | "dates" | "epitaph",
): Pick<Extract<DesignElement, { type: "text" }>, "font" | "size_in" | "x_in" | "y_in" | "align" | "direction" | "rotation_deg"> {
  const width = document.face.width;
  const height = document.face.height;

  if (field === "name") {
    return {
      font: "memorial_serif_1",
      size_in: Math.max(0.82, height * 0.11),
      x_in: width / 2,
      y_in: height * 0.28,
      align: "center",
      direction: "auto",
      rotation_deg: 0,
    };
  }

  if (field === "dates") {
    return {
      font: "memorial_block_1",
      size_in: Math.max(0.56, height * 0.07),
      x_in: width / 2,
      y_in: height * 0.46,
      align: "center",
      direction: "auto",
      rotation_deg: 0,
    };
  }

  return {
    font: "memorial_script_1",
    size_in: Math.max(0.54, height * 0.06),
    x_in: width / 2,
    y_in: height * 0.64,
    align: "center",
    direction: "auto",
    rotation_deg: 0,
  };
}

function createTextElement(
  template: DesignDocument,
  field: "name" | "dates" | "epitaph",
  content: string,
): Extract<DesignElement, { type: "text" }> {
  const source = template.elements.find(
    (element): element is Extract<DesignElement, { type: "text" }> =>
      element.type === "text" && element.field === field,
  );

  if (source) {
    return {
      ...source,
      content,
    };
  }

  const placement = defaultTextPlacement(template, field);
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

export function getTemplateIndex(document: DesignDocument): number {
  const index = memorialTemplates.findIndex((template) => sameFace(template.design_document.face, document.face));
  return index >= 0 ? index : 0;
}

export function getEditableFields(document: DesignDocument): EditableFields {
  const combinedDates = textElementContent(document, "dates");
  const parsedDates = splitDateRange(combinedDates);
  const birthDate = textElementContent(document, "birth_date") || parsedDates.birth_date;
  const deathDate = textElementContent(document, "death_date") || parsedDates.death_date;

  return {
    name: textElementContent(document, "name"),
    birth_date: birthDate,
    death_date: deathDate,
    epitaph: textElementContent(document, "epitaph"),
  };
}

export function buildEditableDocument(templateIndex: number, fields: EditableFields): DesignDocument {
  const template = memorialTemplates[templateIndex] ?? memorialTemplates[0]!;
  const document = cloneDesignDocument(template.design_document);
  const nextElements: DesignElement[] = [];
  const nameContent = fields.name.trim();
  const datesContent = composeDateRange(fields);
  const epitaphContent = fields.epitaph.trim();

  for (const element of document.elements) {
    if (element.type !== "text") {
      nextElements.push(element);
      continue;
    }

    if (!editableTextFields.has(element.field ?? "")) {
      nextElements.push(element);
    }
  }

  if (nameContent) {
    nextElements.push(createTextElement(document, "name", nameContent));
  }

  if (datesContent) {
    nextElements.push(createTextElement(document, "dates", datesContent));
  }

  if (epitaphContent) {
    nextElements.push(createTextElement(document, "epitaph", epitaphContent));
  }

  return {
    ...document,
    elements: nextElements,
  };
}

export function getTemplateTitle(templateIndex: number): string {
  return memorialTemplates[templateIndex]?.title ?? memorialTemplates[0]!.title;
}
