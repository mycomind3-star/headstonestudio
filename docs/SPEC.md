# Headstone Design Studio — Full Product & Technical Specification

**Version:** 1.0
**Purpose:** Hand-off document for autonomous/agentic implementation (Codex, Claude Code, or a dev team). Written to be self-contained: a competent agent should be able to scaffold, build, and ship an MVP from this document plus the accompanying skill files.

---

## 0. One-Paragraph Pitch

A web app that lets families and funeral/monument businesses design a headstone or grave marker end-to-end: pick shape, stone material, and finish; lay out engraved text, dates, symbols, and etched photos on an accurate to-scale 2D/3D preview; check the design against cemetery size and material rules; get a live price; and submit it as a production-ready order (vector files + proof PDF) to a monument company. It must work for people in acute grief, so the UX bar is calm, clear, forgiving, and never pushy.

---

## 1. Users & Context

### 1.1 Primary personas
1. **Grieving family member (B2C)** — arranging a headstone, often for the first time, often under time pressure (cemetery deadlines), possibly on a phone, possibly elderly or not tech-fluent, sometimes coordinating with siblings/relatives on wording.
2. **Funeral home staff (B2B)** — designing on behalf of a family during or after arrangements; needs speed, saved templates, and the ability to hand a family a shareable proof link.
3. **Monument/memorial company staff (B2B, production side)** — receives the order, needs exact production specs (material, dimensions, engraving depth, font, vector artwork) and a way to mark jobs in progress, produced, installed.
4. **Cemetery/administrator (indirect)** — not a user of the app but a source of *constraints*: many cemeteries restrict size, material, base type, in-ground vs. upright, and sometimes vase/photo permissions. The app should be able to encode these as rules even though the app doesn't talk to cemeteries directly (no public API exists for this).

### 1.2 Design tone requirements (non-negotiable)
- No countdown timers, no "X people viewing this," no urgency-manufacturing dark patterns anywhere in the B2C flow.
- Calm, muted visual language; no stock "sale" red/orange; generous whitespace; large touch targets (grieving users may be distracted, older, or on mobile in a parking lot).
- Every irreversible action (submit order, delete design) has a plain-language confirmation, not just an "Are you sure?" modal.
- Copy is written at a 6th–8th grade reading level, warm but not saccharine. No jokes, no exclamation points in system copy.
- Autosave everywhere. A user should never be able to lose 20 minutes of work to a crashed tab.

---

## 2. Core Feature Set (MVP scope, in priority order)

### 2.1 Product catalog
- Shape library: upright/serpentine top, oval top, heart, flat/grass marker, bevel marker, slant marker, monument + base combos, columbarium niche plaque, pet marker.
- Material library: granite (multiple named colors: Jet Black, Bahama Blue, Rose Pink, etc.), marble, bronze plaque on granite base, limestone. Each material has: base cost per sq in, available finish options (polished/rock-pitch/sandblasted), and a swatch image/texture.
- Size presets per shape (e.g., 24"x12"x4" companion, 16"x8"x2" flat marker) plus custom dimensions within min/max bounds.
- Data-driven — all of the above lives in a `products` schema (see §7), not hardcoded in UI, so a monument company can white-label with their own catalog.

### 2.2 Design canvas (the core of the app)
- 2D, to-scale, WYSIWYG editor representing the front (and optionally back) face of the stone.
- Layers: background stone texture → engraved elements (text, symbols, borders, photo etchings) → guide overlays (safe margins, cemetery limits) shown only in edit mode, never exported.
- Text tool:
  - Multiple text blocks, each independently positioned, rotated, sized.
  - Font library curated for engraving legibility (serif memorial fonts, script for names, block for dates) — not arbitrary Google Fonts, since thin/decorative fonts don't engrave well. Each font tagged with a minimum recommended size.
  - Smart fields: Name, Birth Date, Death Date, Relationship ("Beloved Mother"), Epitaph — with a date-formatting helper (MM/DD/YYYY, "Month D, YYYY", Yahrzeit/Hebrew calendar option, era markers).
  - Live warning if text is smaller than the material's minimum legible engraving size, or if a line exceeds the stone width.
