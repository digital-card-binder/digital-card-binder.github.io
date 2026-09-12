import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../core/catalog/catalog-service.js", import.meta.url),
  "utf8",
);

const pokemon = JSON.parse(
  readFileSync(new URL("../data/pokemon-collections.json", import.meta.url), "utf8"),
);
const pokemonSupplement = JSON.parse(
  readFileSync(
    new URL("../data/pokemon-collections-21-40.json", import.meta.url),
    "utf8",
  ),
);
const ar = JSON.parse(
  readFileSync(new URL("../data/ar.json", import.meta.url), "utf8"),
);
const arSupplement = JSON.parse(
  readFileSync(new URL("../data/ar-supplement.json", import.meta.url), "utf8"),
);

function mergedByKey(base, supplement, key) {
  const merged = new Map();
  for (const group of [...base, ...supplement]) {
    const value = String(group?.[key] ?? "").trim().toLowerCase();
    if (value) merged.set(value, group);
  }
  return [...merged.values()];
}

test("shared catalog service reads staged pokemon collection arrays directly", () => {
  assert.match(source, /json\("\.\/data\/pokemon-collections\.json"\)/);
  assert.match(source, /json\("\.\/data\/pokemon-collections-21-40\.json"\)/);
  assert.match(source, /mergeGroups\(base, supplement, "name"\)/);
  assert.ok(Array.isArray(pokemon));
  assert.ok(Array.isArray(pokemonSupplement));
  assert.equal(mergedByKey(pokemon, pokemonSupplement, "name").length, 67);
});

test("shared catalog service reads staged AR arrays directly", () => {
  assert.match(source, /json\("\.\/data\/ar\.json"\)/);
  assert.match(source, /json\("\.\/data\/ar-supplement\.json"\)/);
  assert.match(source, /mergeGroups\(base, supplement, "code"\)/);
  assert.ok(Array.isArray(ar));
  assert.ok(Array.isArray(arSupplement));
  assert.equal(mergedByKey(ar, arSupplement, "code").length, 510);
});

test("shared catalog service keeps path-level promise caching", () => {
  assert.match(source, /if \(!cache\.has\(path\)\) cache\.set\(path, fetchJson\(path\)\)/);
});
