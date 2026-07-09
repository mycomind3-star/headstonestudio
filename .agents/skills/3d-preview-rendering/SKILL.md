---
name: 3d-preview-rendering
description: Use when implementing or modifying the headstone app's 3D preview (react-three-fiber/Three.js scene, materials, lighting, camera, engraving depth visualization). Trigger on tasks mentioning 3D preview, stone rendering, materials/textures, lighting presets, or camera controls for the design canvas.
---

# Skill: 3D Preview Rendering (Headstone Design App)

## When to use this skill
Use whenever implementing or modifying the 3D stone preview (react-three-fiber / Three.js scene), including material shaders, lighting presets, camera controls, or engraving depth visualization.

## Ground truth
The 3D preview is for **visualization only**. It is never the source of truth for production — the `design_document` JSON schema (2D, real-world units) is. Never let 3D-specific logic mutate or derive canonical element positions; always read from the shared schema in `packages/schema`.

## Requirements
- Build the stone mesh procedurally from `face.width / height / depth` (inches) plus `shape` — do not hand-model every shape as a static asset; generate geometry (extrude a 2D shape profile) so custom dimensions render correctly.
- Materials: granite/marble get a PBR material with subtle normal-map texture per color variant (do not use flat/glossy plastic-looking defaults — memorial stone should look like stone, matte-to-semigloss depending on finish). Bronze plaques get a metallic material with patina-appropriate roughness.
- Engraving representation:
  - Sandblasted/incised text or art on granite/marble → render as a subtle inset displacement or normal-map decal, not a flat black decal (flat black looks like a sticker, not an engraving).
  - Raised bronze lettering → render as extruded/embossed geometry or a convincing bump+highlight decal.
- Lighting: implement at minimum 3 presets (soft overcast, midday sun, low-angle sunset) since engraved text legibility changes dramatically with light angle — this is a real concern for buyers, not just an aesthetic toggle.
- Scene dressing must stay minimal, neutral, and respectful: grass plane, soft shadow, no unrelated 3D props, no cartoonish sky. Do not add cemetery headstone rows or grave-adjacent imagery that could read as tacky or morbid.
- Performance: target 60fps on mid-range laptops, graceful texture-resolution degradation on mobile (detect via renderer capabilities, not user-agent sniffing).
- Camera: orbit controls constrained to a reasonable range (don't let users flip the stone upside-down or clip through the ground); default framing should show the full face straight-on before any rotation.

## Testing checklist before marking this done
- [ ] Changing dimensions in the 2D editor updates the 3D mesh proportionally and immediately.
- [ ] All three lighting presets keep engraved text legible.
- [ ] Custom (non-preset) dimensions within min/max bounds render without geometry errors.
- [ ] Mobile Safari and Chrome both render without frame-rate collapse on a mid-tier device profile.
