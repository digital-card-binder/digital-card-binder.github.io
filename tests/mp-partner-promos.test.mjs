import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const catalogSource = await readFile(new URL("../core/catalog/catalog-service.js", import.meta.url), "utf8");
const identitySource = await readFile(new URL("../core/catalog/card-identity.js", import.meta.url), "utf8");
const source = await readFile(new URL("../collector-collection-registry.js", import.meta.url), "utf8");

function localPath(input) {
  return new URL(String(input).replace(/^\.\//, ""), root);
}

const context = {
  URL,
  Map,
  Set,
  Promise,
  console,
  document: { body: { dataset: {} } },
  location: { href: "https://digital-card-binder.github.io/", pathname: "/" },
  fetch: async (input) => {
    try {
      const body = await readFile(localPath(input), "utf8");
      return {
        ok: true,
        status: 200,
        text: async () => body,
        json: async () => JSON.parse(body),
      };
    } catch {
      return { ok: false, status: 404 };
    }
  },
};
context.window = {
  POKEMON_DEX_FIREBASE: {
    userDocument: "nationalDex",
  },
  location: context.location,
};
vm.createContext(context);
vm.runInContext(catalogSource, context);
vm.runInContext(identitySource, context);
vm.runInContext(source, context);
const registry = context.window.CollectorCollectionRegistry;

const oldEnergy = [["058", "GRA", 57, 65], ["059", "FIR", 58, 66], ["060", "WAT", 59, 67]];
const catalog = await registry.loadCatalog("series");
const resolve = (overrides) => registry.resolveOverrides("series", catalog, overrides);
const owned = (result) => Object.entries(result.effectiveOverrides).filter(([, v]) => v.owned).map(([k]) => k).sort();

test("old 058-060 energy records move to GRA/FIR/WAT and never to the Kanto starters", () => {
  for (const [number, token, oldIndex, index] of oldEnergy) {
    const stored = { [`M-P::m-p_${number}/M-P::${oldIndex}`]: { owned: true } };
    const snapshot = JSON.stringify(stored);
    assert.deepEqual(owned(resolve(stored)), [`M-P::m-p_${token}::${index}`]);
    assert.equal(JSON.stringify(stored), snapshot);
  }
});

test("existing M-P ownership keys stay exactly as they were", () => {
  const keys = ["M-P::m-p_001/M-P::0", "M-P::m-p_057/M-P::56", "M-P::m-p_085/M-P::60", "M-P::m-p_502/M-P::64", "M-P::m-p_WAT::67"];
  const result = resolve(Object.fromEntries(keys.map((key) => [key, { owned: true }])));
  assert.deepEqual(owned(result), [...keys].sort());
  assert.equal(result.orphanKeys.length, 0);
});

test("two old records for one energy keep the owned one; a newer save wins", () => {
  const both = { "M-P::m-p_GRA/M-P::68": { owned: false }, "M-P::m-p_058/M-P::57": { owned: true } };
  assert.deepEqual(owned(resolve(both)), ["M-P::m-p_GRA::65"]);
  assert.deepEqual(owned(resolve({ ...both, "M-P::m-p_GRA::65": { owned: false } })), []);
});

test("nine partner card sets are separate dexes with three cards each", () => {
  const sets = catalog.groups.filter((group) => /^30th-[1-9]$/.test(group.key));
  assert.equal(sets.length, 9);
  assert.ok(sets.every((group) => group.itemKeys.length === 3));
  assert.match(catalog.groups.find((group) => group.key === "30th-1").name, /이상해씨・파이리・꼬부기/);
  const numbers = sets.flatMap((group) => group.itemKeys).map((key) => Number(key.match(/m-p_(\d{3})/)[1])).sort((x, y) => x - y);
  assert.equal([...numbers].join(), Array.from({ length: 27 }, (_, i) => 58 + i).join());
  assert.ok(!catalog.items.some((item) => /^M-P::m-p_(0(5[89]|[67]\d|8[0-4]))/.test(item.key)));
});

test("custom dexes keep resolving cards saved with an old code", async () => {
  for (const file of ["custom.js", "custom-public.js"]) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(text, /for \(const legacyCode of card\.legacyCodes \|\| \[\]\)/, file);
  }
});
