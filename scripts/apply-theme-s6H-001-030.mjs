import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n");
const CODE="s6H",DATE="2026-10-15",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s6H-001-030-Korean-art-review-20261015.json";
const PROOF="data/audits/theme-visual-evidence/s6H/001-030/visual-index.json";
const audit="data/audits/theme-s6H-001-095-Korean-print-review-20261015.json";
const NEXT="s6H canonical 031 artwork theme inspection";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,full,modern,legacy,themes,status,hosting]=await Promise.all([
read(REVIEW),read(PROOF),read(audit),read("data/series.json"),
read("data/series-legacy.json"),read("data/art-themes.json"),
read("data/audits/theme-series-review-status.json"),read("data/audits/theme-image-selfhost-audit.json")
]);
const set=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()==="s6h");
if(set.length!==1||set[0].cards.length!==95)throw Error("Canonical S6H master altered");
const source=set[0],key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()==="s6h")||source.code,prior=status.reviews?.[key]||{};
if(prior.artworkReviewedCardCount===30&&prior.reviewedRanges?.includes("001-030")){
 console.log("S6H 001-030 twelve-theme corrections already applied; safe skip");process.exit(0);
}
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
prior.status!=="in_progress"||prior.imagePreflightComplete!==true||
prior.artworkReviewedCardCount!==0||prior.reviewedCardCount!==0||
prior.verifiedKoreanPrintImageCount!==83||prior.verifiedSelfHostedImageCount!==95||
prior.heldCards?.length!==12||prior.unresolvedImageIssues?.length!==12)
 throw Error("S6K global hold or S6H independent preflight checkpoint moved");
if(review.set!==CODE||review.range!=="001-030"||
review.artworksReviewed!==30||review.verifiedKoreanPrintImagesInRange!==30||
review.all12ThemesInspected!==true||review.sourceImagesRequested!==0||
JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
review.items?.length!==30||proof.set!=="s6h"||proof.canonicalCardsChecked!==30||
proof.verifiedOwnedCdnImageCount!==30||proof.printedNumberMatchCount!==30||
proof.koreanNameNonemptyCount!==30||proof.unavailableOwnedCdnImageCount!==0||
full.visuallyReviewedKoreanPrintCount!==83||full.foreignPrintImagePlaceholderCount!==12)
 throw Error("Independent first 30 Korean art evidence incomplete");
const groupMap=new Map((themes.groups||[]).map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groupMap.get(t)?.cards))throw Error("Missing theme "+t);
const origSetIds=source.cards.map(x=>x.code),changes=[],actualCounts={};
// The evidence snapshot reported S6H memberships, but current main has none.
// Never blindly remove/rewrite based on that stale snapshot. Initialize only explicitly
// reviewed Korean cards, and fail if the live set is partially populated.
const currentSetCards=themes.groups.flatMap(g=>(g.cards||[]).filter(c=>
 String(c.set||"").toLowerCase()==="s6h"||
 /^S6H_[0-9]{3}$/i.test(String(c.code||""))).map(c=>({theme:g.code,code:c.code})));
