# Cellula — Architecture & Roadmap Proposal

> Status: **proposal, awaiting approval**. No application code is written until this document is approved.

Cellula is an interactive, cinematic 3D exploration of a human cell (UI in French), with a data-driven
disease simulation system grounded in cited scientific sources.

---

## 1. Guiding principles

1. **Beauty is a feature.** Phase 1 does not end until the base cell looks like a frame from a science documentary.
2. **Everything that is content is data.** Organelles, processes, tours, diseases and sources live in versioned,
   schema-validated files. Adding a disease must never require touching rendering code.
3. **Every claim is traceable.** A claim without a source fails the build. Simplifications are explicit, not hidden.
4. **The GPU does the living.** Per-frame motion (Brownian drift, pulsing, streaming, motor proteins) runs in vertex
   shaders or GPGPU passes, not in React or per-instance JS loops.
5. **Graceful everywhere.** One scene, four quality presets, adaptive degradation, and a non-WebGL fallback.

---

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) | Scene is a client-only island (`dynamic(..., { ssr: false })`); library, disease and source pages are statically generated for SEO and sharing. |
| 3D | three.js r17x + React Three Fiber v9 + drei | WebGL2 baseline. WebGPU kept as a later experiment, not a dependency. |
| Post-processing | @react-three/postprocessing (pmndrs `postprocessing`) | Bloom, DOF, chromatic aberration, noise (grain), vignette, N8AO/SSAO, SMAA, AgX tone mapping. |
| Shaders | Custom GLSL via `ShaderMaterial` + `onBeforeCompile` patches on `MeshPhysicalMaterial` | Shared chunks: noise (simplex/curl/worley), fake SSS, fresnel rim, caustics, dither. Loaded with `glslify`-style raw imports. |
| Motion helpers | `maath` (damping/easing), drei `CameraControls` | Eased, interruptible camera transitions. |
| State | Zustand (+ `subscribeWithSelector`) | Frame loop reads stores with `getState()`; React re-renders only on UI-relevant changes. |
| UI animation | Framer Motion | Panel transitions, micro-interactions. |
| Content validation | Zod | Same schemas validate at build time (CI) and type the runtime. |
| Search | Fuse.js (client-side fuzzy) | Sufficient up to several thousand diseases; index built at build time. |
| Workers | Web Worker (Comlink) | Seeded procedural geometry generation off the main thread. |
| Testing | Vitest (engine, schemas), Playwright (smoke + screenshot checks) | |
| Quality | ESLint, Prettier, `tsc --noEmit`, content validation in GitHub Actions | |
| Fonts | Instrument Serif (display), Geist / Inter Tight (UI), JetBrains Mono (data) | Self-hosted via `next/font`. |

---

## 3. Folder structure

