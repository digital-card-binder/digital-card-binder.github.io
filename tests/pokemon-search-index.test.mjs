import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createHash } from "node:crypto";

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

function splitPipe(value) {
  return clean(value).split("|").map(clean).filter(Boolean);
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
          rarity,
          illustrators,
          trainers,
        ] = entry;
        return {
          code: cardCode,
          name,
          pokemonName,
          image: decodeImage(image, payload.imageBase),
          rarity: clean(rarity),
          illustrators: splitPipe(illustrators),
          trainers: splitPipe(trainers),
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

test("generated search index v2 preserves catalog order, identity, and core fields", () => {
  const base = parse("data/series.json");
  const legacy = parse("data/series-legacy.json");
  const pokedex = parse("data/pokedex.json");
  const compact = parse("data/pokemon-search-index.json");
  const decoded = decodeIndex(compact);
  const exceptions = parse("data/series-collection-exclusions.json");
  const excluded = new Set((exceptions.exclusions || []).map((x) =>
    String(x.setCode).toLowerCase() + "::" + String(x.cardCode).toLowerCase()
  ));
  const canonical = mergeGroups(base, legacy).map((group) => {
    const source = group.cards || [];
    const hasExcluded = source.some((card) =>
      excluded.has(String(group.code).toLowerCase() + "::" + String(card.code).toLowerCase())
    );
    return {
      ...group,
      cards: source.map((card, originalIndex) => {
        if (excluded.has(String(group.code).toLowerCase() + "::" + String(card.code).toLowerCase()))
          return null;
        return hasExcluded && !Number.isInteger(card.accountIndex)
          ? { ...card, accountIndex: originalIndex } : card;
      }).filter(Boolean),
    };
  });

  assert.equal(compact.version, 2);
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

  assert.equal(cardCount, 20241);
  assert.deepEqual(
    decoded.pokedex.map((record) => [record.number, record.nameKo, record.nameEn || ""]),
    pokedex.records.map((record) => [record.number, record.nameKo, record.nameEn || ""]),
  );
});

test("search index enriches canonical cards with rarity, illustrator, and trainer metadata", () => {
  const compact = parse("data/pokemon-search-index.json");
  const decoded = decodeIndex(compact);
  const byCode = new Map();
  for (const group of decoded.groups) {
    for (const card of group.cards) {
      byCode.set(`${clean(group.code).toLowerCase()}::${clean(card.code).toLowerCase()}`, card);
    }
  }

  const m6 = byCode.get("m6::m6_009/076");
  assert.ok(m6);
  assert.equal(m6.rarity, "RR");
  assert.ok(m6.illustrators.includes("5ban Graphics"));

  const red = byCode.get("sm12a::sm12a_191/173");
  assert.ok(red);
  assert.ok(red.illustrators.includes("TOKIYA"));
  assert.ok(red.trainers.includes("레드"));

  let rarityCount = 0;
  let illustratorCount = 0;
  let trainerCount = 0;
  for (const group of decoded.groups) {
    for (const card of group.cards) {
      if (card.rarity) rarityCount += 1;
      if (card.illustrators.length) illustratorCount += 1;
      if (card.trainers.length) trainerCount += 1;
    }
  }
  assert.ok(rarityCount >= 1900);
  assert.ok(illustratorCount >= 3400);
  assert.ok(trainerCount >= 100);
});

test("search index remains a lightweight replacement for the heavy canonical payload", () => {
  const sourceBytes =
    Buffer.byteLength(read("data/series.json")) +
    Buffer.byteLength(read("data/series-legacy.json")) +
    Buffer.byteLength(read("data/pokedex.json"));
  const indexBytes = Buffer.byteLength(read("data/pokemon-search-index.json"));
  assert.ok(indexBytes < sourceBytes * 0.45, `${indexBytes} vs ${sourceBytes}`);
});

test("search client supports unified field scopes without requesting heavy catalogs", () => {
  const client = read("pokemon-search.js");
  const page = read("pokemon-search.html");
  const service = read("core/catalog/catalog-service.js");

  assert.match(client, /catalogService[.]pokemonSearchIndex[(][)]/);
  assert.doesNotMatch(client, /catalogService[.]series[(][)]/);
  assert.doesNotMatch(client, /[.]\/data\/(?:series|series-legacy|pokedex)[.]json/);
  assert.match(service, /[.]\/data\/pokemon-search-index[.]json/);

  for (const scope of ["NAME", "NUMBER", "SET", "ARTIST", "TRAINER", "RARITY"]) {
    assert.match(page, new RegExp(`value="${scope}"`));
    assert.match(client, new RegExp(`${scope}:`));
  }
  assert.match(client, /card[.]illustrators/);
  assert.match(client, /card[.]trainers/);
  assert.match(client, /card[.]rarity/);
  assert.match(page, /id="pokemon-search-dialog-artist"/);
  assert.match(page, /id="pokemon-search-dialog-trainer"/);
  assert.match(page, /id="pokemon-search-dialog-rarity"/);
});


test("Korean Classic replacement images remain locally archived and routed across catalog and search", () => {
  const overrides = parse("data/series-image-overrides.json");
  const audit = parse("data/audits/korean-recovery-classic-clf-001-002-firstparty-display-20261017.json");
  assert.equal(audit.productionReplacements.length, 2);
  for (const row of audit.productionReplacements) {
    assert.ok(["CLF_001", "CLF_002"].includes(row.cardKey));
    assert.equal(overrides.sets.clf[row.masterCardCode], row.newDisplay);
    const bytes = readFileSync(new URL(`..${row.newDisplay}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
    assert.equal(bytes.length, row.imageBytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), row.selfhostedWebPSha256);
    assert.equal(row.printAnd12ThemeFinalClosure, false);
  }
  const client = read("pokemon-search.js");
  assert.match(client, /applySeriesImageOverridesToSearch[(]decoded[.]groups[)]/);
  assert.match(client, /card[.]originalImage = local/);
});


test("SM2L 062 shows its Korean printed Basic Fighting Energy label without rewriting stored ownership IDs", async () => {
  const originals = parse("data/series.json");
  const sm2l = originals.find(group => String(group.code).toLowerCase() === "sm2l");
  const original = sm2l.cards.find(card => card.code === "SM2L_062/050");
  assert.equal(original.name, "격투 에너지");
  const payloads = {
    "./data/series.json": originals,
    "./data/series-legacy.json": parse("data/series-legacy.json"),
    "./data/pokemon-search-index.json": parse("data/pokemon-search-index.json"),
    "./data/series-image-overrides.json": parse("data/series-image-overrides.json"),
    "./data/series-collection-exclusions.json": parse("data/series-collection-exclusions.json"),
  };
  const context = {
    window: {},
    fetch: async (url) => {
      assert.ok(Object.hasOwn(payloads, url), "Unexpected remote JSON " + url);
      return { ok: true, json: async () => structuredClone(payloads[url]) };
    },
  };
  vm.createContext(context);
  vm.runInContext(read("core/catalog/catalog-service.js"), context);
  const catalog = context.window.DigitalCardBinder.catalog;
  const groups = await catalog.series();
  const displayed = groups.find(group => String(group.code).toLowerCase() === "sm2l")
    .cards.find(card => card.code === "SM2L_062/050");
  assert.equal(displayed.name, "기본 격투 에너지");
  assert.equal(displayed.code, original.code);
  assert.equal(displayed.image, original.image);
  const expectedAccountIndex = Number.isInteger(original.accountIndex)
    ? original.accountIndex : sm2l.cards.findIndex(card => card.code === original.code);
  assert.equal(displayed.accountIndex, expectedAccountIndex);
  const compactIndex = await catalog.pokemonSearchIndex();
  const indexGroup = compactIndex.groups.find(group => String(group[0]).toLowerCase() === "sm2l");
  const indexCard = indexGroup[4].find(card => card[0] === "SM2L_062/050");
  assert.equal(indexCard[1], "기본 격투 에너지");
  assert.ok(indexCard[1].includes("격투 에너지"), "The historical shorter name must still match");
  assert.equal(indexCard[0], original.code);
  const originalIndex = payloads["./data/pokemon-search-index.json"].groups
    .find(group => String(group[0]).toLowerCase() === "sm2l")[4]
    .find(card => card[0] === "SM2L_062/050");
  assert.equal(originalIndex[1], "격투 에너지", "Generated source index remains backwards-compatible");
});
