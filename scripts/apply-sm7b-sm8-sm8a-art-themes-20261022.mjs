#!/usr/bin/env node
// Append only visually examined Korean original artwork theme memberships.
import assert from "node:assert/strict";
import fs from "node:fs";

const read = p => JSON.parse(fs.readFileSync(p,"utf8"));
const write = (p,v) => fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n");
const prefix = "data/audits/";
const pathSource=prefix+"theme-sm7b-sm8-sm8a-image-evidence-20261022.json";
const pathReview=prefix+"theme-sm7b-sm8-sm8a-visual-decisions-20261022.json";
const pathPalette=prefix+"theme-sm7b-sm8-sm8a-color-palette-20261022.json";
const pathResult=prefix+"theme-sm7b-sm8-sm8a-artwork-review-20261022.json";
const pathArt="data/art-themes.json";
const pathState=prefix+"theme-series-review-status.json";
const pathTests="tests/theme-card-identity.test.mjs";
assert.ok(!fs.existsSync(pathResult),"Earlier reviewed audit must never be overwritten");
const source=read(pathSource),review=read(pathReview),palette=read(pathPalette);
const coverage=read(prefix+"theme-series-coverage.json");
const art=read(pathArt), state=read(pathState);
const master=[...read("data/series.json"),...read("data/series-legacy.json")];
const normalize=x=>String(x??"").trim().toLowerCase().replace(/\s+/g,"");
const groups=Object.fromEntries(art.groups.map(g=>[g.code,g]));
assert.equal(Object.keys(groups).length,12);
const originals=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.map(x=>JSON.stringify(x))]));
const slots=()=>art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(slots(),19717);
assert.equal(coverage.summary.themeCardSlots,19717);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(source.canonicalSlots,239);
assert.equal(source.decodedImages,236);
assert.equal(review.reviewedContactSheets,18);
assert.equal(review.safeForProvisionalThemeArtReview,217);
assert.equal(review.heldCount,22);
assert.equal(palette.screenedCount,217);
assert.equal(palette.heldCount,22);
const held=new Set(review.held.map(x=>normalize(x.set)+"#"+x.number));
const pixels=new Map(palette.rows.map(x=>[normalize(x.set)+"#"+x.number,x]));
assert.equal(held.size,22);
assert.equal(pixels.size,217);
const expected={sm7b:63,sm8:111,sm8a:65};
const prior={sm7b:0,sm8:1,sm8a:1};
assert.equal(Object.values(prior).reduce((a,b)=>a+b,0),2);
const before=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]));
const results=[];
const checked=new Set();
for (const [setCode,total] of Object.entries(expected)){
  const match=master.filter(x=>normalize(x.code)===setCode);
  assert.equal(match.length,1);
  const set=match[0];
  assert.equal(set.cards.length,total);
  const coverageRecords=coverage.sets.filter(x=>normalize(x.code)===setCode);
  assert.equal(coverageRecords.length,1);
  assert.equal(coverageRecords[0].status,"pending");
  const sourceRows=source.cards.filter(x=>normalize(x.set)===setCode);
  assert.equal(sourceRows.length,total);
  const existing=art.groups.flatMap(g=>g.cards).filter(x=>normalize(x.set)===setCode);
  assert.equal(existing.length,prior[setCode],"Preexisting independent membership drift");
  let provisional=0,excluded=0,newRows=0;
  for (let n=1;n<=total;n++){
    const card=set.cards[n-1], evidence=sourceRows[n-1];
    const key=setCode+"#"+n;
    assert.equal(normalize(card.code),normalize(evidence.canonicalCode));
    assert.equal(card.image,evidence.originalImageReference);
    assert.equal(card.name,evidence.koreanNameInMaster);
    assert.equal(evidence.index,n);
    if (held.has(key)){
      assert.ok(!pixels.has(key),"Held image accidentally color approved");
      excluded++;continue;
    }
    assert.equal(evidence.imageHost,"cards.image.pokemonkorea.co.kr");
    assert.equal(evidence.decoded,true);
    assert.equal(evidence.imageSourceError,null);
    assert.equal(evidence.duplicateArtworkSource,false);
    const pix=pixels.get(key);
    assert.ok(pix,key+" missing real picture colors");
    assert.equal(pix.sourceSha256,evidence.actualSha256);
    assert.equal(normalize(pix.canonicalCode),normalize(card.code));
    assert.match(pix.observedArtColor,/^[가-힣]+·[가-힣]+$/);
    const tags={color:pix.observedArtColor};
    const season=review.seasons?.[setCode]?.[n];
    if (season)tags.season=season;
    for(const theme of ["night","street","work"]){
      const label=review.extra?.[theme]?.[setCode]?.[n];
      if(label)tags[theme]=label;
    }
    const cardId=setCode.toUpperCase()+"_"+String(n).padStart(3,"0");
    for(const [theme,category] of Object.entries(tags)){
      assert.ok(groups[theme]);
      assert.ok(!groups[theme].cards.some(row=>row.code===cardId && normalize(row.set)===setCode),
        "Refusing to duplicate any existing independent theme membership");
      groups[theme].cards.push({
        code:cardId,name:card.name,series:"SM",set:set.code,setName:set.displayName,
        cardNumber:String(card.code).split("_")[1],rarity:card.rarity||"",
        category,image:card.image,
        evidence:"Korean print artwork visually screened in 18 image sheets from GitHub Actions #39690764769; original picture SHA256 rechecked; actual artwork-only themes. 22 suspect printed-number or external-source images held. "+
          pathResult
      });
      newRows++;
    }
    provisional++;checked.add(key);
  }
  const stateKey=Object.keys(state.reviews||{}).find(x=>normalize(x)===setCode)||set.code;
  assert.notEqual(state.reviews?.[stateKey]?.status,"complete");
  state.reviews??={};
  state.reviews[stateKey]={
    ...(state.reviews[stateKey]||{}),
    status:"partial",reviewedAt:"2026-10-22",
    reviewedCardCount:provisional,reviewedThemes:Object.keys(groups),
    evidence:pathResult,
    note:"Provisional 18 contact-sheet Korean-original-art screening "+provisional+"/"+total+
      "; "+excluded+" printed-number/source holds. No strict Korean printed-footer completion."
  };
  results.push({set:set.code,masterCards:total,provisionallyScreened:provisional,
    held:excluded,newIndependentThemeSlots:newRows,strictlyComplete:false});
}
assert.equal(checked.size,217);
assert.equal(results.reduce((n,x)=>n+x.held,0),22);
const added=results.reduce((n,x)=>n+x.newIndependentThemeSlots,0);
assert.equal(added,304,"Only 217 artwork colors, 77 clear scenery, 7 night, 2 street and 1 work tags");
assert.equal(slots(),19717+added);
const deltas=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length-before[g.code]]));
assert.equal(Object.values(deltas).reduce((a,b)=>a+b,0),added);
for(const g of art.groups){
  assert.deepEqual(g.cards.slice(0,originals[g.code].length).map(x=>JSON.stringify(x)),
    originals[g.code],"Prior cards must be byte-preserved, including two SM8/SM8a tags");
}
// Repair the original source report's third-party counter (its old classifier
// expected third_party_image_url; preflight uses third_party_or_missing_image_url).
const external=source.cards.filter(x=>x.referenceKind!=="pokemonkorea_card_image_url");
assert.equal(external.length,8);
source.thirdPartyReferencesRequiringKoreanPrintReview=8;
for(const s of source.sets){
  const rows=source.cards.filter(x=>normalize(x.set)===normalize(s.set));
  s.thirdPartyDecodedCount=rows.filter(x=>x.referenceKind!=="pokemonkorea_card_image_url"&&x.decoded).length;
  s.thirdPartyUncheckedKoreanPrintCount=rows.filter(x=>x.referenceKind!=="pokemonkorea_card_image_url").length;
}
source.provisionalThemeReviewHolds=22;
source.sourceMetadataCounterCorrectedAt="2026-10-22";
const tests=fs.readFileSync(pathTests,"utf8");
const old="assert.equal(total,19717); // SM6b/SM7/SM7a 247 Korean original arts provisionally screened; 24 identity/source holds";
assert.equal(tests.split(old).length,2,"Test baseline changed since branch creation");
fs.writeFileSync(pathTests,tests.replace(old,
  "assert.equal(total,"+slots()+"); // SM7b/SM8/SM8a 217 Korean original arts screened; 22 held"));
