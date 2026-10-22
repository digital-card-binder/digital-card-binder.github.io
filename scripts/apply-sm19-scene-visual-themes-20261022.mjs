#!/usr/bin/env node
/** Append only directly reviewed scene-dex memberships to already source-checked 19 SM sets. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const dir='data/audits/';
const visualFile=dir+'theme-sm19-scene-decisions-20261022.json';
const proofFile=dir+'theme-sm19-scene-source-recheck-20261022.json';
const evidenceFile=dir+'theme-sm-remaining19-source-evidence-20261022.json';
const reportFile=dir+'theme-sm19-scene-artwork-review-20261022.json';
const artFile='data/art-themes.json',statusFile=dir+'theme-series-review-status.json';
assert.ok(!fs.existsSync(reportFile),'Never overwrite scene-review results');
const visual=read(visualFile),proof=read(proofFile),source=read(evidenceFile);
const art=read(artFile),status=read(statusFile),coverage=read(dir+'theme-series-coverage.json');
const master=[...read('data/series.json'),...read('data/series-legacy.json')];
const key=x=>String(x??'').trim().toLowerCase();
const groupById=Object.fromEntries(art.groups.map(g=>[g.code,g]));
assert.equal(art.groups.length,12);
assert.equal(coverage.summary.themeCardSlots,21769);
assert.equal(coverage.summary.strictCompleteSetCount,109);
const count=()=>art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(count(),21769);
assert.equal(source.canonicalSlots,1320);
assert.equal(visual.reviewedVisualSets.length,6);
assert.equal(visual.candidateSelections.length,284);
assert.equal(proof.uniqueProposedCardArtworks,new Set(visual.candidateSelections.map(x=>x.set+'#'+x.number)).size);
const old=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.map(x=>JSON.stringify(x))]));
const existingThemeRows=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]));
const sourceByCard=new Map(source.cards.map(r=>[key(r.set)+'#'+r.index,r]));
const shaProofByCard=new Map(proof.rows.map(r=>[key(r.set)+'#'+r.number,r]));
const masterSets=new Map(master.map(s=>[key(s.code),s]));
const statusReviewed=new Map();
const changes=[],denied=[],oldMatches=[];
for(const selection of visual.candidateSelections){
 const set=key(selection.set),n=selection.number,theme=selection.theme,slot=set+'#'+n;
 assert.ok(visual.reviewedVisualSets.includes(set));
 assert.ok(['season','night','sunset','street','work'].includes(theme),'No unverified subjective theme');
 const official=sourceByCard.get(slot);
 const check=shaProofByCard.get(slot);
 const collection=groupById[theme];
 const setData=masterSets.get(set);
 assert.ok(setData&&collection&&official&&check);
 assert.ok(Number.isInteger(n)&&n>0&&n<=setData.cards.length);
 const card=setData.cards[n-1];
 assert.equal(official.originalImageReference,card.image);
 assert.equal(official.koreanNameInMaster,card.name);
 assert.equal(key(official.canonicalCode),key(card.code));
 const id=set.toUpperCase()+'_'+String(n).padStart(3,'0');
 if(official.referenceKind!=='pokemonkorea_card_image_url'
    ||official.imageHost!=='cards.image.pokemonkorea.co.kr'
    ||!official.decoded||official.imageSourceError||official.duplicateArtworkSource
    ||!check.match||check.sourceSha256!==official.actualSha256){
    denied.push({set,n,theme,reason:'Korean source image hash/printed-footer identity not independently verified'});
    continue;
 }
 if(collection.cards.some(x=>key(x.set)===set&&x.code===id)){
    oldMatches.push({set,n,theme,reason:'Previously present; preserve exact earlier record'});
    continue;
 }
 const foundCover=coverage.sets.find(s=>key(s.code)===set);
 assert.ok(foundCover && foundCover.status==='partial');
 const relation={code:id,name:card.name,series:'SM',set:setData.code,
   setName:setData.displayName,cardNumber:String(card.code).split('_')[1],
   rarity:card.rarity||'',category:selection.category,image:card.image,
   evidence:'Manual illustration scene inspection: '+selection.sheet+
     '; source SHA256 matched original Pokemon Korea image; '+reportFile+
     '. Full set printed-footer completion NOT claimed.'};
 collection.cards.push(relation);
 changes.push({set,n,theme,category:selection.category,contactSheet:selection.sheet,
   imageSha256:official.actualSha256});
 statusReviewed.set(set,[...(statusReviewed.get(set)||[]),theme]);
}
assert.equal(changes.length+denied.length+oldMatches.length,visual.candidateSelections.length);
assert.ok(changes.length>=100,'Too few vetted scene changes, inspect decisions before committing');
for(const g of art.groups){
 assert.deepEqual(g.cards.slice(0,old[g.code].length).map(x=>JSON.stringify(x)),old[g.code],
   'Previously-reviewed independent theme membership must not be altered');
}
assert.equal(count(),21769+changes.length);
for(const code of visual.reviewedVisualSets){
 const keys=Object.keys(status.reviews||{});
 const statusKey=keys.find(k=>key(k)===code)||masterSets.get(code).code;
 assert.notEqual(status.reviews?.[statusKey]?.status,'complete');
 const cur=status.reviews?.[statusKey]||{};
 status.reviews??={};
 status.reviews[statusKey]={
  ...cur,status:'partial',sceneReviewedAt:'2026-10-22',
  reviewedThemes:[...new Set([...(cur.reviewedThemes||[]),...statusReviewed.get(code)||[]])],
  sceneEvidence:reportFile,
  note:(cur.note||'')+'; Contact-sheet scene review for verified official Korean-host artworks. Third-party source and physical printed-footer holds remain unresolved.'
 };
}
const increments=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length-existingThemeRows[g.code]]));
assert.equal(increments.sleeping,0);
assert.equal(increments.color,0);
assert.equal(increments.connected,0);
assert.equal(increments.evolution,0);
assert.equal(increments.reflections,0);
assert.equal(increments.food,0);
assert.equal(increments.cameo,0);
assert.equal(Object.values(increments).reduce((a,b)=>a+b,0),changes.length);
const testFile='tests/theme-card-identity.test.mjs';
const text=fs.readFileSync(testFile,'utf8');
const target='assert.equal(total,21769); // all 19 previously pending SM sets source/hash/pixel-classified, physical print holds remain';
assert.equal(text.split(target).length,2,'Existing theme count regression baseline unexpectedly changed');
fs.writeFileSync(testFile,text.replace(target,
 'assert.equal(total,'+count()+'); // SM19 second-pass scene review: official source image SHA256 and manually checked scenes'));
const report={schemaVersion:1,recordedAt:'2026-10-22',
 reviewScope:'19 previously source-audited SM sets, with direct scene classification only for six Korean official-host eligible expansions',
 visualReview:visualFile,imageProof:proofFile,sourceEvidence:evidenceFile,
 candidateSelections:visual.candidateSelections.length,
 verifiedSourceArtworkCandidates:proof.rows.filter(x=>x.match).length,
 themeRowsAdded:changes.length,
 themeRowsSkippedBecauseAlreadyPresent:oldMatches.length,
 themeRowsQuarantined:denied.length,
 themeSlotsBefore:21769,themeSlotsAfter:count(),
 themeDeltas:increments,
 affectedSets:Object.fromEntries(visual.reviewedVisualSets.map(code=>[
  code,{added:changes.filter(x=>x.set===code).length,
        existed:oldMatches.filter(x=>x.set===code).length,
        quarantined:denied.filter(x=>x.set===code).length}])),
 notes:['No story/evolution/cameo/reflection/sleeping tags created from mere Pokémon species or colors.',
        '797 third-party/missing sources held in previous one-pass audit; still need full printed-number verification.',
        'These six sets remain partial, not strict Korean physical print verified complete.'],
 unaffected:{previous21769ThemeRows:true,userFirestoreOwnership:true,masterCardIdentity:true,cardRadar:true},
 added:changes,skippedExisting:oldMatches,quarantined:denied};
art.updatedAt='2026-10-22';
save(artFile,art);save(statusFile,status);save(reportFile,report);
console.log('SM19_CURATED_SCENES_APPLIED',JSON.stringify({
 reviewedCandidates:visual.candidateSelections.length,added:changes.length,
 preservedDuplicates:oldMatches.length,quarantined:denied.length,
 byTheme:increments,newTotal:count()}));
