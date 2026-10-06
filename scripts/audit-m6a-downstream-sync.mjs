import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("data/audits/m6a-downstream-sync.json", ROOT);
const CHECK = process.argv.includes("--check");

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, ROOT), "utf8"));

const [
  series,
  pokemonBase,
  pokemonExtra,
  arBase,
  arSupplement,
  artists,
  themes,
  strictThemeAudit,
  people,
  trainerPokemon,
  fossil,
  packsSource,
  packAsset,
] = await Promise.all([
  readJson("data/series.json"),
  readJson("data/pokemon-collections.json"),
  readJson("data/pokemon-collections-21-40.json"),
  readJson("data/ar.json"),
  readJson("data/ar-supplement.json"),
  readJson("data/artists.json"),
  readJson("data/art-themes.json"),
  readJson("data/audits/theme-m6a-strict-audit.json"),
  readJson("data/people.json"),
  readJson("data/trainer-pokemon.json"),
  readJson("data/fossil.json"),
  readFile(new URL("packs.js", ROOT), "utf8"),
  readFile(new URL("assets/packs/m6a.webp", ROOT)),
]);

const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();
const list = (payload, key) => Array.isArray(payload) ? payload : (payload?.[key] || []);
const cardNumber = (card) => clean(card?.meta).split(" · ", 1)[0];

const m6a = list(series).find((group) => lower(group?.code) === "m6a");
assert.ok(m6a, "M6a series group is missing");
assert.equal(m6a.cards?.length, 176, "M6a canonical series must contain 176 cards");
assert.match(
  packsSource,
  /\["M","30th CELEBRATION","m6a",[01]\]/,
  "M6a pack-dex entry is missing",
);
assert.ok(packAsset.length > 0, "M6a pack image asset is missing");

const pokemonGroups = [...list(pokemonBase), ...list(pokemonExtra)];
const pokemonActual = [];
for (const group of pokemonGroups) {
  for (const card of group.cards || []) {
    if (!/·\s*M6a\s*$/i.test(clean(card.meta))) continue;
    pokemonActual.push(`${clean(group.name)}::${cardNumber(card)}`);
  }
}
pokemonActual.sort();

const pokemonExpected = [
  "리자몽::137/103",
  "잉어킹::165/103",
  "그란돈::068/103",
  "뜨아거::009/103",
  "뜨아거::124/103",
  "파밀리쥐::100/103",
  "파밀리쥐::123/103",
  ...Array.from({ length: 32 }, (_, index) =>
    `피카츄::${String(index + 17).padStart(3, "0")}/103`
  ),
  "피카츄::126/103",
  "피카츄::127/103",
  "피카츄::136/103",
  "피카츄::160/103",
  "니드런♀::073/103",
  "니드리나::074/103",
  "니드리나::114/103",
  "푸린::096/103",
  "푸린::139/103",
].sort();

assert.deepEqual(
  pokemonActual,
  pokemonExpected,
  "M6a Pokémon collection membership drifted; resync downstream dexes",
);

const arByCode = new Map(list(arBase).map((group) => [lower(group.code), group]));
for (const group of list(arSupplement)) arByCode.set(lower(group.code), group);
const arM6a = arByCode.get("m6a");
assert.ok(arM6a, "M6a AR group is missing");
const arNumbers = (arM6a.cards || []).map((card) => Number(card.number)).sort((a, b) => a - b);
assert.deepEqual(
  arNumbers,
  Array.from({ length: 20 }, (_, index) => index + 104),
  "M6a AR dex must contain 104-123",
);

const artistM6a = list(artists, "artists")
  .flatMap((artist) => artist.cards || [])
  .filter((card) => lower(card.set) === "m6a");
assert.equal(
  artistM6a.length,
  35,
  "M6a artist-dex coverage changed; verify illustrator metadata and approved artist scope",
);

const strictThemes = Array.isArray(strictThemeAudit?.reviewedThemes)
  ? strictThemeAudit.reviewedThemes.map(clean)
  : [];
assert.equal(strictThemeAudit?.status, "complete", "M6a strict theme audit must be complete");
assert.equal(Number(strictThemeAudit?.reviewedCardCount), 176, "M6a strict audit must cover all 176 cards");
assert.equal(Number(strictThemeAudit?.set?.canonicalCardCount), 176, "M6a strict audit canonical count drifted");
assert.deepEqual(
  [...strictThemes].sort(),
  [...(strictThemeAudit?.strictPolicy?.themes || []).map(clean)].sort(),
  "M6a strict audit reviewedThemes must cover all configured themes",
);

