#!/usr/bin/env node
/**
 * Restore six Korean-print-number visually validated SM broken image URLs only.
 * Preserve identity, card count, independent theme memberships and Firestore.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const audit=read('data/audits/theme-sm19-six-korean-print-footer-verified-20261022.json');
const candidates=read('data/audits/theme-sm19-797-six-recovered-printed-identity-evidence-20261022.json');
const paths=['data/series.json','data/series-legacy.json'];
const sources=new Map(paths.map(path=>[path,fs.readFileSync(path,'utf8')]));
const collections=new Map(paths.map(path=>[path,JSON.parse(sources.get(path))]));
assert.equal(audit.acceptedCount,6);
assert.equal(audit.verified.length,6);
assert.equal(candidates.candidateCards.length,6);
const summaries=[];
for(const verified of audit.verified){
 const proof=candidates.candidateCards.find(x=>String(x.expectedCode).toLowerCase()===String(verified.expectedCanonicalCode).toLowerCase());
 assert.ok(proof,'Missing original high-resolution/identity evidence');
 assert.equal(verified.verifiedImageUrl,proof.replacementCandidateUrl);
 assert.equal(verified.sha256,proof.sourceSha256);
 assert.equal(verified.verifiedPrintedNumber,proof.expectedCode.split('_').at(-1));
 assert.equal(verified.koreanName,proof.expectedKoreanName);
 assert.ok(String(verified.verification).includes('printed footer matches'));
 let matches=[];
 for(const [path,series] of collections){
  for(const set of series){
   for(const card of set.cards||[]){
    if(String(card.code).toLowerCase()===String(verified.expectedCanonicalCode).toLowerCase())
      matches.push({path,code:card.code,name:card.name,old:card.image});
   }
  }
 }
 assert.equal(matches.length,1,'Card identity not unique');
 const match=matches[0];
 assert.equal(match.name,verified.koreanName);
 assert.equal(match.old,proof.originalBrokenImageUrl);
 assert.match(verified.verifiedImageUrl,/^https:\/\/tcgbox\.co\.kr\/web\/product\/big\//);
 const before=sources.get(match.path);
 const escapedOld=JSON.stringify(proof.originalBrokenImageUrl);
 const escapedNew=JSON.stringify(verified.verifiedImageUrl);
 assert.equal(before.split(escapedOld).length,2,
   'Original image URL missing or repeated; halt before rewriting master');
 sources.set(match.path,before.replace(escapedOld,escapedNew));
 summaries.push({set:verified.set,index:verified.index,code:verified.expectedCanonicalCode,
    verifiedPrintedNumber:verified.verifiedPrintedNumber,verifiedRarity:verified.verifiedRarity,
    oldImageUrl:proof.originalBrokenImageUrl,newImageUrl:verified.verifiedImageUrl,
    sourceSha256:verified.sha256});
}
for(const [path,contents] of sources){
 const changed=JSON.parse(contents);
 const original=collections.get(path);
 assert.equal(changed.length,original.length);
 for(let i=0;i<changed.length;i++)assert.equal(changed[i].cards.length,original[i].cards.length);
 fs.writeFileSync(path,contents);
}
const all=[...read(paths[0]),...read(paths[1])];
assert.equal(all.length,273);
assert.equal(all.reduce((n,x)=>n+x.cards.length,0),20243);
const themes=read('data/art-themes.json');
assert.equal(themes.groups.reduce((n,g)=>n+g.cards.length,0),22032);
const results={
 schemaVersion:1,recordedAt:'2026-10-22',
 initialUnverifiedExternalSources:797,
 imageRestorations:6,remainingUnverifiedExternalSourceEntries:791,
 masterSetCount:273,masterCardCount:20243,themeMembershipsPreserved:22032,
 userOwnershipModified:false,radarModified:false,sourceHost:'tcgbox.co.kr',
 evidence:'data/audits/theme-sm19-six-korean-print-footer-verified-20261022.json',
 sourceScan:'data/audits/theme-sm19-797-six-recovered-printed-identity-evidence-20261022.json',
 notes:[
  'High-resolution Korean name, code and printed foil rarity directly read from source images.',
  'Original broken URL replaced with working big image path only. Verified six images retain third-party watermark.',
  'Other held 791 cards are not accepted or edited; source and identity need further individual verification.'
 ],cards:summaries};
const path='data/audits/theme-sm19-six-restored-korean-image-urls-20261022.json';
assert.ok(!fs.existsSync(path),'Do not override previously deployed audit');
fs.writeFileSync(path,JSON.stringify(results,null,2)+'\n');
console.log('SM19_SIX_RECOVERIES_APPLIED',JSON.stringify({count:6,sets:results.masterSetCount,master:results.masterCardCount,themes:results.themeMembershipsPreserved,remaining:791,codes:summaries.map(x=>x.code)}));
