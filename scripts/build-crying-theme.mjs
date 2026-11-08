import fs from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url);
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, root), "utf8"));
const write = (name, value) =>
  fs.writeFileSync(new URL(name, root), JSON.stringify(value, null, 2) + "\n", "utf8");
const master = [...read("data/series.json"), ...read("data/series-legacy.json")];
const sources = read("data/audits/crying-theme-reference-pool-20261108.json");
const seeds = [
  { set: "SV1V", no: "086", name: "슬리프", category: "쓸쓸함 · 우울", foreign: "Drowzee · Scarlet & Violet 210", source: "pokecardlists" },
  { set: "SV1V", no: "088", name: "마피티프", category: "슬픔 · 걱정", foreign: "Mabosstiff · Scarlet & Violet 218", source: "pokecardlists" },
  { set: "SV2D", no: "075", name: "모래꿍", category: "외로움", foreign: "Sandygast · Paldea Evolved 214", source: "pokecardlists" },
  { set: "S12a", no: "196", name: "히스이 미끄래곤", category: "속상함 · 외로움", foreign: "Hisuian Goodra · Crown Zenith GG21", source: "pokecardlists" },
  { set: "S10a", no: "055", name: "히스이 미끄래곤", category: "슬픔 · 불안", foreign: "Hisuian Goodra · Lost Origin 134", source: "pokecardlists" },
  { set: "S10a", no: "056", name: "히스이 미끄래곤 V", category: "슬픔 · 불안", foreign: "Hisuian Goodra V · Lost Origin 135", source: "pokecardlists" },
  { set: "S10a", no: "057", name: "히스이 미끄래곤 VSTAR", category: "슬픔 · 불안", foreign: "Hisuian Goodra VSTAR · Lost Origin 136", source: "pokecardlists" },
  { set: "SV6", no: "104", name: "눈여아", category: "고독 · 쓸쓸함", foreign: "Froslass · Twilight Masquerade 174", source: "illudex" },
  { set: "M6a", no: "022", name: "피카츄", category: "외로움", foreign: "Pikachu · 30th Celebration 028", source: "pokecardlists" },
];
// Pass 2: only pixel-confirmed identical card art or original Japanese-print mapping.
const visualAudit = read("data/audits/crying-theme-image-similarity-20261108.json");
const sourceMapped = read("data/audits/crying-theme-korean-original-print-mappings-20261108.json");
const illudexMapped = read("data/audits/crying-theme-illudex-original-print-mappings-20261108.json");
const mood = (name) => {
  if (name === "Sobble") return "울음 · 속상함";
  if (name === "Cubone") return "슬픔 · 외로움";
  if (name === "Hisuian Goodra") return "속상함 · 외로움";
  if (name === "Rockruff") return "외로움 · 위로";
  if (name === "Trubbish") return "쓸쓸함 · 속상함";
  if (name === "Bonsly") return "울음 · 슬픔";
  return "외로움 · 슬픔";
};
const scoredSeeds = visualAudit.items.flatMap((item) => (item.top || [])
  .filter((hit) => item.englishImageDownloaded
      && hit.score >= 90 && hit.maxInliers >= 60
      && Math.max(hit.scoreArtCorrelation, hit.scoreFullCorrelation) >= 0.60)
  .map((hit) => ({
    set: hit.set, no: hit.key.split("_").pop(), name: hit.name,
    category: mood(item.english),
    foreign: item.english + " · " + item.englishSet + " " + item.englishNumber,
    source: "pokecardlists",
    supplemental: true,
    evidenceDetail: "해외판-한국판 동일 일러스트 화상 특징점 대조: "
      + hit.maxInliers + "개 유효 대응점, 최고 점수 " + hit.score
      + ". 해외 원본 " + item.englishImageUrl
  })));
