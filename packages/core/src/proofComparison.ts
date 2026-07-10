import { designDocumentSchema, type DesignDocument, type DesignElement } from "@headstone/schema";
import { designDraftSchema, designVersionSchema, type DesignDraft, type DesignVersion } from "./domain";

export type ProofVersionDiffSeverity = "info" | "important" | "critical";

export type ProofVersionDiffField =
  | "name"
  | "birth_date"
  | "death_date"
  | "epitaph"
  | "shape"
  | "layout"
  | "material"
  | "text_block"
  | "symbol"
  | "photo_etch"
  | "custom_art"
  | "border";

export interface ProofVersionDiffItem {
  id: string;
  field: ProofVersionDiffField;
  severity: ProofVersionDiffSeverity;
  summary: string;
  before: string | null;
  after: string | null;
  element_id?: string;
  element_type?: DesignElement["type"];
}

export interface ProofVersionDiff {
  changed: boolean;
  summary: string;
  items: ProofVersionDiffItem[];
}

const severityOrder: Record<ProofVersionDiffSeverity, number> = {
  critical: 0,
  important: 1,
  info: 2,
};

const namedFieldSeverity: Record<"name" | "birth_date" | "death_date" | "epitaph", ProofVersionDiffSeverity> =
  {
    name: "critical",
    birth_date: "critical",
    death_date: "critical",
    epitaph: "important",
  };

const diffFieldLabels: Record<ProofVersionDiffField, string> = {
  name: "Name",
  birth_date: "Birth date",
  death_date: "Death date",
  epitaph: "Epitaph",
  shape: "Stone shape",
  layout: "Stone layout",
  material: "Stone material",
  text_block: "Text block",
  symbol: "Symbol",
  photo_etch: "Photo etch",
  custom_art: "Custom art",
  border: "Border",
};

function normalizeText(value: string): string {
  return value.trim();
}

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(3));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function describeDesignFace(document: DesignDocument): string {
  return [
    `${document.face.shape}`,
    `${formatNumber(document.face.width)} x ${formatNumber(document.face.height)} x ${formatNumber(document.face.depth)}`,
    document.face.finish,
  ].join(", ");
}

function describeMaterial(document: DesignDocument): string {
  return document.face.material;
}

function describeFieldLabel(field: ProofVersionDiffField): string {
  return diffFieldLabels[field];
}

function describeLayout(document: DesignDocument): string {
  return `units ${document.units}; safe margin ${formatNumber(document.guides.safe_margin_in)}; face ${formatNumber(document.face.width)} x ${formatNumber(document.face.height)} x ${formatNumber(document.face.depth)}`;
}

function describeTextSnapshot(element: Extract<DesignElement, { type: "text" }>): string {
  return [
    `content=${JSON.stringify(normalizeText(element.content))}`,
    `font=${element.font}`,
    `size=${formatNumber(element.size_in)}`,
    `position=${formatNumber(element.x_in)},${formatNumber(element.y_in)}`,
    `rotation=${formatNumber(element.rotation_deg)}`,
    `align=${element.align}`,
    `direction=${element.direction}`,
  ].join("; ");
}

function extractDateRange(document: DesignDocument): { birth_date: string | null; death_date: string | null } {
  const birthElement = findNamedTextElement(document, "birth_date");
  const deathElement = findNamedTextElement(document, "death_date");

  if (birthElement || deathElement) {
    return {
      birth_date: birthElement ? normalizeText(birthElement.content) : null,
      death_date: deathElement ? normalizeText(deathElement.content) : null,
    };
  }

  const combinedDates = document.elements.find(
    (candidate): candidate is Extract<DesignElement, { type: "text" }> =>
      candidate.type === "text" && candidate.field === "dates",
  );

  if (!combinedDates) {
    return { birth_date: null, death_date: null };
  }

  const parts = normalizeText(combinedDates.content).split(/\s[-–—]\s/);
  if (parts.length >= 2) {
    return {
      birth_date: parts[0]?.trim() ?? null,
      death_date: parts.slice(1).join(" - ").trim() || null,
    };
  }

  return {
    birth_date: normalizeText(combinedDates.content) || null,
    death_date: null,
  };
}

