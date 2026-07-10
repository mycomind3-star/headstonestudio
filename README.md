# Headstone Design Studio

Monorepo foundation for the headstone design studio described in [docs/SPEC.md](/Users/macdizzle/Documents/headstone%20design%20studio/docs/SPEC.md).

## Workspace layout

- `apps/web` - minimal Vite editor shell and live SVG preview
- `apps/api` - backend scaffold only
- `packages/agent` - deterministic Design Guide Agent helpers and findings
- `packages/core` - draft/version domain contract, validation, and autosave helpers
- `packages/render` - deterministic SVG renderer for memorial design previews
- `packages/schema` - shared `design_document` schema, fixtures, and validation tests

## Run

Install dependencies:

```bash
npm install
```

Start the web shell:

```bash
npm run dev --workspace @headstone/web
```

## Test

Run schema validation tests:

```bash
npm test
```

Type-check the workspaces:

```bash
npm run typecheck
```

## Build

Build the current foundation:

```bash
npm run build
```

## Extend the schema

All memorial design data should flow through `packages/schema/src/designDocument.ts`.

- Add or change schema fields there first.
- Add a fixture in `packages/schema/src/fixtures.ts` for the new design case.
- Add or update validation tests in `packages/schema/src/designDocument.test.ts`.
- Keep the web shell and later app features consuming the shared schema package instead of redefining local shapes.
- If the preview needs a new element type or layout rule, update `packages/render/src/render.ts` and add a render test there too.

The shared schema is intentionally strict. Unknown keys are rejected so future canvas, pricing, proof, and export code can trust the document shape.

## Render preview

`packages/render` turns a validated `design_document` into deterministic SVG for the editor preview.

- The SVG uses the document's real dimensions and explicit units.
- Safe margins are visible in preview mode so the editor stays honest about layout.
- Text, symbols, photo etch placeholders, borders, and custom art placeholders all come from the shared schema.
- Rendering is deterministic: the same document always produces the same SVG string.
- Rendering is preview-only for now. Production SVG, DXF, and PDF output will later reuse this same render layer on the server side, but that export pipeline is intentionally not built yet.

## Draft lifecycle

Drafts and versions are defined in `packages/core/src/domain.ts`.

- `draft` - initial working state
- `family_review` - shared for review
- `family_change_requested` - family requested edits
- `family_approved` - family approved a versioned draft
- `vendor_review` - vendor is checking the approved draft
- `production_locked` - editing is frozen
- `archived` - terminal state

Rules enforced there:

- Every draft contains a validated `design_document`.
- A new version snapshots the full design document.
- Family approval requires at least one version.
- Production lock requires family approval first.
- A production-locked draft cannot be edited.

## Autosave

The web shell uses browser `localStorage` only for this phase.

- It saves the current draft after hydration.
- It restores the draft on reload if the stored payload still passes validation.
- Invalid stored data is rejected and not loaded.
- The UI shows a small autosave status indicator so the user can see whether the draft was saved, restored, or rejected.

This local storage layer is temporary. It exists to prove the browser contract now, while the persistence rules stay centralized in `packages/core` so a future database adapter can reuse the same draft/version logic without changing the domain model.

## Future persistence

When the database layer is added, it should adapt to the same core contract instead of inventing a new one.

- API handlers should validate input with `packages/core`.
- Draft rows should store the same `design_document` shape.
- Version rows should snapshot the full design document exactly as the core contract creates it.
- Autosave recovery and server-side persistence should both rely on the same validation rules.

## Design Guide Agent

`packages/agent` is available as a deterministic, rule-based advisory layer.

- It reads a draft and returns calm, practical guidance.
- It validates the draft before analysis and never mutates the input.
- It is advisory only and does not approve production work.

Later, an LLM can be plugged behind the same `AgentResponse` shape without changing the rest of the app contract. The browser should still treat any agent output as guidance, not as a source of truth for draft edits or production approval.

## Editor workspace

The web editor now combines manual memorial field editing, deterministic SVG preview, autosave, and deterministic Design Guide feedback in one workspace.

- Editing the memorial fields updates the shared `design_document`.
- The preview stays deterministic so the same draft always renders the same way.
- The guide panel is read-only and advisory only.
- Guide findings can now focus the related editor field for quick review.
- It helps surface calm findings, next actions, and wording notes, but it does not approve production files.
- Those focus actions are navigational only and never mutate the draft.
