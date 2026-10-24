# Phase 0 + 1 review — the living cell

Status: **done** (first pass + polish pass). Reviewed in the browser, mostly on an Intel UHD (integrated) GPU.

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

## Polish pass (follow-up)

Done:
- **Mitochondria cut-away**: as the camera approaches, a plane slides through the organelle and reveals the
  inner membrane, lamellar cristae (extruded folds with rounded rims, alternating sides) and matrix granules,
  with a glowing cut edge. Interior layers are culled entirely when no mitochondrion is near.
- **Macro-distance LOD**: ribosomes, receptors, actin, motors and pore complexes shrink away with distance
  (collapsed in the vertex shader, no popping); particles fade earlier.
- **Nucleus**: stronger envelope (reads as a surface up close), nuclear pore complexes rebuilt as eight-fold
  cytoplasmic and nuclear rings, central channel and basket.
- **Tessellation**: membrane and nucleus were faceted (three.js icosahedron detail is a linear subdivision
  count, not recursive); now 63k / 16k faces.

### Measured performance (Intel UHD Graphics, 1920×1080, `npm run perf`)

GPU time per frame (ms). Budget for 60 fps: 16.7 ms.

| View | Bas | Moyen | Élevé | Ultra |
|---|---|---|---|---|
| Outside the cell | 9.6 | 16.4 | 98 | 105 |
| Inside the cell | 14.8 | 30.3 | 149 | 170 |

First measurement, before the perf work: 47 / 58 / 87 / 122 ms outside, 82 / 91 / 116 / 156 ms inside.

What made the difference:
1. **Welding instanced geometry.** three.js polyhedra are non-indexed: a 20-face ribosome was 240 vertices
   instead of 12, × 20 000 ribosomes. About 8 M vertices per frame dropped to under 1 M.
2. **Render-resolution scale** per preset (0.6 / 0.75 / 1 / 1) and **shading tiers** (bump, caustics, second
   noise octave only where affordable).
3. **Front-to-back sorting** of layered structures (Golgi cisternae and ER sheets split into centred meshes).
4. **Culling** of hidden interior detail; capped particle size near the lens; cheaper membrane shader.
5. Grain/vignette moved after tone mapping; SMAA and chromatic aberration off on *Moyen*.

On an integrated GPU, the app starts on *Moyen* and the adaptive monitor drops to *Bas* when needed (inside
the cell), so it stays near 60 fps. *Élevé* / *Ultra* (AO, depth of field, more haze steps at full resolution)
are meant for dedicated GPUs.

Tools: `npm run perf -- <url>` (GPU timer queries in headless Edge on the real GPU) and
`npm run shots -- <url> <dir> <quality>` (reference screenshots). `?stats`, `?q=`, `?nofx`, `?cam=` URL flags.

Still open:
- The volumetric haze runs at full resolution; a half-resolution pass would make it affordable on *Moyen*.
- Geometry generation still runs on the main thread (~1–2 s on first load, hidden behind the fade-in).
