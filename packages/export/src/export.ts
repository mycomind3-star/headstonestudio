import { z } from "zod";
import { createProofDocument, type ProofDocumentMetadata } from "@headstone/proof";
import { renderDesignDocumentToSvg } from "@headstone/render";
import { designDocumentSchema, type DesignDocument } from "@headstone/schema";
import { designVersionSchema, type DesignVersion } from "@headstone/core";

const isoTimestampSchema = z.string().datetime({ offset: true });

const proofDocumentMetadataSchema = z
  .object({
    proofId: z.string().min(1),
    proofVersionId: z.string().min(1),
    proofVersionNumber: z.number().int().positive(),
    proofVersionLabel: z.string().min(1),
    proofVersionCreatedAt: isoTimestampSchema,
    proofVersionCreatedAtLabel: z.string().min(1),
    generatedAt: isoTimestampSchema,
    generatedAtLabel: z.string().min(1),
    createdByLabel: z.string().min(1),
    memorialName: z.string().min(1),
    birthDateText: z.string().nullable(),
    deathDateText: z.string().nullable(),
    epitaphText: z.string().nullable(),
    dimensionsLabel: z.string().min(1),
    units: z.enum(["in", "mm"]),
    shape: z.string().min(1),
    material: z.string().min(1),
    finish: z.string().min(1),
  })
  .strict();

const exportCandidateInputSchema = z
  .object({
    selectedProofVersion: designVersionSchema,
    designDocument: designDocumentSchema,
    renderedSvg: z.string().min(1),
    proofDocumentMetadata: proofDocumentMetadataSchema.nullable().optional(),
    familyApprovalSummary: z.string().min(1).nullable().optional(),
    vendorReviewSummary: z.string().min(1).nullable().optional(),
    createdAt: isoTimestampSchema,
    createdByLabel: z.string().min(1),
  })
  .strict();

