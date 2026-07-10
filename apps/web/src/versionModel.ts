import { type DesignVersion } from "@headstone/core";
import { getEditableFields } from "./editorModel";

export function summarizeProofVersion(version: DesignVersion): string {
  const fields = getEditableFields(version.design_document);
  const parts: string[] = [];

  if (fields.name.trim()) {
    parts.push(fields.name.trim());
  }

  const dateLine = [fields.birth_date.trim(), fields.death_date.trim()].filter(Boolean).join(" - ");
  if (dateLine) {
    parts.push(dateLine);
  }

  if (fields.epitaph.trim()) {
    parts.push(fields.epitaph.trim());
  }

  return parts.length > 0 ? parts.join(" · ") : "No memorial text yet";
}

export function formatVersionLabel(version: DesignVersion): string {
  return version.label.trim().length > 0 ? version.label : `Proof v${version.version_number}`;
}
