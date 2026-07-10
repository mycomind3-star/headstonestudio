import { z } from "zod";

const isoTimestampSchema = z.string().datetime({ offset: true });

const proofApprovalStatusValues = ["family_approved", "revoked"] as const;
export const proofApprovalStatusSchema = z.enum(proofApprovalStatusValues);
export type ProofApprovalStatus = z.infer<typeof proofApprovalStatusSchema>;

const proofApprovalAcknowledgmentValues = [
  "name_spelling_reviewed",
  "birth_date_reviewed",
  "death_date_reviewed",
  "epitaph_reviewed",
  "understands_not_production_approval",
] as const;
export const proofApprovalAcknowledgmentSchema = z.enum(proofApprovalAcknowledgmentValues);
export type ProofApprovalAcknowledgment = z.infer<typeof proofApprovalAcknowledgmentSchema>;

const proofApprovalAcknowledgmentRecordSchema = z
  .object({
    name_spelling_reviewed: z.literal(true),
    birth_date_reviewed: z.literal(true),
    death_date_reviewed: z.literal(true),
    epitaph_reviewed: z.literal(true),
    understands_not_production_approval: z.literal(true),
  })
  .strict();

type ProofApprovalAcknowledgmentRecord = z.infer<typeof proofApprovalAcknowledgmentRecordSchema>;
type ProofApprovalAcknowledgmentInput = Record<ProofApprovalAcknowledgment, boolean>;

export interface ProofApprovalRecord {
  id: string;
  versionId: string;
  status: ProofApprovalStatus;
  approverName: string;
  approverRoleLabel: string;
  approvedAt: string;
  approvalTextSnapshot: string;
  acknowledgments: ProofApprovalAcknowledgmentRecord;
  createdByLabel: string;
  revokedAt?: string;
  revokedReason?: string;
}

export interface CreateProofApprovalInput {
  id: string;
  versionId: string;
  approverName: string;
  approverRoleLabel: string;
  approvedAt: string;
  approvalTextSnapshot: string;
  acknowledgments: ProofApprovalAcknowledgmentInput;
  createdByLabel: string;
}

export interface RevokeProofApprovalInput {
  revokedAt: string;
  revokedReason: string;
}

export const createProofApprovalInputSchema = z
  .object({
    id: z.string().min(1),
    versionId: z.string().min(1),
    approverName: z.string().min(1),
    approverRoleLabel: z.string().min(1),
    approvedAt: isoTimestampSchema,
    approvalTextSnapshot: z.string().min(1),
    acknowledgments: proofApprovalAcknowledgmentRecordSchema,
    createdByLabel: z.string().min(1),
  })
  .strict();

export const revokeProofApprovalInputSchema = z
  .object({
    revokedAt: isoTimestampSchema,
    revokedReason: z.string().min(1),
  })
  .strict();

export const proofApprovalRecordSchema = z
  .object({
    id: z.string().min(1),
    versionId: z.string().min(1),
    status: proofApprovalStatusSchema,
    approverName: z.string().min(1),
    approverRoleLabel: z.string().min(1),
    approvedAt: isoTimestampSchema,
    approvalTextSnapshot: z.string().min(1),
    acknowledgments: proofApprovalAcknowledgmentRecordSchema,
    createdByLabel: z.string().min(1),
    revokedAt: isoTimestampSchema.optional(),
    revokedReason: z.string().min(1).optional(),
  })
  .strict();

const proofApprovalsEnvelopeSchema = z
  .object({
    approvals: z.array(proofApprovalRecordSchema),
    saved_at: isoTimestampSchema,
  })
  .strict();

export type ProofApprovalsEnvelope = z.infer<typeof proofApprovalsEnvelopeSchema>;

