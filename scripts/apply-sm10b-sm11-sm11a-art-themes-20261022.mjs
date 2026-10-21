#!/usr/bin/env node
// Source-verified and visual-checked Korean card art only; strictly append-only independent theme memberships.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const dir='data/audits/';
const srcFile=dir+'theme-sm10b-sm11-sm11a-image-evidence-20261022.json';
const visualFile=dir+'theme-sm10b-sm11-sm11a-visual-decisions-20261022.json';
const pixelFile=dir+'theme-sm10b-sm11-sm11a-color-palette-20261022.json';
const resultFile=dir+'theme-sm10b-sm11-sm11a-artwork-review-20261022.json';
const artFile='data/art-themes.json';
const statusFile=dir+'theme-series-review-status.json';
assert.ok(!fs.existsSync(resultFile),'Do not overwrite prior audited batch');
const source=read(srcFile),visual=read(visualFile),pixel=read(pixelFile),art=read(artFile);
const coverage=read(dir+'theme-series-coverage.json'),status=read(statusFile);
const series=[...read('data/series.json'),...read('data/series-legacy.json')];
const norm=x=>String(x??'').toLowerCase().trim();
const expected={sm10b:69,sm11:115,sm11a:80};
const earlier={sm10b:0,sm11:3,sm11a:1};
const count=()=>art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(count(),20914);
assert.equal(coverage.summary.themeCardSlots,20914);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(art.groups.length,12);
assert.equal(source.canonicalSlots,264);
assert.equal(visual.canonicalCardSlots,264);
assert.equal(visual.reviewedContactSheets,19);
assert.equal(visual.heldCount,23);
assert.equal(visual.safeForProvisionalThemeArtReview,241);
assert.equal(pixel.screenedCount,241);
assert.equal(pixel.heldCount,23);
const held=new Set(visual.held.map(x=>norm(x.set)+'#'+x.number));
const pixels=new Map(pixel.rows.map(x=>[norm(x.set)+'#'+x.number,x]));
assert.equal(held.size,23);
assert.equal(pixels.size,241);
const groups=Object.fromEntries(art.groups.map(g=>[g.code,g]));
const before=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]));
const preserved=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.map(c=>JSON.stringify(c))]));
let screened=0,added=0;
const results=[];
for(const [code,total] of Object.entries(expected)){
  const matched=series.filter(s=>norm(s.code)===code);
  assert.equal(matched.length,1);
  const set=matched[0];
  assert.equal(set.cards.length,total);
  const evidence=source.cards.filter(x=>norm(x.set)===code);
  assert.equal(evidence.length,total);
  const prior=art.groups.flatMap(g=>g.cards).filter(x=>norm(x.set)===code);
  assert.equal(prior.length,earlier[code]);
  const existing=coverage.sets.filter(x=>norm(x.code)===code);
  assert.equal(existing.length,1);
  assert.equal(existing[0].status,'pending');
  let ok=0,excluded=0,newRows=0;
  for(let i=0;i<total;i++){
    const n=i+1,key=code+'#'+n,card=set.cards[i],proof=evidence[i];
    assert.equal(norm(card.code),norm(proof.canonicalCode));
    assert.equal(card.image,proof.originalImageReference);
    assert.equal(card.name,proof.koreanNameInMaster);
    assert.equal(proof.index,n);
    if(held.has(key)){assert.ok(!pixels.has(key));excluded++;continue;}
    assert.equal(proof.imageHost,'cards.image.pokemonkorea.co.kr');
    assert.equal(proof.decoded,true);
    assert.equal(proof.duplicateArtworkSource,false);
    assert.equal(proof.imageSourceError,null);
    const p=pixels.get(key);
    assert.ok(p,'Missing real source recheck for '+key);
    assert.equal(p.sourceSha256,proof.actualSha256);
    assert.equal(norm(p.canonicalCode),norm(card.code));
    assert.match(p.observedArtColor,/^[가-힣]+·[가-힣]+$/);
    const tags={color:p.observedArtColor};
    if(visual.season?.[code]?.[n])tags.season=visual.season[code][n];
    for(const t of ['night','sunset','street','work']){
      const description=visual.extra?.[t]?.[code]?.[n];
      if(description)tags[t]=description;
    }
    const id=code.toUpperCase()+'_'+String(n).padStart(3,'0');
    for(const [theme,category] of Object.entries(tags)){
      const group=groups[theme];
      assert.ok(group,'Unknown theme '+theme);
      assert.ok(!group.cards.some(x=>norm(x.set)===code&&x.code===id),
        'Duplicate independently themed card '+key+' '+theme);
      group.cards.push({
        code:id,name:card.name,series:'SM',set:set.code,setName:set.displayName,
        cardNumber:String(card.code).split('_')[1],rarity:card.rarity||'',
        category,image:card.image,
        evidence:'Contact-sheet 19-page visual review and SHA256 verified Korean original art; '+resultFile+
          '; independent Korean printed-number authentication still pending for 23 outside-source cards.'
      });
      added++;newRows++;
    }
    ok++;screened++;
  }
  const k=Object.keys(status.reviews||{}).find(x=>norm(x)===code)||set.code;
  assert.notEqual(status.reviews?.[k]?.status,'complete');
  status.reviews??={};
  status.reviews[k]={...(status.reviews[k]||{}),status:'partial',reviewedAt:'2026-10-22',
    reviewedCardCount:ok,reviewedThemes:Object.keys(groups),evidence:resultFile,
    note:'Provisional Korean artwork source review '+ok+'/'+total+
    ', held '+excluded+' rare cards pending exact Korean printed footer.'};
  results.push({set:code,masterCards:total,provisionallyScreened:ok,
    held:excluded,newIndependentThemeSlots:newRows,strictlyComplete:false});
}
assert.equal(screened,241);
assert.equal(results.reduce((n,x)=>n+x.held,0),23);
assert.equal(count(),20914+added);
const deltas=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length-before[g.code]]));
assert.equal(Object.values(deltas).reduce((a,b)=>a+b,0),added);
for(const g of art.groups){
  assert.deepEqual(g.cards.slice(0,before[g.code]).map(c=>JSON.stringify(c)),preserved[g.code]);
}
const outside=source.cards.filter(x=>x.referenceKind!=='pokemonkorea_card_image_url');
assert.equal(outside.length,23);
source.thirdPartyReferencesRequiringKoreanPrintReview=23;
for(const set of source.sets){
  const records=source.cards.filter(x=>norm(x.set)===norm(set.set));
  set.thirdPartyUncheckedKoreanPrintCount=records.filter(x=>x.referenceKind!=='pokemonkorea_card_image_url').length;
  set.thirdPartyDecodedCount=records.filter(x=>x.referenceKind!=='pokemonkorea_card_image_url'&&x.decoded).length;
}
source.provisionalThemeReviewHolds=23;
const testFile='tests/theme-card-identity.test.mjs';
const old='assert.equal(total,20914); // SM9b/SM10/SM10a visually screened Korean original arts; 23 held';
const tests=fs.readFileSync(testFile,'utf8');
assert.equal(tests.split(old).length,2,'Existing full-test expected count changed');
fs.writeFileSync(testFile,tests.replace(old,
  'assert.equal(total,'+count()+'); // SM10b/SM11/SM11a visually checked Korean art; 23 secret holds'));
const report={
 schemaVersion:1,recordedAt:'2026-10-22',
 batch:'SM10b 스카이레전드 / SM11 미라클트윈 / SM11a 리믹스바우트',
 masterEntries:264,sourceEvidence:srcFile,visualEvidence:visualFile,paletteEvidence:pixelFile,
 sourceRunId:visual.sourceGithubRunId,
 artworksScreened:screened,heldCardEntries:23,themeRowsBefore:20914,themeRowsAdded:added,
 themeRowsAfter:count(),deltas,strictCompleteSets:109,fullKoreanPrintedFooterVerificationPending:true,
 preserved:{priorThemeRowsModified:0,masterChanged:0,ownerOrFirestoreChanged:0,
   cardRadarChanged:0,priorSM11AndSM11aSleepingEntries:4},
 sets:results,held:visual.held
};
art.updatedAt='2026-10-22';
write(srcFile,source);write(artFile,art);write(statusFile,status);write(resultFile,report);
console.log('SM10B_SM11_SM11A_APPLIED',JSON.stringify({
 screened,holds:23,added,after:count(),deltas,results
}));
