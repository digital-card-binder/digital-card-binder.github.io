#!/usr/bin/env node
// Resume SM-era Korean card illustration classification at SM2+ 001-010 only.
// Scene tags come from direct visual review of the ten decoded Korean-image
// contact sheets recorded in theme-sm2plus-001-010-readonly-preflight-20261020.
// The artwork set/name identity is Korean; per-card footer enlargement still
// deserves independent manual check. Never touch earlier finished cards.
import fs from "node:fs";
import assert from "node:assert/strict";

const load = p => JSON.parse(fs.readFileSync(p, "utf8"));
const save = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
const themePath = "data/art-themes.json";
const statusPath = "data/audits/theme-series-review-status.json";
const auditPath = "data/audits/theme-sm2plus-001-010-korean-art-screen-20261020.json";
const testPath = "tests/theme-card-identity.test.mjs";
const reference = load("data/audits/theme-sm2plus-001-010-readonly-preflight-20261020.json");
const coverage = load("data/audits/theme-series-coverage.json");
const themeData = load(themePath);
const status = load(statusPath);
const base = load("data/series.json");
const legacy = load("data/series-legacy.json");
const set = [...base, ...legacy].find(x => String(x.code).toLowerCase() === "sm2+");
const REQUIRED_THEMES = ["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const count = () => themeData.groups.reduce((n, x) => n + x.cards.length, 0);
const normalize = x => String(x ?? "").replace(/\s+/g, "").toLowerCase();
assert.equal(set?.cards?.length, 75, "SM2+ catalogue slot count changed");
assert.equal(reference.totalMasterCards, 75);
assert.equal(reference.firstTenDownloadedAndDecoded, 10);
assert.equal(reference.existingThemeRowsPreserved, 0);
assert.equal(coverage.summary.themeCardSlots, 18011);
assert.equal(coverage.summary.strictCompleteSetCount, 109);
assert.equal(count(), 18011, "Another theme review changed the baseline; rebase before applying");
assert.deepEqual(new Set(themeData.groups.map(x => x.code)), new Set(REQUIRED_THEMES));
assert.equal(coverage.sets.find(x=>String(x.code).toLowerCase()==="sm2+")?.status, "pending");
const existing = themeData.groups.flatMap(g => g.cards
  .filter(card => String(card.set ?? "").toLowerCase() === "sm2+")
  .map(card => ({ theme: g.code, code: card.code })));
assert.equal(existing.length, 0, "Do not duplicate an existing SM2+ theme placement");
assert.ok(!fs.existsSync(auditPath), "This visual review already exists");

const reviewed = [
  { n:1, name:"모다피",
    scene:"울창한 초록 잎사귀와 나무뿌리 사이에서 모다피가 고개를 내미는 숲",
    tags:{color:"초록·노랑",season:"큰 잎과 뿌리가 빽빽한 푸른 숲"}},
  { n:2, name:"우츠동",
    scene:"나뭇가지와 열대 고사리 잎 사이에 노란 우츠동, 빽빽한 연녹색 식물",
    tags:{color:"노랑·초록",season:"고사리와 잎이 우거진 숲"}},
  { n:3, name:"우츠보트",
    scene:"어두운 열대 수목과 짙은 초록 그림자 속 우츠보트",
    tags:{color:"초록·회색",season:"햇빛이 적게 드는 짙은 숲"}},
  { n:4, name:"레디바",
    scene:"파란 하늘과 멀리 펼쳐진 풍경, 붉은 꽃밭 위를 날아가는 레디바",
    tags:{color:"빨강·하늘",season:"푸른 하늘 아래 붉은 꽃들이 만발한 들판"}},
  { n:5, name:"레디안",
    scene:"노랑과 연두빛 햇살이 숲을 채우고 레디안이 그늘 사이를 나는 장면",
    tags:{color:"주황·연두",season:"햇살이 스며든 밝은 숲"}},
  { n:6, name:"카푸브루루",
    scene:"검은 바위와 초록빛 숲 배경, 어두운 톤의 카푸브루루",
    tags:{color:"초록·검정"}},
  { n:7, name:"카푸브루루 GX",
    scene:"검은 외곽선과 붉은 기계적 질감, 강한 움직임이 강조된 GX 전투 원화",
    tags:{color:"빨강·검정"}},
  { n:8, name:"야도뇽",
    scene:"검은 바위 동굴과 불꽃·용암의 주황빛, 어둠 속 야도뇽",
    tags:{color:"검정·주황"}},
  { n:9, name:"염뉴트",
    scene:"붉은 용암 불길과 검은 화산성 바위 주변의 염뉴트",
    tags:{color:"주황·검정",season:"용암이 흐르는 화산성 암석 풍경"}},
  { n:10, name:"염뉴트 GX",
    scene:"짙은 회색 포켓몬과 선명한 주홍빛 불꽃 및 추상적 운동선의 GX 전투 원화",
    tags:{color:"빨강·검정"}}
];
assert.equal(reviewed.length, 10);
const expectedAdded = reviewed.reduce((n, card) => n + Object.keys(card.tags).length, 0);
assert.equal(expectedAdded, 16);
const countsBefore = Object.fromEntries(themeData.groups.map(g => [g.code, g.cards.length]));
const byTheme = Object.fromEntries(themeData.groups.map(g => [g.code,g]));
const entries = [];
for (const review of reviewed) {
  const suffix = String(review.n).padStart(3, "0");
  const identity = "sm2plus_" + suffix + "/049";
  const card = set.cards.find(c => normalize(c.code) === identity);
  assert.ok(card, "Missing canonical " + identity);
  assert.equal(normalize(card.name), normalize(review.name), "Korean printed title mismatch " + identity);
  assert.equal(card.image, "https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM2+/SM2plus_" + suffix + ".png");
  const proof = reference.cards[review.n - 1];
  assert.equal(normalize(proof.code), identity);
  assert.equal(proof.decoded, true, "Source image not decoded: " + identity);
  assert.equal(proof.name, card.name, "Image provenance and master Korean names differ");
  assert.equal(proof.image, card.image);
  assert.match(proof.imageSha256, /^[a-f0-9]{64}$/);
  for(const [themeCode, category] of Object.entries(review.tags)) {
    const group = byTheme[themeCode];
    assert.ok(group, "Unknown theme " + themeCode);
    const themeIdentity = "SM2PLUS_" + suffix;
    assert.ok(!group.cards.some(c=>c.code === themeIdentity), "Duplicate theme card " + themeIdentity);
    group.cards.push({
      code:themeIdentity, name:card.name, series:"SM", set:set.code,
      setName:set.displayName, cardNumber:suffix + "/049",
      rarity:card.rarity || "", category, image:card.image,
      evidence:"한국판 카드 전면 이미지 001-010 검토(고유 이미지 SHA-256 기록), " +
        "한국 마스터 이름/순번 및 국내 카드 카탈로그를 교차확인. " +
        review.scene + ". 시각적으로 확정되지 않은 연결·진화·야간·스토리 테마는 제외. " +
        "하단 인쇄번호 확대 대조는 별도 후속 점검. " + auditPath
    });
  }
  entries.push({
    code:"SM2PLUS_"+suffix, koreanName:review.name, canonicalCode:identity,
    catalogPrintedNumber:suffix+"/049", image:card.image,
    imageSha256:proof.imageSha256, imageDecoded:true,
    koreanCardFaceReviewed:true, enlargedFooterIndependentlyRead:false,
    artworkScene:review.scene, approvedIndependentThemes:review.tags,
    otherThemes:"no_verified_visual_match"
  });
}
assert.equal(count(), 18027);
for (const theme of themeData.groups) {
  const inc = reviewed.filter(card => Object.hasOwn(card.tags, theme.code)).length;
  assert.equal(theme.cards.length, countsBefore[theme.code] + inc);
}
themeData.updatedAt = "2026-10-20";
const test = fs.readFileSync(testPath, "utf8");
const target = "assert.equal(total,18011); // SM2L 047-048 Korean-only numbering resolved; all 62 artworks screened";
assert.ok(test.includes(target) && test.split(target).length === 2, "Unexpected identity test baseline");
const nextTest = test.replace(target,
  "assert.equal(total,18027); // Korean SM2+ 001-010 artwork-screened: color 10 and landscape 6");
const reviewKey = Object.keys(status.reviews||{}).find(k=>k.toLowerCase()==="sm2+") || "sm2+";
const prev = status.reviews?.[reviewKey] || {};
assert.ok(prev.status !== "complete", "No re-opening finished set");
status.reviews ??= {};
status.reviews[reviewKey] = {
  ...prev, status:"partial", reviewedAt:"2026-10-20", reviewedCardCount:10,
  reviewedThemes:REQUIRED_THEMES,
  evidence:auditPath,
  note:"Korean SM2+ 001-010 artwork and 12 theme labels visually screened, 16 matching independent placements; 011-075 not yet reviewed; printed footer enlargement pending."
};
const audit = {
  schemaVersion:1, recordedAt:"2026-10-20",
  set:"sm2+", setName:set.displayName, koreanMasterCardCount:75,
  range:"001-010", reviewedArtworkCount:10, exactSourceDecoded:10,
  priorSM2PlusThemeRows:0, newIndependentThemeRows:16, currentTotalThemeRows:18027,
  artworkColorCount:10, verifiedLandscapeSeasonCount:6, allTwelveThemesScreenedForThisRange:true,
  remainingArtworkCount:65, completeSetDeclared:false,
  sourcePreflight:"data/audits/theme-sm2plus-001-010-readonly-preflight-20261020.json",
  sourceKoreanCatalogues:[
    "https://setory.site/sets/sm-new-trials-kr",
    "https://collectory.cc/sets/56ce43c3-d8de-4bbd-87a7-c4249dc3d007"
  ],
  caveat:"Original ten source images decoded and Korean language / scene inspected. Printed bottom number not independently read at high magnification; none of 011-075 are claimed visually reviewed.",
  themeCountsBefore:countsBefore,
  themeCountsAfter:Object.fromEntries(themeData.groups.map(g=>[g.code,g.cards.length])),
  cards:entries,
  preservation:{
    original109CompleteSetsReopened:0, canonicalCardIdentityChanges:0,
    masterCardReplacements:0, existingThemeRowsModified:0,
    ownershipOrFirestoreChanges:0, cardRadarChanges:0
  },
  next:"SM2+ 011-030 Korean image identity and twelve independent artwork themes; continue sequentially, no repeats."
};
save(themePath, themeData);
save(statusPath, status);
save(auditPath, audit);
fs.writeFileSync(testPath, nextTest);
console.log("SM2PLUS_001_010_ARTWORK_REVIEW", JSON.stringify({
  cardsReviewed:10, newThemeRows:16, currentTotalThemeRows:count(),
  incompleteInSet:65, independentlyCheckedThemes:12
}));