- Symbol/clipart library:
  - Categorized: Religious (cross, Star of David, Om, Buddhist wheel, Celtic cross, praying hands, angel...), Military/veteran (branch emblems — sourced only from public-domain/government sources, flagged for licensing review), Nature (roses, oak leaf, dove, sunset), Hobbies/occupations (fishing, military, nursing, farming), Borders/frames.
  - Search + filter; recently used; favorites per account.
  - Custom upload: user can upload their own vector or raster art; raster gets auto-traced to vector (see engraving-export skill) with a manual cleanup step before it's approved for production.
- Photo etching module:
  - Upload photo → crop/rotate → convert to grayscale halftone preview approximating laser/diamond photo-etch appearance → place as an element with fixed aspect ratio (etchings are usually oval/rect, sized in inches).
  - Warn on low-resolution uploads (etching needs real detail; a 100×100 px photo will not etch well).
- Alignment tools: snap-to-grid, center guides, distribute-evenly, nudge with arrow keys, undo/redo (full history, not just one level).
- Multi-script support: Unicode text entry and rendering for Cyrillic, Hebrew, Arabic, CJK, Vietnamese diacritics, etc., since engraving text is often not English-only. RTL text handling for Hebrew/Arabic blocks placed within an otherwise LTR layout.

### 2.3 3D preview
- Real-time 3D render of the finished stone: correct proportions, chosen material texture/reflectivity, engraved text/art shown as inset (sandblasted) or raised (bronze) depending on material, in a neutral outdoor-lawn or cemetery-adjacent setting (soft, respectful — not a random 3D asset store lawn with unrelated props).
- Orbit/zoom controls; a "sunset/overcast/midday" lighting toggle so families can see legibility in different light, since engraved granite can be hard to read in flat light.
- 3D preview is *visualization only* — the production file of record is always the 2D vector layout, never the 3D scene, to avoid any ambiguity in manufacturing.

### 2.4 Cemetery & regulation compliance
- A rules engine, not hardcoded logic: `cemetery_rules` records with max dimensions, allowed materials, upright vs. flat only, base requirements, photo/vase permissions.
- If the user's cemetery is in the database, auto-apply its limits as canvas constraints and flag violations before checkout.
- If not in the database, offer a plain-language checklist ("Call your cemetery office and confirm: maximum size, allowed materials, whether a concrete foundation is required") and a free-text field to store what the family was told, attached to the order for the production team.
- This is explicitly *not* a legal-compliance guarantee — copy must say the family should confirm with the cemetery directly.

### 2.5 Pricing engine
- Deterministic, transparent line-item quote: base stone (material × size), engraving (per character or per-line, plus a photo-etch flat fee, plus custom-art setup fee), base/foundation, delivery + installation estimate by zip, optional rush fee.
- Price updates live as the design changes. No surprise fees at checkout.
- Configurable by vendor (each monument company sets its own pricing table) — pricing is data, not code.

### 2.6 Save, share, collaborate
- Every design auto-saves as a draft tied to the account.
- Shareable read-only proof link (no login required) so a family can send siblings/relatives a preview to approve — with an optional lightweight "approve" click that timestamps consent, useful for funeral homes needing sign-off before production.
- Version history: named snapshots ("v1 – before mom's edits"), not just autosave overwrite.

### 2.7 Checkout & order handoff
- Order flow: review design → confirm cemetery details → delivery/install address → payment (deposit or full) → order confirmation with human-readable order number.
- On order confirmation, the system generates a **production package**: print-ready PDF proof (dimensioned, to scale, with material/finish callouts) + vector export (SVG/DXF) of all engraved elements + a machine-readable JSON spec. This package is what actually ships to the monument company — see the vector-export and PDF-proof skills.
- Payment via Stripe (deposit-based flow is standard in this industry: e.g., 50% deposit, balance on completion).

