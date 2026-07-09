---
name: order-production-workflow
description: Use when building order state transitions, the vendor dashboard, production-package locking, status notifications, or anything touching Order/ProductionPackage records. Trigger on tasks mentioning order status, vendor dashboard, order workflow, or production handoff.
---

# Skill: Order & Production Workflow

## When to use this skill
Use when building order state transitions, the vendor dashboard, notification/email triggers, or anything touching `Order`/`ProductionPackage` records.

## Order state machine (implement as an explicit enum + guarded transitions, not free-text status strings)
```
draft_submitted -> proof_approved -> in_production -> qc -> delivered -> installed
                 -> cancelled (allowed from draft_submitted or proof_approved only)
```
- Each transition must be logged (who, when, from/to state) in an append-only `OrderStatusHistory` table — this is a paper trail families and vendors may need to reference ("when did we approve this?").
- `proof_approved` requires either an authenticated approval action or a share-link approval timestamp (see SPEC.md §2.6) — never auto-advance without an explicit approval event.
- `in_production` is the point at which the `ProductionPackage` (PDF/SVG/DXF, see the vector-export and pdf-proof skills) is locked/frozen. Any design edit after this point must create a *new* order or an explicit change-order flow — never silently mutate an in-production package.

## Vendor dashboard requirements
- Order queue filterable by status, sortable by due date/order date.
- One-click download of the full production package (zip of PDF + SVG + DXF + spec.json).
- Status update UI that only shows valid next-states for the current status (don't let staff jump straight from `draft_submitted` to `installed`).
- Basic audit view per order: status history, who approved the proof, when payment cleared.

## Notifications (email, at minimum — SMS optional v2)
- Customer: order confirmed, proof ready for approval, production started, ready for delivery/installed.
- Vendor: new order received, customer approved proof.
- All notification copy follows the `grief-sensitive-ux` skill (calm, plain-language, no urgency manufacturing) even though these are transactional emails — a "your order shipped!" tone borrowed from generic e-commerce templates is wrong here.

## Explicitly avoid
- Any status update or notification that reads like generic e-commerce ("Your item is on its way! 📦") — keep tone consistent with the rest of the product even in transactional/automated messages.
