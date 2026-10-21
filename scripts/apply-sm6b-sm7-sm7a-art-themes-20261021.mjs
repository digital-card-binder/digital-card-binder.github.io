#!/usr/bin/env node
// Guarded, Korean-hosted 247-card original-art theme classification after viewing 19 image sheets.
import assert from "node:assert/strict";
import fs from "node:fs";
const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+"\n");
const folder="data/audits/";
const source=load(folder+"theme-sm6b-sm7-sm7a-image-evidence-20261021.json");
const review=load(folder+"theme-sm6b-sm7-sm7a-visual-decisions-20261021.json");
const palette=load(folder+"theme-sm6b-sm7-sm7a-color-palette-20261021.json");
const coverage=load(folder+"theme-series-coverage.json");
const statePath=folder+"theme-series-review-status.json";
const state=load(statePath);
const artPath="data/art-themes.json";
const art=load(artPath);
const master=[...load("data/series.json"),...load("data/series-legacy.json")];
const auditPath=folder+"theme-sm6b-sm7-sm7a-artwork-review-20261021.json";
const testPath="tests/theme-card-identity.test.mjs";
const norm=x=>String(x??"").toLowerCase().replace(/\s+/g,"");
const slots=()=>art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(slots(),19397,"Earlier audit changed, do not overwrite it");
assert.equal(coverage.summary.themeCardSlots,19397);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(source.canonicalSlots,271);
assert.equal(source.decodedImages,268);
assert.equal(review.reviewedContactSheets,19);
assert.equal(review.heldCount,24);
assert.equal(palette.screenedCount,247);
assert.equal(palette.heldCount,24);
assert.ok(!fs.existsSync(auditPath));
const expected={sm6b:86,sm7:112,sm7a:73};
const held=new Set(review.held.map(x=>x.set+"#"+x.number));
const rows=new Map(palette.rows.map(x=>[x.set+"#"+x.number,x]));
assert.equal(held.size,24);
assert.equal(rows.size,247);
const groups=Object.fromEntries(art.groups.map(g=>[g.code,g]));
assert.equal(Object.keys(groups).length,12);
const start=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]));
const checkRows=new Set();
const totals=[];
const manual={
  season:review.seasons,
  night:review.extra.night,
  street:review.extra.street
};
for(const [setcode,total] of Object.entries(expected)){
  const matches=master.filter(x=>norm(x.code)===setcode);
  assert.equal(matches.length,1);
  const set=matches[0];
  assert.equal(set.cards.length,total);
  const auditSet=coverage.sets.filter(x=>norm(x.code)===setcode);
  assert.equal(auditSet.length,1);
  assert.equal(auditSet[0].status,"pending");
  const sourceRows=source.cards.filter(x=>norm(x.set)===setcode);
  assert.equal(sourceRows.length,total);
  assert.equal(art.groups.flatMap(g=>g.cards).filter(x=>norm(x.set)===setcode).length,0,
     "Do not revisit previously tagged theme cards");
  let accepted=0,excluded=0,added=0;
  for(let n=1;n<=total;n++){
    const card=set.cards[n-1],proof=sourceRows[n-1];
    const key=setcode+"#"+n;
    assert.equal(norm(card.code),norm(proof.canonicalCode));
    assert.equal(card.image,proof.originalImageReference);
    assert.equal(card.name,proof.koreanNameInMaster);
    if(held.has(key)){
      assert.ok(!rows.has(key));
      excluded++;continue;
    }
    assert.ok(!held.has(key));
    assert.equal(proof.imageHost,"cards.image.pokemonkorea.co.kr");
    assert.equal(proof.decoded,true);
    assert.equal(proof.imageSourceError,null);
    const pixel=rows.get(key);
    assert.ok(pixel);
    assert.equal(pixel.sourceSha256,proof.actualSha256);
    assert.equal(norm(pixel.canonicalCode),norm(card.code));
    assert.match(pixel.observedArtColor,/^[가-힣]+·[가-힣]+$/);
    const tags={color:pixel.observedArtColor};
    for(const theme of ["season","night","street"]){
      const label=manual[theme]?.[setcode]?.[n];
      if(label)tags[theme]=label;
    }
    const cardId=setcode.toUpperCase()+"_"+String(n).padStart(3,"0");
    for(const [theme,category] of Object.entries(tags)){
      assert.ok(groups[theme]);
      assert.ok(!groups[theme].cards.some(r=>r.code===cardId));
      groups[theme].cards.push({
        code:cardId,name:card.name,series:"SM",set:set.code,
        setName:set.displayName,cardNumber:String(card.code).split("_")[1],
        rarity:card.rarity||"",category,image:card.image,
        evidence:"19 Korean artwork contact sheets visually screened in GitHub Actions #39533553177; "+
          "original picture SHA256 rechecked, objective art-color pixels; individual scenery explicitly selected. "+
          "Not a declaration of verified printed footer; 24 held. "+
          auditPath
      });
      added++;
    }
    accepted++;checkRows.add(key);
  }
  const key=Object.keys(state.reviews||{}).find(x=>norm(x)===setcode)||set.code;
  assert.notEqual(state.reviews?.[key]?.status,"complete");
  state.reviews??={};
  state.reviews[key]={
    ...(state.reviews[key]||{}),
    status:"partial",reviewedAt:"2026-10-21",
    reviewedCardCount:accepted,reviewedThemes:Object.keys(groups),
    evidence:auditPath,
    note:"Visually screened Korean card arts "+accepted+"/"+total+
      "; "+excluded+" image/identity holds and all enlarged Korean printed footers pending."
  };
  totals.push({set:set.code,masterCards:total,provisionallyScreened:accepted,
               held:excluded,newIndependentThemeSlots:added,
               strictlyComplete:false});
}
assert.equal(checkRows.size,247);
assert.equal(totals.reduce((n,x)=>n+x.held,0),24);
const added=totals.reduce((n,x)=>n+x.newIndependentThemeSlots,0);
assert.equal(slots(),19397+added);
const deltas=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length-start[g.code]]));
assert.equal(Object.values(deltas).reduce((a,b)=>a+b,0),added);
const tests=fs.readFileSync(testPath,"utf8");
const old="assert.equal(total,19397); // SM5+/SM6/SM6a 244 Korean artwork screens; 13 holds";
assert.equal(tests.split(old).length,2);
fs.writeFileSync(testPath,tests.replace(old,
  "assert.equal(total,"+slots()+"); // SM6b/SM7/SM7a 247 Korean original arts provisionally screened; 24 identity/source holds"));
