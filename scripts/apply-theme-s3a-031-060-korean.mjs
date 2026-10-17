import { readFile, writeFile } from "node:fs/promises";
const load=async f=>JSON.parse(await readFile(f,"utf8"));
const save=async(f,x)=>writeFile(f,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s3a", DATE="2026-10-17", GLOBAL="s6K Korean print source pending: 089,090,092,094";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const REVIEW="data/audits/theme-s3a-031-060-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s3a/031-060/visual-index.json";
const PREVIOUS="data/audits/theme-s3a-001-030-progress-20261017.json";
const PROGRESS="data/audits/theme-s3a-031-060-progress-20261017.json";
const NAME_EVIDENCE="data/audits/theme-s3a-042-printed-name-correction-20261017.json";
const NEXT="s3a Korean 061-090 printed artwork source and 12-theme visual review";
const [review,proof,previous,nameAudit,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 load(REVIEW),load(PROOF),load(PREVIOUS),load(NAME_EVIDENCE),load("data/series.json"),
 load("data/series-legacy.json"),load("data/art-themes.json"),
 load("data/audits/theme-series-review-status.json"),load("data/audits/theme-image-selfhost-audit.json"),
 load("data/audits/theme-series-coverage.json")
]);
const sources=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(sources.length!==1||sources[0].cards?.length!==94)throw Error("S3a 94-slot canonical set changed");
const set=sources[0],originalKeys=JSON.stringify(set.cards.map(x=>x.code));
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(!key)throw Error("S3a previous 001-030 checkpoint missing");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===60&&meta.reviewedRanges?.includes("031-060")&&
 meta.newlyAddedThemeSlotCount===96) {
 console.log("S3a second 30 audit already applied; safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="in_progress"||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==30||meta.reviewedCardCount!==30||
 meta.newlyAddedThemeSlotCount!==50||meta.preservedExistingThemeSlotCount!==1||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030"])||
 previous.totalMasterCards!==94||previous.KoreanPrintArtworksReviewed!==30||
 previous.newlyAddedThemeSlotsThisBatch!==50||
 previous.existingThemeSlotsPreserved!==1||previous.globalCheckpointPreserved!==GLOBAL)
 throw Error("S3a first30 or global S6K hold no longer matches approved baseline");
if(review.status!=="manual_Korean_art_12_theme_reviewed"||review.set!==CODE||
 review.range!=="031-060"||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.existingThemesInThisRange!==0||review.themeAdditions!==46||
 !review.all12ThemesInspected||!review.noMasterOrOwnershipChanges||
 review.items?.length!==30||review.canonicalDisplayNameBlockers?.length!==0||
 review.nameCorrectionEvidence!==NAME_EVIDENCE||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.range!=="031-060"||proof.masterCanonicalCards!==94||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S3a 031-060 manual review or selfhosted artwork proof failed");
if(nameAudit.status!=="corrected"||nameAudit.canonicalCode!=="s3a_042/076"||
 nameAudit.correctKoreanPrintedName!=="석탄산 V"||set.cards[41]?.name!=="석탄산 V")
 throw Error("Korean printed S3a_042 display name must be fixed first");
const groups=new Map(themes.groups.map(x=>[x.code,x]));
if(groups.size!==12||THEMES.some(x=>!groups.has(x)))throw Error("12 theme groups changed");
const orig=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const origJson=orig.map(x=>JSON.stringify(x));
if(orig.length!==51||
 groups.get("sleeping").cards.filter(c=>String(c.code||"").toUpperCase().split("/")[0]==="S3A_028").length!==1)
 throw Error("Preexisting S3a 51 theme records incl. Dedenne sleeping changed");
if(orig.some(x=>/^s3a_0(?:3[1-9]|[4-5][0-9]|60)$/i.test(String(x.code||"").split("/")[0])))
 throw Error("S3a 031-060 contains unexpected existing theme records");
const newEntries=[],counts={};
for(let i=0;i<30;i++){
 const n=31+i,num=String(n).padStart(3,"0"),id="S3a_"+num;
 const row=review.items[i],p=proof.cards[i],card=set.cards[n-1];
 if(!row||!p||!card||row.canonicalOrder!==n||p.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==id.toUpperCase()||
 row.name!==card.name||(n===42?(p.name!=="석탄산"||card.name!=="석탄산 V"):p.name!==card.name)||
 String(card.code||"").toLowerCase()!==("s3a_"+num+"/076")||
 String(p.code||"").toLowerCase()!==("s3a_"+num+"/076")||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 row.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S3a/S3a_"+num+".png"||
 p.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S3a/S3a_"+num+".webp"||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||
 !/^[0-9a-f]{64}$/.test(p.imageCheck?.sha256||"")||
 !["C","U","R","RR","RRR","A"].includes(row.rarity)||
 row.preExistingThemeRecordsPreserved?.length!==0||p.preExistingThemeMemberships?.length!==0)
 throw Error("S3a Korean print or canonical identity mismatch: "+num);
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid 12-theme manual classification at "+num);
 for(const theme of selected){
   const group=groups.get(theme);
   if(group.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===id.toUpperCase()))
     throw Error("Duplicate existing S3a theme: "+id+"/"+theme);
   group.cards.push({code:id,name:card.name,series:"S",set:set.code,
     setName:set.displayName||"전설의 고동",cardNumber:num+"/076",
     rarity:card.rarity||row.rarity,category:row.categories[theme],
     image:p.ownedUrl,evidence:"포켓몬코리아 한국어 인쇄 S3a "+num+
       "/076 및 DCB 자체 보관 WebP 시각 검수: "+row.artObservation+" ("+REVIEW+")"});
   newEntries.push({n,theme});counts[theme]=(counts[theme]||0)+1;
 }
}
if(newEntries.length!==46||THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(x=>x.code))!==originalKeys||
 orig.some((x,i)=>JSON.stringify(x)!==origJson[i]))
 throw Error("S3a approved theme totals or previously approved slots changed");
meta.artworkReviewedCardCount=60;meta.reviewedCardCount=60;
meta.verifiedKoreanPrintImageCount=60;meta.verifiedSelfHostedImageCount=60;
meta.reviewedRanges=["001-030","031-060"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=96;meta.preservedExistingThemeSlotCount=1;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.note="S3a 94장 중 001-060 한국판 카드 12테마 육안 검수 완료. 031-060 신규 46건, 누적 신규 96건. 기존 S3A_028 잠자는 테마와 모든 보유 키 유지. 042 이름은 인쇄본에 맞게 별도 교정. 나머지 34장 검수 전 complete 금지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)throw Error("S6K global pending sources lost");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:94,
  KoreanPrintArtworksReviewed:60,sourceImagesSelfHostedDecoded:60,
  newlyAddedThemeSlotsThisBatch:46,newlyAddedThemeSlotsCumulative:96,
  existingThemeSlotsPreserved:1,reviewedRanges:["001-030","031-060"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:34})
]);
console.log(JSON.stringify({set:CODE,reviewed:60,total:94,newThemeSlotsThisBatch:46,
 cumulativeNewSlots:96,existingPreserved:true,masterUnchanged:true,globalHoldPreserved:true}));
