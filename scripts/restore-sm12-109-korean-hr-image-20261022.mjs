#!/usr/bin/env node
/** Exactly one Korean high-rarity image repair, backed by original picture + footer evidence. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const rd=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const proof=rd('data/audits/theme-sm19-sm12-109-print-verified-20261022.json');
assert.equal(proof.acceptedCount,1);
assert.deepEqual(proof.reviewed,['sm12_109/095']);
const a=proof.accepted[0];
assert.equal(a.code,'sm12_109/095');
assert.equal(a.name,'불카모스 GX');
assert.equal(a.printedNumber,'109/095');
assert.equal(a.printedRarity,'HR');
assert.ok(a.sha256&&/^[0-9a-f]{64}$/.test(a.sha256));
assert.equal(a.newUrl,'https://tcgbox.co.kr/web/product/big/sm12/SM12_109%20copy.jpg');
const file='data/series.json',contents=fs.readFileSync(file,'utf8');
const sets=JSON.parse(contents);
const matching=sets.flatMap(s=>(s.cards||[]).map(c=>({set:s,card:c}))).filter(({card})=>card.code?.toLowerCase()===a.code);
assert.equal(matching.length,1);
assert.equal(matching[0].set.code.toLowerCase(),'sm12');
assert.equal(matching[0].card.name,a.name);
assert.equal(matching[0].card.image,a.originalBrokenUrl);
const oldJSON=JSON.stringify(a.originalBrokenUrl),newJSON=JSON.stringify(a.newUrl);
assert.equal(contents.split(oldJSON).length,2,'Original broken source URL must be unique');
const patched=contents.replace(oldJSON,newJSON);
assert.notEqual(patched,contents);
assert.equal(patched.length-contents.length,newJSON.length-oldJSON.length);
fs.writeFileSync(file,patched);
const all=[...rd('data/series.json'),...rd('data/series-legacy.json')];
assert.equal(all.length,273);
assert.equal(all.reduce((n,s)=>n+s.cards.length,0),20243);
assert.equal(rd('data/art-themes.json').groups.reduce((n,g)=>n+g.cards.length,0),22032);
const found=all.flatMap(s=>s.cards).filter(c=>c.code?.toLowerCase()===a.code);
assert.equal(found.length,1);assert.equal(found[0].image,a.newUrl);
const out='data/audits/theme-sm19-sm12-109-korean-image-repair-20261022.json';
assert.ok(!fs.existsSync(out));
fs.writeFileSync(out,JSON.stringify({
 schemaVersion:1,date:'2026-10-22',repairedCodes:[a.code],oldSource:a.originalBrokenUrl,newSource:a.newUrl,
 sourceImageSha256:a.sha256,fullSizeImageProof:proof.fullSizeImageEvidenceArtifactId,
 inspectedKoreanName:a.printedKoreanName,inspectedPrintedNumber:a.printedNumber,
 directFooterValidated:true,remainingBrokenFromPrior13:12,
 otherPreviouslyHeldPrintedNumberUnknown:778,
 totalRemainingHolds:790,
 heldBreakdown:'778 third-party images with unverified printed Korean number and 12 unavailable sources',
 historicalRestoredSixPreserved:true,masterSetCount:273,masterCardCount:20243,
 independentThemeMembershipsPreserved:22032,
 updatedOnly:'data/series.json original image string for SM12 109/095',
 caveat:'TCGBOX watermarked Korean physical-print photo; not a first-party Korean CDN asset. Zero other source substitutions.'
},null,2)+'\n');
console.log('SM12_109_KOREAN_IMAGE_RESTORED',JSON.stringify({code:a.code,recovered:1,stillBroken:12,held:790,masterCards:20243,themeSlots:22032}));
