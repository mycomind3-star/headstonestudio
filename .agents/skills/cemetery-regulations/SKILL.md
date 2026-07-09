---
name: cemetery-regulations
description: Use when building the CemeteryRule data model, canvas constraint/validation logic, or any UI surfacing size/material/base regulations. Trigger on tasks mentioning cemetery rules, compliance checks, size limits, or regulation validation.
---

# Skill: Cemetery Regulations / Compliance Rules Engine

## When to use this skill
Use when building the `CemeteryRule` data model, the rule-matching/validation logic on the canvas, or any UI that surfaces size/material/base constraints to the user.

## Ground truth
There is no universal API or dataset of cemetery rules — every cemetery sets its own, and rules change over time. This feature is a **best-effort assistant and data-entry system**, not an authority. Never let the UI imply the app guarantees compliance.

## Requirements
- Model `CemeteryRule` as data (see SPEC.md §6), matched to a design by cemetery name/region lookup (fuzzy search — cemetery names are inconsistently formatted in the wild).
- When a matching rule exists: apply it as **soft constraints** on the canvas (visual guide lines for max size, a warning banner if the current design exceeds them, a filtered material list if only certain materials are allowed) — soft meaning the user can still see and adjust, not a hard block that traps them.
- When no matching rule exists: show a plain checklist for the user to confirm with the cemetery directly (max dimensions, allowed materials, upright vs. flat, foundation requirements, photo/vase permissions) and store their free-text answers on the order (`cemetery_details.confirmed_by_family`).
- Always show a persistent, honest disclaimer near any compliance-related UI: rules are provided as a convenience and may be outdated; the family/vendor should confirm directly with the cemetery before production. This is both an accuracy issue and a liability issue — do not soften or hide this disclaimer for the sake of a cleaner UI.
- Admin/vendor-side: provide a simple internal tool (even just a DB-backed CRUD form, not customer-facing) for staff to add/update cemetery rules as they learn them from real orders, since this dataset will only ever be crowd-built from actual usage, not purchased/scraped in bulk.

## Explicitly avoid
- Presenting any rule as guaranteed-current or legally authoritative.
- Hard-blocking checkout purely on a rule mismatch — always allow the user to proceed with an explicit acknowledgment, since the app's data could simply be wrong or outdated and the family may already have cemetery approval in hand.
