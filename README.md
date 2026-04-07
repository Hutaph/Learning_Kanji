# Kulukulu Nihongo

Focused Japanese learning web app for **Kanji + JLPT Vocabulary + Verb practice**.

## Live Demo

- [nihongo-benkyo.vercel.app](https://nihongo-benkyo.vercel.app/)

## Tech Stack

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![Data](https://img.shields.io/badge/Data-pandas-150458?logo=pandas&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-013243?logo=numpy&logoColor=white)
![Modeling](https://img.shields.io/badge/Modeling-scikit--learn-F7931E?logo=scikitlearn&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?logo=tensorflow&logoColor=white)
![Vite](https://img.shields.io/badge/Frontend-Vite-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/UI-React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript&logoColor=white)
![Deployment](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

## Versions

- **v1.0**
  - Core Kanji flashcard workflow
  - Local vocabulary management and grouping
  - Basic progress tracking with local storage

- **v2.0**
  - Major refactor (component split, cleaner folder structure)
  - Upgraded JLPT Vocabulary tab (N5/N4) with lesson filters and quiz modes
  - Wrong-answer review mode
  - Hide learned words + shuffled list with persisted state
  - Added Han-Viet column generated into dataset
  - Better UX: dark mode, compact/full layout, improved data flow

- **v2.5**
  - Verb tab migrated to APKG-based dataset (`Makos_Japanese_Verb_Conjugation.apkg`)
  - Verb images + full conjugation table from source deck
  - Meaning quiz (4 random options)
  - Home dashboard simplified, Kanji workflow streamlined

## Git Convention (v2.5)

- **Branch naming**
  - `feature/<scope>`
  - `fix/<scope>`
  - `chore/<scope>`
  - `data/<scope>`

- **Commit format**
  - `<type>(<scope>): <short summary>`
  - Use present tense, max ~72 chars for summary.

- **Allowed commit types**
  - `feat`: new user-facing functionality
  - `fix`: bug fix / regression fix
  - `refactor`: code restructure without behavior change
  - `ui`: visual/copy/layout update
  - `data`: JSON/APKG-derived dataset changes
  - `docs`: README/docs only
  - `chore`: tooling/maintenance/dependency updates
  - `update`: broad non-breaking update when no better type fits

- **v2.5 examples**
  - `feat(verbs): migrate verb tab to APKG dataset`
  - `data(verbs): refresh verbsConjugation and media assets`
  - `ui(kanji): simplify study controls and copy`
  - `chore(build): split vendor chunks in vite config`
  - `update(readme): align docs with v2.5 release`

- **PR checklist**
  - Keep PR focused to one theme.
  - Include test note: `npx tsc --noEmit`, `npm run build`, manual UI check.
  - Add screenshots for UI changes.

## Key Features

- **Kanji Flashcards**: grouped study, known/unknown marking, related vocabulary, images.
- **JLPT Vocabulary (N5/N4)**:
  - lesson-based filtering (Minna mapping)
  - quiz mode: meaning / kanji / both
  - wrong-answer review
  - hide learned words + persisted shuffle order
  - built-in Han-Viet column
- **Verb Study (N4/N5 APKG)**: image-backed conjugation + 4-option meaning quiz.
- **Data Safety**: local backup/restore + persistent progress via `localStorage`.

## Run Locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Data Scripts

- Import Minna deck to JLPT JSON:

```bash
npm run import-minna
```

- Enrich Han-Viet field from unified kanji dataset (`src/data/kanjiImported.json`):

```bash
npm run enrich-jlpt-hanviet
```

- Import kanji + media from APKG:

```bash
python scripts/import_apkg.py
```

- Import verb conjugation data + media from APKG:

```bash
npm run import-verbs
```

> Put all `.apkg` files inside `apkg/` (ignored by git).

## Deployment

- Target platform: **Vercel** (Vite output: `dist`)
- SPA routing is supported via `vercel.json`
