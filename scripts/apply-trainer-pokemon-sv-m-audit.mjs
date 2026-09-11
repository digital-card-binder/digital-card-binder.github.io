import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const dataUrl = new URL("../data/trainer-pokemon.json", import.meta.url);
const seriesUrl = new URL("../data/series.json", import.meta.url);
const pokedexUrl = new URL("../data/pokedex.json", import.meta.url);

const [data, series, pokedex] = await Promise.all(
  [dataUrl, seriesUrl, pokedexUrl].map(async (url) => JSON.parse(await readFile(url, "utf8"))),
);

const entry = (id, pokemonName, personName, name, rarity) => ({
  id,
  pokemonName,
  personName,
  name,
  rarity,
});

// Every entry below was retained only after opening the official Korean card image.
// Trainer cards with several Pokemon are stored once under one clearly depicted Pokemon.
const retained = [
  entry("sv1s_083", "랄토스", "그 외", "랄토스", "AR"),
  entry("sv1s_084", "킬리아", "그 외", "킬리아", "AR"),
  entry("sv1s_101", "가디안", "그 외", "가디안 ex", "SAR"),
  entry("sv1v_086", "슬리프", "그 외", "슬리프", "AR"),
  entry("sv1v_088", "마피티프", "그 외", "마피티프", "AR"),
  entry("sv1a_078", "뜨아거", "그 외", "뜨아거", "AR"),
  entry("sv1a_097", "라우드본", "그 외", "라우드본 ex", "SAR"),
  entry("sv2d_096", "푸린", "사구아로", "사구아로", "SAR"),
  entry("sv2a_173", "피카츄", "그 외", "피카츄", "AR"),
  entry("sv2a_177", "근육몬", "그 외", "근육몬", "AR"),
  entry("sv2a_205", "뮤", "그 외", "뮤 ex", "SAR"),
  entry("sv2a_207", "페르시온", "비주기", "비주기의 카리스마", "SAR"),
  entry("sv3_137", "대왕끼리동", "뽀삐", "뽀삐", "SAR"),
  entry("sv3a_064", "타만타", "그 외", "타만타", "AR"),
  entry("sv3a_066", "마이농", "그 외", "마이농", "AR"),
  entry("sv4k_092", "빠모", "올림박사", "올림박사의 기백", "SAR"),
  entry("sv4m_070", "바닐리치", "그 외", "바닐리치", "AR"),
  entry("sv4m_074", "강철톤", "그 외", "강철톤", "AR"),
  entry("sv5k_097", "팬텀", "유빈", "유빈의 확신", "SAR"),
  entry("sv5m_079", "몰드류", "그 외", "몰드류", "AR"),
  entry("sv5m_083", "할비롱", "그 외", "할비롱", "AR"),
  entry("sv5a_068", "차데스", "그 외", "차데스", "AR"),
  entry("sv5a_075", "가디", "그 외", "히스이 가디", "AR"),
  entry("sv5a_076", "대코파스", "그 외", "대코파스", "AR"),
  entry("sv5a_093", "잉어킹", "수련", "수련의 돌봄", "SAR"),
  entry("sv6_103", "과미르", "그 외", "과미르", "AR"),
  entry("sv6_109", "으랏차", "그 외", "으랏차", "AR"),
  entry("sv7_104", "릴링", "그 외", "릴링", "AR"),
  entry("sv7_113", "브리두라스", "그 외", "브리두라스", "AR"),
  entry("sv7a_090", "파비코리", "루티아", "루티아의 어필", "SAR"),
  entry("sv9_104", "찌리비크", "모야모", "모야모의 찌리비크", "AR"),
  entry("sv9_105", "에리본", "릴리에", "릴리에의 에리본", "AR"),
  entry("sv9_108", "조로아", "N", "N의 조로아", "AR"),
  entry("sv9_109", "레시라무", "N", "N의 레시라무", "AR"),
  entry("sv9_112", "우르", "호브", "호브의 우르", "AR"),
  entry("sv9_126", "삐삐", "릴리에", "릴리에의 삐삐 ex", "SAR"),
  entry("sv9_127", "조로아크", "N", "N의 조로아크 ex", "SAR"),
  entry("sv9_128", "자시안", "호브", "호브의 자시안 ex", "SAR"),
  entry("sv9a_065", "로즈레이드", "난천", "난천의 로즈레이드", "AR"),
  entry("sv9a_070", "블레이범", "심향", "심향의 블레이범", "AR"),
  entry("sv9a_071", "고라파덕", "이슬", "이슬의 고라파덕", "AR"),
  entry("sv9a_072", "라프라스", "이슬", "이슬의 라프라스", "AR"),
  entry("sv9a_075", "요씽리스", "페퍼", "페퍼의 요씽리스", "AR"),
  entry("sv9a_087", "한카리아스", "난천", "난천의 한카리아스 ex", "SAR"),
  entry("sv9a_088", "마피티프", "페퍼", "페퍼의 마피티프 ex", "SAR"),
  entry("sv9a_089", "피카츄", "심향", "심향의 모험", "SAR"),
  entry("sv10_103", "마자용", "로켓단 조무래기", "로켓단의 마자용", "AR"),
  entry("sv10_105", "또도가스", "람다", "로켓단의 또도가스", "AR"),
  entry("sv10_106", "니로우", "아테나", "로켓단의 니로우", "AR"),
  entry("sv10_108", "레트라", "로켓단 조무래기", "로켓단의 레트라", "AR"),
  entry("sv10_109", "나옹", "비주기", "로켓단의 나옹", "AR"),
  entry("sv10_125", "뮤츠", "비주기", "로켓단의 뮤츠 ex", "SAR"),
  entry("sv10_126", "니드킹", "비주기", "로켓단의 니드킹 ex", "SAR"),
  entry("sv10_127", "크로뱃", "로켓단 조무래기", "로켓단의 크로뱃 ex", "SAR"),
  entry("sv11w_173", "염무왕", "투희", "투희", "SAR"),
  entry("sv4a_350", "님피아", "네르케", "네르케", "SAR"),
  entry("sv4a_351", "화살꼬빈", "네모", "네모", "SAR"),
  entry("sv4a_352", "블래키", "모란", "모란", "SAR"),
  entry("sv4a_353", "무우마직", "모야모", "모야모", "SAR"),
  entry("sv4a_354", "마피티프", "페퍼", "페퍼", "SAR"),

  entry("m1s_066", "레오꼬", "그 외", "레오꼬", "AR"),
  entry("m1s_091", "따라큐", "아세로라", "아세로라의 장난", "SAR"),
  entry("m2a_197", "마그카르고", "심향", "심향의 마그카르고", "AR"),
  entry("m2a_204", "대로트", "호브", "호브의 대로트", "AR"),
  entry("m2a_205", "따라큐", "로켓단 간부", "로켓단의 따라큐", "AR"),
  entry("m2a_206", "닥트리오", "비주기", "로켓단의 닥트리오", "AR"),
  entry("m2a_208", "화강돌", "난천", "난천의 화강돌", "AR"),
  entry("m2a_210", "제크로무", "N", "N의 제크로무", "AR"),
  entry("m2a_220", "로토무", "카나리", "카나리", "SR"),
  entry("m2a_242", "조로아크", "N", "N의 조로아크 ex", "SAR"),
  entry("m2a_243", "오롱털", "마리", "마리의 오롱털 ex", "SAR"),
  entry("m2a_245", "메타그로스", "성호", "성호의 메타그로스 ex", "SAR"),
  entry("m2a_248", "액스라이즈", "아이리스", "아이리스의 투지", "SAR"),
  entry("m2a_249", "님피아", "카나리", "카나리", "SAR"),
  entry("m4_092", "메탕구", "그 외", "메탕구", "AR"),
  entry("m4_118", "플라엣테", "AZ", "AZ의 평온", "SAR"),
];

