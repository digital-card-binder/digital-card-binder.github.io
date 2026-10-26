import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const load=p=>JSON.parse(fs.readFileSync(new URL("../"+p,import.meta.url),"utf8"));
test("XY CP3 verified theme registrations retain complete evidence and unreviewed holds",()=>{
 const ledger=load("data/audits/theme-xy-all-37-sets-review-checkpoint-20261026.json");
 const themes=load("data/art-themes.json");
 const status=load("data/audits/theme-series-review-status.json");
 const story=load("data/art-theme-story-review.json");
 assert.equal(ledger.masterSetCount,37);
 assert.equal(ledger.masterCardCount,2313);
 assert.equal(ledger.originalThemeRows,8);
 assert.equal(ledger.newThemeRows,9);
 assert.equal(ledger.newArtworkFullyScreenedCount,4);
 assert.equal(ledger.remainingArtworkNotFullyScreenedCount,2309);
 assert.equal(ledger.strictCompletedSetCount,0);
 assert.equal(ledger.sets.reduce((n,s)=>n+s.cards.length,0),2313);
 assert.equal(ledger.sets.reduce((n,s)=>n+s.currentThemeRows,0),17);
 assert.equal(status.reviews.CP3.status,"partial");
 assert.equal(status.reviews.CP3.reviewedCardCount,4);
 const get=(theme,code)=>themes.groups.find(g=>g.code===theme).cards.find(c=>c.code===code&&c.set==="CP3");
 for(const code of ["CP3_003","CP3_004","CP3_005"]) {
   assert.ok(get("evolution",code),code);
   assert.equal(story.groups.evolution.cards[code].status,"accepted");
   assert.ok(get("color",code),code);
 }
 assert.ok(get("color","CP3_010"));
 assert.ok(get("season","CP3_005"));
 assert.ok(get("season","CP3_010"));
 for(const item of ledger.visualEvidence) {
   assert.match(item.canonicalImage,/pokemonkorea[.]co[.]kr/);
   assert.equal(item.allTwelveThemesScreenedForThisCard,true);
 }
});
