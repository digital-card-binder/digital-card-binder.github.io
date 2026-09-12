# Architecture guide

## Purpose

Digital Card Binder is a static web application with Firebase-backed collector data, public catalog data, shared collection services, and an Android wrapper. This document defines the boundaries that future feature work must preserve.

## Layers

### 1. Catalog layer

The `data/` directory is the source of truth for public catalog content. Catalog files describe cards, Pokémon, people, artists, series, packs, and derived collections.

Rules:
- Do not store user ownership state in catalog JSON.
- A supplement file may temporarily extend a catalog, but permanent behavior should eventually be consolidated into the owning catalog or a documented staged-data pipeline.
- Consumers must use the same effective catalog definition. If a catalog is composed from multiple files, the merge rule must be documented and tested.

### 2. Collection/service layer

Shared collection behavior belongs in service or registry modules such as `collector-collection-registry.js`, `collector-public-sync.js`, and shared storage helpers.

Rules:
- Collection identity must be deterministic.
- User ownership data must never be inferred from display order when a stable account/card identifier is available.
- `trainerPokemon` identities remain namespaced with `trainerPokemon::` and preserve `accountIndex` compatibility.
- Firebase persistence must preserve existing document IDs and collection keys unless an explicit, tested migration exists.

### 3. Feature layer

Feature modules own feature-specific behavior: dashboard, AR, Pokémon collections, series, artists, packs, people, trainer/Pokémon, news, feedback, sharing, and owner Sheets synchronization.

Rules:
- A feature may consume shared services but must not silently redefine their data contract.
- Permanent fixes belong in the owning module. Avoid adding new `*-fix.js` or `*-supplement.js` files for behavior-only changes.
- Compatibility shims must be documented and have a removal condition.

### 4. Presentation layer

HTML/CSS provides the current public UI. Existing URLs are treated as stable application routes.

Rules:
- Preserve existing routes and visible functionality during refactoring.
- Do not move user-facing behavior solely to a new framework as part of structural cleanup.
- Static navigation labels must not become a second source of truth for catalog counts.

### 5. User-data layer

Firestore and browser-local storage have different responsibilities.

- Firestore: account-scoped persistent collection state and approved public projections.
- `localStorage`: browser-local preferences and intentionally local ownership/override state.
- Public profiles must expose only the approved projection, never private account documents.

## Refactoring strategy

1. Create a branch from `main`.
2. Add/extend contract tests before moving behavior.
3. Refactor one owning module at a time.
4. Keep the public URL and data contracts stable.
5. Run `npm test` before merge.
6. Merge only after the resulting catalog counts and collection identity checks are unchanged.

## Current canonical composed catalogs

- AR = `data/ar.json` + `data/ar-supplement.json`, merged by set code.
- Pokémon collections = `data/pokemon-collections.json` + `data/pokemon-collections-21-40.json`, merged by Pokémon name.

These composition rules must remain identical across dashboard, registry, public summary, page, and owner-Sheets consumers.
