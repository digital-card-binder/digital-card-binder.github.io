import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n");
const CODE="s6H",DATE="2026-10-15",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const ART="data/audits/theme-s6H-061-083-Korean-art-review-20261015.json";
const PROOF="data/audits/theme-visual-evidence/s6H/061-095/visual-index.json";
const NEXT="s6H Korean print source pending: 084-095";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,prev]=await Promise.all([
 read(ART),read(PROOF),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-s6H-031-060-progress-20261015.json")
]);
const matching=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()==="s6h");
if(matching.length!==1||matching[0].cards?.length!==95)throw Error("Canonical s6H set altered");
const set=matching[0],origCodes=set.cards.map(x=>x.code);
const k=Object.keys(status.reviews||{}).find(key=>key.toLowerCase()==="s6h")||set.code,meta=status.reviews?.[k]||{};
if(meta.artworkReviewedCardCount===83&&meta.reviewedRanges?.includes("061-083")){
 console.log("s6H 061-083 already applied; safe idempotent exit");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 meta.status!=="in_progress"||meta.artworkReviewedCardCount!==60||
 meta.reviewedCardCount!==60||meta.verifiedKoreanPrintImageCount!==83||
 meta.verifiedSelfHostedImageCount!==95||
 meta.heldCards?.length!==12||meta.unresolvedImageIssues?.length!==12||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 prev.artworkReviewed!==60||prev.themeAdditionsThisBatch!==48||
 prev.globalCheckpointPreserved!==GLOBAL)
 throw Error("S6H independent 60-card checkpoint or S6K holds changed");
if(review.set!==CODE||review.range!=="061-083"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 review.artworksReviewed!==23||review.verifiedKoreanPrintImagesInRange!==23||
 !review.all12ThemesInspected||review.sourceImagesRequested!==0||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.items?.length!==23||review.globalHoldUnchanged!==GLOBAL||
 proof.set!=="s6h"||proof.range!=="061-095"||
 proof.canonicalCardsChecked!==35||proof.verifiedOwnedCdnImageCount!==35||
 proof.unavailableOwnedCdnImageCount!==0||proof.printedNumberMatchCount!==35)
 throw Error("Korean image+artwork evidence incomplete");
const gmap=new Map((themes.groups||[]).map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(gmap.get(t)?.cards))throw Error("Independent theme missing "+t);
const first60=themes.groups.flatMap(g=>g.cards.filter(x=>/^S6H_0(?:[0-5][0-9]|60)$/i.test(String(x.code||""))));
if(first60.length!==104)throw Error("S6H first sixty visual memberships changed "+first60.length);
const additions=[],counts={};
for(let i=0;i<23;i++){
 const n=61+i,id=String(n).padStart(3,"0"),key="S6H_"+id,code="s6h_"+id+"/070";
 const row=review.items[i],photo=proof.cards[i],master=set.cards[n-1];
 if(!row||!photo||!master||row.canonicalOrder!==n||photo.canonicalOrder!==n||
 row.cardKey!==key||row.name!==master.name||photo.name!==master.name||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 master.code?.toLowerCase()!==code||photo.masterCode?.toLowerCase()!==code||
 photo.expectedPrintedNumber!==id+"/070"||!photo.printedNumberMatches||
 photo.imageCheck?.status!=="decoded"||photo.imageCheck?.http!==200||
 photo.imageCheck?.format!=="WEBP"||
 photo.imageCheck?.dimensions?.[0]<350||photo.imageCheck?.dimensions?.[1]<490||
 !photo.rawSource?.startsWith("https://cards.image.pokemonkorea.co.kr/")||
 !photo.ownedCdnUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/"))
 throw Error("Unverified Korean printed card or source at "+id);
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid manual 12-theme classification "+id);
 const existing=themes.groups.flatMap(g=>g.cards.filter(x=>
 String(x.code||"").toUpperCase()===key||
 (String(x.set||"").toLowerCase()==="s6h"&&String(x.cardNumber||"").startsWith(id+"/"))));
 if(existing.length)throw Error("Refuse to override existing live theme entry "+id);
 for(const t of selected){
   gmap.get(t).cards.push({code:key,name:master.name,series:"S",set:set.code,
   setName:set.displayName||"백은의 랜스",cardNumber:id+"/070",rarity:master.rarity||"",
   category:row.categories[t],image:photo.ownedCdnUrl,
   evidence:"한국어판 S6H "+id+"/070 공식 카드 일러스트 12테마 직접 시각 검수: "+
   row.artObservation+" ("+ART+")"});
   additions.push({number:n,theme:t,operation:"add_visually_confirmed_theme"});
   counts[t]=(counts[t]||0)+1;
 }
}
if(JSON.stringify(origCodes)!==JSON.stringify(set.cards.map(c=>c.code))||
 THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 additions.length!==32)
 throw Error("Unexpected Korean art theme total or changed card identities");
const foreignCodes=Array.from({length:12},(_,i)=>"s6h_"+String(84+i).padStart(3,"0")+"/070");
if(JSON.stringify((meta.heldCards||[]).map(x=>String(x).toLowerCase()))!==JSON.stringify(foreignCodes))
 throw Error("Foreign printed 84-95 Korean edition image holds changed");
meta.artworkReviewedCardCount=83;meta.reviewedCardCount=83;
meta.reviewedRanges=["001-030","031-060","061-083"];
meta.reviewedThemes=THEMES;
meta.partialReviewEvidence=ART;meta.nextStart=NEXT;
meta.newlyAddedThemeSlotCount=(meta.newlyAddedThemeSlotCount||0)+additions.length;
meta.note="S6H 한국어 인쇄 카드 001-083번 그림 12개 독립 테마 모두 검수·반영. 061-083 신규 32개 분류. 084-095 일본어 인쇄 사진은 한국판 검수 불가하여 분류·한국판 이미지 교체 모두 별도 보류, 미완료 유지. S6K 글로벌 카드 보류 4장 및 기존 보유 코드 변경 없음.";
meta.status="in_progress";meta.reviewedAt=DATE;
status.updatedAt=DATE;themes.updatedAt=DATE;
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save("data/audits/theme-s6H-061-083-progress-20261015.json",{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:95,
 artworkReviewed:83,verifiedKoreanPrintImages:83,
 ownCdnImagesDecoded:95,foreignPrintedImagesHeld:12,
 reviewedRanges:["001-030","031-060","061-083"],
 reviewedThisBatch:23,newlyAddedThemeSlots:32,
 totalNewlyAddedThemeSlots:meta.newlyAddedThemeSlotCount,
 themeCounts:counts,pendingKoreanPrints:foreignCodes,
 all12ThemesInspectedForVerifiedKoreanPrints:true,
 status:"in_progress",complete:false,nextStart:NEXT,globalCheckpointPreserved:GLOBAL,
 manualReview:ART,ownedImageProof:PROOF,
 note:"23 official Korean card illustrations classified. The 12 Japanese photo placeholders are deliberately excluded from completed Korean artwork review."
 })]);
console.log(JSON.stringify({set:CODE,reviewedArtworks:83,total:95,added:32,counts,
 KoreanPrintedImagesVerified:83,foreignImageHolds:12,next:NEXT,globalCheckpoint:GLOBAL}));
