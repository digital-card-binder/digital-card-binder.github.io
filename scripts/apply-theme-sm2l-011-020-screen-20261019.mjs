#!/usr/bin/env node
// Continue Korean SM2L art-theme screening after the completed 001-010 checkpoint.
// 011 has a legible Korean physical printed copy. 012-020 are Korean-set
// catalogue matches with cross-language illustration references, NOT confirmed
// Korean print-image decodes. Do not count screening as a strict full-set audit.
import assert from "node:assert/strict";
import fs from "node:fs";

const load = p => JSON.parse(fs.readFileSync(p, "utf8"));
const save = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const themePath = "data/art-themes.json";
const auditPath = "data/audits/theme-sm2l-011-020-artwork-screen-20261019.json";
const testsPath = "tests/theme-card-identity.test.mjs";
const themes = load(themePath);
const master = load("data/series.json");
const set = master.find(s => String(s.code).toLowerCase() === "sm2l");
assert.equal(set?.cards?.length, 62);
assert.equal(themes.groups?.length, 12);
const byTheme = Object.fromEntries(themes.groups.map(g => [g.code, g]));
const total = () => themes.groups.reduce((n, g) => n + g.cards.length, 0);
const normalized = x => String(x || "").replace(/\s+/g, "");
const numbers = [
  {
    n: 11, name: "고래왕", rarity: "U",
    observation: "맑은 낮의 해변, 야자나무와 작은 섬, 파도 위로 솟아오르는 고래왕",
    tags: { color: "파랑·크림", season: "맑은 낮의 열대 해변과 야자나무" },
    illustration: "https://snkrdunk.com/en/trading-cards/336246",
    koreanPhoto: "https://www.ebay.com/itm/305269914427",
    exactKoreanPrintVerified: true
  },
  {
    n: 12, name: "맘복치", rarity: "U",
    observation: "맑고 푸른 바닷속의 분홍빛 맘복치와 산호·해초",
    tags: { color: "분홍·하늘", season: "산호와 해초가 있는 밝은 바닷속" },
    illustration: "https://snkrdunk.com/apparels/336247"
  },
  {
    n: 13, name: "약어리", rarity: "C",
    observation: "여러 마리 약어리가 헤엄치는 깊고 푸른 바다",
    tags: { color: "파랑·청록", season: "물고기 떼가 헤엄치는 푸른 수중 풍경" },
    illustration: "https://namba.hareruya2.com/products/33429"
  },
  {
    n: 14, name: "약어리 GX", rarity: "RR",
    observation: "큰 약어리 군집을 구성하는 작은 물고기들, 다채로운 푸른색과 선명한 녹색·붉은색 원화",
    tags: { color: "파랑·청록" },
    illustration: "https://okini.land/fr/52826-pokemon-tcg-sm2l-014-050-rr-wishiwashi-gx-the-pokemon-company.html"
  },
  {
    n: 15, name: "알로라꼬마돌", rarity: "C",
    observation: "청록빛 속이 비치는 어두운 바위 동굴에서 뛰쳐나오는 알로라꼬마돌",
    tags: { color: "회색·청록", season: "청록빛이 비치는 어두운 바위 동굴" },
    illustration: "https://okini.land/en/52827-pokemon-tcg-sm2l-015-050-c-alolan-geodude-the-pokemon-company.html"
  },
  {
    n: 16, name: "알로라데구리", rarity: "C",
    observation: "자주색·회색 바위지형과 전기 빛, 자철석 결정이 돋아 있는 알로라데구리",
    tags: { color: "회색·자주", season: "빛나는 광물이 드러난 바위지형" },
    illustration: "https://totalcards.net/products/pokemon-sun-moon-guardians-rising-alolan-graveler-41-145",
    provenanceCaution: "Japanese SM2L 016 is Alolan Graveler; some search summaries incorrectly call it Horsea. Crosschecked with Guardians Rising 41/145 and Korean SM2L 016."
  },
  {
    n: 17, name: "알로라딱구리", rarity: "R",
    observation: "검은 바위와 섬광이 폭발하며 노랑·회색 바위 조각이 흩날리는 그림",
    tags: { color: "검정·노랑" },
    illustration: "https://okini.land/en/52829-pokemon-tcg-sm2l-017-050-r-alolan-golem-the-pokemon-company.html"
  },
  {
    n: 18, name: "깨봉이", rarity: "C",
    observation: "바닥에 흩어진 종이 쓰레기와 갈색 바탕, 초록색 점토 인형형 깨봉이",
    tags: { color: "청록·갈색" },
    illustration: "https://otakumart.co.nz/products/trubbish-50-145-sun-moon-guardians-rising",
    sameArtworkIndependentEvidence: "https://bulbapedia.bulbagarden.net/wiki/Trubbish_(Guardians_Rising_50)"
  },
  {
    n: 19, name: "더스트나", rarity: "U",
    observation: "보라빛 유독 연기와 회색 폐기물 더미 사이에 서 있는 더스트나",
    tags: { color: "보라·회색" },
    illustration: "https://www.trollaustraliamelb.com.au/products/garbodor-019-050-sm2l-alolan-moonlight"
  },
  {
    n: 20, name: "따라큐", rarity: "R",
    observation: "어두운 청록 배경과 가는 빛줄기, 노란 천으로 덮인 따라큐",
    tags: { color: "노랑·청록" },
    illustration: "https://www.ebay.com/b/Mimikyu-020-050-Sm2l-Alolan-Moonlight/2536/bn_7124867701"
  }
];
const codes = numbers.map(c => "SM2L_" + String(c.n).padStart(3, "0"));
const priorCodes = Array.from({ length: 10 }, (_, i) => "SM2L_" + String(i + 1).padStart(3, "0"));
const expectedNew = numbers.reduce((n, x) => n + Object.keys(x.tags).length, 0);
assert.equal(expectedNew, 15);
const existing = themes.groups.flatMap(g => g.cards
  .filter(c => String(c.set).toLowerCase() === "sm2l")
  .map(c => ({ code: c.code, group: g.code })));
