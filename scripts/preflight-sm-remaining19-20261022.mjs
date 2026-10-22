#!/usr/bin/env node
/** Metadata-only preflight of all 19 previously unreviewed Korean SM-era sets in one batch. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const rd=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const out='data/audits/theme-sm-remaining19-master-preflight-20261022.json';
assert.ok(!fs.existsSync(out),'Existing audit must not be replaced');
const coverage=rd('data/audits/theme-series-coverage.json');
const art=rd('data/art-themes.json');
const series=[...rd('data/series.json'),...rd('data/series-legacy.json')];
const canon=x=>String(x??'').trim().toLowerCase();
assert.equal(coverage.summary.masterSetCount,273);
assert.equal(coverage.summary.themeCardSlots,21299);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(art.groups.reduce((n,g)=>n+g.cards.length,0),21299);
const codes=['sm1+','sm60a','sm2k','smp2','sm11b','sm12','sm12a','smp','sm30a','sm60b','smm','sml','smn','smk','smi','sme','smd','smc','sma'];
const expected=[77,27,62,24,75,117,235,249,89,23,33,57,44,32,41,22,30,23,60];
assert.equal(codes.length,19);assert.equal(expected.reduce((a,b)=>a+b,0),1320);
const actualPending=coverage.sets.filter(x=>canon(x.era)==='sm'&&x.status==='pending');
assert.deepEqual(actualPending.map(x=>canon(x.code)).sort(),[...codes].sort());
const queue=[],summaries=[];
for(let k=0;k<codes.length;k++){
 const code=codes[k],qty=expected[k];
 const matched=series.filter(s=>canon(s.code)===code);
 assert.equal(matched.length,1,'Missing or ambiguous master set '+code);
 const set=matched[0],catalog=coverage.sets.find(x=>canon(x.code)===code);
 assert.equal(set.cards.length,qty,'Master count mismatch '+code);
 assert.equal(catalog.cardCount,qty);
 const existing=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.filter(c=>canon(c.set)===code).length]));
 assert.equal(Object.values(existing).reduce((a,b)=>a+b,0),Object.values(catalog.themeHits||{}).reduce((a,b)=>a+b,0));
 const hosts={},seen=new Set();
 for(let i=0;i<qty;i++){
  const card=set.cards[i],n=i+1,u=String(card.image||'');
  let host='';
  try{let parsed=new URL(u);if(parsed.protocol==='https:')host=parsed.hostname;}catch{}
  const refKind=host==='cards.image.pokemonkorea.co.kr'?'pokemonkorea_card_image_url':'third_party_or_missing_image_url';
  hosts[host||'missing']=(hosts[host||'missing']||0)+1;
  queue.push({set:set.code,setName:set.displayName||catalog.name,index:n,canonicalCode:String(card.code||''),
    koreanNameInMaster:card.name||'',originalImageReference:u,imageHost:host,referenceKind:refKind,
    sourceDuplicatedWithinSet:!!u&&seen.has(u),sourceHttpCheckedInThisPass:false,
    imageSha256CheckedInThisPass:false,printedKoreanFooterVerifiedInThisPass:false,
    artworkVisuallyReviewedInThisPass:false,thematicEligibility:'not_yet_reviewed',proposedThemeMemberships:[]});
  if(u)seen.add(u);
 }
 summaries.push({set:set.code,name:catalog.name,masterCardCount:qty,previousIndependentThemes:existing,
   previousThemeCount:Object.values(existing).reduce((a,b)=>a+b,0),sourceHosts:hosts,oldStatus:catalog.status});
}
assert.equal(queue.length,1320);
assert.equal(new Set(queue.map(x=>canon(x.set)+':'+x.index)).size,1320);
const result={schemaVersion:1,recordedAt:'2026-10-22',batch:'19 remaining unreviewed Korean SM sets in one pass',
  sourceMainRef:'audit/theme-sm10b-sm11-sm11a-20261022',
  totalSets:19,totalCanonicalSlots:1320,strictCompleteSetsBefore:109,priorThemeSlotsPreserved:21299,
  existingPreviouslyThemedRows:summaries.reduce((n,x)=>n+x.previousThemeCount,0),
  allUnreviewedSetCodes:codes,expectedMasterCounts:expected,summaries,cardQueue:queue,
  sourceHttpChecks:0,artworkVisualChecks:0,newThemeRowsWritten:0,masterChanged:false,userCollectionChanged:false,
  caution:'An HTTP image or master code does NOT independently verify printed Korean card identity or visual theme.'};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log('SM_REMAINING19_PREFLIGHT',JSON.stringify({sets:summaries.length,cards:queue.length,priorThemes:result.existingPreviouslyThemedRows,hostTotals:summaries.map(x=>({set:x.set,hosts:x.sourceHosts}))}));