```
cellula/
├─ app/                          # Next.js routes (French slugs)
│  ├─ layout.tsx
│  ├─ page.tsx                   # Landing: cinematic intro → enter the cell
│  ├─ explorer/page.tsx          # Main 3D experience (scene island + UI shell)
│  ├─ maladies/page.tsx          # Static, searchable disease library (SEO)
│  ├─ maladies/[slug]/page.tsx   # Static disease page + "voir dans la cellule"
│  ├─ processus/[slug]/page.tsx
│  ├─ sources/page.tsx           # Full bibliography
│  └─ a-propos/page.tsx          # Method, simplifications, disclaimer
│
├─ src/
│  ├─ scene/
│  │  ├─ CellCanvas.tsx          # <Canvas>, renderer config, quality wiring
│  │  ├─ CellScene.tsx           # Composition root of the cell
│  │  ├─ layout/                 # Seeded placement of organelles (no overlaps, plausible topology)
│  │  ├─ organelles/
│  │  │  ├─ membrane/            # index.tsx, geometry.ts, material.ts, shaders/*.glsl
│  │  │  ├─ nucleus/             # envelope, pores (instanced), nucleolus, chromatin
│  │  │  ├─ er/                  # rough (sheets + ribosomes) and smooth (tubules)
│  │  │  ├─ golgi/
│  │  │  ├─ mitochondria/        # outer membrane, cristae (LOD), matrix
│  │  │  ├─ lysosomes/  peroxisomes/  ribosomes/  vesicles/  centrosome/
│  │  │  ├─ cytoskeleton/        # actin, microtubules, intermediate filaments, motor proteins
│  │  │  └─ cytoplasm/           # volumetric haze, GPGPU particles, streaming field
│  │  ├─ camera/                 # CameraRig + modes: orbit, focus, flight, tour
│  │  ├─ postfx/                 # PostFX stack per quality preset
│  │  ├─ lod/                    # Distance bands, cross-fade utilities
│  │  ├─ interaction/            # Picking proxies, hover outline, selection
│  │  ├─ effects/                # Effect-channel → uniform bindings, visual "actors"
│  │  └─ shaders/chunks/         # noise, sss, fresnel, caustics, brownian, dither
│  │
│  ├─ engine/
│  │  ├─ timeline/               # Shared scenario engine (processes AND diseases)
│  │  ├─ channels/               # Registry of visual effect channels (typed)
│  │  └─ quality/                # Presets, adaptive performance monitor
│  │
│  ├─ content/
│  │  ├─ schema/                 # Zod schemas (single source of truth for types)
│  │  └─ load.ts                 # Typed loaders, search index, source resolution
│  │
│  ├─ state/                     # Zustand stores: scene, camera, selection, scenario, quality, ui
│  ├─ ui/                        # Glass panels, InfoPanel, Library, Timeline, Tour, Sources, Disclaimer
│  ├─ i18n/                      # fr.ts / en.ts (UI strings), locale store (client-side FR | EN switch)
│  └─ lib/                       # seeded RNG, math, a11y helpers
│
├─ content/                      # ← all scientific content, no code
│  ├─ organelles/*.json
│  ├─ processes/*.json
│  ├─ tours/*.json
│  ├─ diseases/<category>/<slug>.json
│  └─ sources/*.json             # One bibliography entry per file (DOI / PMID / ISBN / URL)
│
├─ scripts/
│  ├─ validate-content.ts        # Schema + referential integrity + "no claim without source"
│  ├─ verify-sources.ts          # Resolves PMIDs/DOIs against PubMed/Crossref, caches results
│  └─ new-disease.ts             # Scaffolds a disease file from a template
│
├─ tests/                        # vitest + playwright
├─ docs/                         # Architecture, art direction, content guide, decisions (ADRs)
└─ .github/workflows/ci.yml
```

---

## 4. Rendering architecture

### 4.1 Scale and units
- 1 scene unit = 0.1 µm. A ~20 µm cell spans ~200 units; a ribosome (~25 nm) is 0.25 units.
- **Compressed scale** by default: organelles are slightly enlarged and less crowded than reality so they read
  clearly. This is declared in the UI ("Échelle artistique") with a toggle showing true relative sizes where useful.
- Logarithmic depth buffer only if z-fighting appears at close range; otherwise dynamic near/far per camera band.

### 4.2 Three detail bands (LOD)
| Band | Camera distance | What is rendered |
|---|---|---|
| **Macro** | whole cell | Membrane shell, organelle silhouettes, volumetric haze, ~20–60k drifting particles |
| **Meso** | organelle in view | Full organelle meshes, instanced ribosomes on RER, microtubule network, vesicle traffic |
| **Micro** | close-up | Cristae inside mitochondria, nuclear pore complexes, double membranes, lipid bilayer patch with receptors/channels, motor proteins stepping |

Bands cross-fade with dithered alpha (no popping). Micro detail is generated lazily (worker) the first time the camera
approaches an organelle and cached.

### 4.3 Materials & light (the "documentary" look)
- **Membranes**: patched `MeshPhysicalMaterial` — transmission + thickness, iridescence for the lipid sheen,
  wrap-lighting fake SSS, fresnel rim glow, animated normal perturbation (slow undulation), wet specular.
- **Cytoplasm**: low-resolution raymarched volume (half/quarter res, upsampled) with 3D noise density, light shafts
  from a key light, and a projected animated **Worley caustic** pattern to suggest light refracting through fluid.
- **Organelles**: each has its own material family (see §9 art direction) but shares lighting chunks so the scene is coherent.
- **Lighting**: one warm key, one cool rim, a procedural environment (no HDRI download), emissive accents fed to bloom.
- **Post stack (high)**: N8AO → DOF (focus follows selection) → Bloom (mip) → Chromatic aberration (radial, subtle)
  → Film grain → Vignette → AgX tone mapping → SMAA.

