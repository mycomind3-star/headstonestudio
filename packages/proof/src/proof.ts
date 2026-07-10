import { z } from "zod";
import {
  designVersionSchema,
  listActiveProofApprovals,
  listOpenReviewNotes,
  proofApprovalRecordSchema,
  proofReviewNoteSchema,
  type DesignVersion,
  type ProofApprovalRecord,
  type ProofReviewNote,
} from "@headstone/core";
import { designDocumentSchema, type DesignDocument, type DesignElement } from "@headstone/schema";

const isoTimestampSchema = z.string().datetime({ offset: true });

const proofDocumentSectionKindSchema = z.enum([
  "warnings",
  "preview",
  "transcript",
  "checklist",
  "approval_status",
  "review_notes",
  "diff_summary",
]);

const proofDocumentWarningSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const proofDocumentSectionSchema = z
  .object({
    id: z.string().min(1),
    kind: proofDocumentSectionKindSchema,
    title: z.string().min(1),
    summary: z.string().nullable(),
    content: z.string().nullable(),
    items: z.array(z.string().min(1)),
  })
  .strict();

const proofDocumentInputSchema = z
  .object({
    proofVersion: designVersionSchema,
    designDocument: designDocumentSchema,
    renderedSvg: z.string().min(1),
    familyApprovalRecords: z.array(proofApprovalRecordSchema).optional(),
    reviewNotes: z.array(proofReviewNoteSchema).optional(),
    diffSummary: z.string().min(1).nullable().optional(),
    createdAt: isoTimestampSchema,
    createdByLabel: z.string().min(1),
  })
  .strict();

export type ProofDocumentSectionKind = z.infer<typeof proofDocumentSectionKindSchema>;

export interface ProofDocumentWarning {
  id: string;
  title: string;
  message: string;
}

export interface ProofDocumentSection {
  id: string;
  kind: ProofDocumentSectionKind;
  title: string;
  summary: string | null;
  content: string | null;
  items: string[];
}

export interface ProofDocumentMetadata {
  proofId: string;
  proofVersionId: string;
  proofVersionNumber: number;
  proofVersionLabel: string;
  proofVersionCreatedAt: string;
  proofVersionCreatedAtLabel: string;
  generatedAt: string;
  generatedAtLabel: string;
  createdByLabel: string;
  memorialName: string;
  birthDateText: string | null;
  deathDateText: string | null;
  epitaphText: string | null;
  dimensionsLabel: string;
  units: DesignDocument["units"];
  shape: string;
  material: string;
  finish: string;
}

export interface ProofDocument {
  id: string;
  title: string;
  metadata: ProofDocumentMetadata;
  renderedSvg: string;
  warnings: ProofDocumentWarning[];
  sections: ProofDocumentSection[];
  transcript: string;
  checklist: string[];
  approvalStatusSummary: string | null;
  reviewNotesSummary: string | null;
  diffSummary: string | null;
  fileName: string;
}

export interface ProofDocumentInput {
  proofVersion: DesignVersion;
  designDocument: DesignDocument;
  renderedSvg: string;
  familyApprovalRecords?: readonly ProofApprovalRecord[];
  reviewNotes?: readonly ProofReviewNote[];
  diffSummary?: string | null;
  createdAt: string;
  createdByLabel: string;
}

