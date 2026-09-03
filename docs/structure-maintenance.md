# Structure maintenance guide

This repository intentionally preserves existing Firestore documents and collection keys.
Structural cleanup must not migrate or reset user collection data unless a separate migration is explicitly designed and tested.

## Canonical catalog rules

- AR: the effective catalog is `data/ar.json` plus `data/ar-supplement.json`, merged by set code. All dashboard, public summary, page and owner-Sheets consumers must see the same effective catalog.
- Pokemon collections: the effective populated catalog is `data/pokemon-collections.json` plus `data/pokemon-collections-21-40.json`, merged by Pokemon name. Current populated groups: 67; current cards: 1134.
- Trainer x Pokemon: account keys are namespaced with `trainerPokemon::` and use `accountIndex` when present.
- Custom dex: stored under `pokemonCollectionsDex.customDexes`. `custom-sharing.js` remains a compatibility extension and must load before dashboard/settings consumers that need the custom registry entry.
- World exploration: ownership and representative-card overrides are currently browser-local (`localStorage`) by design. Do not silently migrate them into Firestore during unrelated cleanup.

## Deployment safety

- `backup/pre-structure-cleanup-20260903` is the immutable pre-cleanup rollback reference.
- Feature work should use a branch and pull request.
- `npm test` must pass before merge.
- The Verify workflow runs for pull requests and direct pushes to `main`.

## Repository hygiene

- Do not commit `.tmp-*` trigger files.
- Keep only the live root `DigitalCardBinder_v0.8.apk`; old build outputs belong in GitHub Actions artifacts/releases, not duplicate repository paths.
- Avoid introducing new `*-fix.js` or `*-supplement.js` files for permanent behavior unless there is a staged-data reason. Prefer consolidating stable behavior into the owning module after compatibility is verified.