### 4.4 Life & motion (all GPU-side)
| Phenomenon | Technique |
|---|---|
| Brownian drift | Vertex shader offset from hashed per-instance noise × time (zero CPU cost) |
| Cytoplasmic streaming | GPGPU ping-pong FBO particles advected by a curl-noise field shaped around organelles |
| Mitochondrial pulsing | Low-frequency vertex displacement + emissive "membrane potential" breathing |
| Motor proteins | Instances parametrised by (microtubule id, t); shader samples the tube curve from a data texture; 8 nm "steps" eased |
| Vesicle budding/fusion | Metaball-like SDF blend in shader at bud sites; lifecycle driven by a small CPU scheduler (dozens, not thousands) |
| Ribosomes on RER | Instanced on sampled ER surface points, with polysome chains and subtle jitter |
| Microtubule dynamics | Growing/shrinking tips (dynamic instability) via per-tube length uniforms |

### 4.5 Procedural geometry
All geometry is procedural and **seeded** (deterministic, shareable "same cell" for everyone):
- Membrane: subdivided icosphere + low-frequency noise + blebbing channel.
- Nucleus: double envelope shells; nuclear pores on a Fibonacci lattice (instanced, 8-fold symmetry); chromatin as
  random-walk tube splines with territories; nucleolus as dense granular cluster.
- ER: rough ER as stacked curved sheets continuous with the outer nuclear membrane; smooth ER as a tubular network
  (graph → tube geometry).
- Golgi: 4–8 curved cisternae with cis→trans gradient, fenestrated rims, budding vesicles.
- Mitochondria: displaced capsules; cristae as folded lamellar inner geometry revealed in micro band (clipped cut-away).
- Cytoskeleton: microtubules radiating from the centrosome; actin cortex mesh under the membrane; intermediate
  filament basket around the nucleus.

### 4.6 Interaction & camera
- **Picking** uses cheap invisible proxy meshes (not the expensive render meshes).
- Hover: soft outline + rim brighten; click: `focus` transition (eased spline, look-ahead, DOF pull).
- Camera modes in a small state machine: `orbit` · `focus(organelleId)` · `flight` (WASD/mouse, collision-softened)
  · `tour(tourId, step)`. All transitions are interruptible.

### 4.7 Quality presets
| Preset | DPR cap | Particles | Volume | AO | DOF | Micro LOD |
|---|---|---|---|---|---|---|
| Low | 1.0 | 8k | off (fog only) | off | off | simplified |
| Medium | 1.25 | 25k | quarter-res | off | on focus | yes |
| High | 1.5 | 60k | half-res | N8AO | on | yes |
| Ultra | 2.0 | 150k | half-res, more steps | N8AO full | on | yes |

An adaptive monitor (drei `PerformanceMonitor`) steps down/up within a preset. Budgets for *High*: < 150 draw calls,
< 1.5M triangles, 60 fps on an integrated-GPU 2023 laptop at 1080p.

---

## 5. Engine: one timeline for processes and diseases

The key scalability idea: **the scene exposes a fixed, typed vocabulary of visual "effect channels"**, and all
scenarios (biological processes *and* diseases) are just data that animate those channels over a timeline.

```ts
// src/engine/channels/registry.ts (excerpt)
export const CHANNELS = {
  'mitochondria.swelling':        { range: [0, 1], doc: 'Gonflement de la matrice' },
  'mitochondria.fragmentation':   { range: [0, 1], doc: 'Fission excessive → réseau fragmenté' },
  'mitochondria.potential':       { range: [0, 1], doc: 'Potentiel de membrane (lueur)' },
  'lysosome.storageLoad':         { range: [0, 1], doc: 'Matériel non dégradé accumulé' },
  'lysosome.count':               { range: [0, 3], doc: 'Multiplicateur du nombre' },
  'er.stress':                    { range: [0, 1], doc: 'Dilatation du RE, UPR' },
  'er.retainedCargo':             { range: [0, 1], doc: 'Protéines retenues dans le RE' },
  'golgi.fragmentation':          { range: [0, 1] },
  'cytoplasm.aggregates':         { range: [0, 1], doc: 'Agrégats protéiques' },
  'cytoplasm.lipidDroplets':      { range: [0, 1] },
  'cytoplasm.glycogen':           { range: [0, 1] },
  'nucleus.envelopeBlebbing':     { range: [0, 1] },
  'nucleus.chromatinCondensation':{ range: [0, 1] },
  'nucleus.inclusions':           { range: [0, 1] },
  'membrane.blebbing':            { range: [0, 1] },
  'membrane.receptorDensity':     { range: [0, 3] },
  'cytoskeleton.disruption':      { range: [0, 1] },
  'cell.divisionRate':            { range: [0, 5] },
  'cell.viability':               { range: [0, 1], doc: '1 = saine, 0 = mort cellulaire' },
  // ~40 channels at launch; adding a channel = one entry + one shader binding
} as const;
```

