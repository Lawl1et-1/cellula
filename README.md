# Cellula

**Explorer une cellule humaine en 3D — et comprendre ce que les maladies lui font.**

Cellula est une expérience web éducative et cinématographique : un voyage à l'intérieur d'une cellule humaine
vivante, organite par organite, avec une bibliothèque de maladies simulées étape par étape à partir de sources
scientifiques citées.

> Projet en cours — phase 1 (la cellule vivante). Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et
> [docs/reviews/phase-1.md](docs/reviews/phase-1.md).

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000. Paramètres utiles : `?stats` (images par seconde),
`?cam=px,py,pz,tx,ty,tz` (point de vue partageable).

| Script | Rôle |
|---|---|
| `npm run check` | Types, lint, validation du contenu, tests |
| `npm run validate:content` | Vérifie schémas, sources et cohérence du dossier `content/` |
| `npm run build` | Build de production |

## Licences

Code : MIT. Contenu scientifique (`content/`) : CC BY-SA 4.0.

## Stack

Next.js · TypeScript · React Three Fiber · drei · postprocessing · GLSL · Zustand · Framer Motion · Zod

## Avertissement

Cellula est un outil pédagogique. Les représentations sont des modèles simplifiés de connaissances scientifiques
publiées ; elles ne constituent ni un avis médical, ni un outil de diagnostic.
