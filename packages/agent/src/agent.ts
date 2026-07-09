import { designDraftSchema, type DesignDraft, type DraftStatus } from "@headstone/core";
import { designDocumentSchema, type DesignDocument } from "@headstone/schema";

export type AgentMode =
  | "family_guidance"
  | "staff_guidance"
  | "production_review"
  | "wording_help";

export type AgentFindingSeverity = "info" | "suggestion" | "warning" | "blocker";

export interface AgentFinding {
  id: string;
  severity: AgentFindingSeverity;
  title: string;
  message: string;
  field?: string;
}

export interface AgentAdvice {
  id: string;
  title: string;
  message: string;
}

export interface AgentSuggestedAction {
  id: string;
  label: string;
  description: string;
  kind:
    | "review"
    | "save_version"
    | "family_review"
    | "family_followup"
    | "vendor_review"
    | "wording";
  priority: number;
  disabled?: boolean;
}

export interface AgentContext {
  mode: AgentMode;
  draft: unknown;
}

export interface AgentResponse {
  mode: AgentMode;
  draft_id: string | null;
  draft_status: DraftStatus | null;
  summary: string;
  findings: AgentFinding[];
  advice: AgentAdvice[];
  suggested_actions: AgentSuggestedAction[];
  ready_for_production: boolean;
}

const longEpitaphLimit = 120;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortByPriority(actions: AgentSuggestedAction[]): AgentSuggestedAction[] {
  return [...actions].sort((a, b) => a.priority - b.priority);
}

function dedupeFindings(findings: AgentFinding[]): AgentFinding[] {
  const seen = new Set<string>();
  const deduped: AgentFinding[] = [];
  for (const finding of findings) {
    if (seen.has(finding.id)) {
      continue;
    }
    seen.add(finding.id);
    deduped.push(finding);
  }
  return deduped;
}

function validateContext(
  context: AgentContext,
): { ok: true; draft: DesignDraft; design_document: DesignDocument } | { ok: false; finding: AgentFinding } {
  const parsedDraft = designDraftSchema.safeParse(context.draft);
  if (!parsedDraft.success) {
    return {
      ok: false,
      finding: {
        id: "draft-validation-failed",
        severity: "blocker",
        title: "Draft needs attention",
        message: "The saved draft could not be analyzed yet.",
      },
    };
  }

  const parsedDocument = designDocumentSchema.safeParse(parsedDraft.data.design_document);
  if (!parsedDocument.success) {
    return {
      ok: false,
      finding: {
        id: "design-document-validation-failed",
        severity: "blocker",
        title: "Design document needs attention",
        message: "The design document could not be reviewed safely.",
      },
    };
  }

  return {
    ok: true,
    draft: parsedDraft.data,
    design_document: parsedDocument.data,
  };
}

function getTextContent(document: DesignDocument, field: string): string | null {
  for (const element of document.elements) {
    if (element.type === "text" && element.field === field) {
      const content = element.content.trim();
      return content.length > 0 ? content : null;
    }
  }
  return null;
}

function hasDateRange(document: DesignDocument): boolean {
  const combinedDates = getTextContent(document, "dates");
  if (!combinedDates) {
    return false;
  }

  return /\S.+\s*[-–—]\s*\S.+/.test(combinedDates);
}

function analyzeContent(
  draft: DesignDraft,
  design_document: DesignDocument,
): AgentFinding[] {
  const findings: AgentFinding[] = [];

  if (!getTextContent(design_document, "name")) {
    findings.push({
      id: "missing-name",
      severity: "blocker",
      title: "Name is missing",
      message: "Add the name when you have it. It is the main text on the stone.",
      field: "name",
    });
  }

  const birthDate = getTextContent(design_document, "birth_date");
  const deathDate = getTextContent(design_document, "death_date");
  const combinedDates = hasDateRange(design_document);

  if (!birthDate && !combinedDates) {
    findings.push({
      id: "missing-birth-date",
      severity: "blocker",
      title: "Birth date is missing",
      message: "Add the birth date when it is ready to confirm.",
      field: "birth_date",
    });
  }

  if (!deathDate && !combinedDates) {
    findings.push({
      id: "missing-death-date",
      severity: "blocker",
      title: "Death date is missing",
      message: "Add the death date when it is confirmed.",
      field: "death_date",
    });
  }

  const epitaph = getTextContent(design_document, "epitaph");
  if (!epitaph) {
    findings.push({
      id: "empty-epitaph",
      severity: "suggestion",
      title: "Epitaph is empty",
      message: "You can leave the epitaph blank for now and come back to it later.",
      field: "epitaph",
    });
  } else if (epitaph.length > longEpitaphLimit) {
    findings.push({
      id: "long-epitaph",
      severity: "warning",
      title: "Epitaph is long",
      message: "A shorter line may be easier to read on stone.",
      field: "epitaph",
    });
  }

  if (draft.versions.length === 0) {
    findings.push({
      id: "no-version-yet",
      severity: "suggestion",
      title: "No saved version yet",
      message: "Save a version before asking other people to review this draft.",
    });
  }

  if (draft.status === "production_locked") {
    findings.push({
      id: "draft-locked",
      severity: "info",
      title: "Draft is locked",
      message: "This draft is locked for production. Changes should happen in a new draft.",
    });
  }

  return findings;
}

