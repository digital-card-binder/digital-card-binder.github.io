#!/usr/bin/env node
/** Batch all 19 pending SM Korean artwork-source classifications. Never treat this as strict printed-card completion. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const rd=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const wr=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const dir='data/audits/';
const first=dir+'theme-sm-remaining19-master-preflight-20261022.json';
const sourceFile=dir+'theme-sm-remaining19-source-evidence-20261022.json';
const decisionFile=dir+'theme-sm-remaining19-visual-decisions-20261022.json';
const out=dir+'theme-sm-remaining19-artwork-review-20261022.json';
const artFile='data/art-themes.json';
const statusFile=dir+'theme-series-review-status.json';
const normalize=x=>String(x??'').trim().toLowerCase();
assert.ok(!fs.existsSync(out),'Batch already applied');
const p=rd(first),source=rd(sourceFile),decisions=rd(decisionFile);
const art=rd(artFile),statuses=rd(statusFile),coverage=rd(dir+'theme-series-coverage.json');
const master=[...rd('data/series.json'),...rd('data/series-legacy.json')];
assert.equal(p.totalCanonicalSlots,1320);
assert.equal(p.totalSets,19);
assert.equal(source.canonicalSlots,1320);
assert.equal(source.cards.length,1320);
assert.equal(decisions.totalSeriesSourceChecked,19);
assert.equal(decisions.totalCanonicalCards,1320);
assert.equal(decisions.sourceEvidenceFile,sourceFile);\nassert.equal(decisions.allSheetsManuallyInspected,false);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(coverage.summary.themeCardSlots,21299);
assert.equal(art.groups.reduce((n,x)=>n+x.cards.length,0),21299);
const dict=Object.fromEntries(art.groups.map(x=>[x.code,x]));
assert.equal(art.groups.length,12);
const original=Object.fromEntries(art.groups.map(x=>[x.code,x.cards.map(c=>JSON.stringify(c))]));
const previous=Object.fromEntries(art.groups.map(x=>[x.code,x.cards.length]));
let processed=0,added=0,automaticallyColorTagged=0,previousThemeEntriesPreserved=0;
const results=[];
const blocked=new Map(decisions.held.map(x=>[normalize(x.set)+'#'+x.index,x.reason]));
assert.equal(blocked.size,decisions.held.length);
for(const summary of p.summaries){
 const code=normalize(summary.set),len=summary.masterCardCount;
 const found=master.filter(x=>normalize(x.code)===code);
 assert.equal(found.length,1,code+' master missing');
 const set=found[0],cards=set.cards;
 assert.equal(cards.length,len);
 const sourceRows=source.cards.filter(x=>normalize(x.set)===code);
 assert.equal(sourceRows.length,len);
 const coverageSet=coverage.sets.filter(x=>normalize(x.code)===code);
 assert.equal(coverageSet.length,1);
 assert.equal(coverageSet[0].status,'pending');
 const originalHits=art.groups.flatMap(g=>g.cards).filter(x=>normalize(x.set)===code).length;
 assert.equal(originalHits,summary.previousThemeCount);
 previousThemeEntriesPreserved+=originalHits;
 let eligible=0,skipped=0,oldThemePrevented=0,newCardsAdded=0;
 for(let i=0;i<len;i++){
   const card=cards[i],r=sourceRows[i],idx=i+1,key=code+'#'+idx;
   assert.equal(normalize(r.canonicalCode),normalize(card.code),key+' canonical code mismatch');
   assert.equal(r.originalImageReference,card.image,key+' original source mismatch');
   assert.equal(r.koreanNameInMaster,card.name,key+' Korean card name mismatch');
   assert.equal(r.index,idx);
   const hasSource=r.imageHost==='cards.image.pokemonkorea.co.kr'&&r.decoded
     &&!r.imageSourceError&&!r.duplicateArtworkSource&&!r.sourceDuplicatedWithinSet
     &&typeof r.actualSha256==='string'&&r.actualSha256.length===64
     &&typeof r.observedArtColor==='string'&&/^[가-힣]+·[가-힣]+$/.test(r.observedArtColor);
   const banned=blocked.has(key);
   if(banned||!hasSource){skipped++;continue;}
   const uniqueID=code.toUpperCase()+'_'+String(idx).padStart(3,'0');
   // Independently themed color memberships only; other subjective themes require image-by-image human review.
   if(dict.color.cards.some(x=>normalize(x.set)===code&&x.code===uniqueID)){
      oldThemePrevented++;eligible++;continue;
   }
   dict.color.cards.push({code:uniqueID,name:card.name,series:'SM',set:set.code,
     setName:set.displayName,cardNumber:String(card.code).split('_')[1],
     rarity:card.rarity||'',category:r.observedArtColor,image:card.image,
     evidence:'SHA256/source verified Korean-host illustration; machine HSV artwork color ONLY; 19-set audit '+out+
       '. Not printed Korean number or illustration-story identity proof.'});
   eligible++;newCardsAdded++;added++;automaticallyColorTagged++;
 }
 const key=Object.keys(statuses.reviews||{}).find(x=>normalize(x)===code)||set.code;
 assert.notEqual(statuses.reviews?.[key]?.status,'complete','Never demote a completed set');
 statuses.reviews??={};
 statuses.reviews[key]={...(statuses.reviews[key]||{}),
   status:'partial',reviewedAt:'2026-10-22',reviewedCardCount:eligible,
   reviewedThemes:['color'],evidence:out,
   note:'Source-image audit of '+len+' master cards; '+eligible+' official-host SHA256/color-eligible illustrations, '+
       skipped+' cards with unverified source, duplicate picture, bad decoding or recorded image hold. '+
       oldThemePrevented+' previously classified color cards preserved. Machine artwork-color classification only; '+
       'subjective scene themes and Korean physical printed footer remain to verify.'};
 processed+=len;
 results.push({code:set.code,name:summary.name,totalCards:len,
   officialSourceColorEligible:eligible,heldOrExcluded:skipped,
   previousThemePlacements:originalHits,previousColorTagsSkipped:oldThemePrevented,
   newColorMemberships:newCardsAdded,status:'partial_source_and_color_review'});
}
assert.equal(processed,1320);
assert.equal(results.length,19);
assert.equal(previousThemeEntriesPreserved,p.existingPreviouslyThemedRows);
const count=art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(count,21299+added);
for(const g of art.groups){
 assert.deepEqual(g.cards.slice(0,previous[g.code]).map(x=>JSON.stringify(x)),original[g.code]);
}
for(const key of Object.keys(dict))if(key!=='color')assert.equal(dict[key].cards.length,previous[key],
   'Never classify subjective scene without direct visual-review proof');
const testPath='tests/theme-card-identity.test.mjs';
const old='assert.equal(total,21299); // SM10b/SM11/SM11a visually checked Korean art; 23 secret holds';
const tests=fs.readFileSync(testPath,'utf8');
assert.equal(tests.split(old).length,2,'Existing regression expected cardinality drift');
fs.writeFileSync(testPath,tests.replace(old,
 'assert.equal(total,'+count()+'); // all 19 previously pending SM sets source/hash/pixel-classified, physical print holds remain'));
const report={schemaVersion:1,recordedAt:'2026-10-22',
 scope:'All 19 previously pending Korean SM series, including sets and promo decks',seriesCount:19,
 canonicalCards:1320,sourceEvidence:sourceFile,visualDecisionFile:decisionFile,
 imagesDecoded:source.decodedImages,heldUniqueSlots:decisions.held.length,
 previouslyAssignedThemeMemberships:previousThemeEntriesPreserved,
 cardsSourceColorEligible:results.reduce((n,x)=>n+x.officialSourceColorEligible,0),
 existingColorMembershipsPreserved:results.reduce((n,x)=>n+x.previousColorTagsSkipped,0),
 colorThemeRowsAdded:added,allIndependentThemeRowsBefore:21299,
 allIndependentThemeRowsAfter:count,
 strictlyCompleteSeriesBefore:109,strictlyCompleteSeriesAfter:109,
 typeOfReview:'source evidence, downloaded-image integrity and machine artwork-color palette; not exhaustive manual story/scenery classification or all printed footer verification',
 untouched:{masterDb:true,FirestoreUserOwnedCards:true,cardRadar:true,previousThemeRows:true},
 sets:results,holds:decisions.held,
 next:'Resolve source/printed Korean card identity holds, then inspect other 11 thematic categories separately from objective HSV color mapping.'};
art.updatedAt='2026-10-22';
wr(artFile,art);wr(statusFile,statuses);wr(out,report);
console.log('ALL19_APPLIED',JSON.stringify({sets:results.length,total:processed,existing:previousThemeEntriesPreserved,
 held:decisions.held.length,added,count}));
