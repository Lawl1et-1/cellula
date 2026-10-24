# Cellula

**Explorer une cellule humaine en 3D — et comprendre ce que les maladies lui font.**

Cellula est une expérience web éducative et cinématographique : un voyage à l'intérieur d'une cellule humaine
vivante, organite par organite, avec une bibliothèque de maladies simulées étape par étape à partir de sources
scientifiques citées.

![Cellula](docs/reviews/img/01-accueil.jpg)

> Les quatre phases sont terminées (cellule vivante, organites interactifs, processus animés, 29 maladies,
> performance, accessibilité, mobile). Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et les bilans de
> [phase 1](docs/reviews/phase-1.md), [phase 2](docs/reviews/phase-2.md), [phase 3](docs/reviews/phase-3.md)
> et [phase 4](docs/reviews/phase-4.md). Le contenu scientifique attend encore une relecture experte.

## Ce que l'on peut faire

- Explorer une cellule humaine en 3D, cliquer sur chaque organite et lire sa fiche (rôle, structure,
  molécules clés, interactions), chaque affirmation renvoyant à une section précise d'un manuel de référence.
- Suivre une visite guidée de 12 étapes.
- Regarder quatre processus animés, étape par étape : synthèse et sécrétion d'une protéine, respiration
  cellulaire, endocytose et exocytose, mitose et cytocinèse.
- Choisir parmi 29 maladies (surcharges lysosomales, maladies mitochondriales, neurodégénératives,
  infections, cancers…) et voir, étape par étape, ce qu'elles font à la cellule. 83 sources, toutes
  vérifiées sur NCBI (PubMed, GeneReviews, StatPearls).

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000. Paramètres utiles : `?stats` (images par seconde et temps GPU),
`?cam=px,py,pz,tx,ty,tz` (point de vue partageable), `?process=mitose&t=0.5` (processus à un instant donné),
`?q=low|medium|high|ultra` (qualité).

| Script | Rôle |
|---|---|
| `npm run check` | Types, lint, validation du contenu, tests |
| `npm run validate:content` | Vérifie schémas, sources et cohérence du dossier `content/` |
| `npm run verify:sources` | Vérifie chaque source sur NCBI (PubMed, Bookshelf) ; `-- --write` enregistre la date |
| `npm run build` | Build de production |
| `npm run perf -- <url>` | Temps GPU par préréglage, sur le GPU réel (Edge sans interface) |
| `npm run shots -- <url> <dossier> <qualité>` | Captures de référence |

## Accessibilité et performances

- Aucune violation axe-core (WCAG 2.1 AA) ; mouvement réglable (vivant, réduit, pause) ; annonces pour
  lecteurs d'écran ; version texte si WebGL 2 n'est pas disponible ; mise en page dédiée aux téléphones.
- Sur une puce graphique intégrée (Intel UHD), première visite affichée en ~3,5 s et 60 images/s en qualité
  « Bas » (voir `npm run perf`).

## Mise en ligne (Vercel)

1. Importer le dépôt GitHub sur https://vercel.com/new (framework détecté automatiquement : Next.js).
2. Définir la variable `NEXT_PUBLIC_SITE_URL` avec l'adresse publique du site.
3. Déployer.

## Licences

Code : MIT. Contenu scientifique (`content/`) : CC BY-SA 4.0.

## Stack

Next.js · TypeScript · React Three Fiber · drei · postprocessing · GLSL · Zustand · Framer Motion · Zod

## Avertissement

Cellula est un outil pédagogique. Les représentations sont des modèles simplifiés de connaissances scientifiques
publiées ; elles ne constituent ni un avis médical, ni un outil de diagnostic.
