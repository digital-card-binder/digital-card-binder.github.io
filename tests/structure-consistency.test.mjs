import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const registry = read("collector-collection-registry.js");
const dashboard = read("dashboard.js");
const sheets = read("owner-sheets-sync.js");
const verify = read(".github/workflows/verify.yml");

const htmlFiles = [
  "index.html",
  "national.html",
  "packs.html",
  "artists.html",
  "series.html",
  "pokemon-collections.html",
  "ar.html",
  "people.html",
  "trainer-pokemon.html",
  "world.html",
  "custom.html",
  "collector-settings.html",
];

test("all consumers include staged Pokemon collection data", () => {
  for (const [name, source] of [
    ["registry", registry],
    ["dashboard", dashboard],
    ["owner sheets", sheets],
  ]) {
    assert.match(source, /pokemon-collections-21-40[.]json/, name);
  }
});

test("dashboard and owner sheets include AR supplement data", () => {
  assert.match(dashboard, /ar-supplement[.]json/);
  assert.match(sheets, /ar-supplement[.]json/);
});

test("dashboard identity uses accountIndex and trainerPokemon namespace", () => {
  assert.match(dashboard, /const accountIndex = Number[.]isInteger\(card[.]accountIndex\)/);
  assert.match(dashboard, /"trainerPokemon",\s*groupId,/s);
  assert.match(dashboard, /card[.]meta \|\| card[.]code \|\| card[.]name \|\| cardIndex,\s*accountIndex,/s);
});

test("main pushes run the verification suite", () => {
  assert.match(verify, /push:\s*branches:\s*- main/s);
});

test("static navigation does not ship known stale collection counts", () => {
  for (const file of htmlFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /29 ARTISTS/, file);
    assert.doesNotMatch(source, /SV · M · 498 CARDS/, file);
    assert.doesNotMatch(source, /1025 POKÉMON/, file);
  }
});