const existingCodes = [...new Set(existing.map(c => c.code))].sort();
if (fs.existsSync(auditPath)) {
  assert.equal(total(), 17944, "Expected finished theme total");
  assert.deepEqual(existingCodes, [...priorCodes, ...codes].sort());
  console.log("SM2L 011-020 batch already recorded; no duplicate work");
  process.exit(0);
}
assert.equal(total(), 17929, "Concurrent theme data changed; stop and rebase");
assert.deepEqual(existingCodes, [...priorCodes].sort(), "First ten SM2L artworks unexpectedly missing or changed");
const before = Object.fromEntries(themes.groups.map(g => [g.code, g.cards.length]));
for (const card of numbers) {
  const suffix = String(card.n).padStart(3, "0");
  const code = "SM2L_" + suffix;
  const canonical = set.cards.find(c => String(c.code).toUpperCase() === code + "/050");
  assert.ok(canonical, "Missing canonical " + code);
  assert.equal(normalized(canonical.name), normalized(card.name), code + " wrong Korean master identity");
  assert.match(canonical.image, new RegExp("/SM2L/SM2L_" + suffix + "\\.png$"), "Unexpected image source " + code);
  for (const [themeName, category] of Object.entries(card.tags)) {
    const g = byTheme[themeName];
    assert.ok(g, "Unrecognized theme " + themeName);
    assert.ok(!g.cards.some(c => c.code === code), "Duplicate theme " + code);
    g.cards.push({
      code, name: canonical.name, series: "SM", set: set.code,
      setName: set.displayName, cardNumber: suffix + "/050",
      rarity: card.rarity, category, image: canonical.image,
      evidence: "SM2L " + suffix + "/050 한국 수록 이름/번호를 국내 체크리스트와 판매처로 확인; " +
        (card.exactKoreanPrintVerified ? "한국어 인쇄 실물 사진 및 대응하는 원화를 비교 확인. " :
          "한국어 실물 전면 픽셀은 별도로 확인하지 못함. 동일 원화 해외 인쇄판으로 화면 구성만 확인. ") +
        card.observation + "; 그림상 명확하지 않은 연결·진화·스토리·기타 테마는 추가하지 않음. " + auditPath
    });
  }
}
assert.equal(total(), 17944, "Unexpected number of new theme records");
for (const g of themes.groups) {
  const delta = numbers.filter(card => Object.hasOwn(card.tags, g.code)).length;
  assert.equal(g.cards.length, before[g.code] + delta, g.code);
}
themes.updatedAt = "2026-10-19";
const test = fs.readFileSync(testsPath, "utf8");
const needle = "assert.equal(total,17929); // SM2L 002,006,008,010 cross-language artwork continuation";
assert.equal(test.split(needle).length, 2, "Theme identity baseline changed; stop before altering test");
const nextTest = test.replace(needle,
  "assert.equal(total,17944); // SM2L 011-020: 1 Korean photographed, 9 matched-art screened");
