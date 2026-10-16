import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n","utf8");
const CODE="s5r",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const ART="data/audits/theme-s5r-031-060-Korean-art-review-20261016.json";
const PREFLIGHT="data/audits/theme-visual-evidence/s5r/031-060/visual-index.json";
const PREVIOUS="data/audits/theme-s5r-001-030-progress-20261016.json";
const PROGRESS="data/audits/theme-s5r-031-060-progress-20261016.json";
const NEXT="s5r Korean final 061-091 visual and print provenance review";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage,prev]=await Promise.all([
 read(ART),read(PREFLIGHT),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),read(PREVIOUS)
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(matches.length!==1||matches[0].cards?.length!==91)throw Error("Canonical S5R 91-slot database altered");
const set=matches[0],originalIds=JSON.stringify(set.cards.map(c=>c.code));
const reviewKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!reviewKey)throw Error("Missing S5R 001-030 applied checkpoint");
const meta=status.reviews[reviewKey];
if(meta.artworkReviewedCardCount===60&&meta.reviewedRanges?.includes("031-060")){
 console.log("S5R 031-060 already applied; safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.reviewedCardCount!==30||meta.artworkReviewedCardCount!==30||
 meta.verifiedKoreanPrintImageCount!==30||meta.verifiedSelfHostedImageCount!==30||
 meta.newlyAddedThemeSlotCount!==47||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030"])||
 prev.KoreanPrintArtworksReviewed!==30||prev.themeSlotsAdded!==47||
 prev.globalCheckpointPreserved!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="in_progress")
 throw Error("S5R first 30 or S6K global held checkpoint changed");
if(review.set!==CODE||review.range!=="031-060"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 !review.noMasterOrOwnershipChanges||review.themeAdditions!==44||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 JSON.stringify(review.preexistingKept)!=="[]"||review.items?.length!==30||
 review.globalHoldUnchanged!==GLOBAL||
 proof.set!==CODE||proof.range!=="031-060"||proof.checkedCardCount!==30||
 proof.ownedImageDecodedCount!==30||proof.ownedImageMissingCount!==0||
 proof.preExistingThemeMemberships!==0||proof.cards?.length!==30||
 proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S5R Korean 031-060 proof or 12-theme review not complete");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing theme "+t);
const before=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
if(before.length!==48||!groups.get("season").cards.some(c=>
 String(c.code||"").toUpperCase()==="S5R_006"&&c.name==="체리꼬"))
 throw Error("Existing S5R 48 themes or original Cherry blossom artwork changed");
const priorSnapshots=before.map(c=>JSON.stringify(c));
const added=[],counts={};
for(let i=0;i<30;i++){
 const n=i+31,num=String(n).padStart(3,"0"),key="S5R_"+num,code="s5r_"+num+"/070";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[n-1];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==key||row.name!==card.name||pre.name!==card.name||
 String(card.code||"").toLowerCase()!==code||String(pre.code||"").toLowerCase()!==code||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 pre.imageCheck?.status!=="decoded_region_unverified"||pre.imageCheck?.http!==200||
 pre.imageCheck?.format!=="WEBP"||
 !pre.sourceUrl?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5/")||
 !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S5/"))
 throw Error("Official Korean S5R print / owned CDN proof mismatch "+num);
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid Korean artwork classification "+num);
 if(themes.groups.some(g=>g.cards.some(c=>String(c.code||"").toUpperCase()===key||
 (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/070"))))
 throw Error("Would overwrite existing S5R 031-060 card "+num);
 for(const t of selected){
  groups.get(t).cards.push({
   code:key,name:card.name,series:"S",set:set.code,setName:set.displayName||"연격마스터",
   cardNumber:num+"/070",rarity:card.rarity||"",category:row.categories[t],image:pre.ownedUrl,
   evidence:"S5R 한국어 인쇄 12테마 이미지 검수: "+row.artObservation+" ("+ART+")"
  });
  counts[t]=(counts[t]||0)+1;added.push({number:n,theme:t});
 }
}
if(added.length!==44||THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==originalIds||
 before.some((c,i)=>JSON.stringify(c)!==priorSnapshots[i])||
 before.some(c=>!themes.groups.some(g=>g.cards.includes(c))))
 throw Error("S5R reviewed theme counts or old IDs changed");
meta.artworkReviewedCardCount=60;meta.reviewedCardCount=60;
meta.verifiedKoreanPrintImageCount=60;meta.verifiedSelfHostedImageCount=60;
meta.reviewedRanges=["001-030","031-060"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=91;meta.partialReviewEvidence=ART;
meta.imagePreflightEvidence=PREFLIGHT;meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="S5R 연격마스터 한국어판 001~060 공식 삽화 12개 테마 검수, 신규 91개 테마 멤버십 누적. S5R_006 기존 시즌 카드·91개 마스터 카드 키 보존. 061~091 검증 전까지 완료 처리 금지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("S6K global four Korean print holds altered");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:91,
 KoreanPrintArtworksReviewed:60,sourceImagesSelfHostedDecoded:60,
 themeSlotsAddedThisBatch:44,totalNewThemeSlots:91,existingPreserved:["S5R_006:season"],
 reviewedRanges:["001-030","031-060"],status:"in_progress",complete:false,
 nextStart:NEXT,globalCheckpointPreserved:GLOBAL,
 manualReview:ART,ownedImagePreflight:PREFLIGHT
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:60,total:91,addedThisBatch:44,
 newThemeSlotsCumulative:91,originalS5R006Preserved:true,cardIDsUnchanged:true}));
