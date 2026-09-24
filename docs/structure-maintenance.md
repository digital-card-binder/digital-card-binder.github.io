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

- `planner.html` is the signed-in collection planning surface for missing cards, wishlist, trade-ready cards, duplicate quantities, and history.
- Planner metadata lives under `pokemonCollectionsDex.plannerV1`; history lives under `pokemonCollectionsDex.historyV1`. Both are merged into the existing document and must not replace ownership overrides or custom dex data.
- `collection-history.js` listens to the existing `pokemon-dex:collection-changed` event and queues history locally before flushing it to Firestore, so reload-based editors do not lose the event.
- The trade-draft handoff reuses the existing card-only trade workflow and never changes collection ownership automatically.

## Official update watch

- `.github/workflows/watch-official-card-updates.yml` runs once per day and performs a single request to the official Pokemon Korea product page.
- `scripts/check-official-card-updates.mjs` compares official expansion-product names with the local canonical series catalog and `data/update-watch.json`.
- The watcher never edits canonical card catalogs. It changes only `data/update-watch.json` when the review state changes, so new cards still require human validation before catalog insertion.

## Owner operations and backup

- `operations.html` is owner-only and combines the update-watch state, health dashboard link, and backup/restore tools.
- Backup format `digital-card-binder-backup-v1` contains the seven existing account collection documents plus browser-local world-exploration state. Profile identity, nickname reservations, public projections, and trade data are intentionally excluded.
- Restore may write only those seven supported account documents for the currently signed-in owner and must overwrite email/display name/base mode with the current account-safe values.

## Owner health dashboard

- `health.html` is an owner-only operational view linked from profile settings only for the configured owner account.
- The dashboard is read-only. It checks catalog counts, duplicate identities, catalog/render drift, missing or unroutable card-image references, Cloudflare image archive membership, orphaned ownership keys, and current site/app/CDN versions.
- Static catalog checks must use the same shared registry/catalog services as the public site. Account checks may read the signed-in owner's existing collection documents but must never mutate ownership data.
- The health route must not be added to the public collection navigation.

## Automatic cache versioning

- Do not manually edit `?v=...` values, `site-version.json`, `SITE_BUILD_VERSION`, or the service-worker cache token.
- `npm run versions:sync` derives JS/CSS cache tokens from file contents and synchronizes all root HTML pages, `collector-nav.js`, `pwa.js`, and `site-version.json`.
- `npm run versions:check` is part of `npm test` and fails if generated versions are stale.
- Run `npm run site:prepare` before committing shared shell, search-index, or cache-version changes. Verify is read-only, and `npm test` fails when generated artifacts are stale.

## Repository hygiene

- Do not commit `.tmp-*` trigger files.
- Keep only the live root `DigitalCardBinder_v0.9.apk`; old build outputs belong in GitHub Actions artifacts/releases, not duplicate repository paths.
- Do not introduce runtime `*-fix.js`, `*-supplement.js`, or `*-fallback.js` files for permanent behavior. Stable behavior belongs in the owning module; staged card data belongs in canonical or explicitly staged data files.


## Retired transitional runtime patches

The former AR count/view patch, AR MEGA compatibility shim, MEGA series fetch patch, latest-MEGA runtime dataset, and owner-header fallback were consolidated into their owning modules/data. Do not reintroduce global `window.fetch` interception for catalog corrections.
