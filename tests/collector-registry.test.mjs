import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
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
vm.runInContext(source, context);
const registry = context.window.CollectorCollectionRegistry;

test("all existing catalogs retain their expected item counts", async () => {
  const expected = {
    national: 1025,
    pack: 62,
    artist: 4838,
    series: 10321,
    pokemon: 679,
    ar: 510,
    people: 179,
    trainerPokemon: 130,
  };
  for (const [collectionId, count] of Object.entries(expected)) {
    const catalog = await registry.loadCatalog(collectionId);
    assert.equal(catalog.items.length, count, collectionId);
    assert.equal(catalog.itemMap.size, count, `${collectionId} unique account keys`);
    assert.equal(
      registry.COLLECTIONS[collectionId].catalogCount,
      count,
      `${collectionId} public summary count`,
    );
  }
});

test("public projection summaries use the current catalog total", () => {
  const metrics = registry.publicProjectionMetrics({
    collectionId: "series",
    ownedKeys: ["series-card-1", "series-card-2", "series-card-2"],
    ownedCount: 3,
    totalCount: 4103,
    promoOwnedKeys: [],
  });

  assert.deepEqual(JSON.parse(JSON.stringify(metrics)), {
    ownedCount: 2,
    totalCount: 10321,
    promoOwnedCount: 0,
  });
});

test("existing nonempty top-level catalog group counts stay unchanged", async () => {
  const expected = {
    national: 9,
    pack: 3,
    artist: 40,
    series: 99,
    pokemon: 47,
    ar: 32,
    people: 9,
    trainerPokemon: 105,
  };
  for (const [collectionId, count] of Object.entries(expected)) {
    const catalog = await registry.loadCatalog(collectionId);
    assert.equal(catalog.groups.length, count, collectionId);
  }
});

test("series catalog includes complete sv5a and sv8a sets in release order", async () => {
  const groups = JSON.parse(
    await readFile(new URL("../data/series.json", import.meta.url), "utf8"),
  );
  const expectations = [
    {
      code: "sv5a",
      previous: "sv5M",
      next: "sv6",
      count: 96,
      denominator: "066",
      imageCode: "SV5a",
    },
    {
      code: "sv8a",
      previous: "sv8",
      next: "sv9",
      count: 237,
      denominator: "187",
      imageCode: "SV8a",
    },
  ];

  for (const expectation of expectations) {
    const index = groups.findIndex((group) => group.code === expectation.code);
    assert.notEqual(index, -1, expectation.code);
    assert.equal(groups[index - 1]?.code, expectation.previous);
    assert.equal(groups[index + 1]?.code, expectation.next);

    const cards = groups[index].cards;
    assert.equal(cards.length, expectation.count, expectation.code);
    cards.forEach((card, cardIndex) => {
      const number = String(cardIndex + 1).padStart(3, "0");
      assert.equal(
        card.code,
        `${expectation.code}_${number}/${expectation.denominator}`,
      );
      assert.equal(card.order, cardIndex + 1);
      assert.equal(
        card.image,
        `https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/${expectation.imageCode}/${expectation.imageCode}_${number}.png`,
      );
    });
  }
});

test("every series card has a real display name instead of a numeric code", async () => {
  const groups = JSON.parse(
    await readFile(new URL("../data/series.json", import.meta.url), "utf8"),
  );

  for (const group of groups) {
    for (const card of group.cards) {
      const displayName = String(card.name || card.pokemonName || "").trim();
      assert.notEqual(displayName, "", card.code);
      assert.notEqual(displayName, card.code, card.code);
    }
  }

  const seriesCatalog = await registry.loadCatalog("series");
  assert.equal(
    seriesCatalog.items.some((item) => item.name === "sv8_095/106"),
    false,
  );
});

