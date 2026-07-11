import { analyzeDesignDraft, type AgentFinding } from "@headstone/agent";
import {
  createDraft,
  createProofApprovalRecord,
  createVendorProductionReview,
  createProofReviewNote,
  createVersion,
  compareDesignVersions,
  compareDraftToLatestVersion,
  dismissProofReviewNote,
  recoverDraftAutosave,
  recoverProofApprovals,
  recoverProofReviewNotes,
  recoverVendorProductionReviews,
  serializeDraftAutosave,
  serializeProofApprovals,
  serializeProofReviewNotes,
  serializeVendorProductionReviews,
  listOpenReviewNotes,
  listActiveProofApprovals,
  listApprovalsForVersion,
  listVendorReviewsForVersion,
  listReviewNotesForVersion,
  getLatestVendorReviewForVersion,
  resolveProofReviewNote,
  isVendorReviewReady,
  markVendorReviewReady,
  revokeVendorProductionReview,
  revokeProofApprovalRecord,
  updateVendorProductionReview,
  updateDraft,
  type DesignDraft,
  type DesignVersion,
  type CreateProofApprovalInput,
  type CreateProofReviewNoteInput,
  type CreateVendorProductionReviewInput,
  type ProofApprovalRecord,
  type ProofReviewNote,
  type ProofReviewNoteType,
  type ProofVersionDiffField,
  type ProofVersionDiffItem,
  type VendorProductionReview,
  type VendorProductionReviewChecklistKey,
} from "@headstone/core";
import {
  createExportFileName,
  createSvgExportCandidate,
  exportCandidateWarningMessages,
  type ExportCandidateFile,
} from "@headstone/export";
import { createProofDocument, type ProofDocument, type ProofDocumentSection } from "@headstone/proof";
import { renderDesignDocumentToSvg } from "@headstone/render";
import { useEffect, useMemo, useRef, useState } from "react";
import { type EditableFieldKey, buildEditableDocument, getEditableFields, getTemplateIndex, getTemplateTitle, memorialTemplates } from "./editorModel";
import { CanvasPreviewStage } from "./CanvasPreviewStage";
import {
  getCanvasElementDescriptor,
  isCanvasElementOutsideSafeArea,
  setCanvasElementPosition,
  updateEditableDocumentFields,
} from "./canvasModel";
import { formatVersionLabel, summarizeProofVersion } from "./versionModel";

const STORAGE_KEY = "headstone-design-studio:draft-autosave:v2";
const REVIEW_NOTES_STORAGE_KEY = "headstone-design-studio:review-notes:v1";
const FAMILY_APPROVALS_STORAGE_KEY = "headstone-design-studio:family-proof-approvals:v1";
const VENDOR_REVIEWS_STORAGE_KEY = "headstone-design-studio:vendor-production-reviews:v1";

function createWorkingDraft(): DesignDraft {
  const now = new Date().toISOString();
  const template = memorialTemplates[0]!;
  const draftId = globalThis.crypto?.randomUUID?.() ?? `draft_${Date.now().toString(36)}`;

  return createDraft({
    id: draftId,
    title: template.title,
    design_document: template.design_document,
    created_at: now,
    updated_at: now,
  });
}

function formatAutosaveStatus(
  tone: "idle" | "saved" | "restored" | "error",
  message: string,
) {
  return { tone, message };
}

type FocusTarget = EditableFieldKey | "template";

interface FieldRefs {
  template: HTMLSelectElement | null;
  name: HTMLInputElement | null;
  birth_date: HTMLInputElement | null;
  death_date: HTMLInputElement | null;
  epitaph: HTMLInputElement | null;
}

interface FocusCue {
  target: FocusTarget;
  token: number;
}

interface ReviewFocusAction {
  target: FocusTarget;
  label: string;
}

interface ProofVersionToast {
  tone: "saved" | "restored" | "idle";
  message: string;
}

interface ReviewNoteToast {
  tone: "idle" | "saved" | "error";
  message: string;
}

interface VendorReviewToast {
  tone: "idle" | "saved" | "error";
  message: string;
}

interface ExportToast {
  tone: "idle" | "saved" | "error";
  message: string;
}

interface ReviewNoteDraft {
  type: ProofReviewNoteType;
  body: string;
  createdByLabel: "Local reviewer" | "Staff";
  diffItemId: string | null;
  diffField: ProofVersionDiffField | null;
}

interface ApprovalDraft {
  approverName: string;
  approverRoleLabel: "Family reviewer" | "Authorized reviewer";
  createdByLabel: "Local reviewer" | "Staff";
  acknowledgments: {
    name_spelling_reviewed: boolean;
    birth_date_reviewed: boolean;
    death_date_reviewed: boolean;
    epitaph_reviewed: boolean;
    understands_not_production_approval: boolean;
  };
}

