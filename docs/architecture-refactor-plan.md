# architecture refactor plan

## goal

Improve internal structure without changing the current user-facing implementation.

## invariants

- Keep existing page URLs and navigation.
- Keep Firestore collection/document keys unchanged.
- Keep existing localStorage ownership semantics.
- Keep trainerPokemon identity semantics and accountIndex behavior.
- Do not migrate or reset existing user collection data.
- Keep staged catalog files as the source data until consumers are migrated and tested.

## phase 1: shared catalog service — completed

`core/catalog/catalog-service.js` provides cached JSON loading and the existing staged-catalog merge rules:

- Pokémon Collections: `pokemon-collections.json` + `pokemon-collections-21-40.json`, keyed by Pokémon name.
- AR: `ar.json` + `ar-supplement.json`, keyed by set code.
- Series: `series.json` + `series-legacy.json`, keyed by set code.

The registry, dashboard, and owner Sheets sync now consume this shared service.

## phase 2: consumer migration — completed

Catalog loading for the registry, dashboard, and owner Sheets sync uses the shared catalog service. Staged source paths no longer live independently in each consumer.

## phase 3: identity and account boundaries — completed

`core/catalog/card-identity.js` is the single source for collection account keys. Tests execute representative trainerPokemon, artist, series, and Pokémon identities and verify the exact legacy strings.

`core/account/firebase-account.js` centralizes owner detection, Firebase configuration checks, first-auth resolution, default base mode, and user collection document references without changing Firestore paths.

`core/catalog/card-lookup.js` centralizes card-code normalization, series-card lookup, official image candidate generation, and detached image probes with CDN fallback. National, People, and World consumers retain their prior legacy-series and timeout behavior through options.

## phase 4: cleanup — completed for shared collection logic

Duplicate catalog merge rules, card identity rules, account helpers, and representative-card lookup helpers have been removed from the migrated consumers. Compatibility and supplement modules remain in place where they still own page-specific behavior; they are not removed solely because they look redundant.

## verification

Run `npm test` before merge. Any failure involving collection identity, staged data, Firestore rules, Android contracts, or UI contracts blocks the merge.
