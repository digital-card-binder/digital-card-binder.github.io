import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("owner health dashboard is hidden from public navigation and exposed from owner settings", () => {
  const healthHtml = read("health.html");
  const settingsHtml = read("collector-settings.html");
  const settingsJs = read("collector-settings.js");
  const shell = read("scripts/sync-site-shell.mjs");
  const nav = read("collector-nav.js");

  assert.match(healthHtml, /<body data-page="health">/);
  assert.match(healthHtml, /id="health-access-gate"/);
  assert.match(healthHtml, /id="health-content" hidden/);
  assert.match(settingsHtml, /id="collector-owner-tools"[^>]*hidden/);
  assert.match(settingsHtml, /href="\.\/health\.html">도감 건강검진 열기<\/a>/);
  assert.match(settingsJs, /firebaseAccount\?\.isOwner\?\.\(CONFIG, currentUser\)/);
  assert.match(settingsJs, /elements\.ownerTools\.hidden = !owner/);
  assert.doesNotMatch(shell, /href: "\.\/health\.html"/);
  assert.match(nav, /"pokemon-search", "health"/);
});

test("health dashboard stays read-only and checks catalogs, images, account residues, and versions", () => {
  const health = read("health.js");

  assert.match(health, /registry\.COLLECTION_ORDER/);
  assert.match(health, /duplicateValues/);
  assert.match(health, /renderMismatch/);
  assert.match(health, /asset-sources\.json/);
  assert.match(health, /missingReferences/);
  assert.match(health, /archiveMissing/);
  assert.match(health, /source\.peopleOwned/);
  assert.match(health, /source\.ownedCodes/);
  assert.match(health, /source\.ownedPromoPackIds/);
  assert.match(health, /source\.overrides/);
  assert.match(health, /digitalCardBinderWorldExplorationOwnedV1/);
  assert.match(health, /site-version\.json/);
  assert.match(health, /app-version\.json/);
  assert.match(health, /imageCdn\?\.version/);
  assert.match(health, /accountService\.isOwner\(CONFIG, currentUser\)/);

  assert.doesNotMatch(
    health,
    /firestoreModule\.(?:setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction)\s*\(/,
  );
});

test("health page loads the shared catalog and owner-auth boundaries before its feature client", () => {
  const page = read("health.html");
  const required = [
    "card-image-cdn.js",
    "firebase-config.js",
    "core/catalog/catalog-service.js",
    "core/catalog/card-identity.js",
    "core/account/firebase-account.js",
    "collector-collection-registry.js",
    "collector-public-sync.js",
    "collector-nav.js",
    "health.js",
  ];
  let previous = -1;
  for (const asset of required) {
    const index = page.indexOf(asset);
    assert.ok(index > previous, `${asset} must load in dependency order`);
    previous = index;
  }
});