const record={schemaVersion:1,recordedAt:"2026-10-21",
 batch:"SM6b 챔피언로드 / SM7 창공의 카리스마 / SM7a 플라스마 스파크",
 sourceEvidence:source.source,actualSourceReport:folder+"theme-sm6b-sm7-sm7a-image-evidence-20261021.json",
 visualEvidence:folder+"theme-sm6b-sm7-sm7a-visual-decisions-20261021.json",
 paletteEvidence:folder+"theme-sm6b-sm7-sm7a-color-palette-20261021.json",
 sourceRunId:39533553177,masterEntries:271,artworksScreened:247,
 heldCardEntries:24,themeRowsBefore:19397,themeRowsAdded:added,
 themeRowsAfter:slots(),deltas,strictCompleteSets:109,
 fullKoreanPrintedFooterVerificationPending:true,
 preserved:{priorThemeRowsModified:0,otherStrictCompleteSetsReopened:0,
 masterChanged:0,ownerOrFirestoreChanged:0,cardRadarChanged:0},
 sets:totals,held:review.held,
 next:"Replace 3 Japanese SM7a photos; recover SM7 108-110 404; inspect 9 SM6b repeated secret-number artwork; enlarge 5 SM7 rare print footers, 4 SM7a rare print footers; do not claim strict completion."
};
art.updatedAt="2026-10-21";
save(artPath,art);save(statePath,state);save(auditPath,record);
console.log("SM6B_SM7_SM7A_VISUAL_ART_THEMES",JSON.stringify({
 screened:247,holds:24,themeAdded:added,slotsAfter:slots(),
 deltas,sets:totals
}));
