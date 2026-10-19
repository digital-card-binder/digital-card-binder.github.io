# Card Radar — one-time fixed-data initialization

This is an intentionally constrained one-time operation for the Firebase **separate Spark project** `digital-card-radar-db`, Firestore database `(default)`.

## Purpose

The Vercel API already authenticates to the new empty Firestore, so `/api/v1/health` returns `dbStatus:"not_seeded"`. This initialization registers ONLY the reviewed baseline identity records:

- 151 card sets (existing pack catalog)
- 10 retailer definitions (connection statuses remain **unverified**)
- 2 internal product concepts (no retailer SKUs)
- 1 validated store location (no measured stock)
- 1 marker `radarSystem/status`

There are **no product quantities, bearer tokens, credentials, user records, retailer access rights or invented merchant IDs** inside the bundled seed.

## Safety mechanics

- The backend will NOT seed unless the administrator explicitly sets `RADAR_BOOTSTRAP_ONCE=yes` **in the Production Vercel project environment** and deploys that environment configuration.
- It further refuses execution unless `GOOGLE_CLOUD_PROJECT=digital-card-radar-db` and `RADAR_FIRESTORE_DATABASE=(default)`.
- An atomic Firestore transaction reads `radarSystem/status`; only if missing does it **create** the 165 fixed documents. Existing records are not overwritten, and a second invocation is a no-op.
- The API is **not a general write or upload endpoint**. During the temporary flag interval, any GET of the health endpoint may trigger the same *fixed* one-time initialization. After success, remove `RADAR_BOOTSTRAP_ONCE` from Vercel, redeploy, and verify connected status.
- On a failure, the error is logged server-side, not returned with any credentials.

## Steps

1. Merge tested GitHub code into `main`; verify corresponding Vercel production deployment is Ready.
2. In Vercel Project Settings → Production Environment Variables, temporarily set `RADAR_BOOTSTRAP_ONCE=yes` (not a credential), then redeploy to load that flag. Do not reveal or change `RADAR_SERVICE_ACCOUNT_JSON`.
3. Request `https://digital-card-radar-api.vercel.app/api/v1/health` once, expect `{"dbStatus":"connected"}`. If it stays unavailable/not_seeded, examine Vercel runtime logs.
4. Remove the flag, redeploy again. Confirm health remains connected.
5. Check a geo lookup around verified Sokcho location: `/api/v1/stores?lat=38.191&lng=128.596&radiusKm=3`, expect the location with `stockStatus:"unknown"` and `items:[]`. This only confirms initial catalog, **not** retailer stock live integration.

## Boundaries

The existing collector Firebase `pokemon-dex-40e92` is forbidden at code level and is not migrated or modified. The previous client-side Card Radar remains unchanged.

The temporary initializer is only for the immutable v1 baseline, not future product additions. Future updates should be reviewed, authenticated admin migrations with a separate audit trail.