test("series catalog contains the complete Korean S and SM box catalogs", async () => {
  const groups = JSON.parse(
    await readFile(new URL("../data/series.json", import.meta.url), "utf8"),
  );
  const swordShield = groups.filter((group) => group.era === "S");
  const sunMoon = groups.filter((group) => group.era === "SM");

  assert.equal(swordShield.length, 30);
  assert.equal(sunMoon.length, 36);
  assert.equal(
    [...swordShield, ...sunMoon].reduce(
      (total, group) => total + group.cards.length,
      0,
    ),
    6218,
  );

  for (const group of [...swordShield, ...sunMoon]) {
    assert.ok(group.displayName, `${group.code}: display name`);
    assert.ok(group.sourceProducts.length >= 1, `${group.code}: source product`);
    assert.equal(
      new Set(group.cards.map((card) => card.code)).size,
      group.cards.length,
      `${group.code}: one slot per printed set code and card number`,
    );
    for (const card of group.cards) {
      assert.match(
        card.image,
        /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\/data\/wmimages\/(?:S|SM)\//,
        card.code,
      );
      assert.match(
        card.source,
        /^https:\/\/pokemoncard[.]co[.]kr\/cards\/detail\//,
        card.code,
      );
    }
  }

  const group = (code) => groups.find((item) => item.code === code);
  assert.equal(group("s4a").cards.length, 326, "different shiny card numbers stay separate");
  assert.equal(group("s9a").cards.length, 87, "same-number parallel foils collapse");
  assert.equal(group("sm4+").cards.length, 124, "REMASTER-only printed codes stay in the box");
  assert.equal(
    group("sm4+").cards.some((card) => card.code.startsWith("sm-p_")),
    true,
  );
  assert.equal(group("sm7a").cards.length, 66, "box-specific temp cards stay in the box");
  assert.equal(
    group("sm12a").cards.filter((card) => card.code.includes("ENERGY-")).length,
    9,
    "numberless basic energies remain distinct collection slots",
  );
});

test("adding legacy eras does not mutate any existing SV, MEGA, or starter card", async () => {
  const groups = JSON.parse(
    await readFile(new URL("../data/series.json", import.meta.url), "utf8"),
  );
  const preserved = groups.filter(
    (group) => group.era !== "S" && group.era !== "SM",
  );
  const digest = createHash("sha256")
    .update(JSON.stringify(preserved))
    .digest("hex");

  assert.equal(preserved.length, 33);
  assert.equal(
    preserved.reduce((total, group) => total + group.cards.length, 0),
    4103,
  );
  assert.equal(
    digest,
    "73bec2b688579e876d782de5d5744aa5e49fa613f6a26803711c554e20047827",
  );
});

test("series trainer corrections match the reviewed Korean card names", async () => {
  const groups = JSON.parse(
    await readFile(new URL("../data/series.json", import.meta.url), "utf8"),
  );
  const card = (groupCode, number) =>
    groups
      .find((group) => group.code === groupCode)
      .cards.find((item) => item.code.includes(`_${number}/`));

  assert.equal(card("sv1S", "070").name, "친구수첩");
  assert.equal(card("sv4K", "059").name, "대지의 그릇");
  assert.equal(card("sv8", "095").name, "미라클인터컴");
  assert.equal(card("sv8", "095").pokemonName, undefined);
  assert.equal(card("sv11W", "082").name, "브레이브뱅글");
  assert.equal(card("m2a", "166").name, "풍선");
  assert.equal(card("m4", "082").name, "버블 물 에너지");
  assert.equal(card("m5", "107").name, "호쾌봄");

  const m5 = groups.find((group) => group.code === "m5");
  assert.equal(m5.title, "어비스아이 (118/081)");
  assert.equal(m5.cards.length, 118);
  assert.equal(m5.cards.at(-1).code, "m5_118/081");
});

test("legacy national projection matches the current baseline without private fields", async () => {
  const projection = await registry.buildProjection(
    "national",
    {
      baseMode: "legacy",
      email: "private@example.com",
      overrides: {
        "1": {
          owned: true,
          note: "private note",
          quantity: 8,
          tradeStatus: "sale",
        },
      },
    },
    "abc123def456",
  );
  assert.equal(projection.totalCount, 1025);
  assert.ok(projection.ownedCount > 0);
  assert.deepEqual(
    Object.keys(projection).sort(),
    [
      "collectionId",
      "ownedCount",
      "ownedKeys",
      "promoOwnedCount",
      "promoOwnedKeys",
      "publicId",
      "schemaVersion",
      "totalCount",
    ].sort(),
  );
  assert.equal(JSON.stringify(projection).includes("private@example.com"), false);
  assert.equal(JSON.stringify(projection).includes("private note"), false);
  assert.equal(JSON.stringify(projection).includes("tradeStatus"), false);
  assert.equal(JSON.stringify(projection).includes("quantity"), false);
});

