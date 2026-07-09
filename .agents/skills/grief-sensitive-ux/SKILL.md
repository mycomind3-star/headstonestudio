---
name: grief-sensitive-ux
description: Use for ANY user-facing copy, layout, or flow change on the customer-facing side of the headstone app — screens, error messages, empty states, emails, confirmation dialogs. Trigger on tasks mentioning copy, microcopy, UX text, notifications, or new/changed customer-facing screens. Apply before merging any customer-facing PR.
---

# Skill: Grief-Sensitive UX & Copywriting

## When to use this skill
Use for **every** user-facing screen, error message, empty state, email, and microcopy string in the B2C flow (customer-facing). Apply before merging any PR that adds or changes copy, layout tone, or a flow with irreversible/urgent-feeling actions.

## Core principle
The user may be actively grieving, exhausted, doing this for the first time, and possibly on a phone at a funeral home parking lot. Every design decision should reduce cognitive load and pressure, never add to it.

## Concrete rules
- **No manufactured urgency.** No countdown timers, no "3 people are viewing this," no "price goes up in X hours" banners, no cart-abandonment guilt emails ("Don't forget Margaret's headstone!" is never acceptable copy).
- **No exclamation points, no jokes, no cutesy empty-state illustrations** in the core design/checkout flow. Save any playful tone for genuinely neutral admin-only screens (e.g., vendor dashboard filter controls), never for anything the family sees.
- **Confirm irreversible actions in plain language**, not just "Are you sure?" — e.g., "This will submit your order for production. Once production starts, changes may not be possible. Submit order?" State the actual consequence.
- **Reading level:** aim for 6th–8th grade (test with a readability tool, e.g., Flesch-Kincaid, in CI on copy files if feasible). Avoid jargon like "SKU," "asset," "canvas" in user-facing strings — use "design," "photo," "symbol," "stone."
- **Errors are calm and actionable**, never blaming: "We couldn't save that change — check your connection and we'll try again" not "Error: request failed (500)."
- **Never lose work.** Any flow that could interrupt (navigating away, closing a tab, session timeout) must autosave first or warn clearly before discarding anything.
- **Support contact is always visible**, not buried — a real phone/email/chat option on every screen past the catalog picker, because some users will want a human, not a wizard, and the app should not force self-service on someone who's struggling.
- **Avoid religious/cultural assumptions** in default copy and defaults (e.g., don't default the date format or symbol suggestions to one religion's convention; ask or infer from explicit user choices only).

## Review checklist for any new/changed screen
- [ ] Would this copy make sense read aloud to someone who just lost a parent?
- [ ] Is there any pressure, timer, or artificial scarcity? Remove it.
- [ ] Is every button's consequence obvious before clicking, not just after?
- [ ] Is there a way to save and come back later, visible at all times?
- [ ] Has the reading level been checked (target ≤ grade 8)?
