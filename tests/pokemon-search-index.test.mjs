import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const parse = (path) => JSON.parse(read(path));

function clean(value) {
  return String(value ?? "").trim();
}

function mergeGroups(baseGroups, supplementGroups) {
  const merged = [...baseGroups];
  for (const extra of supplementGroups) {
    const key = clean(extra?.code).toLowerCase();
    const index = merged.findIndex(
      (group) => clean(group?.code).toLowerCase() === key,
    );
    if (index >= 0) merged[index] = extra;
    else merged.push(extra);
  }
  return merged;
}

function decodeImage(value, base) {
  const source = clean(value);
  return source.startsWith("@/") ? `${base}${source.slice(1)}` : source;
}

function decodeIndex(payload) {
  return {
    pokedex: payload.pokedex.map(([number, nameKo, nameEn]) => ({
      number,
      nameKo,
      nameEn,
    })),
    groups: payload.groups.map(([code, title, displayName, era, cards]) => ({
      code,
      title,
      displayName,
      era,
      cards: cards.map((entry) => {
        const [
          cardCode,
          name,
          pokemonName,
          image,
          meta,
          cardNumber,
          accountIndex,
          owned,
          originalImage,
        ] = entry;
        return {
          code: cardCode,
          name,
          pokemonName,
          image: decodeImage(image, payload.imageBase),
          ...(meta ? { meta } : {}),
          ...(cardNumber ? { cardNumber } : {}),
          ...(Number.isInteger(accountIndex) ? { accountIndex } : {}),
          ...(owned === 1 ? { owned: true } : {}),
          ...(originalImage
            ? { originalImage: decodeImage(originalImage, payload.imageBase) }
            : {}),
        };
      }),
    })),
  };
}

test("generated search index preserves catalog order, identity, and search fields", () => {
  const base = parse("data/series.json");
  const legacy = parse("data/series-legacy.json");
  const pokedex = parse("data/pokedex.json");
  const compact = parse("data/pokemon-search-index.json");
  const decoded = decodeIndex(compact);
  const canonical = mergeGroups(base, legacy);

  assert.equal(compact.version, 1);
  assert.equal(compact.imageBase, "https://cards.image.pokemonkorea.co.kr");
  assert.equal(decoded.groups.length, canonical.length);
  assert.equal(decoded.pokedex.length, pokedex.records.length);

  const identityContext = { window: {} };
  vm.createContext(identityContext);
  vm.runInContext(read("core/catalog/card-identity.js"), identityContext);
  const identity = identityContext.window.DigitalCardBinder.cardIdentity;

  let cardCount = 0;
  canonical.forEach((group, groupIndex) => {
    const indexedGroup = decoded.groups[groupIndex];
    assert.equal(indexedGroup.code, group.code || group.name || "");
    assert.equal(indexedGroup.title, group.title || "");
    assert.equal(indexedGroup.displayName, group.displayName || "");
    assert.equal(indexedGroup.era, group.era || "");
    assert.equal(indexedGroup.cards.length, (group.cards || []).length);

    (group.cards || []).forEach((card, cardIndex) => {
      cardCount += 1;
      const indexed = indexedGroup.cards[cardIndex];
      assert.equal(
        identity.cardIdentity("series", indexedGroup, indexed, groupIndex, cardIndex),
        identity.cardIdentity("series", group, card, groupIndex, cardIndex),
        `${indexedGroup.code} card ${cardIndex} identity`,
      );
      for (const field of ["code", "name", "pokemonName", "image", "meta", "cardNumber"]) {
        assert.equal(
          indexed[field] || "",
          card[field] || "",
          `${indexedGroup.code} card ${cardIndex} ${field}`,
        );
      }
      assert.equal(
        Number.isInteger(indexed.accountIndex) ? indexed.accountIndex : null,
        Number.isInteger(card.accountIndex) ? card.accountIndex : null,
      );
      assert.equal(Boolean(indexed.owned), Boolean(card.owned));
    });
  });

  assert.equal(cardCount, 15670);
  assert.deepEqual(
    decoded.pokedex.map((record) => [record.number, record.nameKo, record.nameEn || ""]),
    pokedex.records.map((record) => [record.number, record.nameKo, record.nameEn || ""]),
  );
});

test("search index cuts the initial canonical search payload by at least 60 percent", () => {
  const sourceBytes =
    Buffer.byteLength(read("data/series.json")) +
    Buffer.byteLength(read("data/series-legacy.json")) +
    Buffer.byteLength(read("data/pokedex.json"));
  const indexBytes = Buffer.byteLength(read("data/pokemon-search-index.json"));
  assert.ok(indexBytes < sourceBytes * 0.4, `${indexBytes} vs ${sourceBytes}`);
});

test("search client does not request the heavy canonical catalogs", () => {
  const client = read("pokemon-search.js");
  const service = read("core/catalog/catalog-service.js");
  assert.match(client, /catalogService[.]pokemonSearchIndex[(][)]/);
  assert.doesNotMatch(client, /catalogService[.]series[(][)]/);
  assert.doesNotMatch(client, /[.]\/data\/(?:series|series-legacy|pokedex)[.]json/);
  assert.match(service, /[.]\/data\/pokemon-search-index[.]json/);
});