function analyzeApprovalStatus(draft: DesignDraft): AgentFinding[] {
  const findings: AgentFinding[] = [];

  if (draft.status === "archived") {
    findings.push({
      id: "draft-archived",
      severity: "info",
      title: "Draft is archived",
      message: "Archived drafts stay read-only.",
    });
    return findings;
  }

  if (draft.versions.length === 0) {
    findings.push({
      id: "approval-needs-version",
      severity: "blocker",
      title: "Save a version first",
      message: "Family approval needs at least one saved version.",
    });
  }

  if (draft.status !== "family_approved" && draft.status !== "production_locked") {
    findings.push({
      id: "family-approval-pending",
      severity: "suggestion",
      title: "Family approval is still pending",
      message: "Share a saved version with the family when the wording feels ready.",
    });
  }

  if (draft.status === "family_approved") {
    findings.push({
      id: "family-approved",
      severity: "info",
      title: "Family approval is recorded",
      message: "The draft has a family-approved version.",
    });
  }

  return findings;
}

function analyzeProductionStatus(draft: DesignDraft): AgentFinding[] {
  const findings: AgentFinding[] = [];

  if (draft.status === "archived") {
    findings.push({
      id: "archived-not-production",
      severity: "blocker",
      title: "Archived draft",
      message: "Archived drafts cannot move to production.",
    });
    return findings;
  }

  if (draft.status === "production_locked") {
    return findings;
  }

  if (draft.status !== "family_approved") {
    findings.push({
      id: "needs-family-approval",
      severity: "blocker",
      title: "Family approval is needed",
      message: "Production review should wait until the family has approved a version.",
    });
  }

  if (draft.status !== "vendor_review") {
    findings.push({
      id: "needs-vendor-review",
      severity: "blocker",
      title: "Vendor review is needed",
      message: "A vendor should review the draft before production lock.",
    });
  }

  if (draft.status === "family_approved") {
    findings.push({
      id: "waiting-vendor-review",
      severity: "warning",
      title: "Waiting for vendor review",
      message: "The draft is family-approved but still needs vendor review.",
    });
  }

  if (draft.status === "vendor_review") {
    findings.push({
      id: "ready-for-lock-review",
      severity: "suggestion",
      title: "Ready for production lock review",
      message: "The draft has reached vendor review. A human should confirm production details.",
    });
  }

  return findings;
}

export function analyzeCompleteness(context: AgentContext): AgentFinding[] {
  const validated = validateContext(context);
  if (!validated.ok) {
    return [validated.finding];
  }

  return analyzeContent(validated.draft, validated.design_document);
}

export function analyzeApprovalReadiness(context: AgentContext): AgentFinding[] {
  const validated = validateContext(context);
  if (!validated.ok) {
    return [validated.finding];
  }

  return dedupeFindings([
    ...analyzeContent(validated.draft, validated.design_document),
    ...analyzeApprovalStatus(validated.draft),
  ]);
}

export function analyzeProductionReadiness(context: AgentContext): AgentFinding[] {
  const validated = validateContext(context);
  if (!validated.ok) {
    return [validated.finding];
  }

  return dedupeFindings([
    ...analyzeContent(validated.draft, validated.design_document),
    ...analyzeApprovalStatus(validated.draft),
    ...analyzeProductionStatus(validated.draft),
  ]);
}

function buildWordingAdvice(
  context: AgentContext,
  draft: DesignDraft,
  design_document: DesignDocument,
): AgentAdvice[] {
  const advice: AgentAdvice[] = [];
  const epitaph = getTextContent(design_document, "epitaph");

  if (!getTextContent(design_document, "name")) {
    advice.push({
      id: "wording-name",
      title: "Start with the name",
      message: "If it helps, begin with the name and return to the dates later.",
    });
  }

  if (!epitaph) {
    advice.push({
      id: "wording-epitaph-empty",
      title: "Leave space for now",
      message: "A blank epitaph is okay. You can come back to it when the words feel settled.",
    });
  } else if (epitaph.length > longEpitaphLimit) {
    advice.push({
      id: "wording-epitaph-long",
      title: "Keep it simple",
      message: "A shorter line can be easier to read and easier to revisit later.",
    });
  } else {
    advice.push({
      id: "wording-epitaph-stable",
      title: "The wording is steady",
      message: "The current wording is clear enough to review with the family.",
    });
  }

  if (draft.status === "production_locked") {
    advice.push({
      id: "wording-locked",
      title: "Use a new draft for changes",
      message: "This draft is locked. If changes are needed, keep them in a separate draft.",
    });
  }

  if (context.mode === "staff_guidance") {
    advice.push({
      id: "wording-staff-note",
      title: "Staff note",
      message: "A staff member can confirm spelling, dates, and family notes before review.",
    });
  }

  return advice;
}

