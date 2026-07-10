import { analyzeDesignDraft, type AgentFinding } from "@headstone/agent";
import {
  createDraft,
  createVersion,
  recoverDraftAutosave,
  serializeDraftAutosave,
  updateDraft,
  type DesignDraft,
  type DesignVersion,
} from "@headstone/core";
import { renderDesignDocumentToSvg } from "@headstone/render";
import { useEffect, useMemo, useRef, useState } from "react";
import { type EditableFieldKey, buildEditableDocument, getEditableFields, getTemplateIndex, getTemplateTitle, memorialTemplates } from "./editorModel";
import { formatVersionLabel, summarizeProofVersion } from "./versionModel";

const STORAGE_KEY = "headstone-design-studio:draft-autosave:v2";

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

const findingFocusMap: Record<string, ReviewFocusAction | null> = {
  "missing-name": { target: "name", label: "Review name" },
  "missing-birth-date": { target: "birth_date", label: "Review birth date" },
  "missing-death-date": { target: "death_date", label: "Review death date" },
  "empty-epitaph": { target: "epitaph", label: "Review epitaph" },
  "long-epitaph": { target: "epitaph", label: "Review epitaph" },
};

function getReviewActionForFinding(finding: AgentFinding): ReviewFocusAction | null {
  return findingFocusMap[finding.id] ?? null;
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
  const fieldRefs = useRef<FieldRefs>({
    template: null,
    name: null,
    birth_date: null,
    death_date: null,
    epitaph: null,
  });
  const focusTimerRef = useRef<number | null>(null);

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
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, serializeDraftAutosave(draft));
    setAutosaveStatus(formatAutosaveStatus("saved", "Saved locally."));
  }, [draft, hydrated]);

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

  const templateIndex = getTemplateIndex(draft.design_document);
  const editorFields = getEditableFields(draft.design_document);
  const previewSvg = renderDesignDocumentToSvg(draft.design_document);
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
  const latestProofVersionNumber = draft.versions.at(-1)?.version_number ?? null;
  const proofVersions = [...draft.versions].reverse();
  const canCreateProofVersion = draft.status !== "production_locked" && draft.status !== "archived";

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

  function updateField(field: EditableFieldKey, value: string) {
    const now = new Date().toISOString();

    setDraft((current) => {
      const nextTemplateIndex = getTemplateIndex(current.design_document);
      const currentFields = getEditableFields(current.design_document);
      const nextFields = {
        ...currentFields,
        [field]: value,
      };

      return updateDraft(current, {
        title: getTemplateTitle(nextTemplateIndex),
        design_document: buildEditableDocument(nextTemplateIndex, nextFields),
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

        <section className="preview-panel">
          <div className="preview-header">
            <div>
              <p className="panel-kicker">Preview</p>
              <h2>Deterministic SVG</h2>
            </div>
            <p className="preview-note">Not production-ready</p>
          </div>

          <div className="preview-stage">
            <div
              className="preview-svg"
              aria-label="Live memorial design preview"
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          </div>

          <p className="preview-footnote">
            Draft proof only — not production-ready. Proof versions preserve what was reviewed, and
            the production export will come later from the same shared document and render layer.
          </p>

          <section className="guide-panel">
            <div className="guide-header">
              <div>
                <p className="panel-kicker">Design Guide</p>
                <h3>Calm guidance</h3>
              </div>
              <p className="guide-note">Read only</p>
            </div>

            <p className="guide-summary">{agentResponse.summary}</p>

            <section className="guide-section">
              <h4>Findings</h4>
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
                <p className="panel-kicker">Version history</p>
                <h3>Local proof versions</h3>
              </div>
              <p className="guide-note">Snapshot review only</p>
            </div>

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
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="guide-more">
              Proof versions are local snapshots for review. They are not family approval and they do
              not approve production.
            </p>
          </section>
        </section>
      </section>
    </main>
  );
}