function renderProofDocumentSection(section: ProofDocumentSection) {
  if (section.kind === "preview") {
    return (
      <section key={section.id} className="proof-document-section proof-document-preview">
        <div className="proof-document-section-header">
          <div>
            <p className="panel-kicker">{section.title}</p>
            {section.summary ? <h4>{section.summary}</h4> : null}
          </div>
        </div>
        <div
          className="proof-document-svg"
          aria-label="Printable memorial proof preview"
          dangerouslySetInnerHTML={{ __html: section.content ?? "" }}
        />
      </section>
    );
  }

  if (section.kind === "transcript") {
    return (
      <section key={section.id} className="proof-document-section">
        <div className="proof-document-section-header">
          <div>
            <p className="panel-kicker">{section.title}</p>
            {section.summary ? <h4>{section.summary}</h4> : null}
          </div>
        </div>
        <pre className="proof-document-transcript">{section.content ?? ""}</pre>
      </section>
    );
  }

  if (section.kind === "warnings" || section.kind === "checklist") {
    return (
      <section key={section.id} className="proof-document-section">
        <div className="proof-document-section-header">
          <div>
            <p className="panel-kicker">{section.title}</p>
            {section.summary ? <h4>{section.summary}</h4> : null}
          </div>
        </div>
        <ul className="proof-document-list">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section key={section.id} className="proof-document-section">
      <div className="proof-document-section-header">
        <div>
          <p className="panel-kicker">{section.title}</p>
          {section.summary ? <h4>{section.summary}</h4> : null}
        </div>
      </div>
      {section.items.length > 0 ? (
        <ul className="proof-document-list">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const findingFocusMap: Record<string, ReviewFocusAction | null> = {
  "missing-name": { target: "name", label: "Review name" },
  "missing-birth-date": { target: "birth_date", label: "Review birth date" },
  "missing-death-date": { target: "death_date", label: "Review death date" },
  "empty-epitaph": { target: "epitaph", label: "Review epitaph" },
  "long-epitaph": { target: "epitaph", label: "Review epitaph" },
};

const reviewNoteTypeLabels: Record<ProofReviewNoteType, string> = {
  general: "General",
  name_review: "Name review",
  date_review: "Date review",
  epitaph_review: "Epitaph review",
  layout_review: "Layout review",
  artwork_review: "Artwork review",
  production_question: "Production question",
};

const reviewNoteFieldLabels: Record<ProofVersionDiffField, string> = {
  name: "Name",
  birth_date: "Birth date",
  death_date: "Death date",
  epitaph: "Epitaph",
  shape: "Shape",
  layout: "Layout",
  material: "Material",
  text_block: "Text block",
  symbol: "Symbol",
  photo_etch: "Photo etch",
  custom_art: "Custom art",
  border: "Border",
};

const approvalAcknowledgmentLabels: Record<keyof ApprovalDraft["acknowledgments"], string> = {
  name_spelling_reviewed: "Name spelling reviewed",
  birth_date_reviewed: "Birth date reviewed",
  death_date_reviewed: "Death date reviewed",
  epitaph_reviewed: "Epitaph reviewed",
  understands_not_production_approval: "Understands this is not production approval",
};

const approvalAcknowledgmentOrder: (keyof ApprovalDraft["acknowledgments"])[] = [
  "name_spelling_reviewed",
  "birth_date_reviewed",
  "death_date_reviewed",
  "epitaph_reviewed",
  "understands_not_production_approval",
];

const vendorReviewChecklistOrder: VendorProductionReviewChecklistKey[] = [
  "family_approval_confirmed",
  "name_spelling_checked",
  "birth_date_checked",
  "death_date_checked",
  "epitaph_checked",
  "layout_checked",
  "safe_margins_checked",
  "artwork_checked",
  "material_size_checked",
  "production_method_checked",
  "proof_pdf_checked",
  "understands_not_exported_for_production",
];

const vendorReviewStatusLabels: Record<VendorProductionReview["status"], string> = {
  not_started: "Not started",
  in_review: "In review",
  needs_changes: "Needs changes",
  ready_for_production_prep: "Ready for production prep",
  revoked: "Revoked",
};

const vendorReviewChecklistLabels: Record<VendorProductionReviewChecklistKey, string> = {
  family_approval_confirmed: "Family approval confirmed",
  name_spelling_checked: "Name spelling checked",
  birth_date_checked: "Birth date checked",
  death_date_checked: "Death date checked",
  epitaph_checked: "Epitaph checked",
  layout_checked: "Layout checked",
  safe_margins_checked: "Safe margins checked",
  artwork_checked: "Artwork checked",
  material_size_checked: "Material size checked",
  production_method_checked: "Production method checked",
  proof_pdf_checked: "Proof PDF checked",
  understands_not_exported_for_production: "Understands this is not exported for production",
};

function getReviewNoteTypeForField(field: ProofVersionDiffField): ProofReviewNoteType {
  switch (field) {
    case "name":
      return "name_review";
    case "birth_date":
    case "death_date":
      return "date_review";
    case "epitaph":
      return "epitaph_review";
    case "layout":
      return "layout_review";
    case "shape":
    case "material":
    case "text_block":
    case "symbol":
    case "photo_etch":
    case "custom_art":
    case "border":
      return "artwork_review";
  }
}

function formatReviewNoteFieldLabel(field: ProofVersionDiffField): string {
  return reviewNoteFieldLabels[field];
}

function createDefaultReviewNoteDraft(): ReviewNoteDraft {
  return {
    type: "general",
    body: "",
    createdByLabel: "Local reviewer",
    diffItemId: null,
    diffField: null,
  };
}

function createDefaultApprovalDraft(): ApprovalDraft {
  return {
    approverName: "",
    approverRoleLabel: "Family reviewer",
    createdByLabel: "Local reviewer",
    acknowledgments: {
      name_spelling_reviewed: false,
      birth_date_reviewed: false,
      death_date_reviewed: false,
      epitaph_reviewed: false,
      understands_not_production_approval: false,
    },
  };
}

function createDefaultVendorReviewChecklist(): Record<VendorProductionReviewChecklistKey, boolean> {
  return vendorReviewChecklistOrder.reduce(
    (accumulator, key) => {
      accumulator[key] = false;
      return accumulator;
    },
    {} as Record<VendorProductionReviewChecklistKey, boolean>,
  );
}

function createVendorReviewChecklistItems(
  checklist: Record<VendorProductionReviewChecklistKey, boolean>,
) {
  return vendorReviewChecklistOrder.map((key) => ({
    key,
    checked: checklist[key],
  }));
}

function downgradeVendorReviewStatus(
  status: VendorProductionReview["status"],
): Exclude<VendorProductionReview["status"], "ready_for_production_prep" | "revoked"> {
  if (status === "ready_for_production_prep") {
    return "needs_changes";
  }

  if (status === "revoked") {
    return "needs_changes";
  }

  if (status === "not_started") {
    return "in_review";
  }

  return status;
}

function getReviewActionForFinding(finding: AgentFinding): ReviewFocusAction | null {
  return findingFocusMap[finding.id] ?? null;
}

function triggerDownload(file: ExportCandidateFile) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.downloadName ?? file.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function summarizeFamilyApprovalForExport(approvals: readonly ProofApprovalRecord[]): string | null {
  if (approvals.length === 0) {
    return null;
  }

  const activeCount = listActiveProofApprovals(approvals).length;
  const revokedCount = approvals.length - activeCount;
  const parts = [`${activeCount} active family approval${activeCount === 1 ? "" : "s"}`];

  if (revokedCount > 0) {
    parts.push(`${revokedCount} revoked`);
  }

  return parts.join(", ");
}

function summarizeVendorReviewForExport(review: VendorProductionReview | null): string | null {
  if (!review) {
    return null;
  }

  const status = vendorReviewStatusLabels[review.status];
  const updatedAt = new Date(review.updatedAt).toLocaleString();
  return `${status} · ${review.reviewedByLabel} · ${updatedAt}`;
}

export function App() {
  const [draft, setDraft] = useState<DesignDraft>(() => createWorkingDraft());
  const [hydrated, setHydrated] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState(() =>
    formatAutosaveStatus("idle", "Loading draft..."),
  );
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [focusCue, setFocusCue] = useState<FocusCue | null>(null);
  const [proofToast, setProofToast] = useState<ProofVersionToast>({
    tone: "idle",
    message: "Proof versions help preserve what was reviewed.",
  });
  const [reviewNotes, setReviewNotes] = useState<ProofReviewNote[]>([]);
  const [reviewNotesHydrated, setReviewNotesHydrated] = useState(false);
  const [reviewNotesNotice, setReviewNotesNotice] = useState<string | null>(null);
  const [reviewNoteToast, setReviewNoteToast] = useState<ReviewNoteToast>({
    tone: "idle",
    message: "Local review notes stay with this browser.",
  });
  const [reviewNoteDraft, setReviewNoteDraft] = useState<ReviewNoteDraft>(() => createDefaultReviewNoteDraft());
  const [approvalRecords, setApprovalRecords] = useState<ProofApprovalRecord[]>([]);
  const [approvalHydrated, setApprovalHydrated] = useState(false);
  const [approvalRecoveryNotice, setApprovalRecoveryNotice] = useState<string | null>(null);
  const [approvalToast, setApprovalToast] = useState<ReviewNoteToast>({
    tone: "idle",
    message: "Local family approvals stay with this browser.",
  });
  const [approvalDraft, setApprovalDraft] = useState<ApprovalDraft>(() => createDefaultApprovalDraft());
  const [revocationReasons, setRevocationReasons] = useState<Record<string, string>>({});
  const [vendorReviews, setVendorReviews] = useState<VendorProductionReview[]>([]);
  const [vendorReviewsHydrated, setVendorReviewsHydrated] = useState(false);
  const [vendorReviewsNotice, setVendorReviewsNotice] = useState<string | null>(null);
  const [vendorReviewToast, setVendorReviewToast] = useState<VendorReviewToast>({
    tone: "idle",
    message: "Local vendor reviews stay with this browser.",
  });
  const [exportToast, setExportToast] = useState<ExportToast>({
    tone: "idle",
    message: "Local SVG export candidates stay on this device.",
  });
  const [vendorReviewVersionId, setVendorReviewVersionId] = useState<string | null>(null);
  const [vendorReviewRevocationReasons, setVendorReviewRevocationReasons] = useState<Record<string, string>>({});
  const [comparisonVersionId, setComparisonVersionId] = useState<string | null>(null);
  const [proofVersionId, setProofVersionId] = useState<string | null>(null);
  const [selectedCanvasElementId, setSelectedCanvasElementId] = useState<string | null>(null);
  const fieldRefs = useRef<FieldRefs>({
    template: null,
    name: null,
    birth_date: null,
    death_date: null,
    epitaph: null,
  });
  const focusTimerRef = useRef<number | null>(null);
  const reviewNotesPanelRef = useRef<HTMLElement | null>(null);
  const reviewNoteBodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (selectedCanvasElementId === null) {
      return;
    }

    if (!draft.design_document.elements.some((element) => element.id === selectedCanvasElementId)) {
      setSelectedCanvasElementId(null);
    }
  }, [draft.design_document, selectedCanvasElementId]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const recovered = recoverDraftAutosave(raw, STORAGE_KEY);

    if (recovered.ok) {
      setDraft(recovered.draft);
      setAutosaveStatus(formatAutosaveStatus("restored", "Restored saved draft."));
      setRecoveryNotice(null);
    } else if (raw === null) {
      setAutosaveStatus(formatAutosaveStatus("saved", "No saved draft found."));
      setRecoveryNotice(null);
    } else {
      setAutosaveStatus(formatAutosaveStatus("error", recovered.message));
      setRecoveryNotice(recovered.message);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(REVIEW_NOTES_STORAGE_KEY);

    if (raw === null) {
      setReviewNotes([]);
      setReviewNotesNotice(null);
      setReviewNotesHydrated(true);
      return;
    }

    const recovered = recoverProofReviewNotes(raw, REVIEW_NOTES_STORAGE_KEY);
    if (recovered.ok) {
      setReviewNotes(recovered.notes);
      setReviewNotesNotice(null);
    } else {
      setReviewNotes([]);
      setReviewNotesNotice(recovered.message);
    }

    setReviewNotesHydrated(true);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(FAMILY_APPROVALS_STORAGE_KEY);

    if (raw === null) {
      setApprovalRecords([]);
      setApprovalRecoveryNotice(null);
      setApprovalHydrated(true);
      return;
    }

    const recovered = recoverProofApprovals(raw, FAMILY_APPROVALS_STORAGE_KEY);
    if (recovered.ok) {
      setApprovalRecords(recovered.approvals);
      setApprovalRecoveryNotice(null);
    } else {
      setApprovalRecords([]);
      setApprovalRecoveryNotice(recovered.message);
    }

    setApprovalHydrated(true);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(VENDOR_REVIEWS_STORAGE_KEY);

    if (raw === null) {
      setVendorReviews([]);
      setVendorReviewsNotice(null);
      setVendorReviewsHydrated(true);
      return;
    }

    const recovered = recoverVendorProductionReviews(raw, VENDOR_REVIEWS_STORAGE_KEY);
    if (recovered.ok) {
      setVendorReviews(recovered.reviews);
      setVendorReviewsNotice(null);
    } else {
      setVendorReviews([]);
      setVendorReviewsNotice(recovered.message);
    }

    setVendorReviewsHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, serializeDraftAutosave(draft));
    setAutosaveStatus(formatAutosaveStatus("saved", "Saved locally."));
  }, [draft, hydrated]);

  useEffect(() => {
    if (!reviewNotesHydrated) {
      return;
    }

    window.localStorage.setItem(REVIEW_NOTES_STORAGE_KEY, serializeProofReviewNotes(reviewNotes));
  }, [reviewNotes, reviewNotesHydrated]);

  useEffect(() => {
    if (!approvalHydrated) {
      return;
    }

    window.localStorage.setItem(FAMILY_APPROVALS_STORAGE_KEY, serializeProofApprovals(approvalRecords));
  }, [approvalHydrated, approvalRecords]);

  useEffect(() => {
    if (!vendorReviewsHydrated) {
      return;
    }

    window.localStorage.setItem(VENDOR_REVIEWS_STORAGE_KEY, serializeVendorProductionReviews(vendorReviews));
  }, [vendorReviews, vendorReviewsHydrated]);

  useEffect(() => {
    if (focusCue === null) {
      return;
    }

    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
    }

    focusTimerRef.current = window.setTimeout(() => {
      setFocusCue(null);
      focusTimerRef.current = null;
    }, 1400);

    return () => {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [focusCue]);

  useEffect(() => {
    if (reviewNoteDraft.diffItemId === null && reviewNoteDraft.diffField === null) {
      return;
    }

    if (reviewNoteBodyRef.current) {
      reviewNoteBodyRef.current.focus({ preventScroll: true });
    }
  }, [reviewNoteDraft.diffItemId, reviewNoteDraft.diffField]);

  const templateIndex = getTemplateIndex(draft.design_document);
  const editorFields = getEditableFields(draft.design_document);
  const previewSvg = renderDesignDocumentToSvg(draft.design_document);
  const selectedCanvasElement = useMemo(
    () =>
      selectedCanvasElementId
        ? getCanvasElementDescriptor(draft.design_document, selectedCanvasElementId)
        : null,
    [draft.design_document, selectedCanvasElementId],
  );
  const selectedCanvasElementOutsideSafeArea = selectedCanvasElement
    ? isCanvasElementOutsideSafeArea(draft.design_document, selectedCanvasElement.id)
    : false;
  const agentResponse = useMemo(
    () =>
      analyzeDesignDraft({
        mode: "family_guidance",
        draft,
      }),
    [draft],
  );
  const visibleFindings = agentResponse.findings.slice(0, 4);
  const visibleActions = agentResponse.suggested_actions.slice(0, 3);
  const visibleAdvice = agentResponse.advice.slice(0, 2);
  const hiddenFindingCount = Math.max(0, agentResponse.findings.length - visibleFindings.length);
  const hiddenActionCount = Math.max(0, agentResponse.suggested_actions.length - visibleActions.length);
  const latestProofVersion = draft.versions.at(-1) ?? null;
  const latestProofVersionNumber = latestProofVersion?.version_number ?? null;
  const proofVersions = [...draft.versions].reverse();
  const canCreateProofVersion = draft.status !== "production_locked" && draft.status !== "archived";
  const selectedProofVersion = proofVersionId
    ? draft.versions.find((version) => version.id === proofVersionId) ?? latestProofVersion
    : latestProofVersion;
  const latestVersionApprovals = latestProofVersion
    ? listApprovalsForVersion(approvalRecords, latestProofVersion.id)
    : [];
  const latestVersionActiveApprovals = listActiveProofApprovals(latestVersionApprovals);
  const selectedVendorReviewVersion = vendorReviewVersionId
    ? draft.versions.find((version) => version.id === vendorReviewVersionId) ?? latestProofVersion
    : latestProofVersion;
  const selectedVendorReview = selectedVendorReviewVersion
    ? getLatestVendorReviewForVersion(vendorReviews, selectedVendorReviewVersion.id)
    : null;
  const latestVendorReviewForLatestProofVersion = latestProofVersion
    ? getLatestVendorReviewForVersion(vendorReviews, latestProofVersion.id)
    : null;
  const latestProofHasFamilyApproval = latestVersionActiveApprovals.length > 0;
  const comparisonVersion = comparisonVersionId
    ? draft.versions.find((version) => version.id === comparisonVersionId) ?? null
    : null;
  const comparisonDiff = useMemo(() => {
    if (!latestProofVersion) {
      return null;
    }

    if (comparisonVersion) {
      return compareDesignVersions(comparisonVersion, latestProofVersion);
    }

    return compareDraftToLatestVersion(draft);
  }, [comparisonVersion, draft, latestProofVersion]);
  const comparisonTitle = comparisonVersion
    ? `Changes between ${formatVersionLabel(comparisonVersion)} and the latest proof`
    : "Changes since latest proof";
  const proofDocumentSignature = useMemo(() => {
    if (!selectedProofVersion) {
      return "no-proof-version";
    }

    const noteSignature = reviewNotes.map((note) => `${note.id}:${note.status}:${note.updatedAt}`).join("|");
    const approvalSignature = approvalRecords
      .map((record) => `${record.id}:${record.status}:${record.approvedAt}:${record.revokedAt ?? ""}`)
      .join("|");

    return [
      selectedProofVersion.id,
      selectedProofVersion.version_number,
      noteSignature,
      approvalSignature,
    ].join("::");
  }, [
    approvalRecords,
    reviewNotes,
    selectedProofVersion?.id,
    selectedProofVersion?.version_number,
  ]);
  const [proofDocumentCreatedAt, setProofDocumentCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (latestProofVersion === null) {
      if (proofVersionId !== null) {
        setProofVersionId(null);
      }
      return;
    }

    const selectedVersionExists = proofVersionId !== null && draft.versions.some((version) => version.id === proofVersionId);
    if (!selectedVersionExists) {
      setProofVersionId(latestProofVersion.id);
    }
  }, [draft.versions, latestProofVersion, proofVersionId]);

  useEffect(() => {
    if (latestProofVersion === null) {
      if (vendorReviewVersionId !== null) {
        setVendorReviewVersionId(null);
      }
      return;
    }

    const selectedVersionExists =
      vendorReviewVersionId !== null && draft.versions.some((version) => version.id === vendorReviewVersionId);
    if (!selectedVersionExists) {
      setVendorReviewVersionId(latestProofVersion.id);
    }
  }, [draft.versions, latestProofVersion, vendorReviewVersionId]);

  const proofDocument = useMemo<ProofDocument | null>(() => {
    if (!selectedProofVersion) {
      return null;
    }

    const proofReviewNotes = listReviewNotesForVersion(reviewNotes, selectedProofVersion.id);
    const proofApprovals = listApprovalsForVersion(approvalRecords, selectedProofVersion.id);
    const proofSvg = renderDesignDocumentToSvg(selectedProofVersion.design_document);

    return createProofDocument({
      proofVersion: selectedProofVersion,
      designDocument: selectedProofVersion.design_document,
      renderedSvg: proofSvg,
      familyApprovalRecords: proofApprovals,
      reviewNotes: proofReviewNotes,
      diffSummary: comparisonDiff?.summary ?? null,
      createdAt: proofDocumentCreatedAt ?? selectedProofVersion.created_at,
      createdByLabel: "Local reviewer",
    });
  }, [approvalRecords, comparisonDiff?.summary, proofDocumentCreatedAt, reviewNotes, selectedProofVersion]);

  useEffect(() => {
    if (!selectedProofVersion) {
      setProofDocumentCreatedAt(null);
      return;
    }

    setProofDocumentCreatedAt(new Date().toISOString());
  }, [proofDocumentSignature]);

  const selectedProofVersionApprovals = selectedProofVersion
    ? listApprovalsForVersion(approvalRecords, selectedProofVersion.id)
    : [];
  const selectedProofVersionVendorReview = selectedProofVersion
    ? getLatestVendorReviewForVersion(vendorReviews, selectedProofVersion.id)
    : null;
  const exportCandidateFileName = selectedProofVersion
    ? createExportFileName({
        selectedProofVersion,
        designDocument: selectedProofVersion.design_document,
        renderedSvg: proofDocument?.renderedSvg ?? renderDesignDocumentToSvg(selectedProofVersion.design_document),
        proofDocumentMetadata: proofDocument?.metadata ?? null,
        familyApprovalSummary: summarizeFamilyApprovalForExport(selectedProofVersionApprovals),
        vendorReviewSummary: summarizeVendorReviewForExport(selectedProofVersionVendorReview),
        createdAt: proofDocumentCreatedAt ?? selectedProofVersion.created_at,
        createdByLabel: "Staff",
      })
    : null;

  function focusTarget(target: FocusTarget) {
    const element = fieldRefs.current[target];
    if (element) {
      element.focus({ preventScroll: true });
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    setFocusCue({
      target,
      token: Date.now(),
    });
  }

  function selectCanvasElement(elementId: string) {
    setSelectedCanvasElementId(elementId);
  }

  function clearCanvasSelection() {
    setSelectedCanvasElementId(null);
  }

  function moveSelectedCanvasElement(elementId: string, nextX: number, nextY: number) {
    setDraft((current) => {
      const nextDocument = setCanvasElementPosition(current.design_document, elementId, nextX, nextY);
      return updateDraft(current, {
        design_document: nextDocument,
        updated_at: new Date().toISOString(),
      });
    });
  }

  function createProofVersion() {
    const now = new Date().toISOString();
    const nextVersionNumber = draft.versions.length + 1;

    try {
      const next = createVersion(draft, {
        id: `proof_${now.replaceAll(/[-:.TZ]/g, "")}`,
        label: `Proof v${nextVersionNumber}`,
        created_at: now,
        created_by: "local_editor",
      });
      setDraft(next.draft);
      setProofToast({
        tone: "saved",
        message: `Saved proof version v${next.version.version_number}.`,
      });
    } catch (error) {
      setProofToast({
        tone: "idle",
        message: error instanceof Error ? error.message : "We could not save that proof version.",
      });
    }
  }

  function restoreProofVersion(version: DesignVersion) {
    const now = new Date().toISOString();

    setDraft((current) =>
      updateDraft(current, {
        title: getTemplateTitle(getTemplateIndex(version.design_document)),
        design_document: version.design_document,
        updated_at: now,
      }),
    );

    setProofToast({
      tone: "restored",
      message: `Restored ${formatVersionLabel(version)} as the working draft.`,
    });
  }

  function addNoteFromDiffItem(item: ProofVersionDiffItem) {
    if (!latestProofVersion) {
      return;
    }

    setReviewNoteDraft((current) => ({
      ...current,
      type: getReviewNoteTypeForField(item.field),
      diffItemId: item.id,
      diffField: item.field,
    }));
    reviewNotesPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveReviewNote() {
    if (!latestProofVersion) {
      return;
    }

    const body = reviewNoteDraft.body.trim();
    if (body.length === 0) {
      setReviewNoteToast({
        tone: "error",
        message: "Write a short note before saving it.",
      });
      return;
    }

    const now = new Date().toISOString();
    const noteInput: CreateProofReviewNoteInput = {
      id: `note_${now.replaceAll(/[-:.TZ]/g, "")}`,
      versionId: latestProofVersion.id,
      type: reviewNoteDraft.type,
      body,
      createdAt: now,
      updatedAt: now,
      createdByLabel: reviewNoteDraft.createdByLabel,
    };

    if (reviewNoteDraft.diffItemId !== null) {
      noteInput.diffItemId = reviewNoteDraft.diffItemId;
    }

    if (reviewNoteDraft.diffField !== null) {
      noteInput.diffField = reviewNoteDraft.diffField;
    }

    const note = createProofReviewNote(noteInput);

    setReviewNotes((current) => [note, ...current]);
    setReviewNoteDraft((current) => ({
      ...createDefaultReviewNoteDraft(),
      createdByLabel: current.createdByLabel,
    }));
    setReviewNoteToast({
      tone: "saved",
      message: "Saved a local review note.",
    });
  }

  function updateReviewNoteStatus(note: ProofReviewNote, nextStatus: "resolved" | "dismissed") {
    const now = new Date().toISOString();

    setReviewNotes((current) =>
      current.map((currentNote) => {
        if (currentNote.id !== note.id) {
          return currentNote;
        }

        return nextStatus === "resolved"
          ? resolveProofReviewNote(currentNote, now)
          : dismissProofReviewNote(currentNote, now);
      }),
    );

    setReviewNoteToast({
      tone: "saved",
      message: nextStatus === "resolved" ? "Marked the note resolved." : "Marked the note dismissed.",
    });
  }

  function buildApprovalTextSnapshot(version: DesignVersion): string {
    return `${formatVersionLabel(version)} · ${summarizeProofVersion(version)}`;
  }

  function submitFamilyApproval() {
    if (!latestProofVersion) {
      setApprovalToast({
        tone: "error",
        message: "Create a proof version before recording family approval.",
      });
      return;
    }

    const approverName = approvalDraft.approverName.trim();
    if (approverName.length === 0) {
      setApprovalToast({
        tone: "error",
        message: "Enter the approver name before saving this approval.",
      });
      return;
    }

    const acknowledgments = approvalDraft.acknowledgments;
    const allAcknowledged = approvalAcknowledgmentOrder.every((key) => acknowledgments[key]);
    if (!allAcknowledged) {
      setApprovalToast({
        tone: "error",
        message: "Check every acknowledgment before saving this approval.",
      });
      return;
    }

    const now = new Date().toISOString();
    const approvalInput: CreateProofApprovalInput = {
      id: `approval_${now.replaceAll(/[-:.TZ]/g, "")}`,
      versionId: latestProofVersion.id,
      approverName,
      approverRoleLabel: approvalDraft.approverRoleLabel,
      approvedAt: now,
      approvalTextSnapshot: buildApprovalTextSnapshot(latestProofVersion),
      acknowledgments: {
        name_spelling_reviewed: true,
        birth_date_reviewed: true,
        death_date_reviewed: true,
        epitaph_reviewed: true,
        understands_not_production_approval: true,
      },
      createdByLabel: approvalDraft.createdByLabel,
    };

    const approval = createProofApprovalRecord(approvalInput);
    setApprovalRecords((current) => [approval, ...current]);
    setApprovalDraft((current) => ({
      ...current,
      acknowledgments: createDefaultApprovalDraft().acknowledgments,
    }));
    setApprovalToast({
      tone: "saved",
      message: "Saved a local family approval for the latest proof version.",
    });
  }

  function revokeFamilyApproval(record: ProofApprovalRecord) {
    const reason = revocationReasons[record.id]?.trim() ?? "";
    if (reason.length === 0) {
      setApprovalToast({
        tone: "error",
        message: "Enter a reason before revoking this approval.",
      });
      return;
    }

    const now = new Date().toISOString();
    const revoked = revokeProofApprovalRecord(record, {
      revokedAt: now,
      revokedReason: reason,
    });

    setApprovalRecords((current) => current.map((item) => (item.id === revoked.id ? revoked : item)));
    setRevocationReasons((current) => ({
      ...current,
      [record.id]: "",
    }));
    setApprovalToast({
      tone: "saved",
      message: "Revoked the local family approval.",
    });
  }

  function startVendorReview() {
    if (!selectedVendorReviewVersion) {
      setVendorReviewToast({
        tone: "error",
        message: "Create a proof version before starting vendor review.",
      });
      return;
    }

    if (selectedVendorReview !== null) {
      setVendorReviewToast({
        tone: "error",
        message: "A vendor review already exists for this proof version.",
      });
      return;
    }

    const now = new Date().toISOString();
    const reviewInput: CreateVendorProductionReviewInput = {
      id: `vendor_review_${now.replaceAll(/[-:.TZ]/g, "")}`,
      versionId: selectedVendorReviewVersion.id,
      reviewedByLabel: "Staff",
      createdAt: now,
      updatedAt: now,
      checklist: createVendorReviewChecklistItems(createDefaultVendorReviewChecklist()),
      notes: "",
      status: "not_started",
    };

    const review = createVendorProductionReview(reviewInput);
    setVendorReviews((current) => [review, ...current]);
    setVendorReviewToast({
      tone: "saved",
      message: "Started a local vendor review for this proof version.",
    });
  }

  function updateCurrentVendorReview(
    updater: (review: VendorProductionReview) => VendorProductionReview,
  ) {
    if (!selectedVendorReview) {
      return;
    }

    if (selectedVendorReview.status === "revoked") {
      setVendorReviewToast({
        tone: "error",
        message: "This vendor review has been revoked and cannot be edited.",
      });
      return;
    }

    setVendorReviews((current) =>
      current.map((review) => {
        if (review.id !== selectedVendorReview.id) {
          return review;
        }

        return updater(review);
      }),
    );
  }

  function setVendorReviewChecklistItem(key: VendorProductionReviewChecklistKey, checked: boolean) {
    if (!selectedVendorReview) {
      setVendorReviewToast({
        tone: "error",
        message: "Start a vendor review before checking production items.",
      });
      return;
    }

    const currentChecklist = selectedVendorReview.checklist.reduce(
      (accumulator, item) => {
        accumulator[item.key] = item.checked;
        return accumulator;
      },
      createDefaultVendorReviewChecklist(),
    );
    const nextChecklist = {
      ...currentChecklist,
      [key]: checked,
    };

    updateCurrentVendorReview(
      (review) =>
        updateVendorProductionReview(review, {
          updatedAt: new Date().toISOString(),
          checklist: createVendorReviewChecklistItems(nextChecklist),
          status: downgradeVendorReviewStatus(review.status),
        }),
    );
  }

  function updateVendorReviewNotes(notes: string) {
    if (!selectedVendorReview) {
      setVendorReviewToast({
        tone: "error",
        message: "Start a vendor review before adding production notes.",
      });
      return;
    }

    updateCurrentVendorReview(
      (review) =>
        updateVendorProductionReview(review, {
          updatedAt: new Date().toISOString(),
          notes,
          status: downgradeVendorReviewStatus(review.status),
        }),
    );
  }

  function updateVendorReviewLabel(reviewedByLabel: "Local reviewer" | "Staff") {
    if (!selectedVendorReview) {
      setVendorReviewToast({
        tone: "error",
        message: "Start a vendor review before changing the reviewer label.",
      });
      return;
    }

    updateCurrentVendorReview(
      (review) =>
        updateVendorProductionReview(review, {
          updatedAt: new Date().toISOString(),
          reviewedByLabel,
          status: downgradeVendorReviewStatus(review.status),
        }),
    );
  }

  function markCurrentVendorReviewReady() {
    if (!selectedVendorReview) {
      setVendorReviewToast({
        tone: "error",
        message: "Start a vendor review before marking it ready.",
      });
      return;
    }

    try {
      const readyReview = markVendorReviewReady(selectedVendorReview, new Date().toISOString());
      setVendorReviews((current) => current.map((review) => (review.id === readyReview.id ? readyReview : review)));
      setVendorReviewToast({
        tone: "saved",
        message: "Marked the review ready for production prep.",
      });
    } catch (error) {
      setVendorReviewToast({
        tone: "error",
        message: error instanceof Error ? error.message : "We could not mark this review ready yet.",
      });
    }
  }

  function revokeCurrentVendorReview(review: VendorProductionReview) {
    const reason = vendorReviewRevocationReasons[review.id]?.trim() ?? "";
    if (reason.length === 0) {
      setVendorReviewToast({
        tone: "error",
        message: "Enter a reason before revoking this vendor review.",
      });
      return;
    }

    const revoked = revokeVendorProductionReview(review, {
      revokedAt: new Date().toISOString(),
      revokedReason: reason,
    });

    setVendorReviews((current) => current.map((item) => (item.id === revoked.id ? revoked : item)));
    setVendorReviewRevocationReasons((current) => ({
      ...current,
      [review.id]: "",
    }));
    setVendorReviewToast({
      tone: "saved",
      message: "Revoked the local vendor review.",
    });
  }

  function updateField(field: EditableFieldKey, value: string) {
    const now = new Date().toISOString();

    setDraft((current) => {
      const currentFields = getEditableFields(current.design_document);
      const nextFields = {
        ...currentFields,
        [field]: value,
      };

      return updateDraft(current, {
        title: current.title,
        design_document: updateEditableDocumentFields(current.design_document, nextFields),
        updated_at: now,
      });
    });
  }

  function changeTemplate(nextIndex: number) {
    const now = new Date().toISOString();

    setDraft((current) => {
      const currentFields = getEditableFields(current.design_document);

      return updateDraft(current, {
        title: getTemplateTitle(nextIndex),
        design_document: buildEditableDocument(nextIndex, currentFields),
        updated_at: now,
      });
    });
  }

  function buildExportCandidatePackage() {
    if (!selectedProofVersion || !proofDocument) {
      setExportToast({
        tone: "error",
        message: "Create a proof version before exporting a local SVG candidate.",
      });
      return null;
    }

    try {
      return createSvgExportCandidate({
        selectedProofVersion,
        designDocument: selectedProofVersion.design_document,
        renderedSvg: proofDocument.renderedSvg,
        proofDocumentMetadata: proofDocument.metadata,
        familyApprovalSummary: summarizeFamilyApprovalForExport(selectedProofVersionApprovals),
        vendorReviewSummary: summarizeVendorReviewForExport(selectedProofVersionVendorReview),
        createdAt: new Date().toISOString(),
        createdByLabel: "Staff",
      });
    } catch (error) {
      setExportToast({
        tone: "error",
        message: error instanceof Error ? error.message : "We could not prepare that export candidate.",
      });
      return null;
    }
  }

  function downloadExportCandidateAsset(fileName: string) {
    const candidate = buildExportCandidatePackage();
    if (!candidate) {
      return;
    }

    const file = candidate.files.find((entry) => entry.name === fileName);
    if (!file) {
      setExportToast({
        tone: "error",
        message: "We could not find that export file.",
      });
      return;
    }

    triggerDownload(file);
    setExportToast({
      tone: "saved",
      message: `Downloaded ${file.downloadName ?? file.name}.`,
    });
  }

  function printProofDocument() {
    window.print();
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <p className="eyebrow">Headstone Design Studio</p>
          <h1>Memorial design draft</h1>
          <p className="lede">
            A calm, to-scale editor for drafting a memorial layout. This screen stays on the shared
            design document and previews it with deterministic SVG.
          </p>
        </div>
        <div className={`status-pill status-${autosaveStatus.tone}`}>{autosaveStatus.message}</div>
      </header>

      <section className="studio-grid">
        <aside className="editor-panel">
          <div className="panel-group-header">
            <p className="panel-kicker">Design</p>
            <h2>Memorial fields</h2>
          </div>

          <section className="panel-block">
            <p className="panel-kicker">Template</p>
            <label className={`field ${focusCue?.target === "template" ? "field-focused" : ""}`} htmlFor="editor-template">
              <span>Design template</span>
              <select
                id="editor-template"
                ref={(node) => {
                  fieldRefs.current.template = node;
                }}
                value={templateIndex}
                onChange={(event) => {
                  changeTemplate(Number(event.target.value));
                }}
              >
                {memorialTemplates.map((template, index) => (
                  <option key={template.id} value={index}>
                    {template.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-note">Switching templates keeps the memorial text in place.</p>
          </section>

          <section className="panel-block">
            <p className="panel-kicker">Memorial text</p>
            <label className={`field ${focusCue?.target === "name" ? "field-focused" : ""}`} htmlFor="editor-name">
              <span>Person name</span>
              <input
                id="editor-name"
                ref={(node) => {
                  fieldRefs.current.name = node;
                }}
                type="text"
                value={editorFields.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Enter the name"
              />
            </label>

            <div className="field-row">
              <label
                className={`field ${focusCue?.target === "birth_date" ? "field-focused" : ""}`}
                htmlFor="editor-birth-date"
              >
                <span>Birth date</span>
                <input
                  id="editor-birth-date"
                  ref={(node) => {
                    fieldRefs.current.birth_date = node;
                  }}
                  type="text"
                  value={editorFields.birth_date}
                  onChange={(event) => updateField("birth_date", event.target.value)}
                  placeholder="Month day, year"
                />
              </label>

              <label
                className={`field ${focusCue?.target === "death_date" ? "field-focused" : ""}`}
                htmlFor="editor-death-date"
              >
                <span>Death date</span>
                <input
                  id="editor-death-date"
                  ref={(node) => {
                    fieldRefs.current.death_date = node;
                  }}
                  type="text"
                  value={editorFields.death_date}
                  onChange={(event) => updateField("death_date", event.target.value)}
                  placeholder="Month day, year"
                />
              </label>
            </div>

            <label className={`field ${focusCue?.target === "epitaph" ? "field-focused" : ""}`} htmlFor="editor-epitaph">
              <span>Epitaph line</span>
              <input
                id="editor-epitaph"
                ref={(node) => {
                  fieldRefs.current.epitaph = node;
                }}
                type="text"
                value={editorFields.epitaph}
                onChange={(event) => updateField("epitaph", event.target.value)}
                placeholder="A calm line of remembrance"
              />
            </label>
          </section>

          <section className="panel-block canvas-inspector">
            <div className="guide-header">
              <div>
                <p className="panel-kicker">Selected element</p>
                <h3>Direct canvas editing</h3>
              </div>
              {selectedCanvasElement ? (
                <button type="button" className="guide-focus-button" onClick={clearCanvasSelection}>
                  Clear selection
                </button>
              ) : null}
            </div>

            {selectedCanvasElement ? (
              <>
                <p className="guide-summary">
                  {selectedCanvasElement.label}. Click, drag, or use the arrow keys on the preview to
                  move it.
                </p>

                <div className="canvas-inspector-grid">
                  <div className="canvas-inspector-readout">
                    <span>Type</span>
                    <strong>{selectedCanvasElement.type}</strong>
                  </div>
                  <div className="canvas-inspector-readout">
                    <span>Label</span>
                    <strong>{selectedCanvasElement.label}</strong>
                  </div>
                  <div className="canvas-inspector-position-group">
                    <div className="canvas-inspector-position-header">
                      <p className="panel-kicker">Position</p>
                      <p className="guide-note">Use the preview or type exact values</p>
                    </div>
                    <div className="canvas-inspector-position-grid">
                      <label className="field" htmlFor="selected-element-x">
                        <span>X position</span>
                        <input
                          id="selected-element-x"
                          type="number"
                          step="0.01"
                          value={selectedCanvasElement.x.toFixed(2)}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            if (Number.isFinite(nextValue)) {
                              moveSelectedCanvasElement(selectedCanvasElement.id, nextValue, selectedCanvasElement.y);
                            }
                          }}
                        />
                      </label>
                      <label className="field" htmlFor="selected-element-y">
                        <span>Y position</span>
                        <input
                          id="selected-element-y"
                          type="number"
                          step="0.01"
                          value={selectedCanvasElement.y.toFixed(2)}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            if (Number.isFinite(nextValue)) {
                              moveSelectedCanvasElement(selectedCanvasElement.id, selectedCanvasElement.x, nextValue);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="canvas-inspector-readout">
                    <span>Width</span>
                    <strong>{selectedCanvasElement.width.toFixed(2)}</strong>
                  </div>
                  <div className="canvas-inspector-readout">
                    <span>Height</span>
                    <strong>{selectedCanvasElement.height.toFixed(2)}</strong>
                  </div>
                  <div className="canvas-inspector-readout">
                    <span>Rotation</span>
                    <strong>{selectedCanvasElement.rotation_deg.toFixed(1)}°</strong>
                  </div>
                </div>

                {selectedCanvasElementOutsideSafeArea ? (
                  <p className="canvas-warning">
                    This element may be too close to the edge for production. Vendor review required.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="guide-empty">
                Select a name, date, epitaph, symbol, or artwork element in the preview to adjust it.
              </p>
            )}
          </section>

          <section className="panel-block">
            <p className="panel-kicker">Draft status</p>
            <p className="meta-line">
              Status: <strong>{draft.status}</strong>
            </p>
            <p className="meta-line">
              Template: <strong>{draft.title}</strong>
            </p>
            <p className="meta-line">
              Elements: <strong>{draft.design_document.elements.length}</strong>
            </p>
            {recoveryNotice ? <p className="error-copy">{recoveryNotice}</p> : null}
            <div className="proof-actions">
              <button
                type="button"
                className="proof-button"
                onClick={createProofVersion}
                disabled={!canCreateProofVersion}
              >
                Create proof version
              </button>
              <p className={`proof-toast proof-toast-${proofToast.tone}`}>{proofToast.message}</p>
            </div>
          </section>

          <p className="support-note">
            Need help? A memorial specialist should confirm the final wording before production work
            begins.
          </p>
        </aside>

        <section className="preview-panel canvas-panel">
          <div className="preview-header">
            <div>
              <p className="panel-kicker">Canvas</p>
              <h2>Design canvas</h2>
            </div>
            <p className="preview-note">Not production-ready</p>
          </div>

          <div className="preview-stage">
            <CanvasPreviewStage
              document={draft.design_document}
              previewSvg={previewSvg}
              selectedElementId={selectedCanvasElementId}
              onSelectElement={selectCanvasElement}
              onClearSelection={clearCanvasSelection}
              onMoveElement={moveSelectedCanvasElement}
            />
          </div>

          <p className="preview-footnote">
            Draft proof only - not production-ready. Click, drag, or use arrow keys to adjust the
            selected element. Proof versions preserve what was reviewed, and the production export
            will come later from the same shared document and render layer.
          </p>
        </section>

        <aside className="workflow-panel">
          <section className="guide-panel">
            <div className="guide-header">
              <div>
                <p className="panel-kicker">Guidance</p>
                <h3>Calm guidance</h3>
              </div>
              <p className="guide-note">Read only</p>
            </div>

            <p className="guide-summary">{agentResponse.summary}</p>

            <section className="guide-section">
              <h4>Findings</h4>
              {selectedCanvasElementOutsideSafeArea ? (
                <div className="guide-card guide-card-warning">
                  <div className="guide-card-top">
                    <strong>Selected element near the edge</strong>
                    <span className="severity-pill">warning</span>
                  </div>
                  <p>This element may be too close to the edge for production. Vendor review required.</p>
                </div>
              ) : null}
              {visibleFindings.length === 0 ? (
                <p className="guide-empty">No immediate concerns.</p>
              ) : (
                <ul className="guide-list">
                  {visibleFindings.map((finding) => (
                    <li key={finding.id} className={`guide-card guide-card-${finding.severity}`}>
                      <div className="guide-card-top">
                        <strong>{finding.title}</strong>
                        <span className="severity-pill">{finding.severity}</span>
                      </div>
                      <p>{finding.message}</p>
                      {(() => {
                        const reviewAction = getReviewActionForFinding(finding);
                        if (!reviewAction) {
                          return null;
                        }

                        return (
                          <button
                            type="button"
                            className="guide-focus-button"
                            onClick={() => focusTarget(reviewAction.target)}
                          >
                            {reviewAction.label}
                          </button>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              )}
              {hiddenFindingCount > 0 ? (
                <p className="guide-more">
                  Showing the first {visibleFindings.length} of {agentResponse.findings.length} items.
                </p>
              ) : null}
            </section>

            <section className="guide-section">
              <h4>Next actions</h4>
              {visibleActions.length === 0 ? (
                <p className="guide-empty">No follow-up action is needed yet.</p>
              ) : (
                <ol className="action-list">
                  {visibleActions.map((action) => (
                    <li key={action.id} className="action-card">
                      <strong>{action.label}</strong>
                      <p>{action.description}</p>
                    </li>
                  ))}
                </ol>
              )}
              {hiddenActionCount > 0 ? (
                <p className="guide-more">
                  Showing the first {visibleActions.length} of {agentResponse.suggested_actions.length} actions.
                </p>
              ) : null}
            </section>

            <section className="guide-section">
              <h4>Wording guidance</h4>
              {visibleAdvice.length === 0 ? (
                <p className="guide-empty">No wording note is needed right now.</p>
              ) : (
                <ul className="guide-list">
                  {visibleAdvice.map((item) => (
                    <li key={item.id} className="advice-card">
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>

          <section className="proof-history-panel">
            <div className="guide-header">
              <div>
                <p className="panel-kicker">Proofs</p>
                <h3>Local proof versions</h3>
              </div>
              <p className="guide-note">Snapshot review only</p>
            </div>

            <section className="proof-diff-panel">
              <div className="guide-header">
                <div>
                  <p className="panel-kicker">What changed</p>
                  <h4>{comparisonTitle}</h4>
                </div>
                {comparisonVersion ? (
                  <button
                    type="button"
                    className="guide-focus-button"
                    onClick={() => setComparisonVersionId(null)}
                  >
                    Compare current draft
                  </button>
                ) : null}
              </div>

              {!latestProofVersion ? (
                <p className="guide-empty">
                  Create a proof version to keep a review snapshot, then compare later edits against it.
                </p>
              ) : comparisonDiff === null ? (
                <p className="guide-empty">Create a proof version to keep a review snapshot, then compare later edits against it.</p>
              ) : comparisonDiff.items.length === 0 ? (
                <p className="guide-empty">
                  {comparisonVersion ? "No changes between these proof versions." : "No changes since latest proof."}
                </p>
              ) : (
                <>
                  <p className="guide-summary">{comparisonDiff.summary}</p>
                  <ul className="version-list">
                    {comparisonDiff.items.map((item) => (
                      <li key={item.id} className={`version-card diff-card diff-card-${item.severity}`}>
                        <div className="guide-card-top">
                          <strong>{item.summary}</strong>
                          <span className="severity-pill">{item.severity}</span>
                        </div>
                        <p className="version-meta">
                          Field: <strong>{item.field}</strong>
                          {item.element_id ? ` · ${item.element_id}` : ""}
                        </p>
                        {item.before !== null ? (
                          <p>
                            Before: <span className="diff-value">{item.before}</span>
                          </p>
                        ) : null}
                        {item.after !== null ? (
                          <p>
                            After: <span className="diff-value">{item.after}</span>
                          </p>
                        ) : null}
                        <div className="diff-card-footer">
                          {item.severity === "critical" ? <p className="diff-caution">Review carefully.</p> : null}
                          {latestProofVersion ? (
                            <button
                              type="button"
                              className="guide-focus-button"
                              onClick={() => addNoteFromDiffItem(item)}
                            >
                              Add note
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {proofVersions.length === 0 ? (
              <p className="guide-empty">No proof versions yet. Save one to preserve the current draft for review.</p>
            ) : (
              <ul className="version-list">
                {proofVersions.map((version) => {
                  const isLatest = version.version_number === latestProofVersionNumber;
                  return (
                    <li key={version.id} className="version-card">
                      <div className="guide-card-top">
                        <strong>{formatVersionLabel(version)}</strong>
                        <span className="severity-pill">{version.id.slice(0, 8)}</span>
                      </div>
                      <p className="version-meta">
                        {new Date(version.created_at).toLocaleString()} {isLatest ? "· Latest proof version" : ""}
                      </p>
                      <p>{summarizeProofVersion(version)}</p>
                      <button
                        type="button"
                        className="guide-focus-button"
                        onClick={() => restoreProofVersion(version)}
                      >
                        Restore this version as working draft
                      </button>
                      {!isLatest ? (
                        <button
                          type="button"
                          className="guide-focus-button"
                          onClick={() => setComparisonVersionId(version.id)}
                        >
                          Compare with latest proof
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <section className="workflow-group">
              <div className="workflow-group-header">
                <div>
                  <p className="panel-kicker">Review</p>
                  <h3>Notes and approvals</h3>
                </div>
                <p className="guide-note">Local only</p>
              </div>

              <section
                className="review-notes-panel"
                ref={(node) => {
                  reviewNotesPanelRef.current = node;
                }}
              >
              <div className="guide-header">
                <div>
                  <p className="panel-kicker">Review notes</p>
                  <h4>Local notes for proof changes</h4>
                </div>
                <p className="guide-note">Local only, not approval</p>
              </div>

              <p className="guide-summary">
                Record what needs to be checked. These notes stay in this browser and do not approve a proof.
              </p>

              {reviewNotesNotice ? <p className="error-copy">{reviewNotesNotice}</p> : null}

              {latestProofVersion ? (
                <section className="review-note-form">
                  <div className="review-note-form-header">
                    <div>
                      <p className="panel-kicker">Add note</p>
                      <h5>{formatVersionLabel(latestProofVersion)}</h5>
                    </div>
                    <p className="guide-note">Record what needs to be checked</p>
                  </div>

                  <div className="review-note-grid">
                    <label className="field" htmlFor="review-note-type">
                      <span>Note type</span>
                      <select
                        id="review-note-type"
                        value={reviewNoteDraft.type}
                        onChange={(event) =>
                          setReviewNoteDraft((current) => ({
                            ...current,
                            type: event.target.value as ProofReviewNoteType,
                          }))
                        }
                      >
                        {Object.entries(reviewNoteTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field" htmlFor="review-note-author">
                      <span>Recorded by</span>
                      <select
                        id="review-note-author"
                        value={reviewNoteDraft.createdByLabel}
                        onChange={(event) =>
                          setReviewNoteDraft((current) => ({
                            ...current,
                            createdByLabel: event.target.value as "Local reviewer" | "Staff",
                          }))
                        }
                      >
                        <option value="Local reviewer">Local reviewer</option>
                        <option value="Staff">Staff</option>
                      </select>
                    </label>
                  </div>

                  <label className="field" htmlFor="review-note-body">
                    <span>Note body</span>
                    <textarea
                      id="review-note-body"
                      ref={(node) => {
                        reviewNoteBodyRef.current = node;
                      }}
                      value={reviewNoteDraft.body}
                      onChange={(event) =>
                        setReviewNoteDraft((current) => ({
                          ...current,
                          body: event.target.value,
                        }))
                      }
                      placeholder="Record what needs to be checked."
                      rows={4}
                    />
                  </label>

                  <div className="review-note-link">
                    {reviewNoteDraft.diffField ? (
                      <p className="version-meta">
                        Linked change: <strong>{formatReviewNoteFieldLabel(reviewNoteDraft.diffField)}</strong>
                        {reviewNoteDraft.diffItemId ? ` · ${reviewNoteDraft.diffItemId}` : ""}
                      </p>
                    ) : reviewNoteDraft.diffItemId ? (
                      <p className="version-meta">
                        Linked change: <strong>Selected diff item</strong> · {reviewNoteDraft.diffItemId}
                      </p>
                    ) : (
                      <p className="version-meta">No specific change linked yet.</p>
                    )}
                  </div>

                  <div className="proof-actions">
                    <button type="button" className="proof-button" onClick={saveReviewNote}>
                      Save local review note
                    </button>
                    <p className={`proof-toast proof-toast-${reviewNoteToast.tone}`}>{reviewNoteToast.message}</p>
                  </div>
                </section>
              ) : (
                <p className="guide-empty">Create a proof version to add local review notes.</p>
              )}

              {proofVersions.length === 0 || reviewNotes.length === 0 ? (
                <p className="guide-empty">
                  No local review notes yet. Add one when a spelling, date, wording, or layout check needs follow-up.
                </p>
              ) : (
                <div className="review-note-version-list">
                  {proofVersions.map((version) => {
                    const notesForVersion = listReviewNotesForVersion(reviewNotes, version.id);
                    if (notesForVersion.length === 0) {
                      return null;
                    }

                    const openNotes = listOpenReviewNotes(notesForVersion);
                    const closedNotes = notesForVersion.filter((note) => note.status !== "open");

                    return (
                      <section key={version.id} className="review-note-version">
                        <div className="guide-card-top">
                          <strong>{formatVersionLabel(version)}</strong>
                          <span className="severity-pill">{notesForVersion.length}</span>
                        </div>
                        <p className="version-meta">
                          {new Date(version.created_at).toLocaleString()} · {openNotes.length} open
                        </p>

                        <div className="review-note-stack">
                          {openNotes.map((note) => (
                            <article key={note.id} className="review-note-card review-note-card-open">
                              <div className="guide-card-top">
                                <strong>{reviewNoteTypeLabels[note.type]}</strong>
                                <span className="severity-pill">{note.status}</span>
                              </div>
                              <p>{note.body}</p>
                              <p className="review-note-meta">
                                {note.createdByLabel} · {new Date(note.createdAt).toLocaleString()}
                              </p>
                              {note.diffField ? (
                                <p className="review-note-source">
                                  Linked to <strong>{formatReviewNoteFieldLabel(note.diffField)}</strong>
                                  {note.diffItemId ? ` · ${note.diffItemId}` : ""}
                                </p>
                              ) : note.diffItemId ? (
                                <p className="review-note-source">Linked to diff item {note.diffItemId}</p>
                              ) : null}
                              <div className="review-note-actions">
                                <button
                                  type="button"
                                  className="guide-focus-button"
                                  onClick={() => updateReviewNoteStatus(note, "resolved")}
                                >
                                  Resolve
                                </button>
                                <button
                                  type="button"
                                  className="guide-focus-button"
                                  onClick={() => updateReviewNoteStatus(note, "dismissed")}
                                >
                                  Dismiss
                                </button>
                              </div>
                            </article>
                          ))}

                          {closedNotes.map((note) => (
                            <article key={note.id} className="review-note-card review-note-card-closed">
                              <div className="guide-card-top">
                                <strong>{reviewNoteTypeLabels[note.type]}</strong>
                                <span className="severity-pill">{note.status}</span>
                              </div>
                              <p>{note.body}</p>
                              <p className="review-note-meta">
                                {note.createdByLabel} · {new Date(note.createdAt).toLocaleString()}
                              </p>
                              {note.diffField ? (
                                <p className="review-note-source">
                                  Linked to <strong>{formatReviewNoteFieldLabel(note.diffField)}</strong>
                                  {note.diffItemId ? ` · ${note.diffItemId}` : ""}
                                </p>
                              ) : note.diffItemId ? (
                                <p className="review-note-source">Linked to diff item {note.diffItemId}</p>
                              ) : null}
                              <p className="guide-more">This note is closed and kept in local history.</p>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="family-approval-panel">
              <div className="guide-header">
                <div>
                  <p className="panel-kicker">Family proof approval</p>
                  <h4>Local approval capture</h4>
                </div>
                <p className="guide-note">Local only, not production</p>
              </div>

              <p className="guide-summary">
                This records family review of this proof version only. Vendor review is still required before production.
              </p>

              {approvalRecoveryNotice ? <p className="error-copy">{approvalRecoveryNotice}</p> : null}

              {latestProofVersion ? (
                <section className="family-approval-form">
                  <div className="family-approval-form-header">
                    <div>
                      <p className="panel-kicker">Approve version</p>
                      <h4>{formatVersionLabel(latestProofVersion)}</h4>
                    </div>
                    <p className="guide-note">Current latest proof</p>
                  </div>

                  <p className="version-meta">
                    Approval snapshot: <strong>{buildApprovalTextSnapshot(latestProofVersion)}</strong>
                  </p>

                  <div className="family-approval-grid">
                    <label className="field" htmlFor="approval-approver-name">
                      <span>Approver name</span>
                      <input
                        id="approval-approver-name"
                        type="text"
                        value={approvalDraft.approverName}
                        onChange={(event) =>
                          setApprovalDraft((current) => ({
                            ...current,
                            approverName: event.target.value,
                          }))
                        }
                        placeholder="Enter the family reviewer name"
                      />
                    </label>

                    <label className="field" htmlFor="approval-approver-role">
                      <span>Approver role</span>
                      <select
                        id="approval-approver-role"
                        value={approvalDraft.approverRoleLabel}
                        onChange={(event) =>
                          setApprovalDraft((current) => ({
                            ...current,
                            approverRoleLabel: event.target.value as ApprovalDraft["approverRoleLabel"],
                          }))
                        }
                      >
                        <option value="Family reviewer">Family reviewer</option>
                        <option value="Authorized reviewer">Authorized reviewer</option>
                      </select>
                    </label>

                    <label className="field" htmlFor="approval-created-by">
                      <span>Recorded by</span>
                      <select
                        id="approval-created-by"
                        value={approvalDraft.createdByLabel}
                        onChange={(event) =>
                          setApprovalDraft((current) => ({
                            ...current,
                            createdByLabel: event.target.value as ApprovalDraft["createdByLabel"],
                          }))
                        }
                      >
                        <option value="Local reviewer">Local reviewer</option>
                        <option value="Staff">Staff</option>
                      </select>
                    </label>
                  </div>

                  <div className="approval-ack-list">
                    {approvalAcknowledgmentOrder.map((key) => (
                      <label key={key} className="approval-ack-item" htmlFor={`approval-ack-${key}`}>
                        <input
                          id={`approval-ack-${key}`}
                          type="checkbox"
                          checked={approvalDraft.acknowledgments[key]}
                          onChange={(event) =>
                            setApprovalDraft((current) => ({
                              ...current,
                              acknowledgments: {
                                ...current.acknowledgments,
                                [key]: event.target.checked,
                              },
                            }))
                          }
                        />
                        <span>{approvalAcknowledgmentLabels[key]}</span>
                      </label>
                    ))}
                  </div>

                  <div className="proof-actions">
                    <button
                      type="button"
                      className="proof-button"
                      onClick={submitFamilyApproval}
                      disabled={latestProofVersion === null}
                    >
                      Save local family approval
                    </button>
                    <p className={`proof-toast proof-toast-${approvalToast.tone}`}>{approvalToast.message}</p>
                  </div>
                </section>
              ) : (
                <p className="guide-empty">Create a proof version before recording family approval.</p>
              )}

              {latestVersionActiveApprovals.length > 0 ? (
                <section className="approval-summary">
                  <p className="guide-summary">
                    Active approval on this proof version. It stays attached to this proof snapshot even if the draft changes later.
                  </p>
                  <ul className="approval-list">
                    {latestVersionActiveApprovals.map((record) => (
                      <li key={record.id} className="approval-card approval-card-active">
                        <div className="guide-card-top">
                          <strong>{record.approverName}</strong>
                          <span className="severity-pill">{record.status}</span>
                        </div>
                        <p className="version-meta">
                          {record.approverRoleLabel} · {new Date(record.approvedAt).toLocaleString()}
                        </p>
                        <p className="approval-snapshot">{record.approvalTextSnapshot}</p>
                        <p className="approval-ack-copy">
                          Name, date, and epitaph review were acknowledged, and this is not production approval.
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : latestProofVersion ? (
                <p className="guide-empty">
                  No active family approval has been saved for this proof version yet.
                </p>
              ) : null}

              {approvalRecords.length === 0 ? (
                <p className="guide-empty">
                  No local family approvals yet. Add one only after a family review of the latest proof version.
                </p>
              ) : (
                <div className="approval-version-list">
                  {proofVersions.map((version) => {
                    const approvalsForVersion = listApprovalsForVersion(approvalRecords, version.id);
                    if (approvalsForVersion.length === 0) {
                      return null;
                    }

                    const activeApprovals = listActiveProofApprovals(approvalsForVersion);
                    const revokedApprovals = approvalsForVersion.filter((record) => record.status === "revoked");
                    const isLatestVersion = latestProofVersion?.id === version.id;

                    return (
                      <section key={version.id} className="approval-version-card">
                        <div className="guide-card-top">
                          <strong>{formatVersionLabel(version)}</strong>
                          <span className="severity-pill">{approvalsForVersion.length}</span>
                        </div>
                        <p className="version-meta">
                          {new Date(version.created_at).toLocaleString()}
                          {isLatestVersion ? " · Latest proof version" : " · Earlier proof version"}
                        </p>
                        {!isLatestVersion ? (
                          <p className="guide-more">
                            This approval belongs to an earlier proof snapshot, not the current draft.
                          </p>
                        ) : null}

                        <div className="approval-record-stack">
                          {activeApprovals.map((record) => (
                            <article key={record.id} className="approval-card approval-card-active">
                              <div className="guide-card-top">
                                <strong>{record.approverName}</strong>
                                <span className="severity-pill">{record.status}</span>
                              </div>
                              <p className="version-meta">
                                {record.approverRoleLabel} · {record.createdByLabel} · {new Date(record.approvedAt).toLocaleString()}
                              </p>
                              <p className="approval-snapshot">{record.approvalTextSnapshot}</p>
                              <div className="approval-ack-list approval-ack-list-compact">
                                {approvalAcknowledgmentOrder.map((key) => (
                                  <span key={key} className="approval-ack-chip">
                                    {approvalAcknowledgmentLabels[key]}
                                  </span>
                                ))}
                              </div>
                              <label className="field" htmlFor={`revoke-reason-${record.id}`}>
                                <span>Revoke reason</span>
                                <textarea
                                  id={`revoke-reason-${record.id}`}
                                  rows={2}
                                  value={revocationReasons[record.id] ?? ""}
                                  onChange={(event) =>
                                    setRevocationReasons((current) => ({
                                      ...current,
                                      [record.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Explain why this approval is being revoked."
                                />
                              </label>
                              <div className="review-note-actions">
                                <button
                                  type="button"
                                  className="guide-focus-button"
                                  onClick={() => revokeFamilyApproval(record)}
                                >
                                  Revoke approval
                                </button>
                              </div>
                            </article>
                          ))}

                          {revokedApprovals.map((record) => (
                            <article key={record.id} className="approval-card approval-card-revoked">
                              <div className="guide-card-top">
                                <strong>{record.approverName}</strong>
                                <span className="severity-pill">{record.status}</span>
                              </div>
                              <p className="version-meta">
                                {record.approverRoleLabel} · {record.createdByLabel} · {new Date(record.approvedAt).toLocaleString()}
                              </p>
                              <p className="approval-snapshot">{record.approvalTextSnapshot}</p>
                              {record.revokedAt ? (
                                <p className="approval-revocation">
                                  Revoked {new Date(record.revokedAt).toLocaleString()}
                                </p>
                              ) : null}
                              {record.revokedReason ? <p className="approval-revocation">{record.revokedReason}</p> : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="vendor-review-panel">
              <div className="guide-header">
                <div>
                  <p className="panel-kicker">Vendor production review</p>
                  <h3>Local production-prep checklist</h3>
                </div>
                <p className="guide-note">Human review only</p>
              </div>

              <p className="guide-summary">
                Ready for production prep means the proof has been reviewed. It does not create engraving files or lock production.
              </p>

              {vendorReviewsNotice ? <p className="error-copy">{vendorReviewsNotice}</p> : null}

              {latestProofVersion ? (
                <>
                  {!latestProofHasFamilyApproval ? (
                    <p className="vendor-review-warning">
                      Family approval has not been recorded for this proof version.
                    </p>
                  ) : null}

                  <section className="vendor-review-form">
                    <div className="vendor-review-form-header">
                      <div>
                        <p className="panel-kicker">Review target</p>
                        <h4>{formatVersionLabel(selectedVendorReviewVersion ?? latestProofVersion)}</h4>
                      </div>
                      <p className="guide-note">Selected proof snapshot</p>
                    </div>

                    <label className="field" htmlFor="vendor-review-version-select">
                      <span>Review version</span>
                      <select
                        id="vendor-review-version-select"
                        value={selectedVendorReviewVersion?.id ?? ""}
                        onChange={(event) => setVendorReviewVersionId(event.target.value)}
                      >
                        {proofVersions.map((version) => (
                          <option key={version.id} value={version.id}>
                            {formatVersionLabel(version)} · {new Date(version.created_at).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </label>

                    <p className="version-meta">
                      Snapshot: <strong>{summarizeProofVersion(selectedVendorReviewVersion ?? latestProofVersion)}</strong>
                    </p>
                    <p className="guide-more">
                      This review stays tied to the selected proof snapshot even if the working draft changes later.
                    </p>

                    {selectedVendorReview ? (
                      <>
                        <div className="guide-card-top">
                          <strong>{vendorReviewStatusLabels[selectedVendorReview.status]}</strong>
                          <span className="severity-pill">{vendorReviewStatusLabels[selectedVendorReview.status]}</span>
                        </div>

                        <p className="version-meta">
                          Created {new Date(selectedVendorReview.createdAt).toLocaleString()} ·{" "}
                          Updated {new Date(selectedVendorReview.updatedAt).toLocaleString()}
                        </p>

                        <p className="vendor-review-status-copy">
                          {selectedVendorReview.status === "revoked"
                            ? "This review has been revoked and remains in local history."
                            : isVendorReviewReady(selectedVendorReview)
                              ? "Ready for production prep means the proof has been reviewed. It does not create engraving files or lock production."
                              : "Keep checking items carefully before marking the review ready for production prep."}
                        </p>

                        <label className="field" htmlFor="vendor-reviewer-label">
                          <span>Reviewed by</span>
                          <select
                            id="vendor-reviewer-label"
                            value={selectedVendorReview.reviewedByLabel}
                            onChange={(event) =>
                              updateVendorReviewLabel(event.target.value as "Local reviewer" | "Staff")
                            }
                            disabled={selectedVendorReview.status === "revoked"}
                          >
                            <option value="Staff">Staff</option>
                            <option value="Local reviewer">Local reviewer</option>
                          </select>
                        </label>

                        <div className="vendor-review-checklist">
                          {vendorReviewChecklistOrder.map((key) => (
                            <label key={key} className="vendor-review-check-item" htmlFor={`vendor-review-check-${key}`}>
                              <input
                                id={`vendor-review-check-${key}`}
                                type="checkbox"
                                checked={selectedVendorReview.checklist.find((item) => item.key === key)?.checked ?? false}
                                onChange={(event) => setVendorReviewChecklistItem(key, event.target.checked)}
                                disabled={selectedVendorReview.status === "revoked"}
                              />
                              <span>{vendorReviewChecklistLabels[key]}</span>
                            </label>
                          ))}
                        </div>

                        <label className="field" htmlFor="vendor-review-notes">
                          <span>Production notes</span>
                          <textarea
                            id="vendor-review-notes"
                            rows={4}
                            value={selectedVendorReview.notes}
                            onChange={(event) => updateVendorReviewNotes(event.target.value)}
                            placeholder="Record what still needs to be checked."
                            disabled={selectedVendorReview.status === "revoked"}
                          />
                        </label>

                        <div className="proof-actions">
                        <button
                          type="button"
                          className="proof-button"
                          onClick={markCurrentVendorReviewReady}
                          disabled={
                            selectedVendorReview.status === "revoked" ||
                            selectedVendorReview.status === "ready_for_production_prep" ||
                            !isVendorReviewReady(selectedVendorReview)
                          }
                        >
                          Ready for production prep
                        </button>
                          <p className={`proof-toast proof-toast-${vendorReviewToast.tone}`}>{vendorReviewToast.message}</p>
                        </div>

                        <label className="field" htmlFor={`vendor-review-revoke-${selectedVendorReview.id}`}>
                          <span>Revoke reason</span>
                          <textarea
                            id={`vendor-review-revoke-${selectedVendorReview.id}`}
                            rows={2}
                            value={vendorReviewRevocationReasons[selectedVendorReview.id] ?? ""}
                            onChange={(event) =>
                              setVendorReviewRevocationReasons((current) => ({
                                ...current,
                                [selectedVendorReview.id]: event.target.value,
                              }))
                            }
                            placeholder="Explain why this review is being revoked."
                            disabled={selectedVendorReview.status === "revoked"}
                          />
                        </label>

                        <div className="review-note-actions">
                          <button
                            type="button"
                            className="guide-focus-button"
                            onClick={() => revokeCurrentVendorReview(selectedVendorReview)}
                            disabled={selectedVendorReview.status === "revoked"}
                          >
                            Revoke review
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="proof-actions">
                        <p className="guide-empty">No vendor review has been started for this proof version yet.</p>
                        <button type="button" className="proof-button" onClick={startVendorReview}>
                          Start vendor review
                        </button>
                        <p className={`proof-toast proof-toast-${vendorReviewToast.tone}`}>{vendorReviewToast.message}</p>
                      </div>
                    )}
                  </section>

                  <section className="vendor-review-version-list">
                    <div className="guide-header">
                      <div>
                        <p className="panel-kicker">Review history</p>
                        <h4>Saved vendor reviews by proof version</h4>
                      </div>
                      <p className="guide-note">Snapshot history</p>
                    </div>

                    {vendorReviews.length === 0 ? (
                      <p className="guide-empty">
                        No local vendor reviews yet. Start one after confirming the proof snapshot you want to review.
                      </p>
                    ) : (
                      proofVersions.map((version) => {
                        const reviewsForVersion = listVendorReviewsForVersion(vendorReviews, version.id);
                        if (reviewsForVersion.length === 0) {
                          return null;
                        }

                        const latestReviewForVersion = getLatestVendorReviewForVersion(vendorReviews, version.id);
                        const isLatestVersion = latestProofVersion?.id === version.id;

                        return (
                          <section key={version.id} className="vendor-review-version-card">
                            <div className="guide-card-top">
                              <strong>{formatVersionLabel(version)}</strong>
                              <span className="severity-pill">{reviewsForVersion.length}</span>
                            </div>
                            <p className="version-meta">
                              {new Date(version.created_at).toLocaleString()}
                              {isLatestVersion ? " · Latest proof version" : " · Earlier proof version"}
                            </p>
                            <p className="guide-more">
                              {isLatestVersion
                                ? "This review history belongs to the latest proof snapshot."
                                : "This review history stays attached to the earlier proof snapshot."}
                            </p>
                            {latestReviewForVersion ? (
                              <article className="vendor-review-card">
                                <div className="guide-card-top">
                                  <strong>{vendorReviewStatusLabels[latestReviewForVersion.status]}</strong>
                                  <span className="severity-pill">{vendorReviewStatusLabels[latestReviewForVersion.status]}</span>
                                </div>
                                <p className="version-meta">
                                  {latestReviewForVersion.reviewedByLabel} ·{" "}
                                  {new Date(latestReviewForVersion.updatedAt).toLocaleString()}
                                </p>
                                <p className="vendor-review-status-copy">
                                  {latestReviewForVersion.status === "revoked"
                                    ? "Revoked reviews are kept in local history."
                                    : latestReviewForVersion.status === "ready_for_production_prep"
                                      ? "Ready for production prep means the proof has been reviewed. It does not create engraving files or lock production."
                                      : "This review is still in local production-prep review."}
                                </p>
                                <p className="vendor-review-notes">{latestReviewForVersion.notes || "No local notes yet."}</p>
                              </article>
                            ) : null}
                          </section>
                        );
                      })
                    )}

                    {latestVendorReviewForLatestProofVersion &&
                    latestVendorReviewForLatestProofVersion.status === "revoked" ? (
                      <p className="guide-more">
                        The latest proof version has a revoked vendor review on file. The snapshot stays available for history.
                      </p>
                    ) : null}
                  </section>
                </>
              ) : (
                <p className="guide-empty">Create a proof version before starting vendor production review.</p>
              )}
            </section>

            </section>

            <section className="workflow-group">
              <div className="workflow-group-header">
                <div>
                  <p className="panel-kicker">Export</p>
                  <h3>Print and candidate files</h3>
                </div>
                <p className="guide-note">Separate from approval</p>
              </div>

              <section className="proof-document-panel">
              <div className="guide-header">
                <div>
                  <p className="panel-kicker">Proof document</p>
                  <h4>{proofDocument?.title ?? "Memorial Design Proof"}</h4>
                </div>
                <p className="guide-note">Family review only</p>
              </div>

              <p className="guide-summary">
                This printable proof uses one saved proof version snapshot. It stays separate from production approval.
              </p>

              {proofVersions.length > 0 ? (
                <div className="proof-document-controls">
                  <label className="field" htmlFor="proof-version-select">
                    <span>Proof version</span>
                    <select
                      id="proof-version-select"
                      value={selectedProofVersion?.id ?? ""}
                      onChange={(event) => setProofVersionId(event.target.value)}
                    >
                      {proofVersions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {formatVersionLabel(version)} · {new Date(version.created_at).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="proof-document-actions">
                    <p className="version-meta">
                      Suggested file name: <strong>{proofDocument?.fileName ?? "proof.pdf"}</strong>
                    </p>
                    <button
                      type="button"
                      className="proof-button"
                      onClick={printProofDocument}
                      disabled={proofDocument === null}
                    >
                      Print / Save as PDF
                    </button>
                  </div>
                </div>
              ) : (
                <p className="guide-empty">Create a proof version to prepare a printable review copy.</p>
              )}

              {proofDocument ? (
                <article className="proof-document-page">
                  <header className="proof-document-header">
                    <div className="proof-document-header-copy">
                      <p className="panel-kicker">Memorial Design Proof</p>
                      <h4>{proofDocument.metadata.memorialName}</h4>
                      <p className="version-meta">
                        Proof version <strong>{proofDocument.metadata.proofVersionId}</strong> ·{" "}
                        {proofDocument.metadata.proofVersionLabel} · Generated {proofDocument.metadata.generatedAtLabel}
                      </p>
                      <p className="version-meta">
                        Suggested file name: <strong>{proofDocument.fileName}</strong>
                      </p>
                    </div>

                    <dl className="proof-document-meta-grid">
                      <div>
                        <dt>Version ID</dt>
                        <dd>{proofDocument.metadata.proofVersionId}</dd>
                      </div>
                      <div>
                        <dt>Version time</dt>
                        <dd>{proofDocument.metadata.proofVersionCreatedAtLabel}</dd>
                      </div>
                      <div>
                        <dt>Generated</dt>
                        <dd>{proofDocument.metadata.generatedAtLabel}</dd>
                      </div>
                      <div>
                        <dt>Dimensions</dt>
                        <dd>{proofDocument.metadata.dimensionsLabel}</dd>
                      </div>
                      <div>
                        <dt>Material</dt>
                        <dd>{proofDocument.metadata.material}</dd>
                      </div>
                      <div>
                        <dt>Finish</dt>
                        <dd>{proofDocument.metadata.finish}</dd>
                      </div>
                    </dl>
                  </header>

                  <section className="proof-document-summary">
                    <div className="proof-document-summary-grid">
                      <div>
                        <p className="guide-note">Memorial name</p>
                        <p className="version-meta">{proofDocument.metadata.memorialName}</p>
                      </div>
                      <div>
                        <p className="guide-note">Birth date</p>
                        <p className="version-meta">{proofDocument.metadata.birthDateText ?? "Not entered yet"}</p>
                      </div>
                      <div>
                        <p className="guide-note">Death date</p>
                        <p className="version-meta">{proofDocument.metadata.deathDateText ?? "Not entered yet"}</p>
                      </div>
                      <div>
                        <p className="guide-note">Epitaph</p>
                        <p className="version-meta">{proofDocument.metadata.epitaphText ?? "Not entered yet"}</p>
                      </div>
                    </div>
                  </section>

                  {proofDocument.sections.map((section) => renderProofDocumentSection(section))}
                </article>
              ) : (
                <p className="guide-empty">
                  No printable proof is available yet. Save a proof version first, then pick it here for review.
                </p>
              )}
            </section>

            <section className="export-candidate-panel">
              <div className="guide-header">
                <div>
                  <p className="panel-kicker">Laser/vector export candidate</p>
                  <h4>Local SVG export snapshot</h4>
                </div>
                <p className="guide-note">Export candidate only</p>
              </div>

              <p className="guide-summary">
                This downloads the selected proof version as a local SVG candidate. It is not certified production-ready.
              </p>

              <ul className="export-warning-list">
                {exportCandidateWarningMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>

              {exportToast.message ? <p className={`proof-toast proof-toast-${exportToast.tone}`}>{exportToast.message}</p> : null}

              {proofVersions.length > 0 && selectedProofVersion && proofDocument ? (
                <>
                  <p className="version-meta">
                    Suggested file name: <strong>{exportCandidateFileName ?? "memorial-design-candidate.svg"}</strong>
                  </p>
                  <div className="proof-actions export-candidate-actions">
                    <button
                      type="button"
                      className="proof-button"
                      onClick={() => downloadExportCandidateAsset("memorial-design-candidate.svg")}
                    >
                      Download SVG candidate
                    </button>
                    <button
                      type="button"
                      className="guide-focus-button"
                      onClick={() => downloadExportCandidateAsset("manifest.json")}
                    >
                      Download manifest
                    </button>
                    <button
                      type="button"
                      className="guide-focus-button"
                      onClick={() => downloadExportCandidateAsset("transcript.txt")}
                    >
                      Download transcript
                    </button>
                    <button
                      type="button"
                      className="guide-focus-button"
                      onClick={() => downloadExportCandidateAsset("design-document.json")}
                    >
                      Download design JSON
                    </button>
                  </div>
                  <p className="guide-more">
                    Export files are built from the immutable proof snapshot. They do not change the draft or mark production complete.
                  </p>
                </>
              ) : (
                <p className="guide-empty">Create a proof version before exporting a local SVG candidate.</p>
              )}
            </section>
            </section>

            <p className="guide-more">
              Proof versions are local snapshots for review. They are not family approval and they do
              not approve production.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}
