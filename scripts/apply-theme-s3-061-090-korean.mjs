import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s3",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s3-061-090-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s3/061-090/visual-index.json";
const PREVIOUS="data/audits/theme-s3-031-060-progress-20261017.json";
const PROGRESS="data/audits/theme-s3-061-090-progress-20261017.json";
const NEXT="S3 한국판 091-119 카드 12테마 이미지 시각검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];

const [review,proof,previous,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),
 read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json")
]);
const sets=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(sets.length!==1||sets[0].cards?.length!==119)throw Error("Canonical S3 119-card set changed");
const set=sets[0],masterCodes=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(!key)throw Error("S3 previous checkpoint not found");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===90&&meta.newlyAddedThemeSlotCount===136&&
 meta.reviewedRanges?.includes("061-090")){
 console.log("S3 061-090 approved themes already applied; safe no-op");process.exit(0);
}
if(meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==60||meta.reviewedCardCount!==60||
 meta.newlyAddedThemeSlotCount!==92||meta.preservedExistingThemeSlotCount!==1||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 previous.totalMasterCards!==119||previous.KoreanPrintArtworksReviewed!==60||
 previous.newlyAddedThemeSlotsCumulative!==92||previous.existingThemeSlotsPreserved!==1||
 previous.globalCheckpointPreserved!==GLOBAL||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="in_progress")
 throw Error("S3 earlier 60 artwork checkpoint / global held evidence changed");
if(review.schemaVersion!==1||review.set!==CODE||review.range!=="061-090"||
 review.status!=="manual_Korean_art_12_theme_reviewed"||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.officialSourceCardsInRange!==30||review.existingThemesInThisRange!==1||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.noMasterOrOwnershipChanges||!review.all12ThemesInspected||review.themeAdditions!==44||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||review.items?.length!==30||
 proof.set!==CODE||proof.range!=="061-090"||proof.masterCanonicalCards!==119||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==1||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Insufficient S3 061-090 Korean print visual evidence");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))
 throw Error("12-theme taxonomy changed");
const old=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const oldProof=old.map(x=>JSON.stringify(x));
if(old.length!==93)throw Error("Existing S3 92+1 prior theme records changed");
const oldInRange=themes.groups.flatMap(g=>g.cards.filter(c=>{
 const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);
 return String(c.set||"").toLowerCase()===CODE&&n>=61&&n<=90;
}).map(c=>({theme:g.code,code:String(c.code||"").toUpperCase().split("/")[0]})));
if(oldInRange.length!==1||oldInRange[0].theme!=="reflections"||oldInRange[0].code!=="S3_079"||
 groups.get("reflections").cards.filter(c=>String(c.code||"").toUpperCase().split("/")[0]==="S3_079").length!==1)
 throw Error("Existing S3_079 reflection must be preserved exactly once");

const additions=[],counts=Object.fromEntries(THEMES.map(t=>[t,0]));
for(let i=0;i<30;i++){
 const n=i+61,num=String(n).padStart(3,"0"),id="S3_"+num,card=set.cards[n-1],
       p=proof.cards[i],r=review.items[i];
 if(!card||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s3_"+num+"/100"||
 String(p.code||"").toLowerCase()!=="s3_"+num+"/100"||
 String(r.cardKey||"").toUpperCase()!==id||p.name!==card.name||
 r.koreanPrintImageVerified!==true||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S3/S3_"+num+".png"||
 p.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S3/S3_"+num+".webp"||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[a-f0-9]{64}$/.test(p.imageCheck?.sha256||"")||
 JSON.stringify(p.preExistingThemeMemberships||[])!==JSON.stringify(n===79?["reflections"]:[])||
 JSON.stringify(r.preExistingThemeRecordsPreserved||[])!==JSON.stringify(n===79?["reflections"]:[]))
 throw Error("S3 061-090 Korean print, selfhosted image or reflection baseline invalid: "+num);
 const matches=new Set(r.matchedThemes||[]);
 if(matches.size!==r.matchedThemes?.length||!matches.has("color")||
 [...matches].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!matches.has(t))||
 (n===79&&matches.has("reflections")))
 throw Error("S3 unsupported manual classification "+num);
 for(const t of matches){
  const g=groups.get(t);
  if(g.cards.some(c=>String(c.code||"").toUpperCase().split("/")[0]===id))
   throw Error("S3 duplicate theme "+id+"/"+t);
  g.cards.push({code:id,name:card.name,series:"S",set:set.code,
    setName:set.displayName||"무한존",cardNumber:num+"/100",
    rarity:card.rarity||"",category:r.categories[t],image:p.ownedUrl,
    evidence:"한국어 인쇄 S3 "+num+"/100 포켓몬코리아 등록카드와 DCB 자체보관 WebP 시각검수. "+
      r.artObservation+" ("+REVIEW+"). 원본 master의 공란 레어도는 임의로 보완하지 않음."});
  additions.push({id,theme:t});counts[t]++;
 }
}
if(additions.length!==44||THEMES.some(t=>counts[t]!==review.themeCounts?.[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==masterCodes||
 old.some((x,i)=>JSON.stringify(x)!==oldProof[i]))
 throw Error("S3 061-090 theme totals, canonical IDs or old themes modified");
meta.artworkReviewedCardCount=90;meta.reviewedCardCount=90;
meta.verifiedKoreanPrintImageCount=90;meta.verifiedSelfHostedImageCount=90;
meta.reviewedRanges=["001-030","031-060","061-090"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=136;meta.preservedExistingThemeSlotCount=1;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.note="S3 119장 중 001-090 한국판 자체보관 이미지 90장 12개 독립 테마 육안 검수. 이번 44건·누적 136건 신규 테마, S3_079 반사 기존 1건 보존. 091-119 검수 전 완료 처리 금지. 마스터 코드·보유 키 불변.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("S6K global source hold changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:119,
  KoreanPrintArtworksReviewed:90,sourceImagesSelfHostedDecoded:90,
  newlyAddedThemeSlotsThisBatch:44,newlyAddedThemeSlotsCumulative:136,
  existingThemeSlotsPreserved:1,reviewedRanges:["001-030","031-060","061-090"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:29})
]);
console.log(JSON.stringify({set:CODE,reviewed:90,total:119,addedThemeSlots:44,
 cumulativeAddedThemeSlots:136,preservedS3_079Reflection:true,masterAndOwnershipUnchanged:true}));