export function createGentleWordingSuggestions(context: AgentContext): AgentAdvice[] {
  const validated = validateContext(context);
  if (!validated.ok) {
    return [
      {
        id: "wording-unavailable",
        title: "Check the saved draft",
        message: "I could not read the draft yet. Save it again and try once more.",
      },
    ];
  }

  return buildWordingAdvice(context, validated.draft, validated.design_document);
}

export function suggestNextActions(context: AgentContext): AgentSuggestedAction[] {
  const validated = validateContext(context);
  if (!validated.ok) {
    return [
      {
        id: "action-review-draft",
        label: "Review the saved draft",
        description: "The agent needs a valid draft before it can suggest next steps.",
        kind: "review",
        priority: 0,
      },
    ];
  }

  const actions: AgentSuggestedAction[] = [];
  const completeness = analyzeContent(validated.draft, validated.design_document);
  const hasFinding = (id: string) => completeness.some((finding) => finding.id === id);

  if (hasFinding("missing-name")) {
    actions.push({
      id: "action-add-name",
      label: "Add the name",
      description: "Add the name before asking the family to review the draft.",
      kind: "family_followup",
      priority: 0,
    });
  }

  if (hasFinding("missing-birth-date") || hasFinding("missing-death-date")) {
    actions.push({
      id: "action-add-dates",
      label: "Add the dates",
      description: "Fill in the dates once they are confirmed.",
      kind: "family_followup",
      priority: 1,
    });
  }

  if (hasFinding("empty-epitaph") || hasFinding("long-epitaph")) {
    actions.push({
      id: "action-review-wording",
      label: "Review the wording",
      description: "Keep the wording simple and calm if the family still wants time.",
      kind: "wording",
      priority: 2,
    });
  }

  if (validated.draft.versions.length === 0) {
    actions.push({
      id: "action-save-version",
      label: "Save a version",
      description: "Save a version before sharing the draft for approval.",
      kind: "save_version",
      priority: 3,
    });
  }

  if (validated.draft.status === "production_locked") {
    actions.push({
      id: "action-review-locked",
      label: "Review the locked draft",
      description: "If changes are needed, use a separate draft for revisions.",
      kind: "review",
      priority: 4,
    });
    return sortByPriority(actions);
  }

  if (validated.draft.status !== "family_approved") {
    actions.push({
      id: "action-family-review",
      label: "Share with family",
      description: "The draft is not family approved yet. Share a saved version when ready.",
      kind: "family_review",
      priority: 4,
    });
  } else {
    actions.push({
      id: "action-vendor-review",
      label: "Send for vendor review",
      description: "The family has approved a version. A vendor should review it next.",
      kind: "vendor_review",
      priority: 4,
    });
  }

  if (validated.draft.status === "vendor_review") {
    actions.push({
      id: "action-production-check",
      label: "Confirm production details",
      description: "Ask a human to confirm the final production details before lock.",
      kind: "review",
      priority: 5,
    });
  }

  return sortByPriority(actions);
}

function modeSummary(mode: AgentMode, findings: AgentFinding[], draft: DesignDraft): string {
  if (findings.some((finding) => finding.severity === "blocker")) {
    return "This draft still needs a few calm checks before it is ready.";
  }

  if (draft.status === "production_locked") {
    return "This draft is locked. Review it carefully, but do not edit it here.";
  }

  if (mode === "wording_help") {
    return "The wording guidance is ready.";
  }

  return "The draft is in a workable state for the current review mode.";
}

function responseFromValidationFailure(mode: AgentMode, finding: AgentFinding): AgentResponse {
  return {
    mode,
    draft_id: null,
    draft_status: null,
    summary: "This draft needs attention before the agent can review it.",
    findings: [finding],
    advice: [
      {
        id: "validation-advice",
        title: "Save the draft again",
        message: "If the draft was recently recovered, save it once more and try again.",
      },
    ],
    suggested_actions: [
      {
        id: "validation-action",
        label: "Review the saved draft",
        description: "The saved draft could not be read safely.",
        kind: "review",
        priority: 0,
      },
    ],
    ready_for_production: false,
  };
}

export function analyzeDesignDraft(context: AgentContext): AgentResponse {
  const validated = validateContext(context);
  if (!validated.ok) {
    return responseFromValidationFailure(context.mode, validated.finding);
  }

  let findings: AgentFinding[];
  switch (context.mode) {
    case "production_review":
      findings = analyzeProductionReadiness(context);
      break;
    case "wording_help":
      findings = analyzeCompleteness(context);
      break;
    case "staff_guidance":
    case "family_guidance":
    default:
      findings = dedupeFindings([
        ...analyzeCompleteness(context),
        ...analyzeApprovalReadiness(context),
      ]);
      break;
  }

  const advice = createGentleWordingSuggestions(context);
  const suggested_actions = suggestNextActions(context);
  return {
    mode: context.mode,
    draft_id: validated.draft.id,
    draft_status: validated.draft.status,
    summary: modeSummary(context.mode, findings, validated.draft),
    findings,
    advice,
    suggested_actions,
    ready_for_production: validated.draft.status === "production_locked",
  };
}

export function cloneAgentResponse(response: AgentResponse): AgentResponse {
  return clone(response);
}
