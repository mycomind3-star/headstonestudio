---
name: vector-engraving-export
description: Use when generating production-ready SVG/DXF vector files or the machine-readable spec from a headstone design_document. Trigger on tasks mentioning vector export, SVG/DXF generation, production files, font-to-path conversion, or CNC/engraving output. This is high-stakes correctness-critical code.
---

# Skill: Vector Engraving Export (SVG/DXF Production Files)

## When to use this skill
Use whenever generating the production-ready vector files (SVG and DXF) or the print-ready PDF proof from a `design_document`. This is the highest-stakes code in the app: an error here gets physically cut into a $2,000–$10,000 piece of granite.

## Ground truth
- Generate exports **server-side from the `design_document` JSON schema**, never from a screenshot/rasterization of the browser canvas. The renderer must interpret the same `x_in/y_in/size_in` real-world-unit fields the editor uses, so what was approved is exactly what gets produced.
- All exported files must encode real-world units explicitly (SVG: set `viewBox` and `width`/`height` in actual inches or mm with correct unit attributes; DXF: set `$INSUNITS` correctly). A unit mismatch is the single most dangerous class of bug in this app — it silently produces a wrong-sized stone.
- Text must be exported as **outlined paths, not live font references** (convert font glyphs to vector paths at export time). Production engraving equipment and third-party vendors cannot be relied on to have the same fonts installed; unconverted text is a common real-world failure mode in print/engraving pipelines.
- Raster-to-vector tracing (for user-uploaded custom art): run through an auto-trace step (e.g., potrace-style algorithm), then flag the result for a manual review/cleanup step before it's marked "approved for production" — never auto-approve traced art without a human check, since tracing artifacts (stray nodes, unclosed paths) can break CNC toolpaths.
- Photo etchings export separately as a flagged raster region with explicit real-world dimensions and DPI metadata (etching source needs to stay a halftone-ready raster, not be force-converted to vector).

## Required outputs per order
1. `proof.pdf` — dimensioned, to-scale, human-readable, with material/finish callouts and a "NOT FOR PRODUCTION USE — PROOF ONLY" or "PRODUCTION FILE" watermark as appropriate.
2. `production.svg` — outlined text, real-world units, layered (engraving / borders / etch-regions) with named layers.
3. `production.dxf` — same content, DXF R12 or later for broad CNC/engraving software compatibility.
4. `spec.json` — machine-readable summary (dimensions, material, finish, element list, checksum of source design version) for the vendor dashboard.

## Validation before a file is allowed to attach to an order
- [ ] Every text element's bounding box is fully within `face` dimensions minus `guides.safe_margin_in`.
- [ ] No live font references remain in the SVG (`<text>` with `font-family` only, no path data) — fail the export if any are found.
- [ ] Unit attributes in SVG/DXF match `design_document.units` and were not silently dropped by the export library.
- [ ] File checksums stored on the `ProductionPackage` record; regenerating from the same design version must be reproducible/deterministic.
- [ ] Any custom-traced art element has a `manual_review_approved: true` flag before export is allowed to finalize.
