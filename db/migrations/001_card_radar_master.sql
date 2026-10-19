-- Card Radar master database v1. PostgreSQL 15+.
-- Run through a privileged migration after an independent database is provisioned.
-- This file does not run on GitHub Pages and does not create a hosted database.
BEGIN;
CREATE SCHEMA IF NOT EXISTS radar;

CREATE TABLE IF NOT EXISTS radar.retailers (
  retailer_id TEXT PRIMARY KEY CHECK (retailer_id ~ '^[a-z0-9_-]{2,32}$'),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  kind TEXT NOT NULL CHECK (kind IN ('convenience','mart','cardshop')),
  adapter_state TEXT NOT NULL CHECK (adapter_state IN
    ('public_rest','session_required','product_code_required','not_connected','official_licensed')),
  permission_status TEXT NOT NULL DEFAULT 'unverified' CHECK (permission_status IN ('unverified','approved','revoked')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS radar.card_sets (
  set_id TEXT PRIMARY KEY CHECK (set_id ~ '^[a-z0-9+_-]{1,35}$'),
  set_code TEXT NOT NULL,
  series TEXT NOT NULL,
  title TEXT NOT NULL,
  catalog_source TEXT NOT NULL DEFAULT 'packs.js',
  UNIQUE (series, set_code)
);
CREATE TABLE IF NOT EXISTS radar.products (
  product_id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES radar.card_sets(set_id),
  title TEXT NOT NULL,
  package_type TEXT NOT NULL CHECK
    (package_type IN ('booster_pack','booster_box','starter_deck','starter_set','other_card_product')),
  identity_status TEXT NOT NULL DEFAULT 'internal_catalog_only'
    CHECK (identity_status IN ('internal_catalog_only','retailer_verified')),
  provenance TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS radar.stores (
  store_id TEXT PRIMARY KEY,
  retailer_id TEXT NOT NULL REFERENCES radar.retailers(retailer_id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('convenience','mart','cardshop')),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  address TEXT,
  verified_location_source TEXT,
  location_status TEXT NOT NULL CHECK (location_status IN ('verified','candidate','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_radar_stores_geo ON radar.stores(latitude,longitude);
CREATE INDEX IF NOT EXISTS idx_radar_stores_retailer ON radar.stores(retailer_id,location_status);

-- Never guess a match purely from the store name. Provider IDs must map deliberately.
CREATE TABLE IF NOT EXISTS radar.store_aliases (
  retailer_id TEXT NOT NULL REFERENCES radar.retailers(retailer_id),
  provider_store_id TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES radar.stores(store_id),
  verified_source TEXT NOT NULL,
  PRIMARY KEY (retailer_id, provider_store_id)
);
CREATE TABLE IF NOT EXISTS radar.retailer_skus (
  retailer_id TEXT NOT NULL REFERENCES radar.retailers(retailer_id),
  retailer_item_code TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES radar.products(product_id),
  verified_source TEXT NOT NULL,
  identity_verified_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (retailer_id, retailer_item_code)
);
CREATE INDEX IF NOT EXISTS idx_radar_sku_product ON radar.retailer_skus(product_id);

CREATE TABLE IF NOT EXISTS radar.data_sources (
  source_id TEXT PRIMARY KEY,
  retailer_id TEXT NOT NULL REFERENCES radar.retailers(retailer_id),
  mode TEXT NOT NULL CHECK (mode IN ('official_partner','authorized_vendor','community_api','store_direct')),
  permission_status TEXT NOT NULL CHECK (permission_status IN ('unverified','approved','revoked')),
  license_reference TEXT,
  fetched_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (permission_status <> 'approved' OR length(coalesce(license_reference,'')) >= 8)
);

-- Observations are immutable events, never rewritten into an invented "current stock".
-- Unknown / failed lookups are distinct from genuine 0 and must have NULL quantity.
CREATE TABLE IF NOT EXISTS radar.inventory_observations (
  observation_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES radar.data_sources(source_id),
  retailer_id TEXT NOT NULL,
  provider_store_id TEXT NOT NULL,
  retailer_item_code TEXT NOT NULL,
  stock_status TEXT NOT NULL CHECK
    (stock_status IN ('in_stock','out_of_stock','unknown','request_failed')),
  quantity INTEGER CHECK (quantity >= 0),
  source_observed_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  FOREIGN KEY (retailer_id,provider_store_id)
    REFERENCES radar.store_aliases(retailer_id,provider_store_id),
  FOREIGN KEY (retailer_id,retailer_item_code)
    REFERENCES radar.retailer_skus(retailer_id,retailer_item_code),
  CHECK (
    (stock_status='in_stock' AND quantity > 0 AND source_observed_at IS NOT NULL)
    OR (stock_status='out_of_stock' AND quantity=0 AND source_observed_at IS NOT NULL)
    OR (stock_status IN ('unknown','request_failed') AND quantity IS NULL)
  ),
  CHECK (expires_at IS NULL OR source_observed_at IS NULL OR expires_at > source_observed_at)
);
CREATE INDEX IF NOT EXISTS idx_radar_stock_latest
  ON radar.inventory_observations(retailer_id,provider_store_id,retailer_item_code,source_observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_stock_expiry ON radar.inventory_observations(expires_at);

-- Read-only projection: latest observations from APPROVED sources with freshness.
-- This is not an authorization shortcut: server-side writer must verify rights.
CREATE OR REPLACE VIEW radar.current_confirmed_inventory AS
WITH ranked AS (
  SELECT o.*,
     row_number() OVER (PARTITION BY o.retailer_id,o.provider_store_id,o.retailer_item_code
                        ORDER BY o.source_observed_at DESC NULLS LAST,o.ingested_at DESC) AS rn
  FROM radar.inventory_observations o
  JOIN radar.data_sources d ON d.source_id=o.source_id
  WHERE d.permission_status='approved'
    AND o.source_observed_at >= now() - interval '15 minutes'
    AND o.source_observed_at <= now() + interval '1 minute'
    AND o.expires_at > now()
)
SELECT * FROM ranked WHERE rn=1 AND stock_status IN ('in_stock','out_of_stock');

COMMIT;