### 2.8 Vendor/admin dashboard (B2B side)
- Order queue with statuses: Draft submitted → Proof approved → In production → QC → Delivered → Installed.
- Ability to reassign a design's product catalog/pricing to a specific vendor's own catalog (white-label).
- Download production package per order.
- Basic reporting: orders by month, revenue, average order value.

### 2.9 Accounts & auth
- Email/password + magic link (grieving users forget passwords; magic link reduces friction). Optional Google/Apple sign-in.
- Funeral-home and monument-company roles are invited by an org admin, not self-serve signup, to prevent catalog/pricing tampering.

---

## 3. Explicitly Out of Scope for MVP (documented so Codex doesn't scope-creep)
- Direct integration with individual cemetery record systems (no standard API exists across cemeteries; this stays a manual-confirmation checklist).
- CNC/laser machine driver integration — the app produces DXF/SVG/PDF; feeding it into a specific engraving machine is the vendor's own tooling.
- AI-generated epitaph *writing* beyond a curated suggestion library (an LLM-assist "help me word this" feature is a good v2, flagged below in §9).
- Multi-currency/international tax handling beyond US sales tax — flag as v2 if there's demand outside the US.

---

## 4. Information Architecture / Screens

1. **Landing / start a design** — "Design a headstone" primary CTA, secondary "I have a quote code from my funeral home."
2. **Shape & material picker** — big visual cards, filter by budget range.
3. **Design canvas** — the core editor (§2.2), with a persistent right-hand price summary and a persistent "Save & exit" that never loses work.
4. **3D preview** — toggled from the canvas, not a separate page (modal or split view).
5. **Cemetery details** — form + rules engine feedback.
6. **Review & share** — read-only summary, share link generator, "invite family to review" email.
7. **Checkout** — address, payment, confirmation.
8. **My designs / orders** (account area) — drafts, past orders, order status tracker.
9. **Vendor dashboard** — separate app shell, role-gated (§2.8).

---

## 5. Technical Architecture

### 5.1 Stack recommendation
- **Frontend:** React + TypeScript, Vite. Canvas editor built on **Konva.js / react-konva** (2D scene graph, good for precise object placement, hit-testing, snapping — better fit than raw SVG DOM manipulation or Fabric.js for this level of interaction complexity). 3D preview via **react-three-fiber** (Three.js).
- **State:** Zustand or Redux Toolkit for canvas/document state; TanStack Query for server state.
- **Backend:** Node.js + TypeScript, Fastify or Express, REST (or tRPC if the whole stack is TS — reduces type-drift bugs between the canvas document schema and API, recommended here since the design-document shape is complex and shared).
- **Database:** PostgreSQL. Design documents stored as JSONB (schema in §7) with a Zod schema validating on read/write; relational tables for catalog, orders, users, cemetery rules.
- **File storage:** S3-compatible object storage for uploaded photos/art, generated vector exports, and PDF proofs.
- **Vector/PDF generation:** server-side rendering pipeline — reuse the same canvas document schema to render via `svgwrite`/`resvg`/headless Puppeteer-to-PDF, or a dedicated Node SVG library, so the exported production file is generated from data, not a screenshot of the browser canvas (accuracy matters — this is what gets cut into stone).
- **Payments:** Stripe (deposit + balance flow via Stripe invoices or a two-charge PaymentIntent flow).
- **Auth:** Auth.js (NextAuth) or Clerk/Supabase Auth — pick one based on whether the team wants managed auth (recommended: managed, this is not the differentiated part of the product).
- **Hosting:** Vercel or Fly.io for the app; managed Postgres (Supabase, Neon, or RDS); S3/R2 for storage.
- **Background jobs:** a queue (BullMQ + Redis, or a managed queue) for PDF/vector generation and email sending, so checkout never blocks on file rendering.