const removedCodes = new Set(["sv9a_091/063", "m2_034/080"]);
const canonicalSets = {
  sv1s: ["SV1S", "스칼렛 ex"],
  sv1v: ["SV1V", "바이올렛 ex"],
  sv1a: ["SV1a", "트리플렛비트"],
  sv2d: ["SV2D", "클레이버스트"],
  sv2a: ["SV2a", "포켓몬 카드 151"],
  sv3: ["SV3", "흑염의 지배자"],
  sv3a: ["SV3a", "레이징서프"],
  sv4k: ["SV4K", "고대의 포효"],
  sv4m: ["SV4M", "미래의 일섬"],
  sv4a: ["SV4a", "샤이니트레저 ex"],
  sv5k: ["SV5K", "와일드포스"],
  sv5m: ["SV5M", "사이버저지"],
  sv5a: ["SV5a", "크림슨헤이즈"],
  sv6: ["SV6", "변환의 가면"],
  sv7: ["SV7", "스텔라미라클"],
  sv7a: ["SV7a", "낙원드래고나"],
  sv9: ["SV9", "배틀파트너즈"],
  sv9a: ["SV9a", "열풍의 아레나"],
  sv10: ["SV10", "로켓단의 영광"],
  sv11w: ["SV11W", "화이트플레어"],
  m1s: ["M1S", "메가심포니아"],
  m2a: ["M2a", "MEGA 드림 ex"],
  m4: ["M4", "닌자스피너"],
};

