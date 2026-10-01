# Structure maintenance guide

This repository intentionally preserves existing Firestore documents and collection keys.
Structural cleanup must not migrate or reset user collection data unless a separate migration is explicitly designed and tested.

## Canonical catalog rules

- AR counts populated sets (33); the empty sv8a option stays available without counting as a populated set. The effective catalog is `data/ar.json` plus `data/ar-supplement.json`, merged by set code. All dashboard, public summary, page and owner-Sheets consumers must see the same effective catalog.
- Pokemon collections: the effective populated catalog is `data/pokemon-collections.json` plus `data/pokemon-collections-21-40.json`, merged by Pokemon name. Counts must be read from the generated catalog metrics rather than duplicated in documentation or UI.
- Trainer x Pokemon: account keys are namespaced with `trainerPokemon::` and use `accountIndex` when present.
- Custom dex: stored under `pokemonCollectionsDex.customDexes`. `custom-sharing.js` remains a compatibility extension and must load before dashboard/settings consumers that need the custom registry entry.
- World exploration: the independent `worldDex` stores 198 place/Pokemon/person keys. Only reference names/images come from National/People; ownership stays independent. Guest local records remain intact. Account caches and migration markers are UID-scoped, failed transfers remain retryable, and public views never read/write visitor overrides. `catalogService.worldGroups()` supplies registry, world, search and Studio metadata.

## Canonical catalog metrics

- `scripts/sync-catalog-metrics.mjs` derives collection counts from the canonical catalog sources and writes the generated block in `core/catalog/catalog-service.js`.
- The generated metrics cover National, Series, AR, Packs, Pokemon Collections, Artists, People, Trainer × Pokemon, Fossil, and World Exploration.
- `collector-collection-registry.js` must read public summary counts from `catalogService.catalogMetrics`; do not hard-code card/group totals in registry metadata.
- Run `npm run catalog-metrics:sync` after canonical catalog changes. `npm run catalog-metrics:check` is part of `npm run site:check`.
- Visible page/menu counts will be migrated to the same metrics in the UI synchronization phase; canonical data remains the source of truth.

## Deployment safety

- `backup/pre-structure-cleanup-20260903` is the immutable pre-cleanup rollback reference.
- Feature work should use a branch and pull request.
- `npm test` must pass before merge.
- The Verify workflow runs for pull requests and direct pushes to `main`.

## Shared site shell

- The shared brand header, collection navigation, and legal footer are generated from `scripts/sync-site-shell.mjs`.
- Page-specific header chips, sidebar notes, footer notes, and all main content remain owned by each page.
- `privacy.html` and `terms.html` intentionally keep their no-sidebar layout; `base-series.html` remains a redirect/compatibility page.
- Do not hand-edit the shared navigation or shared legal footer in individual HTML files. Use `npm run shell:sync`.
- `npm run shell:check` runs before the rest of the test suite.

## Lightweight search data

- `data/pokemon-search-index.json` is generated from the canonical series, legacy-series, Pokedex, artist and trainer/Pokemon sources.
- The search page loads this compact index instead of loading the full source catalogs at runtime.
- Search index v2 preserves series group/card order, `accountIndex`, baseline ownership and card identity while adding searchable rarity, illustrator and trainer metadata by stable set/card-number fingerprint.
- Unified search supports card/Pokemon name, card number, set, illustrator, trainer and rarity scopes. Exact Pokemon-name matching keeps the existing longer-name collision guard.
- Official Pokemon Korea image URLs are stored as compact paths and expanded in the search client.
- Do not hand-edit the generated index. Use `npm run search-index:sync`; `npm run search-index:check` is part of `npm test`.

## Collection planning and history

- The planning panel embedded in `collector-settings.html` is the signed-in collection planning surface for missing cards, wishlist, trade-ready cards, duplicate quantities, and history.
- Planner metadata lives under `pokemonCollectionsDex.plannerV1`; history lives under `pokemonCollectionsDex.historyV1`. Both are merged into the existing document and must not replace ownership overrides or custom dex data.
- `collection-history.js` listens to the existing `pokemon-dex:collection-changed` event and queues history locally before flushing it to Firestore, so reload-based editors do not lose the event.
- The trade-draft handoff reuses the existing card-only trade workflow and never changes collection ownership automatically.

## Official update watch