const printMappedSeeds = sourceMapped.mappings.map((m) => ({
  set: m.set, no: m.no, name: m.name, category: mood(m.en),
  foreign: m.en + " · " + m.setEn + " " + m.numberEn,
  source: "pokecardlists", supplemental: true,
  evidenceDetail: "동일 일본판 원본 인쇄 " + m.japanese
    + " 및 한국판 마스터 DB 번호 대조: " + m.url
}));
function getPrintedNo(card) {
  const str = String(card.code || "").split("_").slice(1).join("_");
  return (str.match(/^([0-9]{1,3})(?:[/]([0-9]+))?/) || []).slice(1);
}
const cards = [], used = new Set();
const illudexSeeds = illudexMapped.mappings.map((m) => ({
  set: m.set, no: m.no, name: m.name, category: "쓸쓸함 · 외로움",
  foreign: m.en + " · " + m.setEn + " " + m.numberEn + " (" + m.artist + ")",
  source: "illudex", supplemental: true,
  evidenceDetail: "Illudex의 감정 분류와 원본 일러스트레이터 " + m.artist +
    ", 일본판 원본 인쇄 " + m.japanese + " 대조. " + m.url
}));
for (const seed of [...seeds, ...scoredSeeds, ...printMappedSeeds, ...illudexSeeds]) {
  const group = master.find((g) => String(g.code).toLowerCase() === seed.set.toLowerCase());
  if (!group) throw Error("Korean set not found: " + seed.set);
  const matched = (group.cards || []).filter((c) => {
    const [no] = getPrintedNo(c);
    return no && no.padStart(3, "0") === seed.no;
  });
  if (matched.length !== 1) throw Error("Unverified or ambiguous Korean print " + seed.set + "_" + seed.no + ": " + matched.length);
  const sourceCard = matched[0];
  if (sourceCard.name !== seed.name) throw Error("Korean name mismatch " + seed.set + "_" + seed.no + ": " + sourceCard.name);
  if (!sourceCard.image || !/^https:\/\//.test(sourceCard.image)) throw Error("No Korean image for " + seed.set + "_" + seed.no);
  const key = String(group.code).toUpperCase() + "_" + seed.no;
  if (used.has(key)) {
    if (seed.supplemental) continue; // Keep the first nine account indexes unchanged.
    throw Error("Duplicate Korean print " + key);
  }
  used.add(key);
  const [, denominator] = getPrintedNo(sourceCard);
  const code = String(group.code).toUpperCase();
  const era = /^SV/.test(code) ? "SV" : /^SM/.test(code) ? "SM"
    : /^XY|^CP|^RBD/.test(code) ? "XY"
    : /^BW|^EBB/.test(code) ? "BW"
    : /^DP|^BS/.test(code) ? "DP"
    : /^M[0-9]/.test(code) ? "M" : "S";
  cards.push({
    code: key, name: sourceCard.name,
    // Earlier, an incorrect 30th Pikachu occupied the ninth slot. Keep its
    // exact existing account key when displaying the corrected Korean art.
    ...(key === "M6A_022" ? { meta: "M6A_028", legacyIdentityCode: "M6A_028" } : {}),
    series: era,
    set: group.code, setName: group.name || "",
    cardNumber: seed.no + (denominator ? "/" + denominator : ""),
    rarity: sourceCard.rarity || "", category: seed.category,
    evidence: "한국판 마스터 DB 세트·카드번호·한국어 카드명 대조. 해외 참고: " + seed.foreign + "."
      + (seed.evidenceDetail ? " " + seed.evidenceDetail : ""),
    image: sourceCard.image,
    source: sourceCard.source || ""
  });
}
const output = {
  schemaVersion: 1,
  updatedAt: "2026-11-08",
  title: "우는 포켓몬 도감",
  group: {
    code: "crying", name: "우는 포켓몬 도감", badge: "SAD & LONELY", icon: "💧",
    description: "울거나 슬프고, 속상하거나 외로워 보이는 장면. 한국어판 동일 일러스트와 세트번호를 검증한 카드만 수록합니다.",
    cards
  },
  sources: [
    { name: "PokéCardLists", url: "https://pokecardlists.com/sad-pokemon-card-list/", note: "35장 참고 목록" },
    { name: "woahpoke", url: "https://woahpoke.com/sad-pokemon-cards/", note: "31장 참고 목록" },
    { name: "Illudex", url: "https://www.illudex.com/art/melancholy-pokemon-card-art", note: "멜랑콜리 94장 중 42장 공개 갤러리" }
  ]
};
write("data/art-themes-crying.json", output);
write("data/audits/crying-theme-korean-matches-20261108.json", {
  schemaVersion: 1, checkedAt: "2026-11-08",
  referenceEntries: sources.sources.map((s) => ({ id: s.id, claimed: s.claimedCount, enumerated: s.enumeratedCount })),
  totalEnumeratedReferences: sources.sources.reduce((sum, s) => sum + s.enumeratedCount, 0),
  notEnumeratedFromIlludex: 52,
  importedKoreanCards: cards.length,
  priorVerifiedCards: seeds.length,
  newlyVerifiedCardPrints: cards.length - seeds.length,
  foreignPrimaryScansCompared: visualAudit.items.length,
  foreignPrimaryScansAvailable: visualAudit.network.downloadedForeign,
  foreignPrimaryScansUnavailable: visualAudit.items.filter((i) => !i.englishImageDownloaded).map((i) => i.english + " / " + i.englishSet),
  visualProofPath: "data/audits/crying-theme-image-similarity-20261108.json",
  printMappingProofPath: "data/audits/crying-theme-korean-original-print-mappings-20261108.json",
  illudexProofPath: "data/audits/crying-theme-illudex-original-print-mappings-20261108.json",
  correctedHistoricalArtwork: {
    priorCode: "M6A_028", correctCode: "M6A_022",
    originalAccountKey: "crying::M6A_028::8",
    preservedViaMeta: true
  },
  koreanCards: cards.map((card) => ({ code: card.code, name: card.name, set: card.set, cardNumber: card.cardNumber, image: card.image })),
  reviewedPolicy: "정확한 한국판 세트·인쇄번호·이름 대조. 해외 동일 일러스트/감정 후보를 참고하되 나머지 목록은 번호 및 일러스트 검증 전까지 추가 금지.",
  remainingCandidateStatus: "pending_individual_illustration_and_korean_print_verification",
  originalMasterUnchanged: true, existingOwnershipUnchanged: true
});
console.log("Crying Pokemon theme: " + cards.length + " confirmed Korean master records.");