function describeGenericSnapshot(element: Exclude<DesignElement, Extract<DesignElement, { type: "text" }>>): string {
  switch (element.type) {
    case "symbol":
      return [
        `asset_id=${element.asset_id}`,
        `scale=${formatNumber(element.scale)}`,
        `position=${formatNumber(element.x_in)},${formatNumber(element.y_in)}`,
        `rotation=${formatNumber(element.rotation_deg)}`,
      ].join("; ");
    case "photo_etch":
      return [
        `asset_url=${element.asset_url}`,
        `shape=${element.shape}`,
        `size=${formatNumber(element.width_in)}x${formatNumber(element.height_in)}`,
        `position=${formatNumber(element.x_in)},${formatNumber(element.y_in)}`,
        `rotation=${formatNumber(element.rotation_deg)}`,
      ].join("; ");
    case "custom_art":
      return [
        `asset_url=${element.asset_url}`,
        `format=${element.format}`,
        `size=${formatNumber(element.width_in)}x${formatNumber(element.height_in)}`,
        `position=${formatNumber(element.x_in)},${formatNumber(element.y_in)}`,
        `rotation=${formatNumber(element.rotation_deg)}`,
        `manual_review_approved=${String(element.manual_review_approved)}`,
      ].join("; ");
    case "border":
      return [
        `style_id=${element.style_id}`,
        `inset=${formatNumber(element.inset_in)}`,
        `stroke=${formatNumber(element.stroke_in)}`,
        `position=${formatNumber(element.x_in)},${formatNumber(element.y_in)}`,
        `rotation=${formatNumber(element.rotation_deg)}`,
      ].join("; ");
  }
}

function describeElementSnapshot(element: DesignElement): string {
  if (element.type === "text") {
    return describeTextSnapshot(element);
  }

  return describeGenericSnapshot(element);
}

function elementFieldForType(type: Exclude<DesignElement["type"], "text">): ProofVersionDiffField {
  switch (type) {
    case "symbol":
      return "symbol";
    case "photo_etch":
      return "photo_etch";
    case "custom_art":
      return "custom_art";
    case "border":
      return "border";
  }
}

function isNamedTextField(field: string | undefined): field is "name" | "birth_date" | "death_date" | "epitaph" {
  return field === "name" || field === "birth_date" || field === "death_date" || field === "epitaph";
}

function findNamedTextElement(
  document: DesignDocument,
  field: "name" | "birth_date" | "death_date" | "epitaph",
): Extract<DesignElement, { type: "text" }> | null {
  const element = document.elements.find(
    (candidate): candidate is Extract<DesignElement, { type: "text" }> =>
      candidate.type === "text" && candidate.field === field,
  );

  return element ?? null;
}

function addItem(
  items: ProofVersionDiffItem[],
  item: ProofVersionDiffItem,
): void {
  items.push(item);
}