const record={
 schemaVersion:1,recordedAt:"2026-10-22",
 batch:"SM7b 페어리라이즈 / SM8 버스트임팩트 / SM8a 다크오더",
 sourceEvidence:pathSource,visualEvidence:pathReview,paletteEvidence:pathPalette,
 sourceRunId:39690764769,masterEntries:239,artworksScreened:217,
 heldCardEntries:22,themeRowsBefore:19717,themeRowsAdded:added,
 themeRowsAfter:slots(),deltas,strictCompleteSets:109,
 fullKoreanPrintedFooterVerificationPending:true,
 preserved:{priorThemeRowsModified:0,earlierStrictCompleteSetsReopened:0,
 masterChanged:0,ownerOrFirestoreChanged:0,cardRadarChanged:0},
 sets:results,held:review.held,
 next:"Recover Korean printed-number evidence for SM7b 057-063 and SM8a 059-065; recover SM8 104-111 external-source identity; do not declare strict completion."
};
art.updatedAt="2026-10-22";
write(pathSource,source);write(pathArt,art);write(pathState,state);write(pathResult,record);
console.log("SM_NEXT_217_ART_THEMES",JSON.stringify({
 screened:217,holds:22,themeAdded:added,slotsAfter:slots(),deltas,sets:results
}));