On top of continuous channels, a small library of reusable **actors** (code) handles discrete, choreographed
events: `virusEntry`, `viralReplicationFactory`, `viralBudding`, `aggregateSeed`, `apoptosisSequence`,
`mitoticSpindle`, `actinCometTail`, `phagosomeArrest`, `secretoryCargo`… Data files reference actors by id with
parameters. A new disease only needs new code when it needs a visual primitive that genuinely does not exist yet.

The timeline engine: keyframed channels (with easing), actor cues, camera cues (optional), narration cues — all
scrubbable both directions (state is a pure function of `t`, never accumulated).

---

## 6. Data schemas (Zod, abridged)

```ts
// Sources & claims ---------------------------------------------------------
const Source = z.object({
  id: z.string(),                                   // 'alberts-2022-mboc7'
  type: z.enum(['article', 'review', 'book', 'chapter', 'database', 'guideline', 'website']),
  title: z.string(),
  authors: z.array(z.string()).optional(),
  year: z.number().int(),
  publisher: z.string().optional(),                 // journal / editor / organisation (WHO, NIH...)
  pmid: z.string().regex(/^\d+$/).optional(),
  doi: z.string().optional(),
  isbn: z.string().optional(),
  url: z.string().url().optional(),
  verified: z.object({ on: z.string(), via: z.enum(['pubmed', 'crossref', 'manual']) }).optional(),
});

const Claim = z.object({
  text: LocalizedText,                              // { fr: string, en?: string }
  sources: z.array(SourceRef).min(1),               // ← enforced: no claim without a source
  simplification: LocalizedText.optional(),         // shown with a "Simplification" badge
});

// Organelles ---------------------------------------------------------------
const Organelle = z.object({
  id: OrganelleId,                                  // 'mitochondrion'
  name: LocalizedText,
  summary: Claim,
  function: z.array(Claim),
  structure: z.array(Claim),
  keyMolecules: z.array(z.object({ name: z.string(), role: Claim })),
  interactions: z.array(z.object({ with: OrganelleId, description: Claim })),
  dimensions: z.object({ min: z.number(), max: z.number(), unit: z.enum(['nm', 'µm']) }).optional(),
  camera: CameraHint.optional(),                    // preferred focus framing
});

// Scenarios (shared by processes and diseases) ------------------------------
const ChannelTrack = z.object({
  channel: ChannelId,                               // key of CHANNELS, validated
  keys: z.array(z.object({ t: z.number().min(0).max(1), v: z.number(), ease: Ease.optional() })),
  target: z.string().optional(),                    // optional subset: 'mitochondria:perinuclear'
});
const ActorCue = z.object({ actor: ActorId, at: z.number(), until: z.number().optional(), params: z.record(z.unknown()) });
const NarrationCue = z.object({ at: z.number(), text: Claim, focus: OrganelleId.optional() });

// Diseases -----------------------------------------------------------------
const Disease = z.object({
  id: z.string(), slug: z.string(),
  name: LocalizedText, aliases: z.array(z.string()).default([]),
  categories: z.array(DiseaseCategory).min(1),      // genetic, metabolic, infectious, cancer, neurodegenerative,
                                                    // autoimmune, mitochondrial, lysosomal-storage, peroxisomal...
  identifiers: z.object({ omim: z.string().optional(), icd11: z.string().optional(),
                          orpha: z.string().optional(), mesh: z.string().optional() }).partial(),
  cellContext: z.object({ cellType: CellType, note: Claim.optional() }),  // see §10 decision 1
  summary: Claim,
  cause: z.array(Claim),                            // gene / pathogen / environmental factors
  affectedOrganelles: z.array(OrganelleId).min(1),
  affectedPathways: z.array(PathwayId),
  mechanism: z.array(z.object({ title: LocalizedText, explanation: Claim, organelle: OrganelleId.optional() })),
  stages: z.array(z.object({
    id: z.string(),
    title: LocalizedText,
    range: z.tuple([z.number(), z.number()]),       // slice of the 0..1 timeline
    description: Claim,
    cellularSigns: z.array(Claim),                  // "symptoms" at the cellular level
    narration: z.array(NarrationCue).default([]),
  })).min(2),
  tracks: z.array(ChannelTrack),
  actors: z.array(ActorCue).default([]),
  treatmentsNote: Claim.optional(),                 // educational context only, never advice
  review: z.object({ status: z.enum(['draft', 'reviewed']), lastChecked: z.string() }),
});
```