function compareNamedTextField(
  before: DesignDocument,
  after: DesignDocument,
  field: "name" | "birth_date" | "death_date" | "epitaph",
  items: ProofVersionDiffItem[],
): void {
  const label = describeFieldLabel(field);
  const severity = namedFieldSeverity[field];

  if (field === "birth_date" || field === "death_date") {
    const beforeDates = extractDateRange(before);
    const afterDates = extractDateRange(after);
    const beforeValue = beforeDates[field];
    const afterValue = afterDates[field];

    if (beforeValue === null && afterValue === null) {
      return;
    }

    if (beforeValue !== afterValue) {
      addItem(items, {
        id: `field-${field}-changed`,
        field,
        severity,
        summary: `${label} changed.`,
        before: beforeValue ?? "blank",
        after: afterValue ?? "blank",
      });
    }
    return;
  }

  const beforeElement = findNamedTextElement(before, field);
  const afterElement = findNamedTextElement(after, field);

  if (!beforeElement && !afterElement) {
    return;
  }

  if (!beforeElement || !afterElement) {
    const item: ProofVersionDiffItem = {
      id: `field-${field}-${beforeElement ? "removed" : "added"}`,
      field,
      severity,
      summary: beforeElement ? `${label} was removed.` : `${label} was added.`,
      before: beforeElement ? normalizeText(beforeElement.content) || "blank" : null,
      after: afterElement ? normalizeText(afterElement.content) || "blank" : null,
      element_type: "text",
    };
    const elementId = afterElement?.id ?? beforeElement?.id;
    if (elementId) {
      item.element_id = elementId;
    }
    addItem(items, item);
    return;
  }

  const beforeContent = normalizeText(beforeElement.content);
  const afterContent = normalizeText(afterElement.content);
  const contentChanged = beforeContent !== afterContent;
  const styleChanged = describeTextSnapshot(beforeElement) !== describeTextSnapshot(afterElement);

  if (!contentChanged && !styleChanged) {
    return;
  }

      addItem(items, {
        id: `field-${field}-changed`,
        field,
        severity: contentChanged ? severity : "important",
        summary:
          contentChanged
        ? `${label} changed.`
        : `${label} layout changed.`,
    before: contentChanged ? beforeContent || "blank" : describeTextSnapshot(beforeElement),
    after: contentChanged ? afterContent || "blank" : describeTextSnapshot(afterElement),
    element_id: afterElement.id,
    element_type: "text",
  });
}

function compareFace(
  before: DesignDocument,
  after: DesignDocument,
  items: ProofVersionDiffItem[],
): void {
  if (before.units !== after.units || describeLayout(before) !== describeLayout(after)) {
    addItem(items, {
      id: "layout-changed",
      field: "layout",
      severity: "important",
      summary: "Stone layout changed.",
      before: describeLayout(before),
      after: describeLayout(after),
    });
  }

  if (before.face.shape !== after.face.shape) {
    addItem(items, {
      id: "shape-changed",
      field: "shape",
      severity: "important",
      summary: "Stone shape changed.",
      before: describeDesignFace(before),
      after: describeDesignFace(after),
    });
  }

  if (describeMaterial(before) !== describeMaterial(after)) {
    addItem(items, {
      id: "material-changed",
      field: "material",
      severity: "important",
      summary: "Stone material changed.",
      before: describeMaterial(before),
      after: describeMaterial(after),
    });
  }
}

function compareElementCollection(
  before: DesignDocument,
  after: DesignDocument,
  items: ProofVersionDiffItem[],
): void {
  const beforeElements = new Map(before.elements.map((element) => [element.id, element] as const));
  const afterElements = new Map(after.elements.map((element) => [element.id, element] as const));
  const ids = [...new Set([...beforeElements.keys(), ...afterElements.keys()])].sort((left, right) =>
    left.localeCompare(right),
  );

  for (const id of ids) {
    const beforeElement = beforeElements.get(id);
    const afterElement = afterElements.get(id);

    if (!beforeElement || !afterElement) {
      const existing = beforeElement ?? afterElement;
      if (!existing) {
        continue;
      }

      if (existing.type === "text" && isNamedTextField(existing.field)) {
        continue;
      }
      if (existing.type === "text" && existing.field === "dates") {
        continue;
      }

      const field = existing.type === "text" ? "text_block" : elementFieldForType(existing.type);
      addItem(items, {
        id: `element-${id}-${beforeElement ? "removed" : "added"}`,
        field,
        severity: "important",
        summary: `${describeFieldLabel(field)} ${beforeElement ? "removed" : "added"}.`,
        before: beforeElement ? describeElementSnapshot(beforeElement) : null,
        after: afterElement ? describeElementSnapshot(afterElement) : null,
        element_id: id,
        element_type: existing.type,
      });
      continue;
    }

    if (beforeElement.type !== afterElement.type) {
      if (beforeElement.type === "text" && isNamedTextField(beforeElement.field)) {
        continue;
      }

      const field = afterElement.type === "text" ? "text_block" : elementFieldForType(afterElement.type);

      addItem(items, {
        id: `element-${id}-type-changed`,
        field,
        severity: "important",
        summary: `${describeFieldLabel(field)} changed.`,
        before: describeElementSnapshot(beforeElement),
        after: describeElementSnapshot(afterElement),
        element_id: id,
        element_type: afterElement.type,
      });
      continue;
    }

    if (beforeElement.type === "text") {
      if (isNamedTextField(beforeElement.field)) {
        continue;
      }
      if (beforeElement.field === "dates") {
        continue;
      }

      const beforeSnapshot = describeTextSnapshot(beforeElement);
      const afterSnapshot = describeTextSnapshot(afterElement as Extract<DesignElement, { type: "text" }>);
      if (beforeSnapshot === afterSnapshot) {
        continue;
      }

      addItem(items, {
        id: `element-${id}-changed`,
        field: "text_block",
        severity: "important",
        summary: "Text block changed.",
        before: beforeSnapshot,
        after: afterSnapshot,
        element_id: id,
        element_type: "text",
      });
      continue;
    }

    const beforeSnapshot = describeGenericSnapshot(
      beforeElement as Exclude<DesignElement, Extract<DesignElement, { type: "text" }>>,
    );
    const afterSnapshot = describeGenericSnapshot(
      afterElement as Exclude<DesignElement, Extract<DesignElement, { type: "text" }>>,
    );
    if (beforeSnapshot === afterSnapshot) {
      continue;
    }

    const field = elementFieldForType(beforeElement.type);
    addItem(items, {
      id: `element-${id}-changed`,
      field,
      severity: "important",
      summary: `${describeFieldLabel(field)} changed.`,
      before: beforeSnapshot,
      after: afterSnapshot,
      element_id: id,
      element_type: beforeElement.type,
    });
  }
}

