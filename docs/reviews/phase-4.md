# Phase 4 review — performance, accessibility, mobile, polish

Status: **done.** Measured on the target laptop (Intel UHD Graphics, Windows, D3D11), production build,
1920×1080, cold browser profile.

## Performance

### First visit (cold shader cache)

| | Before Phase 4 | After |
|---|---|---|
| Time until the cell is shown | 12–17 s | **3.4–4.5 s** |
| Longest main-thread freeze | 9–10 s | **1.6–2.1 s** |
| Time blocked on shader linking (sum) | 14.9 s | **1.6 s** |

How (each step measured, not guessed):
1. A CPU profile showed the freeze inside three.js's shader error check: reading program logs forces the
   driver to finish each compile synchronously. It is now disabled in production (still on in development),
   and shaders compile with `renderer.compileAsync` (KHR_parallel_shader_compile) while the intro is shown.
2. Timing every blocking call showed **~300 ms per shader program** on D3D11: procedural simplex noise was
   inlined 4–6 times per shader. All shaders now sample one shared tileable **3D noise texture**: shaders
   are ~10× cheaper to link and frames are 30–40 % cheaper.
3. Vertex shaders no longer include the lighting code they never used.

A per-frame progressive warm-up was also tried; it made things worse (16 s, serial waits) and was reverted.

### Frame time (GPU ms, `npm run perf`)

| View | Bas | Moyen | Élevé | Ultra |
|---|---|---|---|---|
| Outside the cell | 9.6 | 13.2 | 76 | 87 |
| Inside the cell | 10.9 | 23.1 | 105 | 123 |

Phase 1 started at 47 / 58 / 87 / 122 (outside) and 82 / 91 / 116 / 156 ms (inside).
On this integrated GPU, *Bas* holds 60 fps everywhere and *Moyen* holds 60 fps from outside the cell.
*Élevé* and *Ultra* stay meant for dedicated GPUs. Without post-processing they are 16–39 ms, so the cost
there is AO, depth of field and the full-resolution volumetric haze.

## Accessibility

- **axe-core (WCAG 2.1 AA + best practices): 0 violations** on the landing page, explorer, open info panel,
  running disease, library drawer, disease index and disease page.
- **Motion:** "Vivant / Réduit / Pause" control (WCAG 2.2.2). It defaults to *Réduit* when the system asks
  for reduced motion. It slows or stops drift, streaming, motors, bacteria and the idle camera; scenarios keep
  their own player.
- **Screen readers:** a live region announces the selected organelle (with its summary) and each new stage of
  a process or disease; the 3D view has a role and a label pointing to the keyboard-accessible organelle list.
- **Contrast:** faint text raised to ≥ 4.5:1.
- **No WebGL 2:** a readable text version (organelles, links to the disease library) instead of a black page.
- Headings are in order on every page; all controls are real buttons with labels; Esc closes panels.

## Mobile

Checked on an emulated iPhone 13 (390×844, touch):
- the top row of entry points (Visite, Processus, Maladies) scrolls horizontally;
- settings move behind a "Réglages" button;
- info, disease and library panels become bottom sheets;
- the player owns the bottom of the screen during a scenario; disease details open on demand ("Fiche");
- free flight is hidden on touch devices (it needs a keyboard), and the organelle list folds away after a
  choice;
- touch camera: one finger orbits, two fingers zoom and pan.

## Polish (open points from the previous reviews)

- Chromosomes have two arms hinged at the centromere: an X at metaphase, Vs trailing towards the poles in
  anaphase.
- Endocytosis shows a real clathrin-coated pit: the membrane invaginates at the uptake site (new
  `membrane.pit` channel).
- Replication organelles are drawn with their two membranes.
- Travelling cargo leaves a short fading trail.
- Bacteria are at real scale, with visible actin comet tails.

## Sharing and SEO

Open Graph / Twitter metadata, a social preview image, `/sitemap.xml` (every disease page), `/robots.txt`.
Set `NEXT_PUBLIC_SITE_URL` on the host (see `.env.example`).

## Still open

1. **Expert review of the content.** Every source is machine-verified to exist; the sentences still need a
   careful human read against their sources before `review.status` becomes `reviewed`.
2. A half-resolution volumetric pass would make *Élevé* affordable on integrated GPUs.
3. Mid-range Android phones were not measured on real hardware (only emulated layout).
4. Extracellular events (amyloid plaques, immune cells) and organelle partitioning at cytokinesis are still
   not shown; both are flagged as simplifications in the UI.