Build-time validation (`scripts/validate-content.ts`) checks: schema, every `SourceRef` resolves, every channel and
actor id exists, stage ranges tile `[0,1]` without gaps, every organelle reference exists, slugs are unique.
`verify-sources.ts` resolves PMIDs/DOIs against PubMed and Crossref and checks that titles match, so that no
fabricated reference can slip in.

### Example (abridged) — `content/diseases/lysosomal-storage/tay-sachs.json`
```json
{
  "id": "tay-sachs",
  "slug": "maladie-de-tay-sachs",
  "name": { "fr": "Maladie de Tay-Sachs" },
  "categories": ["genetic", "lysosomal-storage", "neurodegenerative"],
  "identifiers": { "omim": "272800" },
  "cellContext": { "cellType": "neuron" },
  "affectedOrganelles": ["lysosome", "er", "golgi"],
  "stages": [
    { "id": "s1", "title": { "fr": "Enzyme déficiente" }, "range": [0, 0.25], "...": "..." },
    { "id": "s2", "title": { "fr": "Accumulation de GM2" }, "range": [0.25, 0.6], "...": "..." },
    { "id": "s3", "title": { "fr": "Lysosomes distendus" }, "range": [0.6, 0.85], "...": "..." },
    { "id": "s4", "title": { "fr": "Dysfonction neuronale" }, "range": [0.85, 1], "...": "..." }
  ],
  "tracks": [
    { "channel": "lysosome.storageLoad", "keys": [{ "t": 0, "v": 0 }, { "t": 0.6, "v": 0.7 }, { "t": 1, "v": 1 }] },
    { "channel": "lysosome.count",       "keys": [{ "t": 0, "v": 1 }, { "t": 1, "v": 2.5 }] },
    { "channel": "cell.viability",       "keys": [{ "t": 0.7, "v": 1 }, { "t": 1, "v": 0.4 }] }
  ]
}
```

---

## 7. Initial disease set (Phase 3 — 26 diseases)

Chosen for strong documentation **and** visually distinct cellular signatures, covering every category.

| Category | Diseases | Key visual signature |
|---|---|---|
| Lysosomal storage | Tay-Sachs, Gaucher, Pompe, Niemann-Pick type C, Fabry, I-cell disease (mucolipidosis II) | Swollen, overloaded lysosomes; I-cell shows mis-sorting at the Golgi (missing M6P tag) |
| Mitochondrial | MELAS, Leigh syndrome, Leber hereditary optic neuropathy | Abnormal cristae, low potential, ragged/proliferating mitochondria |
| Neurodegenerative | Alzheimer's, Parkinson's, Huntington's, ALS | Tau tangles, α-synuclein Lewy bodies, nuclear polyQ inclusions, TDP-43 mislocalisation |
| Genetic (other) | Cystic fibrosis (F508del), Hutchinson-Gilford progeria, Duchenne muscular dystrophy, Zellweger spectrum, α1-antitrypsin deficiency | ER retention & degradation, nuclear envelope blebbing, cortex/membrane fragility, empty peroxisome "ghosts", ER aggregates |
| Metabolic | Familial hypercholesterolaemia, Type 2 diabetes (insulin resistance), Non-alcoholic fatty liver disease | Failed LDL-receptor endocytosis, impaired GLUT4 translocation, lipid droplet accumulation |
| Infectious | SARS-CoV-2, Influenza A, HIV-1, Listeriosis, Tuberculosis | ER-derived replication organelles, nuclear replication, integration, actin comet tails, arrested phagosome |
| Cancer | Carcinogenesis (p53/RAS model), HER2+ breast cancer | Uncontrolled division, aneuploidy, receptor overexpression |
| Autoimmune | Type 1 diabetes (β-cell destruction) | Immune attack → apoptosis sequence |

Sources favoured for stability and verifiability: *Molecular Biology of the Cell* (Alberts), NCBI Bookshelf
(GeneReviews, StatPearls), OMIM, MedlinePlus Genetics, WHO fact sheets, and peer-reviewed reviews with PMIDs —
each verified by `verify-sources.ts` before a disease is marked `reviewed`.

---

## 8. Processes (Phase 2)

Implemented as scenarios on the same engine:
1. **Synthèse des protéines** — transcription in the nucleus → mRNA export through a pore → ribosome docking on RER
   → co-translational translocation → Golgi → secretory vesicle → exocytosis.
2. **Respiration cellulaire** — glycolysis (cytosol) → pyruvate into mitochondrion → Krebs cycle → electron
   transport chain on cristae → ATP synthase rotation (micro band close-up).
