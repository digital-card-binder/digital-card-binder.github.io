#!/usr/bin/env node
/**
 * Resume Korean standalone theme-dex audit at the next three SM expansions.
 * Metadata preflight ONLY. Never equate an image URL with verified Korean
 * printing, and never auto-assign subjective artwork/story themes.
 * Run on the audit branch, not on main.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { URL } from "node:url";

const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const out = "data/audits/theme-sm9b-sm10-sm10a-master-preflight-20261022.json";
assert.ok(!fs.existsSync(out), "Existing reviewed preflight must not be overwritten");
const expected = [
  { code: "sm9b", name: "풀메탈월", count: 69 },
  { code: "sm10", name: "더블블레이즈", count: 116 },
  { code: "sm10a", name: "GG엔드", count: 69 },
];
const normalize = value => String(value ?? "").trim().toLowerCase();
const master = [...read("data/series.json"), ...read("data/series-legacy.json")];
const coverage = read("data/audits/theme-series-coverage.json");
const art = read("data/art-themes.json");
assert.equal(coverage.summary.themeCardSlots, 20570,
  "The prior SM6b/SM7/SM7a batch must be present. Do not restart from main.");
assert.equal(coverage.summary.strictCompleteSetCount, 109);
assert.equal(coverage.summary.masterSetCount, 273);
assert.equal(art.groups.reduce((n, g) => n + g.cards.length, 0), 20570);
assert.equal(art.groups.length, 12);
const knownCodes = new Set(art.groups.map(group => group.code));
assert.deepEqual([...knownCodes].sort(),
  ["sleeping", "connected", "evolution", "night", "season", "color",
   "sunset", "reflections", "food", "street", "work", "cameo"].sort());
const queue = [], summaries = [];
for (const {code, name, count} of expected) {
  const match = master.filter(set => normalize(set.code) === code);
  assert.equal(match.length, 1, code + " master-set identity conflict");
  const set = match[0];
  assert.equal(set.cards.length, count, code + " canonical-card count drift");
  const status = coverage.sets.filter(s => normalize(s.code) === code);
  assert.equal(status.length, 1, code + " coverage record missing");
  assert.equal(status[0].status, "pending", code + " already under review");
  assert.equal(status[0].cardCount, count);
  const priorThemes = Object.fromEntries(art.groups.map(g => [
    g.code, g.cards.filter(card => normalize(card.set) === code).length
  ]));
  for (const [theme, amount] of Object.entries(priorThemes)) {
    assert.equal(amount, status[0].themeHits?.[theme] ?? 0,
      code + " " + theme + " preexisting entries mismatch");
  }
  const seen = new Set(), sourceHosts = {}, repeatedSources = [];
  let nonOfficial = 0, malformedIds = 0;
  for (let i = 0; i < count; i++) {
    const card = set.cards[i], n = i + 1;
    const canonicalCode = String(card.code ?? "");
    const expectedPattern = new RegExp("^" + code + "_[0-9]{3}/[0-9]{3}$", "i");
    const patternMatched = expectedPattern.test(canonicalCode) &&
      Number(canonicalCode.match(/_([0-9]{3})\//)?.[1]) === n;
    if (!patternMatched) malformedIds++;
    const source = String(card.image ?? "");
    let host = null;
    try { const parsed = new URL(source); if (parsed.protocol === "https:") host = parsed.hostname; }
    catch { /* Missing or non-URL source is held, never silently approved. */ }
    const refKind = host === "cards.image.pokemonkorea.co.kr"
      ? "pokemonkorea_card_image_url" : "third_party_or_missing_image_url";
    if (refKind !== "pokemonkorea_card_image_url") nonOfficial++;
    if (host) sourceHosts[host] = (sourceHosts[host] || 0) + 1;
    if (source && seen.has(source)) repeatedSources.push(n);
    if (source) seen.add(source);
    queue.push({
      set: code, index: n, canonicalCode, koreanNameInMaster: card.name ?? "",
      originalImageReference: source, imageHost: host, referenceKind: refKind,
      canonicalCodePatternMatched: patternMatched,
      sourceDuplicatedWithinSet: repeatedSources.includes(n),
      sourceHttpCheckedInThisPass: false, imageSha256CheckedInThisPass: false,
      printedKoreanFooterVerifiedInThisPass: false,
      artworkVisuallyReviewedInThisPass: false,
      thematicEligibility: "not_yet_reviewed", proposedThemeMemberships: []
    });
  }
  summaries.push({
    set: code, name, masterCardCount: count, coverageStatus: "pending",
    existingIndependentThemeSlots: Object.values(priorThemes).reduce((a,b)=>a+b,0),
    existingThemeHits: Object.fromEntries(Object.entries(priorThemes).filter(([,v])=>v)),
    nonOfficialImageReferences: nonOfficial,
    imageHosts: sourceHosts, duplicateWithinSetIndices: repeatedSources,
    malformedCanonicalIndices: queue.filter(x=>x.set===code && !x.canonicalCodePatternMatched)
      .map(x=>x.index), visuallyReviewed: 0, newlyAssignedThemes: 0
  });
}
assert.equal(queue.length, 254);
assert.equal(new Set(queue.map(x=>x.set + ":" + x.index)).size, 254);
const report = {
  schemaVersion: 1, recordedAt: "2026-10-22",
  kind: "metadata-only-next-three-Korean-SM-theme-audit",
  basePreviousDraftPR: 271, basePreviousDraftHead: "557ea5b79a1be032eaba1a2ed9935b7934ecb83c",
  setsInOrder: ["sm9b", "sm10", "sm10a"], totalCanonicalSlots: 254,
  priorThemeSlotsPreserved: 20570, previousStrictCompleteSetsPreserved: 109,
  note: "A URL, filename or successful HTTP response is NOT proof of Korean printed identity or theme. Pre-existing SM10 three sleeping and SM10a one sleeping entries must remain independent.",
  sourceHttpChecks: 0, directImageVisualReviews: 0,
  printedKoreanFooterChecks: 0, newlyWrittenThemeRows: 0,
  masterDbChanged: false, userOwnershipChanged: false,
  firestoreChanged: false, cardRadarChanged: false,
  nextSteps: [
    "HTTP decode, SHA256 and check repeats for all 254 exact source images.",
    "Inspect each Korean card image in contact sheets, hold suspect foreign or unconfirmed printed numbers.",
    "Tag the 12 standalone themes only where the actual image justifies membership; preserve existing thematic entries.",
    "Never infer evolution, linked illustration or story from mere species or chronological proximity.",
    "Run regression tests on audit branch; do not merge or deploy until evidence and review are complete."
  ], summaries, cardQueue: queue
};
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log("NEXT_THREE_SM_THEME_PREFLIGHT", JSON.stringify({
  cards: queue.length, groups: summaries, out
}));