### 5.2 Why Konva over Fabric.js or raw SVG (for the agent's benefit)
Konva gives better performance for many draggable/rotatable objects with snapping and layering, has first-class React bindings, and its export-to-JSON scene graph maps cleanly onto the `design_document` schema below, which is also what the server-side renderer consumes to produce the exact same layout in the production PDF/SVG (avoiding "what I saw in the browser doesn't match what got cut into the stone" bugs).

### 5.3 Non-functional requirements
- **Accuracy over aesthetics in production output:** the exported vector file's dimensions must be verifiably to-scale (encode real-world units — inches or mm — in the document schema, never just pixels).
- **Accessibility:** WCAG 2.1 AA minimum on all B2C screens; full keyboard navigation of the canvas for core operations (add text, move, resize) since not all users have fine mouse control; screen-reader-friendly labels even though the canvas itself is inherently visual (provide an "outline view" listing all elements as a fallback).
- **Performance:** canvas interactions must stay smooth (60fps target) with up to ~50 elements on a stone face; 3D preview must degrade gracefully (lower texture res) on low-end/mobile devices.
- **Data retention & privacy:** uploaded photos of deceased persons and personal data (dates of birth/death) are sensitive — encrypt at rest, restrict access to the owning account + assigned vendor only, provide account deletion that actually purges files from storage, not just DB rows.
- **Auditability:** every order's production package is immutable once generated (versioned, not overwritten) so there's a permanent record of exactly what was approved and what was cut.
- **Uptime/data-loss tolerance:** autosave should be resilient to flaky connections (local-first buffering with retry/sync, e.g., via IndexedDB queue), because losing a family's carefully-worded epitaph is a real harm, not just an inconvenience.

---

## 6. Data Model (core entities)

```
User
  id, email, name, role (customer | funeral_home_staff | vendor_staff | vendor_admin | platform_admin)
  organization_id (nullable, for funeral_home/vendor roles)

Organization
  id, name, type (funeral_home | monument_vendor), catalog_id, pricing_table_id

Design
  id, owner_user_id, organization_id (nullable), title
  product_shape_id, product_material_id, dimensions {width_in, height_in, depth_in}
  document (JSONB — see 7.1 design_document schema)
  status (draft | shared | approved | ordered)
  created_at, updated_at, current_version_id

DesignVersion
  id, design_id, label, document (JSONB snapshot), created_by, created_at

ShareLink
  id, design_id, token, expires_at, allow_approve (bool), approved_at, approved_by_name

Product / Shape / Material / FinishOption / SymbolAsset / FontAsset
  — catalog tables, each with an organization_id override capability for white-labeling

CemeteryRule
  id, cemetery_name, region, max_width_in, max_height_in, max_depth_in,
  allowed_materials[], upright_allowed (bool), flat_only (bool),
  foundation_required (bool), notes

Order
  id, design_id, design_version_id (locked at order time), buyer_user_id, organization_id (vendor),
  cemetery_details {name, section, plot, confirmed_by_family (bool), rule_id (nullable)},
  price_breakdown (JSONB), status, stripe_payment_intent_id, created_at

ProductionPackage
  id, order_id, pdf_proof_url, svg_url, dxf_url, spec_json_url, generated_at, checksum
```

### 6.1 `design_document` JSONB schema (canvas source of truth)
```json
{
  "units": "in",
  "face": {
    "width": 24, "height": 12, "depth": 4,
    "shape": "serpentine_top",
    "material": "bahama_blue_granite",
    "finish": "polished_face_pitched_sides"
  },
  "elements": [
    {
      "id": "el_1", "type": "text",
      "field": "name",
      "content": "MARGARET A. HOLLOWAY",
      "font": "memorial_serif_1",
      "size_in": 1.25,
      "x_in": 12, "y_in": 3, "rotation_deg": 0,
      "align": "center"
    },
    {
      "id": "el_2", "type": "symbol",
      "asset_id": "sym_rose_01",
      "x_in": 4, "y_in": 4, "scale": 1.0, "rotation_deg": 0
    },
    {
      "id": "el_3", "type": "photo_etch",
      "asset_url": "s3://.../etch_source.jpg",
      "shape": "oval", "width_in": 3, "height_in": 4,
      "x_in": 12, "y_in": 6.5
    }
  ],
  "guides": { "safe_margin_in": 0.75 }
}
```
This same schema is consumed by (a) the Konva editor for rendering/editing, (b) the server-side SVG/PDF/DXF exporter, and (c) the pricing engine (character counts, element counts, photo-etch presence all derive from this document — never re-entered separately).

