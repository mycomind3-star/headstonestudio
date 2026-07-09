---
name: pricing-engine
description: Use when building or modifying price calculation for headstone designs — line-item pricing, vendor pricing tables, checkout price recomputation. Trigger on tasks mentioning price, cost, quote, checkout total, or pricing table configuration.
---

# Skill: Pricing Engine

## When to use this skill
Use when building or modifying anything that computes a price for a design: the live price sidebar, the checkout summary, or vendor-side pricing table configuration.

## Ground truth
- Price is **always derived from the `design_document` and the vendor's `pricing_table`**, never manually entered or cached without a recompute path. If a design changes, the price must visibly update within ~300ms (debounced), and checkout must always recompute server-side at submit time (never trust a client-calculated price for the actual charge).
- Pricing tables are per-organization data, not hardcoded logic — a monument company must be able to configure its own base rates, per-character engraving rates, photo-etch fees, and delivery pricing by zip/region without a code deploy.

## Standard line items (implement all, even if some are $0 by default)
1. Base stone: `material.base_rate_per_sqin * (width_in * height_in)` + a depth multiplier if depth exceeds the material's standard depth.
2. Engraving: per-character or per-line rate for text elements; symbols priced per-symbol (flat or by complexity tier); photo etching as a flat fee tied to etch size.
3. Custom art setup fee (one-time, for traced/cleaned-up custom uploads).
4. Foundation/base, if required by the shape or by a cemetery rule.
5. Delivery + installation estimate (by zip/region — this can be a simple distance-banded table for MVP, not a full logistics integration).
6. Optional rush fee.
7. Tax (US sales tax by ship-to state/zip for MVP; flag international tax as out of scope per SPEC.md §3).

## Requirements
- Every line item must be shown to the user, itemized, before they pay — no bundled "design fee" black boxes. This is both a trust requirement (grieving buyers are especially vulnerable to feeling nickel-and-dimed) and often a legal expectation in funeral-adjacent commerce.
- Price must never *decrease* trust by fluctuating unexpectedly between the canvas view and checkout — if it can change (e.g., a promo expired), show a clear diff, don't silently update the number.
- Unit test the pricing function directly against the `design_document` schema with fixture documents (a minimal one-line design, a maximum-complexity design with photo etch + custom art + rush) so pricing logic isn't only exercised through the UI.

## Explicitly avoid
- Dynamic/personalized pricing based on user behavior (e.g., charging more because someone looked "urgent" or reloaded checkout multiple times). This is an ethical hard line for this product category, not just a style preference.
