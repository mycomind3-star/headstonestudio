# Headstone Design Studio

Monorepo foundation for the headstone design studio described in [docs/SPEC.md](/Users/macdizzle/Documents/headstone%20design%20studio/docs/SPEC.md).

## Workspace layout

- `apps/web` - minimal Vite shell for the future editor and customer experience
- `apps/api` - backend scaffold only
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

The shared schema is intentionally strict. Unknown keys are rejected so future canvas, pricing, proof, and export code can trust the document shape.
