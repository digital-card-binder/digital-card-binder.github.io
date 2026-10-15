import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const write=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n");
const CODE="s6H", DATE="2026-10-15";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s6H-031-060-Korean-art-review-20261015.json";
const PROOF="data/audits/theme-visual-evidence/s6H/031-060/visual-index.json";
const IMAGE_AUDIT="data/audits/theme-s6H-001-095-Korean-print-review-20261015.json";
const NEXT="s6H canonical 061 artwork theme inspection";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,imageAudit,modern,legacy,themeDb,status,hosting,priorProgress]=await Promise.all([
 read(REVIEW),read(PROOF),read(IMAGE_AUDIT),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-s6H-001-030-progress-20261015.json")
]);
const matching=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s6h");
if(matching.length!==1||matching[0].cards?.length!==95)throw Error("Expected one 95-card Korean S6H master");
const set=matching[0],originalCodes=set.cards.map(c=>c.code);
const reviewKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()==="s6h")||set.code;
const previous=status.reviews?.[reviewKey]||{};
if(previous.artworkReviewedCardCount===60&&previous.reviewedRanges?.includes("031-060")){
 console.log("S6H 031-060 already registered; no duplicate changes");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 previous.status!=="in_progress"||previous.artworkReviewedCardCount!==30||
 previous.reviewedCardCount!==30||previous.verifiedKoreanPrintImageCount!==83||
 previous.verifiedSelfHostedImageCount!==95||previous.heldCards?.length!==12||
 previous.unresolvedImageIssues?.length!==12||
 JSON.stringify(previous.reviewedRanges)!==JSON.stringify(["001-030"])||
 priorProgress.artworkReviewed!==30||priorProgress.themeAdditions!==56||
 priorProgress.globalCheckpointPreserved!==GLOBAL)
 throw Error("S6K global hold or S6H 001-030 checkpoint changed, refuse mutation");
if(review.set!==CODE||review.range!=="031-060"||
 review.status!=="manual_artwork_12_theme_reviewed"||
 review.artworksReviewed!==30||review.verifiedKoreanPrintImagesInRange!==30||
 review.all12ThemesInspected!==true||review.sourceImagesRequested!==0||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.items?.length!==30||review.globalHoldUnchanged!==GLOBAL||
 proof.set!=="s6h"||proof.range!=="031-060"||
 proof.canonicalCardsChecked!==30||proof.masterSetCardCount!==95||
 proof.verifiedOwnedCdnImageCount!==30||proof.unavailableOwnedCdnImageCount!==0||
 proof.printedNumberMatchCount!==30||proof.koreanNameNonemptyCount!==30||
 proof.sourceRequestCount!==0||
 imageAudit.visuallyReviewedKoreanPrintCount!==83||
 imageAudit.foreignPrintImagePlaceholderCount!==12||
 imageAudit.heldNumbers?.length!==12)
 throw Error("S6H independent manual / Korean print proof incomplete");