const audit = {
  schemaVersion: 1, recordedAt: "2026-10-19",
  series: set.code, setName: set.displayName,
  previousCheckpoint: "data/audits/theme-sm2l-002-006-008-010-artwork-20261019.json",
  scope: "SM2L 011-020: confirmed KR set names and IDs; inspected matching illustration composition",
  cardCount: 10, cardCodes: codes,
  newThemeRecords: expectedNew, slotCountBefore: 17929, slotCountAfter: 17944,
  before, after: Object.fromEntries(themes.groups.map(g => [g.code, g.cards.length])),
  koreanPhotoDirectlyCheckedThisBatch: ["SM2L_011"],
  KoreanPrintedPhotosPendingThisBatch: codes.filter(x => x !== "SM2L_011"),
  artworkScreenedCumulative: 20,
  exactKoreanPhotoConfirmedCumulative: 7,
  previouslyHeldKoreanPhotos: ["SM2L_002", "SM2L_006", "SM2L_008", "SM2L_010"],
  cumulativeUnconfirmedKoreanPhotoCases: 13,
  unreviewedArtworksInSet: 42,
  nextArtworkRange: "SM2L_021..030",
  noEvolutionOrConnectedSetsInferred: true,
  canonicalImageReplacementCount: 0,
  dataSafety: { previousThemeRecordsModified: 0, canonicalMasterModified: 0, firestoreModified: 0, ownershipModified: 0 },
  evidenceBase: {
    koreanSetChecklist: "https://setory.site/sets/sm-alola-moonlight-kr",
    koreanRetailCatalogue: "https://tcgbox.co.kr/category/sm2%EC%95%8C%EB%A1%9C%EB%9D%BC%EC%9D%98-%EB%8B%AC%EB%B9%9B/109/",
    koreanImageIndex: "https://k-tcgpanda.com/cardimg/SM/SM2L/"
  },
  cards: numbers.map(c => {
    const printed = String(c.n).padStart(3, "0") + "/050";
    return {
      code: "SM2L_" + String(c.n).padStart(3, "0"), name: c.name,
      printedNumber: printed, rarity: c.rarity,
      scene: c.observation, approvedThemes: c.tags,
      artworkEvidence: c.illustration,
      sourceKoreanPrint: c.koreanPhoto || null,
      exactKoreanPrintVerified: !!c.exactKoreanPrintVerified,
      sameArtworkIndependentEvidence: c.sameArtworkIndependentEvidence || null,
      provenanceCaution: c.provenanceCaution || null
    };
  })
};
save(themePath, themes);
save(auditPath, audit);
fs.writeFileSync(testsPath, nextTest);
console.log("SM2L_011_020_CONTINUATION", JSON.stringify({
  screened: 10, registeredThemeSlots: expectedNew, total: total(),
  koreanPrintVerifiedThisBatch: 1, koreanPrintPendingThisBatch: 9,
  artworkRemaining: 42
}));
