# Review — Focus mode and the DNA zoom

Status: **built; content in FR and EN; checks green.** Branch `feat/focus-player`.

## Why

Disease mode showed everything at once: a 50-second timeline, the full fact sheet, every organelle at full
strength, tiny viruses scattered by the hundred, and no labels. It was hard to tell what was happening.

## Focus mode

- **One step at a time.** Every disease (and every process) is now a short story of 4–6 steps. A step plays
  in about 12 s and then holds on its last frame; the reader moves on with *Next*, the step dots or the ← →
  keys. *Autoplay* chains the steps with a pause to read. *Replay* restarts a step.
- **Control bar** (bottom): Previous · Play/Pause/Replay · Next · "Step 2 / 6" with clickable progress,
  Autoplay, Free camera, Fact sheet (the full sourced sheet, closed by default) and **Exit**.
- **Caption** above the bar: the step's title and a 1–2 sentence explanation with its sources, the same
  citation system as everywhere else.
- **Ghosting.** Everything the step does not involve becomes faint, grey and see-through (not invisible, so
  the reader keeps their bearings). What the step involves stays in full colour with a soft glow. Changing
  step fades the previous elements out and the new ones in. Disease systems (virions, aggregates, lipid
  droplets, bacteria, lesions…) follow the same rule.
- **Camera.** Each step flies (eased) to frame its action, slightly above the centre so the caption does not
  cover it. User control is locked during a step; *Free camera* unlocks it and *Reframe* flies back. Idle
  drift is off. **Exit** flies back to the view the reader had before and restores the whole cell.

## Readability

- **Enlarged key objects** with distinct shapes and colours that no cell component uses: SARS-CoV-2 (teal
  with golden spikes), influenza, HIV, *Listeria*, *M. tuberculosis*, receptors, viral RNA, mRNA, proteins,
  misfolded proteins, enzymes, substrates, LDL, glucose, insulin, a T lymphocyte, UV rays.
- **Honest scale.** Each model has its real size in `src/content/heroScale.ts`; the caption shows the factor
  ("SARS-CoV-2: enlarged ×7 for readability", "ACE2 receptor ×30"). Bacteria and the T lymphocyte are drawn
  close to their real size and get no note.
- **Labels** in the scene name what matters at each step (the ACE2 receptor, viral RNA, caspases…). They are
  DOM labels projected from the scene every frame, below the panels.

## Every disease, step by step

All 31 diseases were rewritten from their existing sourced content (no new sources were needed; every
caption cites sources already verified on NCBI). The steps are authored once in
`scripts/disease-steps/*.py`, which regenerate each disease's stages, channel tracks and actors.

| Group | Story |
|---|---|
| Viruses (COVID-19, flu, HIV) | attachment to the named receptor → entry → genome release → hijacking ribosomes / ER (or nucleus, or integration) → assembly → exit |
| Bacteria (listeriosis, tuberculosis) | entry → vacuole escape or blocked phagosome → multiplication → actin comet tails or granuloma |
| Lysosomal storage (Pompe, Gaucher, Fabry, Tay-Sachs, Niemann-Pick C) | mutated gene → missing enzyme or transporter → substrate arrives → lysosomes fill → consequences in that disease's cells |
| Other genetic (CF, α1-antitrypsin, Duchenne, FH, ML II, progeria, XP, sickle cell, Huntington, Zellweger) | mutated gene → where the protein fails (ER, Golgi, membrane, nucleus, peroxisome) → what the cell and tissue suffer |
| Cancers | mutation → faulty signal (oncogene / suppressor, HER2 receptors) → uncontrolled division → escape from apoptosis → instability |
| Neurodegenerative | misfolded protein (amyloid/tau, α-synuclein, TDP-43) → aggregation → damage → neuron loss |
| Mitochondrial (Leigh, LHON, MELAS) | mtDNA variant → respiratory chain defect → less ATP → abnormal mitochondria → most energy-hungry tissues |
| Metabolic and autoimmune | insulin and glucose, lipid droplets, T-cell attack and the caspase cascade |

## DNA zoom

Clicking DNA (in the scene or the list) now works like the mitochondria close-up: the camera flies to a
chromatin locus and, as it closes in, the strand there resolves into nucleosomes and then into the double
helix, while the rest of the cell ghosts away. The two strands, the base pairs as coloured rungs and labels
(A · adenine, T · thymine, G · guanine, C · cytosine, sugar-phosphate backbone) are shown; the reader orbits
around it. Closing the panel (× or Esc) pulls the camera back out to the whole nucleus. The sourced DNA
panel and the four-level packaging close-up are unchanged.

## Still open

1. Expert review of the new step captions (FR and EN).
2. The sickle shape of a red blood cell, amyloid plaques and the granuloma's neighbouring cells remain
   schematic, as flagged in the captions.
