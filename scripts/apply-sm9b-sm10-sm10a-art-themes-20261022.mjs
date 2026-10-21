#!/usr/bin/env node
// Append only source-proven Korean original artwork memberships to independent thematic dexes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const dir='data/audits/';
const imageFile=dir+'theme-sm9b-sm10-sm10a-image-evidence-20261022.json';
const visualFile=dir+'theme-sm9b-sm10-sm10a-visual-decisions-20261022.json';
const paletteFile=dir+'theme-sm9b-sm10-sm10a-color-palette-20261022.json';
const outputFile=dir+'theme-sm9b-sm10-sm10a-artwork-review-20261022.json';
const artFile='data/art-themes.json',stateFile=dir+'theme-series-review-status.json';
assert.ok(!fs.existsSync(outputFile),'Do not overwrite an audited batch');
const source=load(imageFile),review=load(visualFile),palette=load(paletteFile);
const art=load(artFile),state=load(stateFile),coverage=load(dir+'theme-series-coverage.json');
const master=[...load('data/series.json'),...load('data/series-legacy.json')];
const norm=x=>String(x??'').toLowerCase().replace(/\s+/g,'');
const expected={sm9b:69,sm10:116,sm10a:69};
const prior={sm9b:0,sm10:3,sm10a:1};
const slots=()=>art.groups.reduce((n,x)=>n+x.cards.length,0);
assert.equal(art.groups.length,12);
assert.equal(slots(),20570);
assert.equal(coverage.summary.themeCardSlots,20570);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(source.canonicalSlots,254);
assert.equal(review.canonicalCardSlots,254);
assert.equal(review.reviewedContactSheets,18);
assert.equal(review.heldCount,23);
assert.equal(review.safeForProvisionalThemeArtReview,231);
assert.equal(palette.screenedCount,231);
assert.equal(palette.heldCount,23);
const held=new Set(review.held.map(x=>norm(x.set)+'#'+x.number));
const pixels=new Map(palette.rows.map(x=>[norm(x.set)+'#'+x.number,x]));
assert.equal(held.size,23);
assert.equal(pixels.size,231);
const groups=Object.fromEntries(art.groups.map(g=>[g.code,g]));
const original=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.map(x=>JSON.stringify(x))]));
const initial=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]));
const results=[];
let accepted=0,added=0;
for(const [code,total] of Object.entries(expected)){
  const matched=master.filter(x=>norm(x.code)===code);
  assert.equal(matched.length,1);
  const set=matched[0];
  assert.equal(set.cards.length,total);
  const proof=source.cards.filter(x=>norm(x.set)===code);
  assert.equal(proof.length,total);
  const past=art.groups.flatMap(x=>x.cards).filter(x=>norm(x.set)===code);
  assert.equal(past.length,prior[code],'Earlier themed card membership changed');
  const cov=coverage.sets.filter(x=>norm(x.code)===code);
  assert.equal(cov.length,1);
  assert.equal(cov[0].status,'pending');
  let screened=0,excluded=0,addedSet=0;
  for(let i=0;i<total;i++){
    const n=i+1,key=code+'#'+n,card=set.cards[i],e=proof[i];
    assert.equal(norm(card.code),norm(e.canonicalCode));
    assert.equal(card.image,e.originalImageReference);
    assert.equal(card.name,e.koreanNameInMaster);
    assert.equal(e.index,n);
    if(held.has(key)){
      assert.ok(!pixels.has(key));
      excluded++;continue;
    }
    assert.equal(e.imageHost,'cards.image.pokemonkorea.co.kr');
    assert.equal(e.decoded,true);
    assert.equal(e.imageSourceError,null);
    assert.equal(e.duplicateArtworkSource,false);
    const px=pixels.get(key);
    assert.ok(px,key);
    assert.equal(px.sourceSha256,e.actualSha256);
    assert.equal(norm(px.canonicalCode),norm(card.code));
    assert.match(px.observedArtColor,/^[가-힣]+·[가-힣]+$/);
    const tags={color:px.observedArtColor};
    if(review.seasons?.[code]?.[n])tags.season=review.seasons[code][n];
    for(const theme of ['night','street','sunset','work']){
      const tag=review.extra?.[theme]?.[code]?.[n];
      if(tag)tags[theme]=tag;
    }
    const cardId=code.toUpperCase()+'_'+String(n).padStart(3,'0');
    for(const [theme,category] of Object.entries(tags)){
      assert.ok(groups[theme]);
      assert.ok(!groups[theme].cards.some(x=>norm(x.set)===code && x.code===cardId),
        'Do not duplicate previously tagged independent card');
      groups[theme].cards.push({
        code:cardId,name:card.name,series:'SM',set:set.code,
        setName:set.displayName,cardNumber:String(card.code).split('_')[1],
        rarity:card.rarity||'',category,image:card.image,
        evidence:'Visually screened 18 contact sheets + exact official-image SHA256; '+outputFile+
          '. Held 23 third-party secret-number artworks, no universal printed-footer completion.'
      });
      added++;addedSet++;
    }
    screened++;accepted++;
  }
  const stateKey=Object.keys(state.reviews||{}).find(x=>norm(x)===code)||set.code;
  assert.notEqual(state.reviews?.[stateKey]?.status,'complete');
  state.reviews??={};
  state.reviews[stateKey]={
    ...(state.reviews[stateKey]||{}),
    status:'partial',reviewedAt:'2026-10-22',
    reviewedCardCount:screened,reviewedThemes:Object.keys(groups),evidence:outputFile,
    note:'Korean original card artworks provisionally screened '+screened+'/'+total+
      '; '+excluded+' unresolved third-party printed-number identities.'
  };
  results.push({set:code,masterCards:total,provisionallyScreened:screened,
    held:excluded,newIndependentThemeSlots:addedSet,strictlyComplete:false});
}
assert.equal(accepted,231);
assert.equal(results.reduce((n,x)=>n+x.held,0),23);
assert.equal(slots(),20570+added);
for(const group of art.groups){
  assert.deepEqual(group.cards.slice(0,initial[group.code]).map(x=>JSON.stringify(x)),original[group.code]);
}
const deltas=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length-initial[g.code]]));
assert.equal(Object.values(deltas).reduce((a,b)=>a+b,0),added);
const thirdParty=source.cards.filter(x=>x.referenceKind!=='pokemonkorea_card_image_url');
assert.equal(thirdParty.length,23);
source.thirdPartyReferencesRequiringKoreanPrintReview=thirdParty.length;
for(const set of source.sets){
  const records=source.cards.filter(x=>norm(x.set)===norm(set.set));
  set.thirdPartyUncheckedKoreanPrintCount=records.filter(x=>x.referenceKind!=='pokemonkorea_card_image_url').length;
  set.thirdPartyDecodedCount=records.filter(x=>x.referenceKind!=='pokemonkorea_card_image_url'&&x.decoded).length;
}
source.provisionalThemeReviewHolds=23;
const testPath='tests/theme-card-identity.test.mjs';
const old='assert.equal(total,20570); // SM8b/SM9/SM9a visual art review; uncertain Korean print holds';
const text=fs.readFileSync(testPath,'utf8');
assert.equal(text.split(old).length,2,'Baseline theme test changed unexpectedly');
fs.writeFileSync(testPath,text.replace(old,
  'assert.equal(total,'+slots()+'); // SM9b/SM10/SM10a visually screened Korean original arts; 23 held'));
const report={
 schemaVersion:1,recordedAt:'2026-10-22',
 batch:'SM9b 풀메탈월 / SM10 더블블레이즈 / SM10a GG엔드',
 masterEntries:254,sourceEvidence:imageFile,visualEvidence:visualFile,paletteEvidence:paletteFile,
 sourceRunId:review.sourceGithubRunId,artworksScreened:accepted,heldCardEntries:23,
 themeRowsBefore:20570,themeRowsAdded:added,themeRowsAfter:slots(),
 deltas,strictCompleteSets:109,fullKoreanPrintedFooterVerificationPending:true,
 preserved:{priorThemeRowsModified:0,masterChanged:0,ownerOrFirestoreChanged:0,cardRadarChanged:0,priorSM10AndSM10aSleepingEntries:4},
 sets:results,held:review.held
};
art.updatedAt='2026-10-22';
save(imageFile,source);save(artFile,art);save(stateFile,state);save(outputFile,report);
console.log('SM9B_SM10_SM10A_APPLIED',JSON.stringify({accepted,held:23,added,total:slots(),deltas,results}));
