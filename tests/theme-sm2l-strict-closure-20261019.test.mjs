import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("SM2L 62 Korean printed identities close all 12 independent themes with no ownership key rewrite",()=>{
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const status=read("data/audits/theme-series-review-status.json");
const coverage=read("data/audits/theme-series-coverage.json");
const closure=read("data/audits/theme-sm2l-strict-closure-20261019.json");
const cards=read("data/series.json").find(x=>String(x.code).toLowerCase()==="sm2l").cards;
const themes=read("data/art-themes.json");
const review=Object.entries(status.reviews).find(([k])=>k.toLowerCase()==="sm2l")?.[1];
assert.equal(review?.status,"complete");
assert.equal(review?.reviewedCardCount,62);
assert.equal(review?.reviewedThemes.length,12);
assert.equal(closure.status,"complete");
assert.equal(closure.reviewedCardCount,62);
assert.equal(closure.proofDetails.unresolvedPrintedCardIdentityErrors,0);
assert.equal(closure.proofDetails.KoreanPrintedCardFooterNumbersChecked,62);
assert.equal(closure.proofDetails.KoreanCardNameAcceptedPrintedAliasCount,1);
assert.equal(closure.proofDetails.KoreanCardNameExactMatches,61);
assert.equal(closure.proofDetails.changeToOwnedCardIdentity,0);
assert.equal(closure.proofDetails.changedMasterCardRecords,0);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(coverage.summary.baselineRemainingSetCount,164);
assert.equal(coverage.summary.themeCardSlots,18011);
assert.equal(coverage.sets.find(x=>x.code.toLowerCase()==="sm2l")?.status,"complete");
assert.equal(cards.length,62);
const fought=cards.find(x=>x.code==="SM2L_062/050");
assert.equal(fought.name,"격투 에너지");
assert.equal(closure.acceptedPrintedNameAlias.actualKoreanPrintedName,"기본 격투 에너지");
const sm2lCards=themes.groups.flatMap(g=>g.cards.filter(c=>c.set.toLowerCase()==="sm2l"));
assert.deepEqual([...new Set(sm2lCards.map(c=>c.code))].sort(),
  Array.from({length:62},(_,i)=>"SM2L_"+String(i+1).padStart(3,"0")));
assert.equal(sm2lCards.length,99);
});
