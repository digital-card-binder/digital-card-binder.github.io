import {readFile,writeFile} from "node:fs/promises";

const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s3",DATE="2026-10-17";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s3-031-060-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s3/031-060/visual-index.json";
const PREVIOUS="data/audits/theme-s3-001-030-progress-20261017.json";
const PROGRESS="data/audits/theme-s3-031-060-progress-20261017.json";
const NEXT="S3 한국판 061-090 카드 12테마 이미지 시각검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];

const [review,proof,previous,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json")
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(matches.length!==1||matches[0].cards?.length!==119)throw Error("Canonical S3 119-card set changed");
const set=matches[0],originalKeys=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(!key)throw Error("Missing S3 001-030 checkpoint");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===60&&meta.newlyAddedThemeSlotCount===92&&
 meta.reviewedRanges?.includes("031-060")){
 console.log("S3 031–060 already audited: safe no-op");process.exit(0);
}
if(meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==30||meta.reviewedCardCount!==30||
 meta.newlyAddedThemeSlotCount!==51||meta.preservedExistingThemeSlotCount!==1||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030"])||
 previous.totalMasterCards!==119||previous.KoreanPrintArtworksReviewed!==30||
 previous.newlyAddedThemeSlotsCumulative!==51||previous.existingThemeSlotsPreserved!==1||
 previous.globalCheckpointPreserved!==GLOBAL||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="in_progress")
 throw Error("First S3 batch baseline or historic global hold changed");

if(review.schemaVersion!==1||review.status!=="manual_Korean_art_12_theme_reviewed"||
 review.set!==CODE||review.range!=="031-060"||
 review.artworksReviewed!==30||review.verifiedKoreanPrintImagesInRange!==30||
 review.ownedCDNImagesDecoded!==30||review.officialSourceCardsInRange!==30||
 review.existingThemesInThisRange!==0||review.themeAdditions!==41||
 !review.all12ThemesInspected||!review.noMasterOrOwnershipChanges||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalCheckpointPreserved!==GLOBAL||review.imagePreflight!==PROOF||
 review.items?.length!==30||proof.set!==CODE||proof.range!=="031-060"||
 proof.masterCanonicalCards!==119||proof.checkedCardCount!==30||
 proof.ownedImageDecodedCount!==30||proof.ownedImageMissingCount!==0||
 proof.preExistingThemeMemberships!==0||proof.cards?.length!==30||
 proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S3 031-060 manual review or first-party image source is insufficient");

const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))
 throw Error("12 independent theme groups changed");
const old=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const originals=old.map(c=>JSON.stringify(c));
if(old.length!==52||groups.get("reflections").cards.filter(c=>
 String(c.code||"").toUpperCase().split("/")[0]==="S3_079").length!==1)
 throw Error("Existing 51+1 S3 artworks or reflection slot unexpectedly changed");
if(old.some(c=>{const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);return n>=31&&n<=60;}))
 throw Error("S3 031-060 contains existing, unaccounted theme entries");

const additions=[],counts=Object.fromEntries(THEMES.map(t=>[t,0]));
for(let i=0;i<30;i++){
 const n=i+31,num=String(n).padStart(3,"0"),id="S3_"+num,card=set.cards[n-1];
 const p=proof.cards[i],r=review.items[i];
 if(!card||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s3_"+num+"/100"||
 String(p.code||"").toLowerCase()!=="s3_"+num+"/100"||
 String(r.cardKey||"").toUpperCase()!==id||
 r.koreanPrintImageVerified!==true||!r.artObservation?.trim()||
 p.name!==card.name||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S3/S3_"+num+".png"||
 p.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S3/S3_"+num+".webp"||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[a-f0-9]{64}$/.test(p.imageCheck?.sha256||"")||
 p.preExistingThemeMemberships?.length!==0||r.preExistingThemeRecordsPreserved?.length!==0)
 throw Error("S3 031-060 Korean print / original card mapping invalid at "+num);
 const selected=new Set(r.matchedThemes||[]);
 if(selected.size!==r.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid theme taxonomy "+num);
 for(const t of selected){
  const g=groups.get(t);
  if(g.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===id))
   throw Error("Duplicate artwork mapping "+id+"/"+t);
  g.cards.push({code:id,name:card.name,series:"S",set:set.code,
    setName:set.displayName||"무한존",cardNumber:num+"/100",
    rarity:card.rarity||"",category:r.categories[t],
    image:p.ownedUrl,
    evidence:"한국어 인쇄 S3 "+num+"/100 포켓몬코리아 등록카드와 DCB 자체보관 이미지 시각검수. "+
      r.artObservation+" ("+REVIEW+"). 원본 master의 레어도 필드가 비어 있어 새 레어도는 임의 보충하지 않음."});
  additions.push({id,theme:t});counts[t]++;
 }
}
if(additions.length!==41||THEMES.some(t=>counts[t]!==review.themeCounts?.[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==originalKeys||
 old.some((x,i)=>JSON.stringify(x)!==originals[i]))
 throw Error("S3 review theme totals or prior artwork entries changed");
meta.artworkReviewedCardCount=60;meta.reviewedCardCount=60;
meta.verifiedKoreanPrintImageCount=60;meta.verifiedSelfHostedImageCount=60;
meta.reviewedRanges=["001-030","031-060"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=92;meta.preservedExistingThemeSlotCount=1;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.note="S3 119장 중 한국판 001-060 총 60장 자체 보관 카드 일러스트를 12테마 기준으로 검수. 이번 배치 41건, 신규 누적 92건; 기존 079번 반사 테마 보존. 061-119번 검수 전 세트 완료 금지. 사용자 보유 키와 canonical 카드 119개는 변경 없음.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Historic S6K image evidence hold unexpectedly moved");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:119,
  KoreanPrintArtworksReviewed:60,sourceImagesSelfHostedDecoded:60,
  newlyAddedThemeSlotsThisBatch:41,newlyAddedThemeSlotsCumulative:92,
  existingThemeSlotsPreserved:1,reviewedRanges:["001-030","031-060"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:59})
]);
console.log(JSON.stringify({set:CODE,reviewed:60,total:119,addedThemeSlots:41,
 cumulativeNewThemeSlots:92,existingReflectionPreserved:true,
 masterCardIdsAndOwnershipUntouched:true,globalHoldPreserved:true}));
