#!/usr/bin/env node
// Continue the already-approved Korean SM2L theme review, without restarting it.
// Evidence: directly inspected Korean Pokémon Korea card images for 001,003,004,007,009.
// No other SM2L artworks are marked visually reviewed by this script.
import assert from "node:assert/strict";
import fs from "node:fs";

const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
const auditPath = "data/audits/theme-sm2l-001-010-official-visual-review-20261019.json";
const themePath = "data/art-themes.json";
const testPath = "tests/theme-card-identity.test.mjs";
const themes = read(themePath);
const master = read("data/series.json");
const set = master.find(g => String(g.code).toLowerCase() === "sm2l");
assert.equal(set?.cards?.length, 62, "Do not mutate an unexpected master catalogue");
assert.equal(themes.groups.length, 12);
const byTheme = Object.fromEntries(themes.groups.map(g => [g.code, g]));
const total = () => themes.groups.reduce((n, g) => n + g.cards.length, 0);
const verified = [
  {
    n: 1, name: "나목령", rarity: "C",
    scene: "분홍빛 둥근 달과 어두운 숲, 나목령의 그림자를 한국판 공식 그림에서 확인",
    selected: {
      color: "분홍·자주",
      season: "붉은 달이 뜬 어두운 나무숲",
      night: "분홍빛 보름달이 보이는 숲의 밤"
    }
  },
  {
    n: 3, name: "불켜미", rarity: "C",
    scene: "회녹색의 짙고 안개 낀 숲에 촛불 포켓몬이 있는 그림",
    selected: {
      color: "회녹·남색",
      season: "어두운 나무숲과 안개 낀 배경"
    }
  },
  {
    n: 4, name: "램프라", rarity: "C",
    scene: "푸른 잎과 나무들이 있는 밝은 숲, 연두와 노랑 계열의 배경",
    selected: {
      color: "연두·노랑",
      season: "햇살이 드는 초록 숲과 나무 그늘"
    }
  },
  {
    n: 7, name: "염뉴트", rarity: "U",
    scene: "선명한 주황색 용암·불빛, 짙은 보라색과 검은 바위 동굴",
    selected: {
      color: "주황·보라"
    }
  },
  {
    n: 9, name: "독파리", rarity: "U",
    scene: "청록빛 해수와 푸른 해저 바위, 물속을 헤엄치는 독파리",
    selected: {
      color: "청록·남색",
      season: "짙푸른 물속 바위와 해저 풍경"
    }
  }
];
const expectedCodes = verified.map(x => "SM2L_" + String(x.n).padStart(3, "0"));
const expectedAdded = verified.reduce((n, x) => n + Object.keys(x.selected).length, 0);
assert.equal(expectedAdded, 10);
const existing = themes.groups.flatMap(g => g.cards
  .filter(c => String(c.set).toLowerCase() === "sm2l")
  .map(c => ({theme: g.code, code: c.code, category: c.category})));