3. **Endocytose / exocytose** — clathrin-coated pit → endosome → lysosome; secretory exocytosis.
4. **Mitose** — chromatin condensation → envelope breakdown → spindle from duplicated centrosomes → metaphase
   alignment → anaphase → telophase → cytokinesis (whole-cell choreography actor).

---

## 9. Art direction (summary)

- **Mood**: deep abyssal blue-black fluid, warm bioluminescent accents, soft volumetric light — "deep-sea documentary",
  not "neon sci-fi".
- **Palette** (tuned in Phase 1): background `#04070D`; membrane pearl/ivory with cyan rim; nucleus deep indigo
  with warm chromatin glow; mitochondria coral → amber; ER lilac; Golgi pale gold; lysosomes magenta; peroxisomes
  chartreuse; cytoskeleton thin silver-blue filaments. Disease states shift palettes toward desaturated / sickly tones.
- **UI**: dark glassmorphism (backdrop blur, 1 px hairline borders, soft inner glow), generous spacing, editorial
  serif headings, small-caps labels, restrained motion (spring, < 300 ms), a single accent colour.
- **Typography**: Instrument Serif for titles, Geist for interface, JetBrains Mono for measurements and citations.

---

## 10. Decisions I need from you

1. **Cell type.** A "generic human cell" doesn't exist in reality: many diseases happen in specific cells (neurons,
   hepatocytes, β-cells, muscle fibres, macrophages; red blood cells even lack most organelles).
   *Proposal*: one archetypal eukaryotic cell for v1, with each disease showing its real cell context as a labelled
   note; cell-type variants (neuron, hepatocyte…) added later as an extension of the layout system.
2. **Scale.** Artistic compressed scale by default with a "taille réelle" toggle — OK?
3. **Hosting.** Vercel (simplest for Next.js, preview deployments per push) vs GitHub Pages (static export).
4. **Content language.** UI and content in French only, with the schema already supporting `en` for later — OK?
   *Update:* French and English are both shipped; every content string has `en`, enforced by the validator.
5. **Licence.** Code MIT and content CC BY-SA 4.0, or keep all rights reserved?

---

## 11. Roadmap

### Phase 0 — Foundations (short)
Next.js + TS strict scaffold, lint/format, Zod schemas, content validator, CI (typecheck, lint, validate, build),
quality-preset store, empty Canvas with renderer configured. **Done when** CI is green and a blank, correctly
tone-mapped scene renders.

### Phase 1 — The living cell (top priority, iterate until stunning)
1. Lighting rig, environment, post-processing stack, quality presets.
2. Membrane (shell + micro bilayer patch with receptors/channels) and cytoplasm (volume, caustics, GPGPU particles).
3. Nucleus (double envelope, pores, chromatin, nucleolus), ER (rough + smooth), Golgi.
4. Mitochondria (with cristae LOD), lysosomes, peroxisomes, ribosomes, vesicles, centrosome, cytoskeleton.
5. Motion layer: Brownian drift, streaming, pulsing, motor proteins, budding/fusion.
6. Camera: orbit, free flight, eased transitions; landing-page cinematic intro.

**Done when**: 60 fps on High on the target laptop, no static-looking surface anywhere, critical review recorded
(screenshots + list of improvements) in `docs/reviews/phase-1.md`.

### Phase 2 — Understanding the cell
Hover/selection, focus camera, info panels (function, structure, key molecules, interactions — all sourced),
organelle list for keyboard users, guided tour, timeline engine, four process scenarios.

### Phase 3 — Diseases
Channel registry + bindings, actor library, disease library UI (search, category filters, cards), timeline scrubber
with stages and narration, sources drawer, disclaimer, static disease pages, the 26 initial diseases, source
verification. Then a contributor guide: "add a disease in one file".

### Phase 4 — Performance, accessibility, polish
Profiling and budgets, adaptive quality, mobile/tablet layouts and touch controls, `prefers-reduced-motion`,
non-WebGL fallback, keyboard navigation, screen-reader descriptions of scene state, Lighthouse/axe passes,
OG images, final art pass.

Each phase ends with a written critical review (visual quality + scientific accuracy) and proposed improvements.

---

## 12. Educational disclaimer (shown in the UI)

> *Cellula est un outil pédagogique. Les représentations sont des modèles simplifiés de connaissances scientifiques
> publiées ; elles ne constituent ni un avis médical, ni un outil de diagnostic. Consultez un professionnel de santé
> pour toute question médicale.*