test("pack projection keeps every official promo item and excludes custom promo details", async () => {
  const promoPayload = JSON.parse(
    await readFile(new URL("../data/promo-packs.json", import.meta.url), "utf8"),
  );
  const promos = Array.isArray(promoPayload)
    ? promoPayload
    : [
        ...(promoPayload.packs || []),
        ...(promoPayload.cards || []),
      ];
  const projection = await registry.buildProjection(
    "pack",
    {
      baseMode: "empty",
      ownedPromoPackIds: promos.map((item) => item.id),
      customPromoPacks: [
        { id: "private-custom", note: "private", imageUrl: "private" },
      ],
    },
    "abc123def456",
  );
  assert.equal(promos.length, 222);
  assert.equal(projection.promoOwnedCount, 222);
  assert.equal(projection.promoOwnedKeys.includes("promo-card-s-p-008"), true);
  assert.equal(projection.promoOwnedKeys.includes("private-custom"), false);
  assert.equal(JSON.stringify(projection).includes("private"), false);
});

test("the same physical card remains independent across catalogs", async () => {
  const nationalCatalog = await registry.loadCatalog("national");
  const artistCatalog = await registry.loadCatalog("artist");
  const nationalKey = nationalCatalog.items[0].key;
  const artistKey = artistCatalog.items[0].key;
  const national = await registry.ownershipFor("national", {
    baseMode: "empty",
    overrides: { [nationalKey]: { owned: true } },
  });
  const artist = await registry.ownershipFor("artist", {
    baseMode: "empty",
    overrides: { [artistKey]: { owned: false } },
  });
  assert.equal(national.ownedKeys.includes(nationalKey), true);
  assert.equal(artist.ownedKeys.includes(artistKey), false);
});

test("people ownership stays inside nationalDex peopleOwned", async () => {
  const catalog = await registry.loadCatalog("people");
  const personId = catalog.items[0].key;
  const owned = await registry.ownershipFor("people", {
    overrides: { [personId]: { owned: true } },
    peopleOwned: { [personId]: true },
  });
  assert.deepEqual([...owned.ownedKeys], [personId]);
});

test("dashboard defaults preserve the old six-category summary", () => {
  for (const collectionId of registry.COLLECTION_ORDER) {
    const setting = registry.defaultSetting(collectionId);
    assert.equal(
      setting.dashboardVisible,
      collectionId !== "people",
      collectionId,
    );
    assert.equal(setting.visibility, "private");
  }
});

test("custom dex extension exposes dashboard ownership with per-dex keys", async () => {
  const customSource = await readFile(
    new URL("../custom-sharing.js", import.meta.url),
    "utf8",
  );
  const customRegistry = {
    COLLECTION_ORDER: ["national"],
    COLLECTIONS: { national: {} },
    supportedCollectionId: () => false,
    ownershipFor: async () => ({ catalog: { items: [] }, ownedKeys: [] }),
    buildProjection: async () => ({}),
  };
  const customContext = {
    console,
    window: { CollectorCollectionRegistry: customRegistry },
  };
  vm.createContext(customContext);
  vm.runInContext(customSource, customContext);

  const ownership = customRegistry.customOwnership({
    customDexes: {
      fire: {
        id: "fire",
        title: "불꽃 도감",
        cards: [
          { key: "sv1::001", owned: true },
          { key: "sv1::002", owned: false },
          { key: "sv1::002", owned: true },
        ],
      },
      favorites: {
        id: "favorites",
        title: "최애 도감",
        cards: [{ key: "sv1::001", owned: true }],
      },
    },
  });

  assert.deepEqual(customRegistry.COLLECTION_ORDER, ["national", "custom"]);
  assert.equal(customRegistry.COLLECTIONS.custom.defaultDashboardVisible, true);
  assert.equal(ownership.catalog.items.length, 3);
  assert.equal(ownership.catalog.groups.length, 2);
  assert.deepEqual(
    [...ownership.ownedKeys],
    ["fire::sv1::001", "favorites::sv1::001"],
  );
});

test("legacy link-only settings are treated as private without changing card data", () => {
  const setting = registry.normalizeSetting("national", {
    dashboardVisible: true,
    visibility: "unlisted",
    shareId: "AbCdEfGhIjKlMnOpQrStUvWxYz012345",
  });
  assert.equal(setting.dashboardVisible, true);
  assert.equal(setting.visibility, "private");
  assert.equal(setting.shareId, "");
});
