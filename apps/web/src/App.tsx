import { useEffect, useState } from "react";
import { createDraft, recoverDraftAutosave, serializeDraftAutosave, updateDraft, type DesignDraft } from "@headstone/core";
import { renderDesignDocumentToSvg } from "@headstone/render";
import { type EditableFieldKey, buildEditableDocument, getEditableFields, getTemplateIndex, getTemplateTitle, memorialTemplates } from "./editorModel";

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

export function App() {
  const [draft, setDraft] = useState<DesignDraft>(() => createWorkingDraft());
  const [hydrated, setHydrated] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState(() =>
    formatAutosaveStatus("idle", "Loading draft..."),
  );
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

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

  const templateIndex = getTemplateIndex(draft.design_document);
  const editorFields = getEditableFields(draft.design_document);
  const previewSvg = renderDesignDocumentToSvg(draft.design_document);

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
            <label className="field">
              <span>Design template</span>
              <select
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
            <label className="field">
              <span>Person name</span>
              <input
                type="text"
                value={editorFields.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Enter the name"
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Birth date</span>
                <input
                  type="text"
                  value={editorFields.birth_date}
                  onChange={(event) => updateField("birth_date", event.target.value)}
                  placeholder="Month day, year"
                />
              </label>

              <label className="field">
                <span>Death date</span>
                <input
                  type="text"
                  value={editorFields.death_date}
                  onChange={(event) => updateField("death_date", event.target.value)}
                  placeholder="Month day, year"
                />
              </label>
            </div>

            <label className="field">
              <span>Epitaph line</span>
              <input
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
            This is a working design draft only. The production export will come later from the same
            shared document and render layer.
          </p>
        </section>
      </section>
    </main>
  );
}
