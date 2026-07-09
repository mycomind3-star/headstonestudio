---
name: pdf-proof-generation
description: Use when building the human-readable, dimensioned PDF proof document for customer/vendor review and approval. Trigger on tasks mentioning PDF proof, approval document, print-ready summary, or proof generation/versioning.
---

# Skill: PDF Proof Generation

## When to use this skill
Use when building the customer/vendor-facing PDF proof — the human-readable, dimensioned document a family or funeral home reviews and approves before an order goes to production. Pairs with the `vector-engraving-export` skill, which produces the machine-facing SVG/DXF files; this skill produces the *human* document.

## Requirements
- Generate server-side from the same `design_document` schema used everywhere else — never a browser screenshot (screenshots drift from real proportions and don't print reliably at scale).
- Layout must include:
  - A to-scale rendering of the stone face with a printed ruler/scale bar (so anyone can physically verify proportions even without trusting the PDF's internal scale).
  - Material, finish, and exact dimensions (W × H × D in inches) printed as text, not just implied by the image.
  - A full text transcript of every engraved text element (name, dates, epitaph) printed separately below the visual, in plain type — this is the easiest way for a family to catch a spelling error, since misspellings are much easier to spot in plain readable text than in a stylized memorial font.
  - Order/design version ID and generation timestamp, so an approved proof can always be traced back to an exact `DesignVersion`.
- Clearly label the document: a **pre-approval proof** ("PROOF — PLEASE REVIEW CAREFULLY, ESPECIALLY DATES AND SPELLING") is visually distinct from a **final production reference** copy generated after approval.
- Must render correctly (no clipped text, no overlapping elements) at standard print sizes (US Letter default, with the to-scale stone diagram sized to fit while the scale bar stays accurate) — test with unusually long names/epitaphs and with non-Latin scripts (Hebrew, Arabic, CJK) to make sure the layout engine handles bidi text and CJK line-wrapping correctly.
- Store the generated PDF immutably per `DesignVersion` (never regenerate-and-overwrite an already-shared proof link — if the design changes, generate a new version and a new proof).

## Testing checklist
- [ ] A design with a very long epitaph doesn't clip or overflow the page.
- [ ] A Hebrew or Arabic name block renders in correct reading direction alongside English text.
- [ ] The scale bar's printed length is verified against actual PDF page units (print a test page and measure it once, physically, as a sanity check).
- [ ] Regenerating the same design version twice produces byte-identical (or checksum-identical) output.
