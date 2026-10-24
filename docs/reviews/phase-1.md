# Phase 0 + 1 review — the living cell

Status: **first pass done, visual polish continues.** Reviewed in the browser, mostly on an Intel UHD (integrated) GPU.

## What exists

- Next.js 16 + TypeScript (strict), Zod content schemas, content validator (`npm run validate:content`),
  Vitest, ESLint, GitHub Actions CI (typecheck · lint · content · tests · build).
- A procedurally generated, seeded cell (1 unit = 0.1 µm):
  plasma membrane with receptors · nucleus (double envelope, ~500 pores, chromatin territories, nucleoli) ·
  rough ER (fenestrated sheet stacks + polysomes) · smooth ER (tubular network with three-way junctions) ·
  Golgi (6 cisternae, cis→trans gradient) · mitochondria with cristae · lysosomes · peroxisomes ·
  vesicles · free ribosomes · microtubules from the centrosome (dynamic instability) · actin cortex ·
  intermediate filaments · centrioles · kinesin/dynein motors towing cargo vesicles · cytoplasm particles.
- Everything moves on the GPU: Brownian drift, cytoplasmic streaming, surface undulation, mitochondrial "breathing",
  microtubule growth/shrinkage, stepping motors.
- Shared "wet organic" light model (wrap diffuse, back-scatter SSS, fresnel rim, dual specular, caustics).
- Depth-aware raymarched cytoplasm haze with volumetric nucleus shadow; N8AO, DOF, bloom, chromatic aberration,
  AgX tone mapping, vignette, grain, SMAA.
- Quality presets (Bas / Moyen / Élevé / Ultra), GPU-aware initial choice, adaptive step-down, `?stats` overlay,
  `?cam=px,py,pz,tx,ty,tz` shareable viewpoints.
- Camera: cinematic intro → eased dive, orbit with idle drift, free flight (WASD/ZQSD, Space/C, Shift, wheel).

## Bugs found and fixed during review

| Problem | Cause | Fix |
|---|---|---|
| Cyan/blue "holes" on every highlight | Soft-light grain applied to HDR values before tone mapping → negative colours | Grain and vignette moved after AgX |
| Sparkly speckle on surfaces | Same as above, then sub-pixel bump detail | Single-sample derivative bump, lower frequency |
| Camera never left the intro on `/explorer` | Mode change happened before the controls mounted | Controls held in state; effect re-runs when ready |
| Landing caption read "20 MM" | `text-transform: uppercase` turns µ into Μ | Caption no longer uppercased |
| Opaque cream balls everywhere | Motor cargoes rendered as solid spheres | Motor = two glowing heads + glassy cargo vesicle |
| ~20 fps on *Élevé* (integrated GPU, dev build) | ~12 simplex noises per particle and ~9 per pixel | Trig-based flow field, 2-octave fbm, single-sample bump, cheaper caustics, lighter presets |

## Critical assessment — visual quality

Good:
- From outside, the cell reads as a glassy, glowing body in a dark fluid, which is the intended documentary mood.
- Up close the materials look wet and translucent. The Golgi stack, ER sheets with ribosomes and the microtubule
  network give strong depth.

Not yet at the target:
1. **Mitochondria** still read as stylised capsules. They need a real cut-away LOD: an inner membrane mesh with
   lamellar cristae, revealed when the camera is close (planned in the architecture; not built yet).
2. **Nucleus** is under-expressed from most angles: the envelope is too faint against the ER. It needs a stronger
   double-membrane silhouette and visible pore complexes in close-up (8-fold symmetry geometry).
3. **Golgi** is a bit too uniform and opaque face-on. It needs fenestrated rims and budding vesicles fused to the rims.
4. **Clutter at macro distance**: free ribosomes and actin cortex compete with the organelles. Fade
   molecular-scale objects with distance (LOD band "macro") so the big shapes read first.
5. **Membrane close-up**: the planned lipid-bilayer patch (heads/tails, channels, receptors at true shape) is not
   built yet.
6. **Vesicle budding/fusion** (metaball blend at bud sites) is not implemented yet: vesicles only drift.
7. The volumetric haze is subtle. A half-resolution pass would let us afford more steps and stronger light shafts.

## Critical assessment — scientific accuracy

- Sizes of organelles are close to reality: cell ~20 µm, nucleus ~5.6 µm, mitochondria 0.5 × 1.5–2.5 µm.
  Molecular objects are enlarged in "Échelle artistique" (ribosomes, filaments, receptors), and the toggle shows
  true size. This is stated in the UI.
- Counts are heavily reduced (a real cell has millions of ribosomes and thousands of nuclear pores). This needs a
  visible "Simplification" note in Phase 2's info panels.
- Organelle positions are plausible (RER continuous with the nuclear envelope; Golgi next to the centrosome;
  microtubules radiating from it; actin cortex under the membrane) but generic. This is a deliberate choice,
  recorded in the architecture.
- **Unsourced UI copy to fix in Phase 2**: the landing text ("Vingt micromètres. Des milliards de molécules.") and
  the "10 à 30 µm" caption must either cite a source or be reworded. The validator only checks content files, not
  UI strings. Plan: move these strings into sourced content.

## Performance notes

- The in-app preview pane caps at ~30 fps and stops drawing when hidden, so numbers from it are not reliable.
  Use the production build with `?stats` in a normal browser window to measure.
- Integrated GPUs now start on *Moyen* (DPR 1, 20k particles, 8 volume steps, no AO/DOF). Discrete GPUs start
  on *Élevé*. The adaptive monitor steps down further if needed.
- Next targets: half-resolution volume pass, distance-based LOD for molecular instances, shader warm-up behind the
  intro screen, and moving geometry generation to a Web Worker to remove the load-time hitch.

## Proposed next steps (before Phase 2)

1. Mitochondria cut-away LOD with real cristae geometry.
2. Macro-distance fading of molecular-scale instances.
3. Nucleus envelope and pore close-up pass.
4. Production-build performance check on the target laptop with `?stats`.
