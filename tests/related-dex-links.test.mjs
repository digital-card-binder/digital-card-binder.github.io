import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("related dex navigation is identity-only and never writes ownership", () => {
  const nav = read("collector-nav.js");
  const start = nav.indexOf("const RELATED_DEX_ORDER");
  const end = nav.indexOf("const UNIFIED_DEX_CONTROL_CONFIG", start);
  assert.ok(start >= 0 && end > start);
  const related = nav.slice(start, end);

  assert.match(related, /relatedCardReference/);
  assert.match(related, /fingerprint/);
  assert.match(related, /setCode/);
  assert.match(related, /cardNumber/);
  assert.match(related, /보유 상태는 각 도감에서 독립적으로 관리됩니다/);
  assert.doesNotMatch(related, /saveOwned|saveOverride|readCollectionDocument|overrides/);
});

test("related dex index covers card-based standalone dex destinations", () => {
  const nav = read("collector-nav.js");
  for (const id of [
    "series",
    "ar",
    "pokemon",
    "artist",
    "people",
    "trainerPokemon",
    "fossil",
    "world",
    "artThemes",
    "national",
  ]) {
    assert.match(nav, new RegExp(`"${id}"`), `${id}: related destination`);
  }

  for (const path of [
    "./data/artists.json",
    "./data/people.json",
    "./data/trainer-pokemon.json",
    "./data/fossil.json",
    "./data/art-themes.json",
    "./data/pokedex.json",
  ]) {
    assert.ok(nav.includes(path), path);
  }
  assert.match(nav, /catalog[.]pokemonCollections\(\)/);
  assert.match(nav, /catalog[.]ar\(\)/);
  assert.match(nav, /catalog[.]worldGroups\(\)/);
});

test("card detail clients request related dex links", () => {
  for (const path of [
    "catalog.js",
    "artists.js",
    "trainer-pokemon.js",
    "fossil.js",
    "art-themes.js",
    "world.js",
    "app.js",
    "pokemon-search.js",
  ]) {
    const source = read(path);
    assert.match(
      source,
      /DigitalCardBinder[?][.]relatedDex[?][.]render[?][.]\(/,
      `${path}: related dex renderer`,
    );
  }
});

test("related destinations restore their requested standalone group", () => {
  const artists = read("artists.js");
  const people = read("people.js");
  const trainer = read("trainer-pokemon.js");
  const fossil = read("fossil.js");
  const world = read("world.js");
  const catalog = read("catalog.js");
  const themes = read("art-themes.js");
  const national = read("app.js");

  assert.match(artists, /get\("artist"\)/);
  assert.match(people, /get\("person"\)/);
  assert.match(trainer, /get\("group"\)/);
  assert.match(fossil, /get\("set"\)/);
  assert.match(world, /get\("generation"\)/);
  assert.match(catalog, /get\("group"\)/);
  assert.match(themes, /get\("theme"\)/);
  assert.match(national, /get\("pokemon"\)/);
});

test("related dex links have compact mobile-safe styling", () => {
  const css = read("collector.css");
  assert.match(css, /[.]related-dex-links/);
  assert.match(css, /[.]related-dex-items/);
  assert.match(css, /[.]related-dex-link/);
  assert.match(css, /@media \(max-width: 690px\)[\s\S]*?[.]related-dex-items[\s\S]*?overflow-x: auto/);
});