function buildProofApprovalRecord(
  approval: {
    id: string;
    versionId: string;
    status: ProofApprovalStatus;
    approverName: string;
    approverRoleLabel: string;
    approvedAt: string;
    approvalTextSnapshot: string;
    acknowledgments: ProofApprovalAcknowledgmentRecord;
    createdByLabel: string;
    revokedAt: string | undefined;
    revokedReason: string | undefined;
  },
): ProofApprovalRecord {
  const result: ProofApprovalRecord = {
    id: approval.id,
    versionId: approval.versionId,
    status: approval.status,
    approverName: approval.approverName,
    approverRoleLabel: approval.approverRoleLabel,
    approvedAt: approval.approvedAt,
    approvalTextSnapshot: approval.approvalTextSnapshot,
    acknowledgments: approval.acknowledgments,
    createdByLabel: approval.createdByLabel,
  };

  if (approval.revokedAt !== undefined) {
    result.revokedAt = approval.revokedAt;
  }

  if (approval.revokedReason !== undefined) {
    result.revokedReason = approval.revokedReason;
  }

  return result;
}

export function createProofApprovalRecord(input: CreateProofApprovalInput): ProofApprovalRecord {
  const parsed = createProofApprovalInputSchema.parse(input);

  return buildProofApprovalRecord({
    id: parsed.id,
    versionId: parsed.versionId,
    status: "family_approved",
    approverName: parsed.approverName,
    approverRoleLabel: parsed.approverRoleLabel,
    approvedAt: parsed.approvedAt,
    approvalTextSnapshot: parsed.approvalTextSnapshot,
    acknowledgments: parsed.acknowledgments,
    createdByLabel: parsed.createdByLabel,
    revokedAt: undefined,
    revokedReason: undefined,
  });
}

export function revokeProofApprovalRecord(
  record: ProofApprovalRecord,
  input: RevokeProofApprovalInput,
): ProofApprovalRecord {
  const parsedRecord = proofApprovalRecordSchema.parse(record);
  const parsedInput = revokeProofApprovalInputSchema.parse(input);

  return buildProofApprovalRecord({
    id: parsedRecord.id,
    versionId: parsedRecord.versionId,
    status: "revoked",
    approverName: parsedRecord.approverName,
    approverRoleLabel: parsedRecord.approverRoleLabel,
    approvedAt: parsedRecord.approvedAt,
    approvalTextSnapshot: parsedRecord.approvalTextSnapshot,
    acknowledgments: parsedRecord.acknowledgments,
    createdByLabel: parsedRecord.createdByLabel,
    revokedAt: parsedInput.revokedAt,
    revokedReason: parsedInput.revokedReason,
  });
}

export function listActiveProofApprovals(records: readonly ProofApprovalRecord[]): ProofApprovalRecord[] {
  return records.filter((record) => record.status === "family_approved");
}

export function listApprovalsForVersion(
  records: readonly ProofApprovalRecord[],
  versionId: string,
): ProofApprovalRecord[] {
  const parsedVersionId = z.string().min(1).parse(versionId);
  return records.filter((record) => record.versionId === parsedVersionId);
}

export function hasActiveFamilyApprovalForVersion(
  records: readonly ProofApprovalRecord[],
  versionId: string,
): boolean {
  return listApprovalsForVersion(records, versionId).some((record) => record.status === "family_approved");
}

export function serializeProofApprovals(
  approvals: readonly ProofApprovalRecord[],
  savedAt = new Date().toISOString(),
): string {
  const parsedApprovals = z.array(proofApprovalRecordSchema).parse(approvals) as ProofApprovalRecord[];
  const parsedSavedAt = isoTimestampSchema.parse(savedAt);

  return JSON.stringify({
    approvals: parsedApprovals,
    saved_at: parsedSavedAt,
  });
}

export function recoverProofApprovals(
  raw: string | null,
  storageKey = "headstone-design-studio:family-proof-approvals:v1",
): { ok: true; approvals: ProofApprovalRecord[]; storage_key: string } | { ok: false; storage_key: string; message: string } {
  if (raw === null) {
    return {
      ok: false,
      storage_key: storageKey,
      message: "No saved family approvals were found.",
    };
  }

  try {
    const parsed = proofApprovalsEnvelopeSchema.parse(JSON.parse(raw));
    return {
      ok: true,
      storage_key: storageKey,
      approvals: parsed.approvals as ProofApprovalRecord[],
    };
  } catch {
    return {
      ok: false,
      storage_key: storageKey,
      message: "We could not restore the saved family approvals. The draft was left unchanged.",
    };
  }
}
