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

## phase 1: shared catalog service

`core/catalog/catalog-service.js` provides cached JSON loading and the two existing staged-catalog merge rules:

- Pokémon Collections: `pokemon-collections.json` + `pokemon-collections-21-40.json`, keyed by Pokémon name.
- AR: `ar.json` + `ar-supplement.json`, keyed by set code.

This is intentionally additive. Existing consumers are not switched in the same change.

## phase 2: consumer migration

Migrate one consumer at a time, beginning with the registry. Compare output against the current implementation before removing duplicated loaders.

## phase 3: identity boundary

Centralize card identity helpers only after tests prove that existing Firestore account keys resolve to the same identifiers.

## phase 4: cleanup

After compatibility is demonstrated, consolidate permanent behavior from compatibility/fix/supplement modules into their owning modules. Do not delete compatibility code solely because it looks redundant.

## verification

Run `npm test` before merge. Any failure involving collection identity, staged data, Firestore rules, Android contracts, or UI contracts blocks the merge.