const exportCandidateWarningSchema = z
  .object({
    id: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const exportCandidateFileSchema = z
  .object({
    name: z.string().min(1),
    mimeType: z.string().min(1),
    content: z.string(),
    downloadName: z.string().min(1).nullable(),
  })
  .strict();

const exportCandidateMetadataSchema = z
  .object({
    exportType: z.literal("local_svg_candidate"),
    createdAt: isoTimestampSchema,
    createdByLabel: z.string().min(1),
    exportFileName: z.string().min(1),
    proofVersionId: z.string().min(1),
    proofVersionNumber: z.number().int().positive(),
    proofVersionLabel: z.string().min(1),
    proofVersionCreatedAt: isoTimestampSchema,
    memorialName: z.string().min(1),
    birthDateText: z.string().nullable(),
    deathDateText: z.string().nullable(),
    epitaphText: z.string().nullable(),
    dimensionsLabel: z.string().min(1),
    units: z.enum(["in", "mm"]),
    shape: z.string().min(1),
    material: z.string().min(1),
    finish: z.string().min(1),
    proofDocumentMetadata: proofDocumentMetadataSchema.nullable(),
    familyApprovalSummary: z.string().nullable(),
    vendorReviewSummary: z.string().nullable(),
  })
  .strict();

export const exportCandidateWarningMessages = [
  "Export candidate only — not certified production-ready.",
  "Verify dimensions, scale, margins, material, artwork, and laser settings before engraving.",
  "Family approval and vendor review do not automatically make this file machine-ready.",
  "Test on scrap material or a non-final sample before production.",
] as const;

const exportCandidateWarnings: ExportCandidateWarning[] = exportCandidateWarningMessages.map((message, index) => ({
  id: `warning_${String(index + 1).padStart(2, "0")}`,
  message,
}));

const exportFileNames = {
  svg: "memorial-design-candidate.svg",
  designDocument: "design-document.json",
  manifest: "manifest.json",
  transcript: "transcript.txt",
  warnings: "warnings.txt",
} as const;

export interface ExportCandidateWarning {
  id: string;
  message: string;
}

export interface ExportCandidateFile {
  name: string;
  mimeType: string;
  content: string;
  downloadName: string | null;
}

export interface ExportCandidateMetadata {
  exportType: "local_svg_candidate";
  createdAt: string;
  createdByLabel: string;
  exportFileName: string;
  proofVersionId: string;
  proofVersionNumber: number;
  proofVersionLabel: string;
  proofVersionCreatedAt: string;
  memorialName: string;
  birthDateText: string | null;
  deathDateText: string | null;
  epitaphText: string | null;
  dimensionsLabel: string;
  units: DesignDocument["units"];
  shape: string;
  material: string;
  finish: string;
  proofDocumentMetadata: ProofDocumentMetadata | null;
  familyApprovalSummary: string | null;
  vendorReviewSummary: string | null;
}

export interface ExportCandidatePackage {
  metadata: ExportCandidateMetadata;
  warnings: ExportCandidateWarning[];
  files: ExportCandidateFile[];
  manifest: string;
  transcript: string;
}

export interface ExportCandidateInput {
  selectedProofVersion: DesignVersion;
  designDocument: DesignDocument;
  renderedSvg: string;
  proofDocumentMetadata?: ProofDocumentMetadata | null | undefined;
  familyApprovalSummary?: string | null | undefined;
  vendorReviewSummary?: string | null | undefined;
  createdAt: string;
  createdByLabel: string;
}

function formatExportTimestamp(iso: string): string {
  const date = new Date(iso);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function normalizeFileSegment(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe.length > 0 ? safe : "memorial";
}

function sameDocument(left: DesignDocument, right: DesignDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function extractMemorialText(document: DesignDocument): {
  memorialName: string;
  birthDateText: string | null;
  deathDateText: string | null;
  epitaphText: string | null;
} {
  let memorialName = "Memorial draft";
  let birthDateText: string | null = null;
  let deathDateText: string | null = null;
  let epitaphText: string | null = null;

  for (const element of document.elements) {
    if (element.type !== "text") {
      continue;
    }

    const content = element.content.trim();
    if (content.length === 0) {
      continue;
    }

    if (element.field === "name") {
      memorialName = content;
      continue;
    }

    if (element.field === "birth_date") {
      birthDateText = content;
      continue;
    }

    if (element.field === "death_date") {
      deathDateText = content;
      continue;
    }

    if (element.field === "epitaph") {
      epitaphText = content;
    }
  }

  return {
    memorialName,
    birthDateText,
    deathDateText,
    epitaphText,
  };
}

function buildExportCandidate(input: ExportCandidateInput) {
  const parsed = exportCandidateInputSchema.parse(input);
  const parsedDesignDocument = designDocumentSchema.parse(parsed.designDocument);
  const parsedProofVersion = designVersionSchema.parse(parsed.selectedProofVersion);
  const expectedRenderedSvg = renderDesignDocumentToSvg(parsedDesignDocument);

  if (!sameDocument(parsedProofVersion.design_document, parsedDesignDocument)) {
    throw new Error("Export candidates must use the selected proof version snapshot.");
  }

  if (parsed.renderedSvg !== expectedRenderedSvg) {
    throw new Error("Export candidates must use the deterministic SVG render output.");
  }

  const proofDocument = createProofDocument({
    proofVersion: parsedProofVersion,
    designDocument: parsedDesignDocument,
    renderedSvg: parsed.renderedSvg,
    createdAt: parsed.createdAt,
    createdByLabel: parsed.createdByLabel,
  });

  if (parsed.proofDocumentMetadata !== undefined && parsed.proofDocumentMetadata !== null) {
    if (
      parsed.proofDocumentMetadata.proofVersionId !== proofDocument.metadata.proofVersionId ||
      parsed.proofDocumentMetadata.proofVersionNumber !== proofDocument.metadata.proofVersionNumber ||
      parsed.proofDocumentMetadata.proofId !== proofDocument.metadata.proofId
    ) {
      throw new Error("Export candidate metadata must match the selected proof version.");
    }
  }

  const memorialText = extractMemorialText(parsedDesignDocument);
  const exportFileName = createExportFileName(parsed);
  const metadata: ExportCandidateMetadata = {
    exportType: "local_svg_candidate",
    createdAt: parsed.createdAt,
    createdByLabel: parsed.createdByLabel,
    exportFileName,
    proofVersionId: proofDocument.metadata.proofVersionId,
    proofVersionNumber: proofDocument.metadata.proofVersionNumber,
    proofVersionLabel: proofDocument.metadata.proofVersionLabel,
    proofVersionCreatedAt: proofDocument.metadata.proofVersionCreatedAt,
    memorialName: memorialText.memorialName,
    birthDateText: memorialText.birthDateText,
    deathDateText: memorialText.deathDateText,
    epitaphText: memorialText.epitaphText,
    dimensionsLabel: proofDocument.metadata.dimensionsLabel,
    units: proofDocument.metadata.units,
    shape: proofDocument.metadata.shape,
    material: proofDocument.metadata.material,
    finish: proofDocument.metadata.finish,
    proofDocumentMetadata: parsed.proofDocumentMetadata ?? proofDocument.metadata,
    familyApprovalSummary: parsed.familyApprovalSummary ?? null,
    vendorReviewSummary: parsed.vendorReviewSummary ?? null,
  };

  const transcriptLines = [
    "Export candidate only — not certified production-ready.",
    `Created by: ${parsed.createdByLabel}`,
    `Created at: ${formatExportTimestamp(parsed.createdAt)}`,
    `Proof version: ${proofDocument.metadata.proofVersionLabel} (${proofDocument.metadata.proofVersionId})`,
    `Snapshot time: ${formatExportTimestamp(proofDocument.metadata.proofVersionCreatedAt)}`,
    "",
    "Memorial text transcript:",
    proofDocument.transcript.trim().length > 0 ? proofDocument.transcript.trim() : "No memorial text was found.",
  ];

  if (parsed.familyApprovalSummary !== undefined && parsed.familyApprovalSummary !== null) {
    transcriptLines.push("");
    transcriptLines.push(`Family approval summary: ${parsed.familyApprovalSummary}`);
  }

  if (parsed.vendorReviewSummary !== undefined && parsed.vendorReviewSummary !== null) {
    transcriptLines.push("");
    transcriptLines.push(`Vendor review summary: ${parsed.vendorReviewSummary}`);
  }

  const transcript = transcriptLines.join("\n");
  const warningsText = exportCandidateWarnings.map((warning) => warning.message).join("\n");
  const designDocumentJson = JSON.stringify(parsedDesignDocument, null, 2);
  const manifest = createExportManifestFromMetadata(metadata);

  const files: ExportCandidateFile[] = [
    {
      name: exportFileNames.svg,
      mimeType: "image/svg+xml",
      content: parsed.renderedSvg,
      downloadName: exportFileName,
    },
    {
      name: exportFileNames.designDocument,
      mimeType: "application/json",
      content: designDocumentJson,
      downloadName: null,
    },
    {
      name: exportFileNames.manifest,
      mimeType: "application/json",
      content: manifest,
      downloadName: null,
    },
    {
      name: exportFileNames.transcript,
      mimeType: "text/plain",
      content: transcript,
      downloadName: null,
    },
    {
      name: exportFileNames.warnings,
      mimeType: "text/plain",
      content: warningsText,
      downloadName: null,
    },
  ];

  return {
    metadata,
    transcript,
    manifest,
    warnings: exportCandidateWarnings.map((warning) => ({ ...warning })),
    files,
  } satisfies ExportCandidatePackage;
}

function createExportManifestFromMetadata(metadata: ExportCandidateMetadata): string {
  return JSON.stringify(
    {
      export_type: metadata.exportType,
      created_at: metadata.createdAt,
      created_by_label: metadata.createdByLabel,
      export_file_name: metadata.exportFileName,
      proof_version: {
        id: metadata.proofVersionId,
        version_number: metadata.proofVersionNumber,
        label: metadata.proofVersionLabel,
        created_at: metadata.proofVersionCreatedAt,
      },
      memorial: {
        name: metadata.memorialName,
        birth_date_text: metadata.birthDateText,
        death_date_text: metadata.deathDateText,
        epitaph_text: metadata.epitaphText,
        dimensions_label: metadata.dimensionsLabel,
        units: metadata.units,
        shape: metadata.shape,
        material: metadata.material,
        finish: metadata.finish,
      },
      proof_document_metadata: metadata.proofDocumentMetadata,
      family_approval_summary: metadata.familyApprovalSummary,
      vendor_review_summary: metadata.vendorReviewSummary,
      files: [
        exportFileNames.svg,
        exportFileNames.designDocument,
        exportFileNames.manifest,
        exportFileNames.transcript,
        exportFileNames.warnings,
      ],
      warnings: exportCandidateWarnings.map((warning) => warning.message),
    },
    null,
    2,
  );
}

export function createExportFileName(input: ExportCandidateInput): string {
  const parsed = exportCandidateInputSchema.parse(input);
  const parsedDesignDocument = designDocumentSchema.parse(parsed.designDocument);
  const parsedProofVersion = designVersionSchema.parse(parsed.selectedProofVersion);

  if (!sameDocument(parsedProofVersion.design_document, parsedDesignDocument)) {
    throw new Error("Export candidates must use the selected proof version snapshot.");
  }

  const memorialName = extractMemorialText(parsedDesignDocument).memorialName;
  const memorialSegment = normalizeFileSegment(memorialName);
  const versionSegment = normalizeFileSegment(
    `${parsedProofVersion.label}-v${parsedProofVersion.version_number}`,
  );
  return `memorial-design-candidate-${memorialSegment}-${versionSegment}.svg`;
}

export function createExportManifest(input: ExportCandidateInput): string {
  return buildExportCandidate(input).manifest;
}

export function createSvgExportCandidate(input: ExportCandidateInput): ExportCandidatePackage {
  return buildExportCandidate(input);
}

export {
  exportCandidateInputSchema,
  exportCandidateMetadataSchema,
  exportCandidateWarningSchema,
};