const proofWarnings: ProofDocumentWarning[] = [
  {
    id: "proof-only",
    title: "Proof only",
    message: "Proof only — not production-ready.",
  },
  {
    id: "family-vendor-review",
    title: "Family review reminder",
    message: "Family approval does not replace vendor production review.",
  },
  {
    id: "review-carefully",
    title: "Careful review",
    message: "Names, dates, spelling, layout, and artwork should be reviewed carefully before production.",
  },
];

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(3));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatProofTimestamp(iso: string): string {
  const date = new Date(iso);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function sameDocument(left: DesignDocument, right: DesignDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeProofApprovalRecord(input: z.infer<typeof proofApprovalRecordSchema>): ProofApprovalRecord {
  const record: ProofApprovalRecord = {
    id: input.id,
    versionId: input.versionId,
    status: input.status,
    approverName: input.approverName,
    approverRoleLabel: input.approverRoleLabel,
    approvedAt: input.approvedAt,
    approvalTextSnapshot: input.approvalTextSnapshot,
    acknowledgments: input.acknowledgments,
    createdByLabel: input.createdByLabel,
  };

  if (input.revokedAt !== undefined) {
    record.revokedAt = input.revokedAt;
  }

  if (input.revokedReason !== undefined) {
    record.revokedReason = input.revokedReason;
  }

  return record;
}

function normalizeProofReviewNote(input: z.infer<typeof proofReviewNoteSchema>): ProofReviewNote {
  const note: ProofReviewNote = {
    id: input.id,
    versionId: input.versionId,
    type: input.type,
    status: input.status,
    body: input.body,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    createdByLabel: input.createdByLabel,
  };

  if (input.diffItemId !== undefined) {
    note.diffItemId = input.diffItemId;
  }

  if (input.diffField !== undefined) {
    note.diffField = input.diffField;
  }

  return note;
}

function normalizeText(value: string): string {
  return value.trim();
}

function getTextElement(
  document: DesignDocument,
  field: string,
): Extract<DesignElement, { type: "text" }> | null {
  const element = document.elements.find(
    (candidate): candidate is Extract<DesignElement, { type: "text" }> =>
      candidate.type === "text" && candidate.field === field,
  );
  return element ?? null;
}

function splitDateRange(content: string): { birthDateText: string | null; deathDateText: string | null } {
  const trimmed = normalizeText(content);
  if (trimmed.length === 0) {
    return { birthDateText: null, deathDateText: null };
  }

  const parts = trimmed.split(/\s[-–—]\s/);
  if (parts.length >= 2) {
    return {
      birthDateText: parts[0]?.trim() ?? null,
      deathDateText: parts.slice(1).join(" - ").trim() || null,
    };
  }

  return {
    birthDateText: trimmed,
    deathDateText: null,
  };
}

function extractMemorialText(document: DesignDocument): {
  memorialName: string;
  birthDateText: string | null;
  deathDateText: string | null;
  epitaphText: string | null;
  transcriptLines: string[];
} {
  const transcriptLines: string[] = [];
  let memorialName = "Memorial draft";
  let birthDateText: string | null = null;
  let deathDateText: string | null = null;
  let epitaphText: string | null = null;

  for (const element of document.elements) {
    if (element.type !== "text") {
      continue;
    }

    const content = normalizeText(element.content);
    if (content.length === 0) {
      continue;
    }

    if (element.field === "name") {
      memorialName = content;
      transcriptLines.push(`Name: ${content}`);
      continue;
    }

    if (element.field === "birth_date") {
      birthDateText = content;
      transcriptLines.push(`Birth date: ${content}`);
      continue;
    }

    if (element.field === "death_date") {
      deathDateText = content;
      transcriptLines.push(`Death date: ${content}`);
      continue;
    }

    if (element.field === "dates") {
      const split = splitDateRange(content);
      if (split.birthDateText !== null && split.deathDateText !== null) {
        birthDateText = split.birthDateText;
        deathDateText = split.deathDateText;
        transcriptLines.push(`Birth date: ${split.birthDateText}`);
        transcriptLines.push(`Death date: ${split.deathDateText}`);
      } else {
        transcriptLines.push(`Dates: ${content}`);
        if (birthDateText === null) {
          birthDateText = split.birthDateText;
        }
        if (deathDateText === null) {
          deathDateText = split.deathDateText;
        }
      }
      continue;
    }

    if (element.field === "epitaph") {
      epitaphText = content;
      transcriptLines.push(`Epitaph: ${content}`);
      continue;
    }

    transcriptLines.push(`${element.field ?? element.id}: ${content}`);
  }

  return {
    memorialName,
    birthDateText,
    deathDateText,
    epitaphText,
    transcriptLines,
  };
}

function createChecklistItems(metadata: ProofDocumentMetadata): string[] {
  return [
    `Review the memorial name spelling for ${metadata.memorialName}.`,
    "Check birth and death dates carefully against the source record.",
    "Review epitaph wording, line breaks, layout, and artwork before printing.",
    "Confirm the proof is only for review and is not production approval.",
  ];
}

function summarizeApprovals(approvals: readonly ProofApprovalRecord[]): {
  summary: string | null;
  items: string[];
} {
  if (approvals.length === 0) {
    return {
      summary: null,
      items: [],
    };
  }

  const activeApprovals = listActiveProofApprovals(approvals);
  const revokedApprovals = approvals.filter((record) => record.status === "revoked");
  const parts: string[] = [];

  if (activeApprovals.length > 0) {
    parts.push(
      `${activeApprovals.length} active family approval${activeApprovals.length === 1 ? "" : "s"}`,
    );
  }

  if (revokedApprovals.length > 0) {
    parts.push(`${revokedApprovals.length} revoked approval${revokedApprovals.length === 1 ? "" : "s"}`);
  }

  const items = approvals.map((record) => {
    const stamp = record.status === "revoked" && record.revokedAt !== undefined ? record.revokedAt : record.approvedAt;
    const statusLabel = record.status === "family_approved" ? "Approved" : "Revoked";
    const label = `${statusLabel} by ${record.approverName} · ${record.approverRoleLabel} · ${record.createdByLabel} · ${formatProofTimestamp(stamp)}`;
    return record.revokedReason ? `${label} · ${record.revokedReason}` : label;
  });

  return {
    summary: `Approval records: ${parts.join(" and ")}.`,
    items,
  };
}

function summarizeReviewNotes(notes: readonly ProofReviewNote[]): { summary: string | null; items: string[] } {
  if (notes.length === 0) {
    return {
      summary: null,
      items: [],
    };
  }

  const openNotes = listOpenReviewNotes(notes);
  const resolvedCount = notes.filter((note) => note.status === "resolved").length;
  const dismissedCount = notes.filter((note) => note.status === "dismissed").length;
  const summaryParts: string[] = [];

  summaryParts.push(`${openNotes.length} open review note${openNotes.length === 1 ? "" : "s"}`);
  if (resolvedCount > 0) {
    summaryParts.push(`${resolvedCount} resolved`);
  }
  if (dismissedCount > 0) {
    summaryParts.push(`${dismissedCount} dismissed`);
  }

  const items = notes.map((note) => {
    const stamp = formatProofTimestamp(note.updatedAt);
    const base = `${note.type} · ${note.status} · ${note.createdByLabel} · ${stamp}`;
    return note.diffField ? `${base} · ${note.diffField} · ${note.body}` : `${base} · ${note.body}`;
  });

  return {
    summary: `Review notes: ${summaryParts.join(", ")}.`,
    items,
  };
}

function buildProofDocumentSections(
  proof: ProofDocument,
  approvals: readonly ProofApprovalRecord[],
  reviewNotes: readonly ProofReviewNote[],
): ProofDocumentSection[] {
  const approvalSummary = summarizeApprovals(approvals);
  const reviewNoteSummary = summarizeReviewNotes(reviewNotes);
  const sections: ProofDocumentSection[] = [
    {
      id: "warnings",
      kind: "warnings",
      title: "Proof only warnings",
      summary: "Important reminders for review.",
      content: null,
      items: proof.warnings.map((warning) => warning.message),
    },
    {
      id: "preview",
      kind: "preview",
      title: "Memorial preview",
      summary: "Rendered from the selected proof version snapshot.",
      content: proof.renderedSvg,
      items: [],
    },
    {
      id: "transcript",
      kind: "transcript",
      title: "Memorial text transcript",
      summary: "Every engraved text element is listed in plain text.",
      content: proof.transcript,
      items: [],
    },
    {
      id: "checklist",
      kind: "checklist",
      title: "Review checklist",
      summary: "A calm reminder of the main review steps.",
      content: null,
      items: proof.checklist,
    },
  ];

  if (approvalSummary.summary !== null) {
    sections.push({
      id: "approval-status",
      kind: "approval_status",
      title: "Approval status",
      summary: approvalSummary.summary,
      content: null,
      items: approvalSummary.items,
    });
  }

  if (reviewNoteSummary.summary !== null) {
    sections.push({
      id: "review-notes",
      kind: "review_notes",
      title: "Review notes",
      summary: reviewNoteSummary.summary,
      content: null,
      items: reviewNoteSummary.items,
    });
  }

  if (proof.diffSummary !== null) {
    sections.push({
      id: "diff-summary",
      kind: "diff_summary",
      title: "Change summary",
      summary: proof.diffSummary,
      content: null,
      items: [],
    });
  }

  return sections;
}

export function createProofTranscript(proof: ProofDocument): string {
  return proof.transcript;
}

export function createProofFileName(proof: ProofDocument): string {
  const safeName = normalizeFileSegment(proof.metadata.memorialName);
  const safeVersionId = normalizeFileSegment(proof.metadata.proofVersionId);
  return `proof-${safeName}-${safeVersionId}.pdf`;
}

function normalizeFileSegment(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe.length > 0 ? safe : "memorial";
}

export function createProofDocument(input: ProofDocumentInput): ProofDocument {
  const parsed = proofDocumentInputSchema.parse(input);
  const parsedDesignDocument = designDocumentSchema.parse(parsed.designDocument);
  const parsedProofVersion = designVersionSchema.parse(parsed.proofVersion);

  if (!sameDocument(parsedProofVersion.design_document, parsedDesignDocument)) {
    throw new Error("Proof documents must use the selected proof version snapshot.");
  }

  const memorialText = extractMemorialText(parsedDesignDocument);
  const metadata: ProofDocumentMetadata = {
    proofId: parsedProofVersion.id,
    proofVersionId: parsedProofVersion.id,
    proofVersionNumber: parsedProofVersion.version_number,
    proofVersionLabel: parsedProofVersion.label.trim(),
    proofVersionCreatedAt: parsedProofVersion.created_at,
    proofVersionCreatedAtLabel: formatProofTimestamp(parsedProofVersion.created_at),
    generatedAt: parsed.createdAt,
    generatedAtLabel: formatProofTimestamp(parsed.createdAt),
    createdByLabel: parsed.createdByLabel,
    memorialName: memorialText.memorialName,
    birthDateText: memorialText.birthDateText,
    deathDateText: memorialText.deathDateText,
    epitaphText: memorialText.epitaphText,
    dimensionsLabel: `${formatNumber(parsedDesignDocument.face.width)} x ${formatNumber(parsedDesignDocument.face.height)} x ${formatNumber(parsedDesignDocument.face.depth)} ${parsedDesignDocument.units}`,
    units: parsedDesignDocument.units,
    shape: parsedDesignDocument.face.shape,
    material: parsedDesignDocument.face.material,
    finish: parsedDesignDocument.face.finish,
  };

  const proof: ProofDocument = {
    id: parsedProofVersion.id,
    title: "Memorial Design Proof",
    metadata,
    renderedSvg: parsed.renderedSvg,
    warnings: proofWarnings.map((warning) => ({ ...warning })),
    sections: [],
    transcript: memorialText.transcriptLines.length > 0 ? memorialText.transcriptLines.join("\n") : "No memorial text was found.",
    checklist: createChecklistItems(metadata),
    approvalStatusSummary: null,
    reviewNotesSummary: null,
    diffSummary: parsed.diffSummary ?? null,
    fileName: "",
  };

  const approvals = (parsed.familyApprovalRecords ?? []).map(normalizeProofApprovalRecord);
  const reviewNotes = (parsed.reviewNotes ?? []).map(normalizeProofReviewNote);
  const approvalSummary = summarizeApprovals(approvals);
  const reviewNoteSummary = summarizeReviewNotes(reviewNotes);

  proof.sections = buildProofDocumentSections(proof, approvals, reviewNotes);
  proof.approvalStatusSummary = approvalSummary.summary;
  proof.reviewNotesSummary = reviewNoteSummary.summary;
  proof.fileName = createProofFileName(proof);

  return {
    ...proof,
    warnings: proof.warnings.map((warning) => ({ ...warning })),
    sections: proof.sections.map((section) => ({
      ...section,
      items: [...section.items],
    })),
    checklist: [...proof.checklist],
  };
}
