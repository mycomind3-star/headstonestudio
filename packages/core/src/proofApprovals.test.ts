import { describe, expect, it } from "vitest";
import {
  createProofApprovalRecord,
  hasActiveFamilyApprovalForVersion,
  listActiveProofApprovals,
  listApprovalsForVersion,
  recoverProofApprovals,
  revokeProofApprovalRecord,
} from "./index";

const baseNow = "2026-07-10T00:00:00.000Z";

function makeApprovalInput(overrides = {}) {
  return {
    id: "approval_1",
    versionId: "version_1",
    approverName: "Jordan Lee",
    approverRoleLabel: "Family reviewer" as const,
    approvedAt: baseNow,
    approvalTextSnapshot: "Proof v1 · Margaret A. Holloway · 1947 - 2026 · Beloved mother",
    acknowledgments: {
      name_spelling_reviewed: true,
      birth_date_reviewed: true,
      death_date_reviewed: true,
      epitaph_reviewed: true,
      understands_not_production_approval: true,
    },
    createdByLabel: "Local reviewer",
    ...overrides,
  };
}

describe("proof approvals", () => {
  it("creates a valid approval record", () => {
    const approval = createProofApprovalRecord(makeApprovalInput());

    expect(approval.status).toBe("family_approved");
    expect(approval.versionId).toBe("version_1");
    expect(approval.approverName).toBe("Jordan Lee");
  });

  it("rejects a missing versionId", () => {
    expect(() =>
      createProofApprovalRecord({
        ...makeApprovalInput(),
        versionId: "",
      }),
    ).toThrow();
  });

  it("rejects an empty approverName", () => {
    expect(() =>
      createProofApprovalRecord({
        ...makeApprovalInput(),
        approverName: "",
      }),
    ).toThrow();
  });

  it("rejects a missing acknowledgment", () => {
    const input = makeApprovalInput();
    const { birth_date_reviewed: _birthDateReviewed, ...acknowledgments } = input.acknowledgments;

    expect(() =>
      createProofApprovalRecord({
        ...input,
        acknowledgments: acknowledgments as any,
      }),
    ).toThrow();
  });

  it("requires an approval text snapshot", () => {
    expect(() =>
      createProofApprovalRecord({
        ...makeApprovalInput(),
        approvalTextSnapshot: "",
      }),
    ).toThrow();
  });

  it("revokes without mutating the original record", () => {
    const approval = createProofApprovalRecord(makeApprovalInput());
    const before = JSON.stringify(approval);

    const revoked = revokeProofApprovalRecord(approval, {
      revokedAt: "2026-07-10T00:05:00.000Z",
      revokedReason: "The family requested a later correction.",
    });

    expect(JSON.stringify(approval)).toBe(before);
    expect(revoked.status).toBe("revoked");
    expect(revoked.revokedReason).toContain("correction");
  });

  it("does not count revoked approvals as active", () => {
    const approval = createProofApprovalRecord(makeApprovalInput());
    const revoked = revokeProofApprovalRecord(approval, {
      revokedAt: "2026-07-10T00:05:00.000Z",
      revokedReason: "The family requested a later correction.",
    });

    expect(listActiveProofApprovals([revoked])).toEqual([]);
  });

  it("filters approvals by version", () => {
    const first = createProofApprovalRecord(makeApprovalInput({ id: "approval_1", versionId: "version_1" }));
    const second = createProofApprovalRecord(makeApprovalInput({ id: "approval_2", versionId: "version_2" }));

    expect(listApprovalsForVersion([first, second], "version_1")).toEqual([first]);
  });

  it("detects an active family approval for the matching version only", () => {
    const first = createProofApprovalRecord(makeApprovalInput({ id: "approval_1", versionId: "version_1" }));
    const second = revokeProofApprovalRecord(
      createProofApprovalRecord(makeApprovalInput({ id: "approval_2", versionId: "version_2" })),
      {
        revokedAt: "2026-07-10T00:05:00.000Z",
        revokedReason: "The family requested a later correction.",
      },
    );

    expect(hasActiveFamilyApprovalForVersion([first, second], "version_1")).toBe(true);
    expect(hasActiveFamilyApprovalForVersion([first, second], "version_2")).toBe(false);
    expect(hasActiveFamilyApprovalForVersion([first, second], "version_3")).toBe(false);
  });

  it("rejects invalid approval recovery data", () => {
    const recovered = recoverProofApprovals("not valid json");

    expect(recovered.ok).toBe(false);
    if (!recovered.ok) {
      expect(recovered.message).toMatch(/could not restore/i);
    }
  });
});
