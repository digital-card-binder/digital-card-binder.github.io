import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const registry = read("collector-collection-registry.js");
const maintenance = read("docs/structure-maintenance.md");
const architecture = read("docs/architecture.md");

const htmlFiles = readdirSync(new URL("../", import.meta.url))
  .filter((file) => file.endsWith(".html"));

test("architecture guide documents the protected layers", () => {
  for (const heading of [
    "## Layers",
    "### 1. Catalog layer",
    "### 2. Collection/service layer",
    "### 3. Feature layer",
    "### 4. Presentation layer",
    "### 5. User-data layer",
  ]) {
    assert.match(architecture, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("canonical composed catalogs are documented", () => {
  assert.match(architecture, /AR = `data\/ar\.json` \+ `data\/ar-supplement\.json`/);
  assert.match(architecture, /Pokémon collections = `data\/pokemon-collections\.json` \+ `data\/pokemon-collections-21-40\.json`/);
  assert.match(maintenance, /effective catalog is `data\/ar\.json` plus `data\/ar-supplement\.json`/);
  assert.match(maintenance, /effective populated catalog is `data\/pokemon-collections\.json` plus `data\/pokemon-collections-21-40\.json`/);
});

test("collection identity compatibility remains explicit", () => {
  assert.match(registry, /trainerPokemon/);
  assert.match(registry, /Number\.isInteger\(card\.accountIndex\)/);
  assert.match(registry, /\[\s*"trainerPokemon"/s);
});

test("legacy fix/supplement modules are not silently multiplied", () => {
  const rootFiles = readdirSync(new URL("../", import.meta.url));
  const fixFiles = rootFiles.filter((file) => /-(fix|supplement)\.js$/i.test(file));
  assert.ok(
    fixFiles.length <= 12,
    `Too many root compatibility modules (${fixFiles.length}): ${fixFiles.join(", ")}`,
  );
});

test("public application routes remain present", () => {
  for (const file of [
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
  ]) {
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), true, file);
  }
});