---

## 7. API Surface (representative, not exhaustive)

```
POST   /api/designs                       create draft
GET    /api/designs/:id
PATCH  /api/designs/:id                    autosave (debounced client-side)
POST   /api/designs/:id/versions           snapshot
POST   /api/designs/:id/share-link
GET    /api/share/:token                   public read-only view

GET    /api/catalog/shapes|materials|fonts|symbols
GET    /api/cemetery-rules?query=

POST   /api/designs/:id/price              returns live price breakdown
POST   /api/orders                         create order from a design version
POST   /api/orders/:id/payment-intent
GET    /api/orders/:id
POST   /api/orders/:id/production-package  (internal/queued) generates PDF/SVG/DXF

GET    /api/vendor/orders?status=
PATCH  /api/vendor/orders/:id/status
```

---

## 8. Suggested Build Order (milestones for an agentic coder)

1. **Scaffold** — monorepo (e.g., Turborepo): `apps/web`, `apps/api`, `packages/schema` (shared Zod types for `design_document`).
2. **Catalog + auth** — seed shapes/materials/fonts/symbols; basic account creation.
3. **Canvas MVP** — Konva editor: add/move/resize text, undo/redo, autosave. No 3D, no pricing yet. Get this feeling *good* before adding anything else — this is the product.
4. **Pricing engine** — derive live price from the document schema.
5. **Cemetery rules + validation overlays** on canvas.
6. **3D preview** — react-three-fiber, reading the same document schema.
7. **Share links + approval flow.**
8. **Checkout + Stripe.**
9. **Production package generation** (server-side SVG/PDF/DXF renderer) — this is high-risk/high-value, build and test it early against the schema even before checkout is finished, since it's the piece with the least room for error.
10. **Vendor dashboard.**
11. **Polish pass:** accessibility audit, empty states, error states, grief-sensitive copy review (§1.2).

---

## 9. v2 / Future Ideas (explicitly deferred)
- LLM-assisted epitaph wording help ("describe your loved one, get 3 respectful suggestions") — feasible, but needs careful prompt design so it never produces generic/insensitive text; would use the Anthropic API pattern for structured suggestions.
- AR preview (view the stone at actual size via phone camera at the intended plot).
- Direct vendor-to-vendor marketplace (families get quotes from multiple local monument companies on one submitted design).
- Multi-currency/international cemetery-rule datasets.
- Native mobile app (the responsive web app should cover most needs first).

---

## 10. Content/Data Sourcing Notes (flag for legal review, not for the coding agent to resolve)
- Military branch emblems and any trademarked symbols need licensing/permission review before shipping to production — MVP should ship with a clearly public-domain/generic symbol set and mark contested ones as "pending legal review" in the seed data.
- Religious symbol sets should be reviewed by someone with cultural/religious knowledge for accuracy and respectfulness, not just visually copied from a generic clipart pack.

---

## 11. What "done" looks like for MVP
A funeral-home staffer can, in one sitting: pick a shape/material, lay out a name/dates/epitaph/one symbol, see an accurate 3D preview, confirm it fits a known cemetery's rules, get a correct price, share a read-only link with the family for approval, and — once approved — submit an order that produces a dimensionally-accurate PDF proof and SVG/DXF file a real monument company could hand to their engraver without modification.
