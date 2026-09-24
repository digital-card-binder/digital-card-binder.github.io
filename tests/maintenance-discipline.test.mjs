import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

function gitBlobVersion(source) {
  const body = Buffer.from(source, "utf8");
  return createHash("sha1")
    .update(Buffer.from(`blob ${body.length}\0`, "utf8"))
    .update(body)
    .digest("hex")
    .slice(0, 12);
}

test("site preparation is explicit and verification never mutates branches", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["site:prepare"], "npm run search-index:sync && npm run shell:sync && npm run versions:sync");
  assert.equal(pkg.scripts["site:check"], "npm run search-index:check && npm run shell:check && npm run versions:check");
  assert.match(pkg.scripts.test, /^npm run site:check && /);

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
  assert.ok(sync.includes('const EXTRA_ASSETS = Object.freeze(["trade-offer.js"]);'));
  assert.ok(sync.includes("for (const asset of EXTRA_ASSETS) assets.add(asset);"));
  assert.equal(manifest.assets["trade-offer.js"], gitBlobVersion(read("trade-offer.js")));
});
