import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n");
const CODE="s5a",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const ART="data/audits/theme-s5a-001-030-Korean-art-review-20261016.json";
const PREFLIGHT="data/audits/theme-visual-evidence/s5a/001-030/visual-index.json";
const NEXT="s5a canonical 031-060";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,preflight,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(ART),read(PREFLIGHT),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json")
]);
const matching=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(matching.length!==1||matching[0].cards?.length!==96)throw Error("Expected unchanged 96-card Korean S5a master set");
const set=matching[0],ids=set.cards.map(c=>c.code);
const existingKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
const existing=existingKey&&status.reviews[existingKey];
if(existing?.reviewedCardCount===30&&existing.reviewedRanges?.includes("001-030")){
 console.log("S5a 001-030 already applied; idempotent no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 (existing&&existing.status!=="pending")||
 coverage.sets?.find(s=>String(s.code||"").toLowerCase()===CODE)?.status!=="pending")
 throw Error("Preserved global hold or S5a baseline drift; refuse mutation");
if(review.set!==CODE||review.range!=="001-030"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.sourceImagesRequested!==0||
 review.globalHoldUnchanged!==GLOBAL||review.nextStart!==NEXT||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.items?.length!==30||
 preflight.set!==CODE||preflight.range!=="001-030"||
 preflight.checkedCardCount!==30||preflight.ownedImageDecodedCount!==30||
 preflight.ownedImageUnavailableCount!==0||
 preflight.globalCheckpointPreserved!==GLOBAL)
 throw Error("Independent Korean printed card evidence missing");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing theme group "+t);
const existingS5a=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
if(existingS5a.length!==1||String(existingS5a[0].code).toUpperCase()!=="S5A_061"||
 !themes.groups.find(g=>g.code==="season").cards.some(c=>String(c.code).toUpperCase()==="S5A_061"))
 throw Error("Do not lose the preexisting S5a_061 seasonal membership");
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=i+1,number=String(n).padStart(3,"0"),id="S5a_"+number,code="s5a_"+number+"/070";
 const row=review.items[i],pre=preflight.cards[i],master=set.cards[i];
 if(!row||!pre||!master||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 row.cardKey!==id||row.name!==master.name||pre.name!==master.name||
 master.code.toLowerCase()!==code||pre.code.toLowerCase()!==code||
 pre.printedNumber!==number+"/070"||!row.koreanPrintImageVerified||
 !row.artObservation?.trim()||pre.imageCheck?.status!=="decoded"||
 pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP"||
 pre.imageCheck?.dimensions?.[0]!==420||pre.imageCheck?.dimensions?.[1]!==586||
 !pre.rawSource?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5a/S5a_")||
 !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S5a/S5a_"))
 throw Error("Korean print/owned image proof mismatch for S5a "+number);
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("Artwork theme classification invalid at S5a "+number);
 if(themes.groups.some(g=>g.cards.some(c=>String(c.code||"").toUpperCase()===id.toUpperCase()||
 (String(c.set||"").toLowerCase()===CODE&&String(c.cardNumber||"")===number+"/070"))))
 throw Error("Refuse to overwrite existing S5a 001-030 entry "+number);
 for(const t of selected){
   groups.get(t).cards.push({
    code:id,name:master.name,series:"S",set:set.code,setName:set.displayName||"쌍벽의 파이터",
    cardNumber:number+"/070",rarity:master.rarity||"",category:row.categories[t],
    image:pre.ownedUrl,
    evidence:"한국어 인쇄 공식 S5a "+number+"/070 삽화 12개 독립 테마 시각검수: "+
      row.artObservation+" ("+ART+")"
   });
   additions.push({number:n,theme:t});
   counts[t]=(counts[t]||0)+1;
 }
}
if(additions.length!==53||
 THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==JSON.stringify(ids))
 throw Error("Unexpected category total or canonical ownership key alteration");
status.reviews??={};
status.reviews[set.code]={
 status:"in_progress",reviewedAt:DATE,masterSetCardCount:96,
 artworkReviewedCardCount:30,reviewedCardCount:30,
 verifiedKoreanPrintImageCount:30,verifiedSelfHostedImageCount:30,
 reviewedRanges:["001-030"],reviewedThemes:THEMES,
 newlyAddedThemeSlotCount:additions.length,heldCards:[],
 unresolvedImageIssues:[],
 partialReviewEvidence:ART,imagePreflightEvidence:PREFLIGHT,
 nextStart:NEXT,complete:false,
 note:"쌍벽의 파이터 한국어판 001~030번 실제 카드 이미지를 직접 보고 12개 테마 검수, 신규 53개 테마 슬롯 자체 CDN 원본 이미지로 등록. 031~096번 미검수, 기존 061/070 계절 테마 및 원본 카드 보유 키 보존. S6K 글로벌 이미지 보류 4장 미변경."
};
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 existingS5a[0].code!=="S5a_061")
 throw Error("Global hold or prior S5a theme entry modified");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save("data/audits/theme-s5a-001-030-progress-20261016.json",{
  schemaVersion:1,recordedAt:DATE,set:set.code,setName:set.displayName,
  totalMasterCards:96,KoreanPrintArtworksReviewed:30,
  sourceImagesSelfHostedDecoded:30,themeSlotsAdded:additions.length,
  themeCounts:counts,existingPreserved:["S5a_061"],
  reviewedRanges:["001-030"],status:"in_progress",complete:false,
  nextStart:NEXT,globalCheckpointPreserved:GLOBAL,
  manualReview:ART,ownedImagePreflight:PREFLIGHT,
  note:"S5a first 30 Korean printed cards visually classified for 12 themes. Remaining 66 cards unreviewed; do not mark complete."
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:30,total:96,newThemeSlots:53,
 counts,nextStart:NEXT,globalCheckpointPreserved:GLOBAL}));