- `.github/workflows/watch-official-card-updates.yml` runs once per day and performs a single request to the official Pokemon Korea product page.
- `scripts/check-official-card-updates.mjs` compares official expansion-product names with the local canonical series catalog and `data/update-watch.json`.
- The watcher never edits canonical card catalogs. It changes only `data/update-watch.json` when the review state changes, so new cards still require human validation before catalog insertion.

## Owner operations and backup

- `operations.html` is owner-only and combines the update-watch state, health dashboard link, and backup/restore tools.
- Backup-v2 contains eight account collection documents including `worldDex`, additive large-catalog `overrideShards`, local world state, and customBinders metadata with active image chunks. Backup-v1 remains readable. Profile identity, nickname reservations, public projections and trade data are excluded.
- Restore first validates every payload, decoded chunk size, grid/background, and final write budget. It stages fresh background chunk sets without deleting originals, then atomically publishes collection/shard changes and binder metadata. Only backed-up values are applied; later entries stay intact. Email/display name/base mode use the current account-safe values.

## Owner health dashboard

- `health.html` is an owner-only operational view linked from profile settings only for the configured owner account.
- The dashboard is read-only. It checks catalog counts, duplicate identities, catalog/render drift, missing or unroutable card-image references, Cloudflare image archive membership, disconnected ownership records, and current site/app/CDN versions.
- Static catalog checks must use the same shared registry/catalog services as the public site. Account checks may read the signed-in owner's existing collection documents but must never mutate ownership data.
- The owner dashboard must explain what each issue means and generate a copyable Korean ChatGPT repair prompt. Prompts must explicitly prohibit automatic deletion/reset of user ownership data and require root-cause analysis first.
- Shared Firestore documents must be audited against the union of all catalogs that legitimately share that document. In particular, pokemonCollectionsDex includes Pokemon collections, Trainer × Pokemon, and Fossil ownership keys and must not flag one catalog's valid keys as disconnected records for another.
- The health route must not be added to the public collection navigation.

## Series master inventory baseline

- `data/series-inventory-audit.json` is the deterministic baseline for the merged series catalog (`data/series.json` + `data/series-legacy.json`).
- Run `npm run series-inventory:sync` after any series-data change. `npm run site:check` verifies that the audit stays synchronized.
- The audit records total sets/cards, era and set counts, duplicate identities, metadata coverage, and image/source-host coverage. It does not alter ownership, card records, or Firestore data.
- Treat the audit as a quantity/integrity baseline, not proof that every Korean card ever released is present. Official Pokemon Korea reconciliation is a separate validation step.

## Automatic cache versioning

- Do not manually edit `?v=...` values, `site-version.json`, `SITE_BUILD_VERSION`, or the service-worker cache token.
- `npm run versions:sync` derives JS/CSS cache tokens from file contents and synchronizes all root HTML pages, `collector-nav.js`, `pwa.js`, and `site-version.json`.
- `npm run versions:check` is part of `npm test` and fails if generated versions are stale.
- Run `npm run site:prepare` before committing shared shell, search-index, or cache-version changes. Verify is read-only, and `npm test` fails when generated artifacts are stale.

## Repository hygiene

- Do not commit `.tmp-*` trigger files.
- Keep only the live root `DigitalCardBinder_v1.0.apk`; old build outputs belong in GitHub Actions artifacts/releases, not duplicate repository paths.
- Do not introduce runtime `*-fix.js`, `*-supplement.js`, or `*-fallback.js` files for permanent behavior. Stable behavior belongs in the owning module; staged card data belongs in canonical or explicitly staged data files.


## Retired transitional runtime patches

The former AR count/view patch, AR MEGA compatibility shim, MEGA series fetch patch, latest-MEGA runtime dataset, and owner-header fallback were consolidated into their owning modules/data. Do not reintroduce global `window.fetch` interception for catalog corrections.

## Additive large-catalog ownership

- New Series/AR changes write one entry to `users/{uid}/collections/{seriesDex|arDex}/overrideShards/s00..s7f` (128 deterministic buckets). Existing root overrides and keys are never migrated, compacted or deleted.
- `firebaseAccount.readCollectionSnapshot` merges legacy root records and shards; timestamp precedence also tolerates writes from an older tab. All private/public/settings/Studio/search/health/shared-view consumers must use this read path. Dashboard subscriptions watch both root and shard changes.
- Backup includes raw shards; restore puts backed-up overrides into the same bounded storage without enlarging the legacy root document.
- Deploy the compatible Rules before enabling shard writes in the web client.
- Dynamic custom modules and the pack print helper have content-derived tokens generated by versions:sync; global fetch/DOM catalog correction patches are prohibited.
