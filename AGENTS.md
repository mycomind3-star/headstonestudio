# AGENTS.md

## Project
Headstone Design Studio - see [docs/SPEC.md](/Users/macdizzle/Documents/headstone design studio/docs/SPEC.md) for the full product spec.
This is a grief-adjacent consumer product. Read the `grief-sensitive-ux` skill before touching any customer-facing copy or flow.

## Stack
- Frontend: React + TypeScript + Vite, Konva.js (2D canvas), react-three-fiber (3D preview)
- Backend: Node + TypeScript, Postgres, S3-compatible storage, Stripe
- Shared types live in `packages/schema` - the `design_document` schema is the single source of truth for the canvas editor, the 3D preview, pricing, and production file export. Never let one of those drift from the schema.

## Commands
- `npm run dev` - start local dev
- `npm test` - run test suite before opening a PR
- `npm run lint` - must pass before PR

## Non-negotiables
- Production files (SVG/DXF/PDF) are generated server-side from `design_document`, never from a browser screenshot.
- No manufactured urgency, dark patterns, or exclamation-heavy copy in customer-facing flows.
- Every irreversible action needs a plain-language confirmation.
