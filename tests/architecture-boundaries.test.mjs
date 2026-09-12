import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shared catalog service preserves staged catalog sources", () => {
  const source = read("core/catalog/catalog-service.js");
  assert.match(source, /pokemon-collections-21-40[.]json/);
  assert.match(source, /ar-supplement[.]json/);
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