const groups=new Map((themeDb.groups||[]).map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Independent theme missing "+t);
const liveFirst30=themeDb.groups.flatMap(g=>g.cards.filter(c=>
 /^S6H_0(?:[0-2][0-9]|30)$/i.test(String(c.code||""))).map(c=>({t:g.code,c:c.code})));
if(liveFirst30.length!==56)throw Error("Existing first 30 art-review memberships changed: "+liveFirst30.length);
const changes=[],counts={};
for(let i=0;i<30;i++){
 const n=31+i,id=String(n).padStart(3,"0"),code="s6h_"+id+"/070",key="S6H_"+id;
 const art=review.items[i],row=proof.cards[i],master=set.cards[n-1];
 if(!art||!row||!master||art.canonicalOrder!==n||row.canonicalOrder!==n||
 art.cardKey!==key||art.name!==master.name||row.name!==master.name||
 !art.artObservation?.trim()||!row.koreanNameNonempty||!row.printedNumberMatches||
 row.masterCode?.toLowerCase()!==code||master.code?.toLowerCase()!==code||
 row.expectedPrintedNumber!==id+"/070"||
 row.imageCheck?.status!=="decoded"||row.imageCheck?.http!==200||
 row.imageCheck?.format!=="WEBP"||row.imageCheck?.dimensions?.[0]<350||
 row.imageCheck?.dimensions?.[1]<490||
 !row.rawSource?.startsWith("https://cards.image.pokemonkorea.co.kr/")||
 !row.ownedCdnUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/"))
 throw Error("Incorrect Korean print or source image at S6H "+id);
 const selected=new Set(art.matchedThemes);
 if(selected.size!==art.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!art.categories?.[t]?.trim())||
 Object.keys(art.categories||{}).some(t=>!selected.has(t)))
 throw Error("12-theme manual classification invalid "+id);
 const existing=themeDb.groups.flatMap(g=>g.cards.filter(c=>
  String(c.code||"").toUpperCase()===key||
  (String(c.set||"").toLowerCase()==="s6h"&&
  String(c.cardNumber||"").startsWith(id+"/"))).map(c=>({theme:g.code,card:c})));
 if(existing.length)throw Error("Refuse to replace live S6H "+id+" theme records: "+existing.length);
 // Previously archived priorThemes references came from a stale cross-set preflight.
 // Do NOT infer membership or delete cards from that historical field.
 for(const t of selected){
  const group=groups.get(t);
  group.cards.push({code:key,name:master.name,series:"S",set:set.code,
   setName:set.displayName||"백은의 랜스",cardNumber:id+"/070",rarity:master.rarity||"",
   category:art.categories[t],image:row.ownedCdnUrl,
   evidence:"한국판 S6H "+id+"/070 카드 일러스트 12테마 시각검수: "+
   art.artObservation+" ("+REVIEW+")"});
  changes.push({number:n,theme:t,operation:"add_visually_confirmed_theme"});
  counts[t]=(counts[t]||0)+1;
 }
}
if(JSON.stringify(originalCodes)!==JSON.stringify(set.cards.map(c=>c.code))||
 THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 changes.length!==48)
 throw Error("Card identity changed or unexpected 031-060 theme totals");
previous.artworkReviewedCardCount=60;
previous.reviewedCardCount=60;
previous.reviewedRanges=["001-030","031-060"];
previous.reviewedThemes=THEMES;
previous.partialReviewEvidence=REVIEW;
previous.nextStart=NEXT;
previous.newlyAddedThemeSlotCount=(previous.newlyAddedThemeSlotCount||0)+changes.length;
previous.note="백은의 랜스 001-060 총 60장 12독립 테마 직접 시각 검수·반영. 031-060은 48개 슬롯 신규 등록, 이름/번호/한국어판 자체CDN 검증. 061-095 일러스트 미반영; 084-095 한국어 실물 이미지 12장 보류. 기존 S6K 이미지 보류 4장과 사용자 보유 키 보존.";
previous.reviewedAt=DATE;previous.status="in_progress";
status.updatedAt=DATE;themeDb.updatedAt=DATE;
await Promise.all([
 write("data/art-themes.json",themeDb),
 write("data/audits/theme-series-review-status.json",status),
 write("data/audits/theme-s6H-031-060-progress-20261015.json",{
  schemaVersion:1,recordedAt:DATE,set:CODE,totalCards:95,
  artworkReviewed:60,artworkReviewedThisBatch:30,
  koreanPrintedImagesVerified:83,foreignPrintedImageHolds:12,
  themeReviewRanges:["001-030","031-060"],
  all12ThemesInspected:true,themeAdditionsThisBatch:48,
  themeAdditionsTotal:(previous.newlyAddedThemeSlotCount||0),
  incorrectThemeRemovals:0,
  notes:"All source images are official Korean-printed 420x586 scans rehosted at DCB modern CDN. Historical priorThemes annotations were not used to infer membership; only explicit reviewed illustration classifications added. Preserve live prior 001-030 and user ownership keys.",
  modifications:changes,complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,themeReviewProof:REVIEW,
  imageProof:PROOF
 })]);
console.log(JSON.stringify({set:CODE,verifiedArtworks:60,total:95,
 batchArtworks:30,batchThemeAdditions:changes.length,counts,next:NEXT,globalHold:GLOBAL}));
