import { useEffect, useState } from "react";
import {
  createDraft,
  recoverDraftAutosave,
  serializeDraftAutosave,
  updateDraft,
  type DesignDraft,
} from "@headstone/core";
import { designDocumentFixtures } from "@headstone/schema";

const STORAGE_KEY = "headstone-design-studio:draft-autosave:v1";

const sampleDrafts = [
  {
    title: "Serpentine memorial",
    design_document: designDocumentFixtures[0]!,
  },
  {
    title: "Flat marker memorial",
    design_document: designDocumentFixtures[1]!,
  },
  {
    title: "Hebrew memorial",
    design_document: designDocumentFixtures[2]!,
  },
  {
    title: "Pet memorial",
    design_document: designDocumentFixtures[3]!,
  },
] as const;

function createWorkingDraft(index = 0): DesignDraft {
  const sample = sampleDrafts[index] ?? sampleDrafts[0];
  const now = new Date().toISOString();
  const draftId =
    globalThis.crypto?.randomUUID?.() ?? `draft_${Date.now().toString(36)}`;

  return createDraft({
    id: draftId,
    title: sample.title,
    design_document: sample.design_document,
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
  const [canPersist, setCanPersist] = useState(true);
  const [autosaveStatus, setAutosaveStatus] = useState(() =>
    formatAutosaveStatus("idle", "Loading draft..."),
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const recovered = recoverDraftAutosave(raw, STORAGE_KEY);

    if (recovered.ok) {
      setDraft(recovered.draft);
      setAutosaveStatus(formatAutosaveStatus("restored", "Restored saved draft."));
      setCanPersist(true);
    } else if (raw === null) {
      setAutosaveStatus(formatAutosaveStatus("saved", "No saved draft found."));
      setCanPersist(true);
    } else {
      setAutosaveStatus(formatAutosaveStatus("error", recovered.message));
      setCanPersist(false);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !canPersist) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, serializeDraftAutosave(draft));
    setAutosaveStatus(formatAutosaveStatus("saved", "Saved locally."));
  }, [canPersist, draft, hydrated]);

  function replaceDraft(nextIndex: number) {
    const sample = sampleDrafts[nextIndex] ?? sampleDrafts[0];
    const now = new Date().toISOString();
    setCanPersist(true);
    setDraft((current) =>
      updateDraft(current, {
        title: sample.title,
        design_document: sample.design_document,
        updated_at: now,
      }),
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Headstone Design Studio</p>
        <h1>Draft autosave foundation</h1>
        <p>
          The shared design document schema now drives draft recovery and
          version-ready state.
        </p>
      </section>

      <section className="card">
        <div className={`status-pill status-${autosaveStatus.tone}`}>
          {autosaveStatus.message}
        </div>
        <h2>{draft.title}</h2>
        <p>
          Status: <strong>{draft.status}</strong>
          {" · "}
          Versions: <strong>{draft.versions.length}</strong>
        </p>
        <p>
          {draft.design_document.face.shape} on {draft.design_document.face.material}
        </p>
        {autosaveStatus.tone === "error" ? (
          <p className="error-copy">{autosaveStatus.message}</p>
        ) : null}
      </section>

      <section className="card">
        <h2>Sample memorial drafts</h2>
        <p>
          These seed documents let the workspace prove draft recovery without a
          canvas editor.
        </p>
        <div className="button-row">
          {sampleDrafts.map((sample, index) => (
            <button
              key={sample.title}
              type="button"
              className="sample-button"
              onClick={() => replaceDraft(index)}
            >
              {sample.title}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
