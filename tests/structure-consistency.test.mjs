import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const registry = read("collector-collection-registry.js");
const dashboard = read("dashboard.js");
const sheets = read("owner-sheets-sync.js");
const catalogService = read("core/catalog/catalog-service.js");
const identityService = read("core/catalog/card-identity.js");
const pageManager = read("firebase-page-manager.js");
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

test("shared catalog service is the single owner of staged catalog sources", () => {
  for (const path of [
    "pokemon-collections-21-40.json",
    "ar-supplement.json",
    "series-legacy.json",
  ]) {
    assert.match(catalogService, new RegExp(path.replace(".", "[.]")));
    for (const [name, source] of [
      ["registry", registry],
      ["dashboard", dashboard],
      ["owner sheets", sheets],
    ]) {
      assert.equal(source.includes(path), false, `${name}: ${path}`);
    }
  }
  assert.match(registry, /catalogService[.]pokemonCollections[(][)]/);
  assert.match(dashboard, /catalogService[.]pokemonCollections[(][)]/);
  assert.match(sheets, /catalogService[.]pokemonCollections[(][)]/);
  assert.match(registry, /catalogService[.]ar[(][)]/);
  assert.match(dashboard, /catalogService[.]ar[(][)]/);
  assert.match(sheets, /catalogService[.]ar[(][)]/);
  assert.match(registry, /catalogService[.]series[(][)]/);
});

test("collection identity semantics live in one shared helper", () => {
  assert.match(identityService, /const accountIndex = Number[.]isInteger\(card[?][.]accountIndex\)/);
  assert.match(identityService, /collectionId === "trainerPokemon"/);
  assert.match(identityService, /"trainerPokemon",\s*groupId,/s);
  for (const [name, source] of [
    ["registry", registry],
    ["dashboard", dashboard],
    ["owner sheets", sheets],
    ["page manager", pageManager],
  ]) {
    assert.match(source, /identityService[.]cardIdentity/, name);
  }
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