const expectedThemeCards = strictThemeAudit?.verifiedThemeCards || {};
const themeGroups = list(themes, "groups");
const themeM6aSlots = [];
for (const group of themeGroups) {
  for (const card of group.cards || []) {
    if (lower(card.set) !== "m6a") continue;
    themeM6aSlots.push({ theme: clean(group.code), code: clean(card.code).toUpperCase() });
  }
}
themeM6aSlots.sort((a, b) =>
  a.theme.localeCompare(b.theme) || a.code.localeCompare(b.code)
);

for (const themeCode of strictThemes) {
  const expected = [...(expectedThemeCards[themeCode] || [])]
    .map((code) => clean(code).toUpperCase())
    .sort();
  const actual = themeM6aSlots
    .filter((entry) => entry.theme === themeCode)
    .map((entry) => entry.code)
    .sort();
  assert.deepEqual(
    actual,
    expected,
    `M6a strict theme membership drifted: ${themeCode}`,
  );
}

const expectedThemeSlotCount = strictThemes.reduce(
  (sum, themeCode) => sum + (expectedThemeCards[themeCode] || []).length,
  0,
);
assert.equal(
  themeM6aSlots.length,
  expectedThemeSlotCount,
  "M6a theme-dex slot count drifted from strict audit ledger",
);

const uniqueThemeCards = new Set(themeM6aSlots.map((entry) => entry.code));

assert.equal(
  people?.metadata?.cardPolicy?.representativeCardsPerPerson,
  1,
  "People dex policy changed; M6a representative-card review must be repeated",
);

const trainerM6a = list(trainerPokemon, "groups")
  .flatMap((group) => group.cards || [])
  .filter((card) => lower(card.set) === "m6a");
const fossilM6a = list(fossil, "groups")
  .flatMap((group) => group.cards || [])
  .filter((card) => lower(card.set) === "m6a");

const audit = {
  schemaVersion: 1,
  updatedAt: "2026-10-05",
  set: {
    code: "M6a",
    name: "30th CELEBRATION",
    canonicalCardCount: 176,
  },
  results: {
    series: {
      status: "complete",
      cardCount: m6a.cards.length,
    },
    pack: {
      status: "complete",
      packEntry: true,
      packAsset: "assets/packs/m6a.webp",
    },
    pokemonCollections: {
      status: "complete",
      cardSlots: pokemonActual.length,
      rule: "현재 67개 포켓몬 컬렉션 그룹과 M6a 카드명을 교차검증",
    },
    ar: {
      status: "complete",
      cardSlots: arNumbers.length,
      range: "104-123",
    },
    artist: {
      status: "complete-within-approved-40-artists",
      cardSlots: artistM6a.length,
      note: "승인된 40명 작가 도감 범위 기준. M6a 원본 illustrator 메타데이터가 추가되면 재검수한다.",
    },
    artThemes: {
      status: "complete-strict-exhaustive-review",
      cardSlots: themeM6aSlots.length,
      uniqueCards: uniqueThemeCards.size,
      groups: Object.fromEntries(
        strictThemes.map((code) => [
          code,
          themeM6aSlots.filter((entry) => entry.theme === code).length,
        ]),
      ),
    },
    people: {
      status: "no-exhaustive-add-required",
      note: "인물도감은 인물당 대표 한국판 카드 1장을 쓰는 구조라 M6a 신규 카드 전체를 누적하지 않는다.",
    },
    trainerPokemon: {
      status: trainerM6a.length ? "has-membership" : "reviewed-no-confirmed-addition",
      cardSlots: trainerM6a.length,
      note: "사람과 포켓몬이 함께 그려진 카드만 수록하는 기존 실물 이미지 판독 규칙을 유지한다.",
    },
    fossil: {
      status: fossilM6a.length ? "has-membership" : "reviewed-no-membership",
      cardSlots: fossilM6a.length,
    },
    world: {
      status: "no-exhaustive-add-required",
      note: "월드탐험도감은 세트 전수 파생이 아닌 고정 장소·인물·포켓몬 슬롯 큐레이션이다.",
    },
  },
  safeguards: [
    "M6a 176장 기준 수가 바뀌면 감사가 실패한다.",
    "팩 도감의 M6a 항목 또는 낱팩 이미지가 빠지면 감사가 실패한다.",
    "포켓몬 컬렉션 M6a 48슬롯 중 하나라도 빠지거나 잘못 추가되면 감사가 실패한다.",
    "AR 104-123 20장 범위가 달라지면 감사가 실패한다.",
    "승인 작가 범위의 M6a 35장 또는 strict 장부의 테마 카드/슬롯 구성이 달라지면 재검수를 요구한다.",
  ],
};

const serialized = `${JSON.stringify(audit, null, 2)}\n`;
if (CHECK) {
  const current = await readFile(OUT, "utf8");
  assert.equal(current, serialized, "M6a downstream audit artifact is stale; run npm run downstream-sync:sync");
  console.log("M6a downstream sync audit is current");
} else {
  await writeFile(OUT, serialized);
  console.log("M6a downstream sync audit updated");
}