const normalCode = (value) => String(value || "").trim().split(/\s+/, 1)[0].toLowerCase();
const idOf = (code) => normalCode(code).split("/", 1)[0];
const currentCards = data.groups.flatMap((group) =>
  (group.cards || []).map((card) => ({ group, card })),
);
const beforeIndices = new Map(
  currentCards
    .filter(({ card }) => !removedCodes.has(normalCode(card.code)))
    .map(({ card }) => [normalCode(card.code), card.accountIndex]),
);
const existingByCode = new Map(currentCards.map((item) => [normalCode(item.card.code), item]));

for (const group of data.groups) {
  group.cards = (group.cards || []).filter((card) => !removedCodes.has(normalCode(card.code)));
}
data.groups = data.groups.filter((group) => group.cards.length > 0);

const seriesCards = new Map();
for (const group of series) {
  for (const card of group.cards || []) seriesCards.set(idOf(card.code), { group, card });
}
const dexByName = new Map(pokedex.records.map((record) => [record.nameKo, record.number]));
const groupByName = new Map(data.groups.map((group) => [group.name, group]));
const retainedIds = new Set(retained.map(({ id }) => id));

assert.equal(retainedIds.size, retained.length, "duplicate retained audit id");
assert.equal(retained.filter(({ id }) => id.startsWith("sv")).length, 60);
assert.equal(retained.filter(({ id }) => /^m\d/.test(id)).length, 16);