function compareDocumentsInternal(before: DesignDocument, after: DesignDocument): ProofVersionDiff {
  const items: ProofVersionDiffItem[] = [];

  compareFace(before, after, items);
  compareNamedTextField(before, after, "name", items);
  compareNamedTextField(before, after, "birth_date", items);
  compareNamedTextField(before, after, "death_date", items);
  compareNamedTextField(before, after, "epitaph", items);
  compareElementCollection(before, after, items);

  items.sort((left, right) => {
    const severityDelta = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const fieldDelta = left.field.localeCompare(right.field);
    if (fieldDelta !== 0) {
      return fieldDelta;
    }

    return left.id.localeCompare(right.id);
  });

  const criticalCount = items.filter((item) => item.severity === "critical").length;
  const importantCount = items.filter((item) => item.severity === "important").length;
  const infoCount = items.filter((item) => item.severity === "info").length;

  let summary: string;
  if (items.length === 0) {
    summary = "No changes were found between these proof versions.";
  } else {
    const parts: string[] = [];
    if (criticalCount > 0) {
      parts.push(`${criticalCount} critical`);
    }
    if (importantCount > 0) {
      parts.push(`${importantCount} important`);
    }
    if (infoCount > 0) {
      parts.push(`${infoCount} note${infoCount === 1 ? "" : "s"}`);
    }

    summary = `${parts.join(", ")} change${items.length === 1 ? "" : "s"} found.`;
    if (criticalCount > 0) {
      summary += " Review carefully.";
    }
  }

  return {
    changed: items.length > 0,
    summary,
    items,
  };
}

export function compareDesignDocuments(before: unknown, after: unknown): ProofVersionDiff {
  const parsedBefore = designDocumentSchema.parse(before);
  const parsedAfter = designDocumentSchema.parse(after);
  return compareDocumentsInternal(parsedBefore, parsedAfter);
}

export function compareDesignVersions(
  beforeVersion: unknown,
  afterVersion: unknown,
): ProofVersionDiff {
  const parsedBefore = designVersionSchema.parse(beforeVersion);
  const parsedAfter = designVersionSchema.parse(afterVersion);
  return compareDesignDocuments(parsedBefore.design_document, parsedAfter.design_document);
}

export function compareDraftToLatestVersion(draft: unknown): ProofVersionDiff | null {
  const parsedDraft = designDraftSchema.parse(draft);
  const latestVersion = parsedDraft.versions.at(-1);

  if (!latestVersion) {
    return null;
  }

  return compareDesignDocuments(latestVersion.design_document, parsedDraft.design_document);
}
