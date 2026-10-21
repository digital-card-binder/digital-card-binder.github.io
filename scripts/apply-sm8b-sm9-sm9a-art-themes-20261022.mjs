#!/usr/bin/env node
/** Strict append-only Korean card artwork theme audit. Run only after manual 438-card visual review. */
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const dir="data/audits/",basename="theme-sm8b-sm9-sm9a-";
const sourcePath=dir+basename+"image-evidence-20261022.json";
const visualPath=dir+basename+"visual-decisions-20261022.json";
const palettePath=dir+basename+"color-palette-20261022.json";
const resultPath=dir+basename+"artwork-review-20261022.json";
const artPath="data/art-themes.json";
const statePath=dir+"theme-series-review-status.json";
const testsPath="tests/theme-card-identity.test.mjs";
assert.ok(!fs.existsSync(resultPath),"Do not overwrite completed audit evidence");
const source=read(sourcePath),visual=read(visualPath),palette=read(palettePath);
const coverage=read(dir+"theme-series-coverage.json");
const art=read(artPath),state=read(statePath);
const master=[...read("data/series.json"),...read("data/series-legacy.json")];
const norm=x=>String(x??"").toLowerCase().replace(/\s+/g,"");
const expected={sm8b:250,sm9:118,sm9a:70};
const existingCounts={sm8b:0,sm9:3,sm9a:1};
const groups=Object.fromEntries(art.groups.map(x=>[x.code,x]));
assert.equal(Object.keys(groups).length,12);
const oldSerialized=Object.fromEntries(art.groups.map(x=>[x.code,x.cards.map(c=>JSON.stringify(c))]));
const count=()=>art.groups.reduce((n,x)=>n+x.cards.length,0);
assert.equal(count(),20021);
assert.equal(coverage.summary.themeCardSlots,20021);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(source.canonicalSlots,438);
assert.equal(visual.canonicalCardSlots,438);
assert.equal(visual.reviewedContactSheets,source.contactSheets.length);
assert.equal(visual.heldCount,visual.held.length);
assert.equal(visual.safeForProvisionalThemeArtReview + visual.heldCount,438);
assert.equal(palette.screenedCount,visual.safeForProvisionalThemeArtReview);
assert.equal(palette.heldCount,visual.heldCount);
const held=new Set(visual.held.map(x=>norm(x.set)+"#"+x.number));
const paletteMap=new Map(palette.rows.map(x=>[norm(x.set)+"#"+x.number,x]));
assert.equal(held.size,visual.heldCount);
assert.equal(paletteMap.size,palette.screenedCount);
const before=Object.fromEntries(art.groups.map(x=>[x.code,x.cards.length]));
let acceptedTotal=0,added=0;
const completed=[];
for(const [setcode,total] of Object.entries(expected)){
  const matches=master.filter(x=>norm(x.code)===setcode);
  assert.equal(matches.length,1);const set=matches[0];
  assert.equal(set.cards.length,total);
  const sourceRows=source.cards.filter(x=>norm(x.set)===setcode);
  assert.equal(sourceRows.length,total);
  const coverageRows=coverage.sets.filter(x=>norm(x.code)===setcode);
  assert.equal(coverageRows.length,1);
  assert.equal(coverageRows[0].status,"pending");
  const previousRows=art.groups.flatMap(x=>x.cards).filter(x=>norm(x.set)===setcode);
  assert.equal(previousRows.length,existingCounts[setcode]);
  let valid=0,excluded=0,addedBySet=0;
  for(let i=0;i<total;i++){
    const n=i+1,card=set.cards[i],proof=sourceRows[i];
    const key=setcode+"#"+n;
    assert.equal(norm(card.code),norm(proof.canonicalCode));
    assert.equal(proof.originalImageReference,card.image);
    assert.equal(proof.koreanNameInMaster,card.name);
    if(held.has(key)){excluded++;continue;}
    assert.ok(proof.decoded && proof.httpStatus===200 && !proof.imageSourceError);
    assert.equal(proof.imageHost,"cards.image.pokemonkorea.co.kr");
    assert.equal(proof.duplicateArtworkSource,false);
    const pixel=paletteMap.get(key);assert.ok(pixel,key+" missing verified image pixels");
    assert.equal(pixel.sourceSha256,proof.actualSha256);
    assert.equal(norm(pixel.canonicalCode),norm(card.code));
    assert.match(pixel.observedArtColor,/^[가-힣]+·[가-힣]+$/);
    const tags={color:pixel.observedArtColor};
    const scene=visual.seasons?.[setcode]?.[n];
    if(scene)tags.season=scene;
    for(const theme of ["night","street","work","food","sunset","reflections","sleeping","cameo"]){
      const label=visual.extra?.[theme]?.[setcode]?.[n];if(label)tags[theme]=label;
    }
    const id=setcode.toUpperCase()+"_"+String(n).padStart(3,"0");
    for(const [theme,category] of Object.entries(tags)){
      assert.ok(groups[theme]);
      assert.ok(!groups[theme].cards.some(x=>norm(x.set)===setcode && x.code===id),"No duplicate independent theme membership");
      groups[theme].cards.push({
        code:id,name:card.name,series:"SM",set:set.code,
        setName:set.displayName,cardNumber:String(card.code).split("_")[1],
        rarity:card.rarity||"",category,image:card.image,
        evidence:"Visual image-screen inspection + original Pokemon Korea image SHA256 verified; uncertain secret printed-number slots held. "+resultPath
      });added++;addedBySet++;
    }
    valid++;acceptedTotal++;
  }
  const key=Object.keys(state.reviews||{}).find(x=>norm(x)===setcode)||set.code;
  assert.notEqual(state.reviews?.[key]?.status,"complete");
  state.reviews??={};
  state.reviews[key]={
    ...(state.reviews[key]||{}),
    status:"partial",reviewedAt:"2026-10-22",reviewedCardCount:valid,
    reviewedThemes:Object.keys(groups),evidence:resultPath,
    note:"Exact image/source and real contact-sheet artwork review "+valid+"/"+total+
      "; "+excluded+" unconfirmed Korean printed-footer/source-image holds. Not strict complete."
  };
  completed.push({set:set.code,masterCards:total,provisionallyScreened:valid,
    held:excluded,newIndependentThemeSlots:addedBySet,strictlyComplete:false});
}
assert.equal(acceptedTotal,visual.safeForProvisionalThemeArtReview);
assert.equal(completed.reduce((n,x)=>n+x.held,0),visual.heldCount);
assert.equal(count(),20021+added);
assert.ok(added>=acceptedTotal);
const delta=Object.fromEntries(art.groups.map(x=>[x.code,x.cards.length-before[x.code]]));
assert.equal(Object.values(delta).reduce((a,b)=>a+b,0),added);
for(const g of art.groups)assert.deepEqual(g.cards.slice(0,oldSerialized[g.code].length).map(x=>JSON.stringify(x)),oldSerialized[g.code]);
const tests=fs.readFileSync(testsPath,"utf8");
const old="assert.equal(total,20021); // SM7b/SM8/SM8a 217 Korean original arts screened; 22 held";
assert.equal(tests.split(old).length,2);
fs.writeFileSync(testsPath,tests.replace(old,
  "assert.equal(total,"+count()+"); // SM8b/SM9/SM9a visual art review; uncertain Korean print holds"));
const record={
 schemaVersion:1,recordedAt:"2026-10-22",
 batch:"SM8b GX 울트라샤이니 / SM9 태그볼트 / SM9a 나이트유니슨",
 masterEntries:438,sourceEvidence:sourcePath,visualEvidence:visualPath,
 paletteEvidence:palettePath,sourceRunId:visual.sourceGithubRunId,
 artworksScreened:acceptedTotal,heldCardEntries:visual.heldCount,
 themeRowsBefore:20021,themeRowsAdded:added,themeRowsAfter:count(),
 deltas:delta,strictCompleteSets:109,
 fullKoreanPrintedFooterVerificationPending:true,
 preserved:{previousThemeRowsModified:0,masterChanged:0,
    userOrFirestoreChanged:0,cardRadarChanged:0,
    priorSM9AndSM9aThemeRowsPreserved:4},
 sets:completed,held:visual.held
};
art.updatedAt="2026-10-22";
write(artPath,art);write(statePath,state);write(resultPath,record);
console.log("NEXT_438_SM_THEMES",JSON.stringify({
 valid:acceptedTotal,holds:visual.heldCount,added,after:count(),delta,completed
}));