let added = 0;
for (const audited of retained) {
  const setPrefix = audited.id.split("_", 1)[0];
  const canonical = canonicalSets[setPrefix];
  assert.ok(canonical, `missing canonical set metadata for ${audited.id}`);

  let seriesItem = seriesCards.get(audited.id);
  if (!seriesItem && audited.id.startsWith("sv4a_")) {
    const number = audited.id.slice(-3);
    seriesItem = {
      card: {
        code: `${audited.id}/190`,
        image: `https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_${number}.png`,
      },
    };
  }
  assert.ok(seriesItem, `missing series card for ${audited.id}`);

  const code = normalCode(seriesItem.card.code);
  const cardNumber = code.split("_", 2)[1];
  const existing = existingByCode.get(code);
  let group = existing?.group || groupByName.get(audited.pokemonName);
  if (!group) {
    const nationalDexNo = dexByName.get(audited.pokemonName);
    assert.ok(nationalDexNo, `missing National Dex number for ${audited.pokemonName}`);
    group = { name: audited.pokemonName, nationalDexNo, cards: [] };
    data.groups.push(group);
    groupByName.set(group.name, group);
  }
  if (existing) {
    assert.equal(existing.group.name, audited.pokemonName, `unexpected group move for ${code}`);
  }

  const personType = audited.personName === "그 외" || audited.personName.includes("조무래기") || audited.personName.includes("간부")
    ? "other"
    : "named";
  const next = {
    ...(existing?.card || {}),
    personName: audited.personName,
    personType,
    set: canonical[0],
    setName: canonical[1],
    rarity: audited.rarity,
    cardNumber,
    code,
    illustrator: existing?.card.illustrator || "",
    image: seriesItem.card.image,
    source: existing?.card.source || "https://pokemoncard.co.kr/cards",
    sceneTags: ["사람과 포켓몬", "실물 이미지 전수 검수"],
    name: audited.name,
    pokemonName: audited.pokemonName,
    owned: existing?.card.owned ?? false,
    verification: "reviewed-official-korean-image-20260911",
  };

  if (existing) {
    const index = group.cards.indexOf(existing.card);
    assert.notEqual(index, -1, `existing card disappeared: ${code}`);
    next.accountIndex = existing.card.accountIndex;
    next.order = existing.card.order;
    if ("trainer" in existing.card) next.trainer = audited.personName;
    group.cards[index] = next;
  } else {
    const usedAccountIndices = group.cards.map((card) => card.accountIndex).filter(Number.isInteger);
    const usedOrders = group.cards.map((card) => card.order).filter(Number.isInteger);
    next.accountIndex = usedAccountIndices.length ? Math.max(...usedAccountIndices) + 1 : 0;
    next.order = usedOrders.length ? Math.max(...usedOrders) + 1 : 1;
    group.cards.push(next);
    added += 1;
  }
}

data.groups.sort((a, b) => a.nationalDexNo - b.nationalDexNo);
const finalCards = data.groups.flatMap((group) => group.cards || []);
const afterByCode = new Map(finalCards.map((card) => [normalCode(card.code), card]));

assert.ok([0, 50].includes(added), `unexpected number of newly added cards: ${added}`);
assert.equal(finalCards.length, 245);
assert.equal(new Set(finalCards.map((card) => normalCode(card.code))).size, finalCards.length);
for (const [code, accountIndex] of beforeIndices) {
  const card = afterByCode.get(code);
  assert.ok(card, `retained pre-audit card missing: ${code}`);
  assert.equal(card.accountIndex, accountIndex, `accountIndex changed: ${code}`);
}
for (const code of removedCodes) assert.equal(afterByCode.has(code), false, `excluded card retained: ${code}`);

data.version = 6;
data.updatedAt = "2026-09-11";
data.catalogCount = finalCards.length;
data.audit = {
  ...data.audit,
  scope: ["S", "SM", "SV", "M"],
  series: {
    ...data.audit.series,
    SV: { reviewed: 3336, included: 60, added: 40, removed: 1, excluded: 3276 },
    M: { reviewed: 902, included: 16, added: 10, removed: 1, excluded: 886 },
  },
  addedThisAudit: 118,
  removedThisAudit: ["s8b_081/184", "sv9a_091/063", "m2_034/080"],
  fixedImages: ["s9a_083/067", "s9a_084/067"],
  held: [],
  poolAdjustments: [
    "SV4a 191~360번 공식 이미지 170장을 누락 풀에 추가해 전수 판독",
    "M1L 093, M2 116, M2a 250, M3 117은 공식 카드 DB와 이미지에 없는 비실재 행으로 검수 모수에서 제외",
    "M4 120/083은 공식 상세 DB와 보조 실물 이미지로 확인했으며 사람 미등장으로 제외",
  ],
};

await writeFile(dataUrl, `${JSON.stringify(data, null, 2)}\n`);
console.log(`trainer-pokemon audit applied: ${finalCards.length} cards, ${data.groups.length} Pokemon groups, ${added} added`);
