import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n","utf8");
const CODE="sm1s",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-sm1s-001-030-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/sm1s/001-030/visual-index.json";
const PROGRESS="data/audits/theme-sm1s-001-030-progress-20261017.json";
const NEXT="SM1S 썬 컬렉션 031-060 한국판 이미지 및 12테마 개별 시각검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage,s1w,s1h,s1a,s2a,s2,s3]=await Promise.all([
 read(REVIEW),read(PROOF),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s1w-061-075-approved8-held7-progress-20261017.json"),
 read("data/audits/theme-s1h-061-075-approved8-held7-progress-20261017.json"),
 read("data/audits/theme-s1a-061-086-approved18-held8-progress-20261017.json"),
 read("data/audits/theme-s2a-061-086-approved18-held8-progress-20261017.json"),
 read("data/audits/theme-s2-091-115-approved16-held9-progress-20261017.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const matched=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(matched.length!==1||matched[0].cards?.length!==73)
 throw Error("Original SM1S Sun Collection 73-card master is not intact");
const set=matched[0],masterBefore=JSON.stringify(set.cards);
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(key&&status.reviews[key].artworkReviewedCardCount===30&&
 status.reviews[key].newlyAddedThemeSlotCount===53&&
 status.reviews[key].reviewedRanges?.includes("001-030")){
 console.log("SM1S 001-030 already applied; safe no-op");process.exit(0);
}
if(key||status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(s=>String(s.code||"").toLowerCase()===CODE)?.status!=="pending"||
 s1w.KoreanPrintArtworksReviewed!==68||s1w.heldJapanesePrintImages!==7||
 s1h.KoreanPrintArtworksReviewed!==68||s1h.heldJapanesePrintImages!==7||
 s1a.KoreanPrintArtworksReviewed!==78||s1a.heldJapanesePrintImages!==8||
 s2a.KoreanPrintArtworksReviewed!==78||s2a.heldJapanesePrintImages!==8||
 s2.KoreanPrintArtworksReviewed!==106||s2.heldNonKoreanSourceCount!==9||
 s3.KoreanPrintArtworksReviewed!==110||s3.heldNonKoreanSourceCount!==9)
 throw Error("SM1S pending baseline or earlier Japanese/S6K source holds changed");

if(review.schemaVersion!==1||review.set!==CODE||review.range!=="001-030"||
 review.status!=="manual_Korean_art_12_theme_reviewed"||
 review.artworksReviewed!==30||review.verifiedKoreanPrintImagesInRange!==30||
 review.ownedCDNImagesDecoded!==30||review.officialSourceCardsInRange!==30||
 review.existingThemesInThisRange!==0||review.themeAdditions!==53||
 !review.preExistingThemesOutsideRangeProtected||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.noMasterOrOwnershipChanges||!review.all12ThemesInspected||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||review.items?.length!==30||
 proof.set!==CODE||proof.range!=="001-030"||proof.masterCanonicalCards!==73||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("SM1S initial Korean artwork provenance/review evidence missing");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("Thematic groups changed");
const old=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const snapshot=old.map(x=>JSON.stringify(x));
if(old.length!==0)
 throw Error("Pre-existing SM1S theme memberships unexpectedly changed");
const addCounts=Object.fromEntries(THEMES.map(t=>[t,0]));
let additions=0;
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),key="SM1S_"+num;
 const card=set.cards[i],p=proof.cards[i],r=review.items[i];
 const expectedOriginal="https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM1S/SM1S_"+num+".png";
 const expectedOwned="https://dcb-card-images-legacy-2026.pages.dev/data/wmimages/SM/SM1S/SM1S_"+num+".webp";
 if(!card||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="sm1s_"+num+"/060"||
 String(p.code||"").toLowerCase()!=="sm1s_"+num+"/060"||
 String(r.cardKey||"").toUpperCase()!==key.toUpperCase()||p.name!==card.name||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!==expectedOriginal||p.ownedUrl!==expectedOwned||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[a-f0-9]{64}$/.test(p.imageCheck?.sha256||"")||
 p.preExistingThemeMemberships?.length!==0||
 r.preExistingThemeRecordsPreserved?.length!==0)
 throw Error("SM1S Korean card provenance mismatch "+key);
 const selected=r.matchedThemes||[];
 if(new Set(selected).size!==selected.length||!selected.includes("color")||
 selected.some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).length!==selected.length)
 throw Error("Invalid SM1S 12-theme classification "+key);
 for(const t of selected){
  const g=groups.get(t);
  if(g.cards.some(c=>String(c.code||"").toUpperCase().split("/")[0]===key.toUpperCase()))
   throw Error("Duplicate theme "+key+"/"+t);
  g.cards.push({code:key,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"썬 컬렉션",cardNumber:num+"/060",rarity:card.rarity||"",
   category:r.categories[t],image:p.ownedUrl,
   evidence:"포켓몬코리아 SM1S 한국어 인쇄 "+num+"/060 및 DCB 자체 보관 WebP 육안 확인. "+
    r.artObservation+" ("+REVIEW+")."});
  addCounts[t]++;additions++;
 }
}
if(additions!==53||THEMES.some(t=>addCounts[t]!==review.themeCounts?.[t])||
 old.some((x,i)=>JSON.stringify(x)!==snapshot[i])||
 JSON.stringify(set.cards)!==masterBefore)
 throw Error("SM1S 53 additions, retained old membership or canonical master drift");
status.reviews[CODE]={
 artworkReviewedCardCount:30,reviewedCardCount:30,
 verifiedKoreanPrintImageCount:30,verifiedSelfHostedImageCount:30,
 reviewedRanges:["001-030"],reviewedThemes:THEMES,newlyAddedThemeSlotCount:53,
 preservedExistingThemeSlotCount:0,partialReviewEvidence:REVIEW,
 imagePreflightEvidence:PROOF,nextStart:NEXT,reviewedAt:DATE,
 status:"in_progress",complete:false,
 note:"SM1S 썬 컬렉션 한국어판 86장 중 001-030 30장 한국어 인쇄 이미지와 12테마 개별 검수. 신규 53건, 기존 SM1S 테마 0건 확인. 43장 검수 전 완료 금지. S2a 일본어 8장·S2/S3 일본어 9장씩·S6K 4건 보류 및 사용자 보유 정보 보존."
};
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global source-checkpoint changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:73,
  KoreanPrintArtworksReviewed:30,sourceImagesSelfHostedDecoded:30,
  newlyAddedThemeSlotsThisBatch:53,newlyAddedThemeSlotsCumulative:53,
  existingThemeSlotsPreserved:0,reviewedRanges:["001-030"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,ownedImagePreflight:PROOF,
  remainingImageAndArtworkCount:43})
]);
console.log(JSON.stringify({set:CODE,reviewed:30,total:73,addedThemeSlots:53,
 preservedExistingThemeSlots:0,masterAndOwnershipUnchanged:true}));