if(currentSetCards.length!==0)throw Error("S6H expected empty current theme baseline, saw "+JSON.stringify(currentSetCards.slice(0,10)));
for(let i=0;i<30;i++){
 const n=i+1,id=String(n).padStart(3,"0"),key="S6H_"+id,code="s6h_"+id+"/070";
 const row=review.items[i],proofrow=proof.cards[i],card=source.cards[i];
 if(row.canonicalOrder!==n||row.cardKey!==key||row.name!==card.name||
 !row.artObservation?.trim()||proofrow.canonicalOrder!==n||
 proofrow.masterCode.toLowerCase()!==code||card.code.toLowerCase()!==code||
 proofrow.name!==card.name||!proofrow.printedNumberMatches||
 proofrow.expectedPrintedNumber!==id+"/070"||
 proofrow.imageCheck?.status!=="decoded"||proofrow.imageCheck.http!==200||
 proofrow.imageCheck.format!=="WEBP"||
 !proofrow.rawSource.startsWith("https://cards.image.pokemonkorea.co.kr/"))
 throw Error("Unsafe Korean image or canonical identity "+id);
 const selected=new Set(row.matchedThemes);
 if(selected.size!==row.matchedThemes.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid twelve-theme visual review "+id);
 const before=[];
 for(const theme of THEMES){
 const group=groupMap.get(theme);
 const slots=group.cards.filter(c=>String(c.code||"").toUpperCase()===key);
 if(slots.length>1)throw Error("Duplicate independent theme card "+key+" "+theme);
 if(slots.length===1)before.push(theme);
 }
 if(before.length!==0||
 JSON.stringify(row.priorThemes.slice().sort())!==JSON.stringify(proofrow.priorThemes.slice().sort()))
 throw Error("S6H empty current baseline, historical reviewed/proof source inconsistent at "+id);
 if(!proofrow.ownedCdnUrl.startsWith("https://dcb-card-images-modern-2026.pages.dev/")||
 proofrow.name!==card.name)
 throw Error("Missing official Korean-hosted photo at "+id);
 for(const t of THEMES){
 const group=groupMap.get(t),index=group.cards.findIndex(c=>String(c.code||"").toUpperCase()===key);
 if(index>=0&&!selected.has(t)){
  group.cards.splice(index,1);
  changes.push({number:n,theme:t,operation:"remove_wrong_visual_theme"});
 }else if(index<0&&selected.has(t)){
  group.cards.push({code:key,name:card.name,series:"S",set:source.code,
   setName:source.displayName||"백은의 랜스",cardNumber:id+"/070",rarity:card.rarity||"",
   category:row.categories[t],image:proofrow.ownedCdnUrl,
   evidence:"한국판 백은의 랜스 "+id+"/070 실물 12테마 일러스트 검수: "+row.artObservation+" ("+REVIEW+")"});
  changes.push({number:n,theme:t,operation:"add_visually_confirmed_theme"});
 }
 }
 for(const t of selected)actualCounts[t]=(actualCounts[t]||0)+1;
}
if(JSON.stringify(source.cards.map(c=>c.code))!==JSON.stringify(origSetIds))
 throw Error("Canonical or user ownership keys changed");
if(THEMES.some(t=>(actualCounts[t]||0)!==(review.themeCounts?.[t]||0)))
throw Error("Visual theme totals inconsistent");
const actualAdd=changes.filter(c=>c.operation.startsWith("add")).map(c=>c.theme+":"+c.number).sort();
const actualRemove=changes.filter(c=>c.operation.startsWith("remove")).map(c=>c.theme+":"+c.number).sort();
const expectedAdds=review.items.flatMap(row=>row.matchedThemes.map(theme=>theme+":"+row.canonicalOrder)).sort();
if(JSON.stringify(expectedAdds)!==JSON.stringify(actualAdd)||
 actualRemove.length!==0||actualAdd.length!==56||
 new Set(actualAdd).size!==actualAdd.length)
throw Error("Expected 56 manually reviewed new theme memberships on empty current baseline");
prior.artworkReviewedCardCount=30;prior.reviewedCardCount=30;
prior.reviewedRanges=["001-030"];prior.reviewedThemes=THEMES;
prior.partialReviewEvidence=REVIEW;prior.nextStart=NEXT;
prior.newlyAddedThemeSlotCount=(prior.newlyAddedThemeSlotCount||0)+actualAdd.length;
prior.removedIncorrectThemeSlotCount=(prior.removedIncorrectThemeSlotCount||0)+actualRemove.length;
prior.note="백은의 랜스 001~030 12개 테마 일러스트 직접 확인. 검수 시트의 과거 priorThemes 참조와 현행 DB가 달라 현재 빈 S6H 테마 기준으로 분류 56건을 신규 등록; 기존 카드 삭제 없음. 031~095 테마 미검수, 084~095 한국판 이미지 미확보, S6K 이미지 보류 4장은 유지.";
prior.status="in_progress";prior.reviewedAt=DATE;
status.updatedAt=DATE;themes.updatedAt=DATE;
await Promise.all([
save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
save("data/audits/theme-s6H-001-030-progress-20261015.json",{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalCards:95,
 artworkReviewed:30,koreanPrintedImagesVerified:83,foreignPrintedImageHolds:12,
 themeReviewRanges:["001-030"],all12ThemesInspected:true,
 themeAdditions:actualAdd.length,incorrectThemeRemovals:actualRemove.length,
 baselineReconciliation:"Reviewed prior-theme references were stale; live main contained no S6H themes; created 56 from direct Korean artwork review and did not remove old user records.",
 historicalReferenceProposedRemovals:review.themeRemovals,
 modified:changes,nextStart:NEXT,globalCheckpointPreserved:GLOBAL,
 themeReviewProof:REVIEW,imageProof:audit,complete:false})
]);
console.log(JSON.stringify({set:CODE,reviewed:30,themeAdditions:actualAdd.length,incorrectThemeRemovals:actualRemove.length,next:NEXT,globalCheckpoint:GLOBAL}));
