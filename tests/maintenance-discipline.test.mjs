import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

function gitBlobVersion(source) {
  const body = Buffer.from(source.replace(/\r\n/g, "\n"), "utf8");
  return createHash("sha1")
    .update(Buffer.from(`blob ${body.length}\0`, "utf8"))
    .update(body)
    .digest("hex")
    .slice(0, 12);
}

test("site preparation is explicit and verification never mutates branches", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["site:prepare"], "npm run series-inventory:sync && npm run master-db-audit:sync && npm run downstream-sync:sync && npm run related-dex:sync && npm run search-index:sync && npm run catalog-metrics:sync && npm run shell:sync && npm run versions:sync");
  assert.equal(pkg.scripts["site:check"], "npm run series-inventory:check && npm run master-db-audit:check && npm run downstream-sync:check && npm run related-dex:check && npm run search-index:check && npm run catalog-metrics:check && npm run shell:check && npm run versions:check");
  assert.match(pkg.scripts.test, /^npm run site:check && /);
  assert.equal(pkg.scripts["series-inventory:sync"], "node scripts/audit-series-inventory.mjs");
  assert.equal(pkg.scripts["series-inventory:check"], "node scripts/audit-series-inventory.mjs --check");
  assert.equal(pkg.scripts["master-db-audit:sync"], "node scripts/audit-master-card-db.mjs");
  assert.equal(pkg.scripts["master-db-audit:check"], "node scripts/audit-master-card-db.mjs --check");
  assert.equal(pkg.scripts["downstream-sync:sync"], "node scripts/audit-m6a-downstream-sync.mjs");
  assert.equal(pkg.scripts["downstream-sync:check"], "node scripts/audit-m6a-downstream-sync.mjs --check");
  assert.equal(pkg.scripts["related-dex:sync"], "node scripts/build-related-dex-index.mjs");
  assert.equal(pkg.scripts["related-dex:check"], "node scripts/build-related-dex-index.mjs --check");
  assert.equal(pkg.scripts["catalog-metrics:sync"], "node scripts/sync-catalog-metrics.mjs");
  assert.equal(pkg.scripts["catalog-metrics:check"], "node scripts/sync-catalog-metrics.mjs --check");

  const workflow = read(".github/workflows/verify.yml");
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /git\s+(?:push|commit)/);
  assert.match(workflow, /run:\s*npm test/);
});

test("PWA service-worker registration has a single owner", () => {
  const owners = readdirSync(root)
    .filter((name) => name.endsWith(".js"))
    .filter((name) => read(name).includes("navigator.serviceWorker.register"))
    .sort();
  assert.deepEqual(owners, ["pwa.js"]);
});

test("dynamic trade helper follows centralized build versioning", () => {
  const nav = read("collector-nav.js");
  const sync = read("scripts/sync-site-versions.mjs");
  const manifest = JSON.parse(read("site-version.json"));

  assert.match(nav, /trade-offer[.]js[?]v=[$][{]SITE_BUILD_VERSION[}]/);
  assert.doesNotMatch(nav, /20260821-4/);
  assert.match(sync, /EXTRA_ASSETS[\s\S]*trade-offer[.]js/);
  assert.doesNotMatch(sync, /collection-history[.]js/);
  assert.ok(sync.includes("for (const asset of EXTRA_ASSETS) assets.add(asset);"));
  assert.equal(manifest.assets["trade-offer.js"], gitBlobVersion(read("trade-offer.js")));
  assert.equal(manifest.assets["collection-history.js"], undefined);
  assert.doesNotMatch(nav, /collection-history[.]js/);
});
