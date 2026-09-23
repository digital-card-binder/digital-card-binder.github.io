import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shared catalog service preserves staged catalog sources", () => {
  const source = read("core/catalog/catalog-service.js");
  assert.match(source, /pokemon-collections-21-40[.]json/);
  assert.match(source, /ar-supplement[.]json/);
  assert.match(source, /series-legacy[.]json/);
  assert.match(source, /function asGroups\(payload/);
  assert.match(source, /async function series\(\)/);
});

test("shared catalog service caches JSON requests", () => {
  const source = read("core/catalog/catalog-service.js");
  assert.match(source, /const cache = new Map\(\)/);
  assert.match(source, /cache[.]set\(path, fetchJson\(path\)\)/);
});

test("refactor plan forbids data and URL migrations", () => {
  const source = read("docs/architecture-refactor-plan.md");
  assert.match(source, /Keep existing page URLs/);
  assert.match(source, /Do not migrate or reset existing user collection data/);
  assert.match(source, /trainerPokemon identity semantics/);
});

test("shared identity helper returns the exact legacy Firestore keys", () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read("core/catalog/card-identity.js"), context);
  const identity = context.window.DigitalCardBinder.cardIdentity;

  assert.equal(
    identity.cardIdentity(
      "trainerPokemon",
      { code: "red" },
      { meta: "001/100", accountIndex: 7 },
      0,
      2,
    ),
    "trainerPokemon::red::001/100::7",
  );
  assert.equal(
    identity.cardIdentity(
      "artist",
      { name: "OKACHEKE" },
      { set: "SV1S", cardNumber: "079/078", order: 12 },
      0,
      3,
    ),
    "OKACHEKE::SV1S::079/078::12",
  );
  assert.equal(
    identity.cardIdentity(
      "series",
      { code: "sv1S" },
      { code: "sv1S_079/078", accountIndex: 22 },
      0,
      4,
    ),
    "sv1S::sv1S_079/078::22",
  );
  assert.equal(
    identity.cardIdentity(
      "pokemon",
      { name: "피카츄" },
      { meta: "025/100 · R", accountIndex: 5 },
      0,
      1,
    ),
    "피카츄::025/100 · R::5",
  );
});

test("shared Firebase account helper keeps existing document path semantics", () => {
  const source = read("core/account/firebase-account.js");
  assert.match(source, /config[?][.]userCollection \|\| "collections"/);
  assert.match(source, /return isOwner\(config, user\) \? "legacy" : "empty"/);
  assert.match(source, /onAuthStateChanged/);
});

test("shared card lookup owns CDN-safe detached image probes", () => {
  const source = read("core/catalog/card-lookup.js");
  assert.match(source, /DigitalCardBinderImageCdn[?][.]restoreOriginal/);
  assert.match(source, /includeLegacy !== false/);
  assert.match(source, /series-legacy[.]json/);
});