if (existing.length !== 1) {
  const accepted = existing.filter(x => expectedCodes.includes(x.code));
  if (fs.existsSync(auditPath) && total() === 17923 && accepted.length === expectedAdded) {
    console.log("SM2L official artwork batch already recorded; no duplicate changes");
    process.exit(0);
  }
  throw new Error("Unexpected prior SM2L records: stop and protect existing approvals");
}
assert.equal(total(), 17913, "Theme slot baseline changed; re-audit before applying");
assert.deepEqual(existing, [{theme:"color",code:"SM2L_005",category:"보라·주황"}]);
assert.ok(!fs.existsSync(auditPath));
const oldCounts = Object.fromEntries(themes.groups.map(g => [g.code, g.cards.length]));
for (const row of verified) {
  const suffix = String(row.n).padStart(3, "0");
  const code = "SM2L_" + suffix;
  const card = set.cards.find(c => String(c.code).toUpperCase() === code + "/050");
  assert.equal(card?.name, row.name, code + " Korean master name");
  assert.match(card.image, new RegExp("/SM2L/SM2L_" + suffix + "\\.png$"), code + " official image URL");
  for (const [themeCode, category] of Object.entries(row.selected)) {
    const group = byTheme[themeCode];
    assert.ok(group, "Unknown independent theme " + themeCode);
    assert.ok(!group.cards.some(c => c.code === code), "Do not duplicate " + code + " in " + themeCode);
    group.cards.push({
      code,
      name: card.name,
      series: "SM",
      set: set.code,
      setName: set.displayName,
      cardNumber: suffix + "/050",
      rarity: row.rarity,
      category,
      image: card.image,
      evidence: "포켓몬코리아 공식 한국어판 전면 그림·하단 SM2L " + suffix +
        "/050 번호를 육안 대조. " + row.scene +
        ". 그림 근거가 없는 진화/연결/스토리 관계는 미추가. " + auditPath
    });
  }
}
assert.equal(total(), 17923);
for (const g of themes.groups) {
  const expectedDelta = verified.filter(x => Object.hasOwn(x.selected, g.code)).length;
  assert.equal(g.cards.length, oldCounts[g.code] + expectedDelta, g.code);
}
themes.updatedAt = "2026-10-19";
const originalTest = fs.readFileSync(testPath, "utf8");
const before = "assert.equal(total,17913); // Korean SM2L 005 verified color-theme addition";
assert.equal(originalTest.split(before).length, 2, "Theme-card identity test baseline mismatch");
fs.writeFileSync(testPath, originalTest.replace(before,
  "assert.equal(total,17923); // Korean SM2L 001,003,004,007,009 official-art continuation"));
const audit = {
  schemaVersion: 1,
  recordedAt: "2026-10-19",
  project: "Korean illustration theme audit - strict continuation",
  series: set.code,
  setName: set.displayName,
  parentCheckpoint: "data/audits/theme-sm2l-005-korean-color-20261019.json",
  priorReviewed: ["SM2L_005"],
  verifiedNew: expectedCodes,
  newReviewedCount: verified.length,
  cumulativelyReviewedInSet: 6,
  masterSlots: 62,
  unreviewedInSet: 56,
  newThemeRows: expectedAdded,
  totalThemeRowsBefore: 17913,
  totalThemeRowsAfter: 17923,
  oldThemeCounts: oldCounts,
  newThemeCounts: Object.fromEntries(themes.groups.map(g => [g.code, g.cards.length])),
  imagePolicy: "Official Korean printed image read visually at pokemoncard.co.kr and cards.image.pokemonkorea.co.kr; preserve existing master image paths. No outside photos copied, no image files replaced.",
  sourceIndexLead: "https://k-tcgpanda.com/cardimg/SM/SM2L/ (KOR image filenames indexed; those alone do not prove decoded image language)",
  cards: verified.map(x => {
    const num = String(x.n).padStart(3,"0");
    return {
      code: "SM2L_" + num,
      name: x.name, rarity: x.rarity, printedNumber: num + "/050",
      exactKoreanArtworkVisuallyInspected: true,
      officialCardPage: "https://pokemoncard.co.kr/cards/detail/BS2017005" + num,
      officialArtwork: "https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM2L/SM2L_" + num + ".png?w=512",
      illustrationObservation: x.scene,
      approvedIndependentThemes: x.selected,
      otherThemes: "not_approved_no_visual_evidence"
    };
  }),
  currentUnreviewedFirstBatch: ["SM2L_002","SM2L_006","SM2L_008","SM2L_010"],
  next: "Inspect SM2L_002, _006, _008, _010 Korean card artworks, then 011 onward; skip 001/003/004/005/007/009. SM2K 057/058/060/061/062 remain separately held.",
  safeguards: {
    canonicalCardsChanged: 0, ownershipChanged: 0, firestoreChanged: 0,
    priorApprovedRowsModified: 0, imageFilesChanged: 0, otherSetThemesChanged: 0
  }
};
write(themePath, themes);
write(auditPath, audit);
console.log("SM2L_OFFICIAL_VISUAL_CONTINUATION", JSON.stringify({
  reviewedNew: verified.length, newThemeRows: expectedAdded,
  priorTotal: 17913, newTotal: total(), remainingUnreviewed: 56
}));
