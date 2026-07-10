# Headstone Design Studio

Monorepo foundation for the headstone design studio described in [docs/SPEC.md](/Users/macdizzle/Documents/headstone%20design%20studio/docs/SPEC.md).

## Workspace layout

- `apps/web` - minimal Vite editor shell and live SVG preview
- `apps/api` - backend scaffold only
- `packages/agent` - deterministic Design Guide Agent helpers and findings
- `packages/core` - draft/version domain contract, validation, and autosave helpers
- `packages/proof` - printable proof document model built from proof versions and SVG
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

## Proof versions

The editor can create local proof versions from the current draft.

- Each proof version snapshots the full `design_document` for review.
- The version history shows what was reviewed and lets the user restore a snapshot as the working draft.
- Proof creation does not approve the design, complete vendor review, or lock production.
- Version history is stored in the same local draft autosave payload for now, so reload recovery preserves both the working draft and its proof history.

That storage shape is temporary. A future database-backed version store should preserve the same immutable snapshot contract and recovery rules instead of inventing a new version model.

## Proof comparison

The editor can compare the current draft against the latest proof version, or compare two proof versions against each other.

- Name and date changes are treated as critical because they are the most important spelling and safety checks.
- Epitaph changes are treated as important.
- Shape, layout, and material changes are also surfaced as important review items.
- Comparison is for review and audit history, not for approval.
- A comparison result never mutates the draft, creates a version, or changes approval status.

## Proof documents

`packages/proof` builds a printable proof document from a selected proof version snapshot, the deterministic SVG render, and the local review records.

- The proof document always uses the saved proof version snapshot, not the mutable working draft.
- The proof page includes proof-only warnings, a memorial text transcript, a review checklist, and optional approval/review summaries.
- The first implementation is browser print / save as PDF through `window.print()`.
- The proof page is clearly labeled as review-only and not production approval.

This is the first step toward server-side PDF generation. A future PDF service should consume the same `ProofDocument` model instead of inventing a new proof shape.

## Review notes

Local review notes can be attached to proof versions and, when useful, to specific diff items.

- Notes help staff or reviewers record what needs to be checked, especially name, date, and epitaph changes.
- Notes have local statuses: open, resolved, and dismissed.
- Notes are not approvals and do not change draft status, family approval, vendor review, or production lock.
- The browser stores notes in `localStorage` for now, alongside the draft and proof history.

That storage is temporary. A future database-backed note store should preserve the same version IDs and diff references so review history stays auditable without changing the note model.

## Family proof approval

The editor can capture a local family approval record for a specific proof version.

- The approval is attached to a proof version, not the mutable working draft.
- It records the approver name, role label, approval snapshot text, and required acknowledgments for spelling, dates, epitaph, and production understanding.
- It is not vendor review, production lock, payment, or production export.
- The browser stores approval records in `localStorage` for now.

That storage is temporary. A future database-backed approval store should preserve the same version IDs, acknowledgment text, timestamps, and revocation history so the approval trail stays auditable.

## Vendor production review

The editor can capture a local vendor production review checklist for a specific proof version.

- The review is attached to a proof version snapshot, not the mutable working draft.
- It checks family approval, spelling, dates, epitaph, layout, margins, artwork, material size, production method, and proof PDF readiness.
- `ready_for_production_prep` means the proof has been reviewed. It does not create engraving files, lock production, or export production-ready output.
- The browser stores vendor reviews in `localStorage` for now, alongside the draft, proof history, notes, and family approval records.
- A future production package export should require both family approval and vendor review readiness before it can proceed.

That storage is temporary. A future database-backed vendor review store should preserve the same version IDs, checklist state, notes, timestamps, and revocation history so production-prep audit history stays intact.

## Future persistence

When the database layer is added, it should adapt to the same core contract instead of inventing a new one.

- API handlers should validate input with `packages/core`.
- Draft rows should store the same `design_document` shape.
- Version rows should snapshot the full design document exactly as the core contract creates it.
- Autosave recovery and server-side persistence should both rely on the same validation rules.
- Note storage should preserve version IDs and diff references instead of flattening them away.
- Approval storage should preserve version IDs, acknowledgment snapshots, timestamps, and revocation history instead of recreating approval records from the draft.
- Vendor review storage should preserve version IDs, checklist booleans, notes, timestamps, and revocation history instead of turning the checklist into a freeform note.

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

## Printable proof workflow

The visual editor also includes a local proof document view for the selected proof version.

- The proof document uses the same `design_document` snapshot and deterministic SVG preview as the editor.
- It can be printed or saved as PDF through the browser, but it is still a proof-only review artifact.
- The proof document is advisory and does not approve the draft or create production files.
