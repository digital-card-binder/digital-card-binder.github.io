#!/usr/bin/env node
// Resumable, idempotent Korean SM2L visual theme addition.
// Only SM2L 005/050 Chandelure: verified Korean physical-print photo and color artwork.
// This deliberately does NOT declare the other 61 artworks reviewed and does NOT add
// an evolution/connected/scene story based on species names alone.
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const write = (path, data) => fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
const auditPath = "data/audits/theme-sm2l-005-korean-color-20261019.json";
const themesPath = "data/art-themes.json";
const testsPath = "tests/theme-card-identity.test.mjs";
const themes = read(themesPath);
const master = read("data/series.json");
const set = master.find(g => String(g.code).toLowerCase() === "sm2l");
assert.equal(set?.cards?.length, 62);
const card = set.cards.find(c => c.code?.toLowerCase() === "sm2l_005/050");
assert.equal(card?.name, "샹델라");
assert.match(card.image, /\/SM2L\/SM2L_005\.png$/);
assert.equal(themes.groups.length, 12);
const oldCounts = Object.fromEntries(themes.groups.map(g => [g.code, g.cards.length]));
const total = () => themes.groups.reduce((sum, group) => sum + group.cards.length, 0);
const already = themes.groups.filter(g => g.cards.some(c => c.code?.toUpperCase() === "SM2L_005"));
const color = themes.groups.find(g => g.code === "color");
assert.ok(color);
if (already.length > 0) {
  // Safe if a prior run already applied exactly this change.
  assert.deepEqual(already.map(g => g.code), ["color"]);
  assert.ok(color.cards.some(c => c.code === "SM2L_005" && c.category === "보라·주황"));
  assert.ok(fs.existsSync(auditPath));
  console.log("SM2L_005 already accepted; no duplicate added");
  process.exit(0);
}
assert.equal(total(), 17912, "Theme catalogue baseline changed: stop instead of overriding concurrent work");
assert.ok(!fs.existsSync(auditPath));
assert.equal(themes.groups.reduce((n,g)=>n+g.cards.filter(c => String(c.set).toLowerCase()==="sm2l").length,0), 0);
const entry = {
  code: "SM2L_005",
  name: "샹델라",
  series: "SM",
  set: set.code,
  setName: set.displayName,
  cardNumber: "005/050",
  rarity: "R",
  category: "보라·주황",
  image: card.image,
  evidence: "한국어 실물 카드 사진의 샹델라·SM2L 005/050 표기와 보라빛 불꽃·주황빛 배경을 확인했고, 한국 판매 목록의 동일 카드 번호를 대조했다. 색상 테마만 수록하며 진화·연결·스토리 관계는 미확정. 자료: data/audits/theme-sm2l-005-korean-color-20261019.json"
};
color.cards.push(entry);
themes.updatedAt = "2026-10-19";
assert.equal(total(), 17913);
assert.equal(color.cards.length, oldCounts.color + 1);
for (const group of themes.groups) if (group.code !== "color") assert.equal(group.cards.length, oldCounts[group.code]);

const oldTest = fs.readFileSync(testsPath, "utf8");
const oldAssertion = "assert.equal(total,17912); // Korean SM2K 056 verified color-theme addition";
assert.equal(oldTest.split(oldAssertion).length, 2, "Test baseline changed");
const newTest = oldTest.replace(oldAssertion, "assert.equal(total,17913); // Korean SM2L 005 verified color-theme addition");
const audit = {
  schemaVersion: 1,
  recordedAt: "2026-10-19",
  series: "sm2L",
  setName: set.displayName,
  totalMasterSlots: 62,
  resumeFrom: "data/audits/theme-resume-sm2k-holds-sm2l-next-20261019.json",
  checkpoint: {
    completedVisualThemeReviews: 1,
    reviewedCodes: ["SM2L_005"],
    notReviewed: 61,
    nextStart: "SM2L_001..004 then 006 onwards, review each Korean print artwork; skip already reviewed 005.",
    priorSM2KHoldCodesStillPending: ["SM2K_057","SM2K_058","SM2K_060","SM2K_061","SM2K_062"]
  },
  verifiedCard: {
    code: entry.code,
    KoreanPrintedName: "샹델라",
    printedNumber: "005/050",
    rarity: "R",
    actualKoreanPhotoSeen: true,
    imageArtworkObservation: "보라색 유령 불꽃과 주황빛/갈색 불꽃 배경",
    themeSelected: "color",
    category: entry.category,
    noOtherThemeApproved: true,
    sourceEvidence: [
      {kind: "Korean physical printed card image", url: "https://www.ebay.com/itm/264592777875", note: "실물 사진에서 한글 카드 이름, 기술 텍스트 및 005/050 하단 표기 확인."},
      {kind: "Korean card seller catalogue", url: "https://tcgbox.co.kr/product/%EC%83%B9%EB%8D%B8%EB%9D%BCsml2/3980/", note: "SM2L 005 Korean card listing."},
      {kind: "Korean set catalogue", url: "https://carahi.kr/set/pokemon/%EC%95%8C%EB%A1%9C%EB%9D%BC%EC%9D%98%EB%8B%AC%EB%B9%9B-%ED%95%9C%EA%B8%80%ED%8C%90", note: "Korean SM2L membership reference."}
    ],
    imageRenderingSource: card.image,
    imageHostingNote: "Preserved pre-existing canonical image source; existing CDN resolver operates at runtime. Exact own-CDN pixel-to-photo matching and redistribution rights not independently verified; no external seller photo copied or self-hosted.",
    noImageFileModified: true
  },
  themeSlotsBefore: oldCounts,
  themeSlotsAfter: Object.fromEntries(themes.groups.map(g => [g.code,g.cards.length])),
  totalBefore: 17912,
  totalAfter: 17913,
  safeguards: {existingCardIdsModified:0,masterCardsModified:0,ownershipDataModified:0,firestoreModified:0,otherThemeGroupsModified:0,previousApprovedThemeRowsModified:0,newThemeRows:1},
  noFalseClaimOf62CardCompletion: true
};
write(themesPath, themes);
write(auditPath, audit);
fs.writeFileSync(testsPath, newTest);
console.log("SM2L_005_KOREAN_COLOR_APPROVED", JSON.stringify({card:entry.code,addedThemeRows:1,previousTotal:17912,newTotal:17913}));
