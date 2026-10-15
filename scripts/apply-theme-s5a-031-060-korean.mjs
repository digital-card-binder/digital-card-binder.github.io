import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n");
const CODE="s5a",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const ART="data/audits/theme-s5a-031-060-Korean-art-review-20261016.json";
const PREFLIGHT="data/audits/theme-visual-evidence/s5a/031-060/visual-index.json";
const PROGRESS="data/audits/theme-s5a-031-060-progress-20261016.json";
const PREVIOUS="data/audits/theme-s5a-001-030-progress-20261016.json";
const NEXT="s5a canonical 061-096";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage,previous]=await Promise.all([
 read(ART),read(PREFLIGHT),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),read(PREVIOUS)
]);
const sources=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(sources.length!==1||sources[0].cards?.length!==96)throw Error("Canonical S5a 96-slot master altered");
const set=sources[0],originalKeys=set.cards.map(c=>c.code);
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(!key)throw Error("Missing S5a first 30 applied checkpoint");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===60&&meta.reviewedRanges?.includes("031-060")){
 console.log("S5a 031-060 already applied; safe idempotent exit");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 meta.status!=="in_progress"||meta.reviewedCardCount!==30||
 meta.artworkReviewedCardCount!==30||meta.verifiedKoreanPrintImageCount!==30||
 meta.verifiedSelfHostedImageCount!==30||meta.newlyAddedThemeSlotCount!==53||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030"])||
 meta.nextStart!=="s5a canonical 031-060"||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="in_progress"||
 previous.KoreanPrintArtworksReviewed!==30||previous.themeSlotsAdded!==53||
 previous.globalCheckpointPreserved!==GLOBAL)
 throw Error("S5a first 30 or S6K global checkpoint changed");
if(review.set!==CODE||review.range!=="031-060"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||
 review.sourceImagesRequested!==0||review.globalHoldUnchanged!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.items?.length!==30||
 proof.set!==CODE||proof.range!=="031-060"||proof.checkedCardCount!==30||
 proof.ownedImageDecodedCount!==30||proof.ownedImageUnavailableCount!==0||
 proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S5a 031-060 Korean preflight/manual artwork audit incomplete");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Required theme missing "+t);
const existing=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
if(existing.length!==54||!existing.some(c=>String(c.code).toUpperCase()==="S5A_061"))
 throw Error("Existing S5a 53+1 theme memberships unexpectedly altered");
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=i+31,num=String(n).padStart(3,"0"),cardKey="S5a_"+num,code="s5a_"+num+"/070";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[n-1];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 row.cardKey!==cardKey||row.name!==card.name||pre.name!==card.name||
 card.code?.toLowerCase()!==code||pre.code?.toLowerCase()!==code||
 pre.printedNumber!==num+"/070"||!row.koreanPrintImageVerified||
 !row.artObservation?.trim()||pre.imageCheck?.status!=="decoded"||
 pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP"||
 pre.imageCheck?.dimensions?.[0]!==420||pre.imageCheck?.dimensions?.[1]!==586||
 !pre.rawSource?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5a/S5a_")||
 !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S5a/S5a_"))
 throw Error("Missing genuine Korean card or owned image "+num);
 const chosen=new Set(row.matchedThemes||[]);
 if(chosen.size!==row.matchedThemes?.length||!chosen.has("color")||
 [...chosen].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!chosen.has(t)))
 throw Error("Invalid visual classification "+num);
 if(themes.groups.some(g=>g.cards.some(c=>String(c.code).toUpperCase()===cardKey.toUpperCase()||
 (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/070"))))
 throw Error("Must not overwrite an existing live artwork "+num);
 for(const t of chosen){
   groups.get(t).cards.push({
    code:cardKey,name:card.name,series:"S",set:set.code,
    setName:set.displayName||"쌍벽의 파이터",
    cardNumber:num+"/070",rarity:card.rarity||"",category:row.categories[t],
    image:pre.ownedUrl,evidence:"한국어 인쇄 공식 S5a "+num+"/070 직접 확인 및 12개 테마 시각검수: "+
    row.artObservation+" ("+ART+")"
   });
   counts[t]=(counts[t]||0)+1;
   additions.push({number:n,theme:t});
 }
}
if(additions.length!==46||THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==JSON.stringify(originalKeys)||
 !themes.groups.find(g=>g.code==="season").cards.some(c=>String(c.code).toUpperCase()==="S5A_061"))
 throw Error("S5a theme count or preexisting season membership altered");
meta.artworkReviewedCardCount=60;
meta.reviewedCardCount=60;
meta.verifiedKoreanPrintImageCount=60;
meta.verifiedSelfHostedImageCount=60;
meta.reviewedRanges=["001-030","031-060"];
meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=99;
meta.partialReviewEvidence=ART;
meta.imagePreflightEvidence=PREFLIGHT;
meta.nextStart=NEXT;
meta.reviewedAt=DATE;
meta.status="in_progress";
meta.complete=false;
meta.note="쌍벽의 파이터 한국판 001~060번 실제 이미지와 12개 독립 테마 검수 완료. 신규 031~060번 46개, 누적 99개 신규 테마 슬롯. 공식 한국판 이미지 60장 자체 CDN 표시. 061~096번 추가 검수 필요, 기존 S5a_061 테마 및 보유 ID 유지. S6K 글로벌 보류 4장 보존.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Unexpected global state change");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
  schemaVersion:1,recordedAt:DATE,set:set.code,totalMasterCards:96,
  artworkReviewed:60,verifiedKoreanPrintedImages:60,
  imageDecodedCountThisBatch:30,themeSlotsAddedThisBatch:46,
  totalNewThemeSlots:99,counts,
  retainedOriginalMembership:"S5a_061",reviewedRanges:["001-030","031-060"],
  complete:false,status:"in_progress",nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,sourceProof:ART,hostedImageProof:PREFLIGHT
 })
]);
console.log(JSON.stringify({set:CODE,artworksReviewed:60,total:96,added:46,
 themeSlotsTotal:99,counts,nextStart:NEXT,globalCheckpointPreserved:GLOBAL}));
