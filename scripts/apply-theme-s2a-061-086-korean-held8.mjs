import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async (p,obj)=>writeFile(p,JSON.stringify(obj,null,2)+"\n","utf8");
const SET="s2a", DATE="2026-10-17", GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s2a-061-086-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s2a/061-086/visual-index.json";
const PREVIOUS="data/audits/theme-s2a-031-060-progress-20261017.json";
const PROGRESS="data/audits/theme-s2a-061-086-approved18-held8-progress-20261017.json";
const NEXT="S2a 한국판 079-086 실제 인쇄 이미지 확보 전 보류 (일본어 원본 8건)";
const THEMES=["sleeping","connected","evolution","night","season","color",
"sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage,s2held,s3held]=
await Promise.all([
read(REVIEW),read(PROOF),read(PREVIOUS),
read("data/series.json"),read("data/series-legacy.json"),
read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
read("data/audits/theme-image-selfhost-audit.json"),
read("data/audits/theme-series-coverage.json"),
read("data/audits/theme-s2-091-115-approved16-held9-progress-20261017.json"),
read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const sets=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===SET);
if(sets.length!==1||sets[0].cards?.length!==86)throw Error("Unexpected S2a canonical set");
const set=sets[0],masterBefore=JSON.stringify(set.cards);
const meta=status.reviews?.[SET];
if(!meta)throw Error("Previous S2a review metadata missing");
if(meta.artworkReviewedCardCount===78&&meta.newlyAddedThemeSlotCount===114&&
meta.heldNonKoreanSourceCount===8&&meta.reviewedRanges?.includes("061-078")){
console.log("S2a Korean 061-078 and JP held 079-086 already handled; no-op");
process.exit(0);
}
if(meta.artworkReviewedCardCount!==60||meta.reviewedCardCount!==60||
meta.newlyAddedThemeSlotCount!==92||meta.preservedExistingThemeSlotCount!==3||
JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
meta.status!=="in_progress"||meta.complete!==false||
previous.KoreanPrintArtworksReviewed!==60||previous.newlyAddedThemeSlotsCumulative!==92||
previous.remainingImageAndArtworkCount!==26||
previous.globalCheckpointPreserved!==GLOBAL||
coverage.sets.find(x=>String(x.code||"").toLowerCase()===SET)?.status!=="in_progress"||
status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
s2held.KoreanPrintArtworksReviewed!==106||s2held.heldNonKoreanSourceCount!==9||
s3held.KoreanPrintArtworksReviewed!==110||s3held.heldNonKoreanSourceCount!==9)
throw Error("Earlier S2a/S2/S3 checkpoint or global S6K source hold changed");

if(review.schemaVersion!==1||review.set!==SET||review.range!=="061-086"||
review.status!=="partial_Korean_18_held_Japanese_8"||
!review.all12ThemesInspectedForApproved||
JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
review.canonicalCardsInRange!==26||review.artworksReviewed!==18||
review.verifiedKoreanPrintImagesInRange!==18||
review.ownedCDNImagesDecoded!==26||review.officialSourceCardsInRange!==18||
review.heldNonKoreanSourceCount!==8||review.existingThemesInThisRange!==0||
review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
!review.noMasterOrOwnershipChanges||review.globalCheckpointPreserved!==GLOBAL||
review.imagePreflight!==PROOF||review.themeAdditions!==22||
review.items?.length!==18||review.held?.length!==8||
proof.set!==SET||proof.range!=="061-086"||proof.masterCanonicalCards!==86||
proof.checkedCardCount!==26||proof.ownedImageDecodedCount!==26||
proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
proof.sourceHostCounts?.["cards.image.pokemonkorea.co.kr"]!==18||
proof.sourceHostCounts?.["static.tcgexchange.kr"]!==8||
proof.cards?.length!==26||proof.globalCheckpointPreserved!==GLOBAL)
throw Error("S2a partial Korean approval/Japanese hold evidence invalid");

const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("Theme group registry changed");
const old=themes.groups.flatMap(g=>g.cards.filter(c=>
String(c.set||"").toLowerCase()===SET||
String(c.code||"").toLowerCase().startsWith(SET+"_")));
const oldSnapshots=old.map(c=>JSON.stringify(c));
if(old.length!==95||old.some(c=>{
 const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);
 return n>=61&&n<=86;
}))throw Error("Unexpected S2a preexisting membership in final range");
const tally=Object.fromEntries(THEMES.map(t=>[t,0]));
let added=0;
for(let i=0;i<18;i++){
 const n=i+61,num=String(n).padStart(3,"0"),key="S2a_"+num;
 const c=set.cards[n-1],p=proof.cards[i],r=review.items[i];
 const expectedSource="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S2a/S2a_"+num+".png";
 const expectedOwn="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S2a/S2a_"+num+".webp";
 if(!c||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(c.code||"").toLowerCase()!=="s2a_"+num+"/070"||
 String(p.code||"").toLowerCase()!=="s2a_"+num+"/070"||
 p.name!==c.name||r.cardKey!==key||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||
 p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!==expectedSource||p.ownedUrl!==expectedOwn||
 p.imageCheck?.status!=="decoded_region_unverified"||
 p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
 p.imageCheck?.dimensions?.[0]!==420||p.imageCheck?.dimensions?.[1]!==586||
 !/^[a-f0-9]{64}$/.test(p.imageCheck?.sha256||"")||
 p.preExistingThemeMemberships?.length!==0||
 r.preExistingThemeRecordsPreserved?.length!==0)
 throw Error("Korean card print source/owned archive mismatch "+key);
 const matches=r.matchedThemes||[];
 if(matches.length!==new Set(matches).size||!matches.includes("color")||
 matches.some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).length!==matches.length)
 throw Error("Unreconciled theme category "+key);
 for(const t of matches){
  const g=groups.get(t);
  if(g.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===key.toUpperCase()))
   throw Error("Duplicate S2a theme "+key+"/"+t);
  g.cards.push({code:key,name:c.name,series:"S",set:set.code,
   setName:set.displayName||"폭염워커",cardNumber:num+"/070",
   rarity:c.rarity||"",category:r.categories[t],image:p.ownedUrl,
   evidence:"포켓몬코리아 S2a 한국어 인쇄 "+num+"/070 및 DCB 자체 보관 WebP 육안 확인. "+
    r.artObservation+" ("+REVIEW+")."});
  added++;tally[t]++;
 }
}
if(added!==22||THEMES.some(t=>tally[t]!==review.themeCounts?.[t]))
 throw Error("S2a 18-card thematic count drift");
for(let i=0;i<8;i++){
 const n=i+79,num=String(n).padStart(3,"0"),key="S2a_"+num;
 const c=set.cards[n-1],p=proof.cards[i+18],h=review.held[i];
 if(!c||!p||!h||p.canonicalOrder!==n||h.canonicalOrder!==n||
 String(c.code||"").toLowerCase()!=="s2a_"+num+"/070"||
 p.name!==c.name||h.name!==c.name||h.cardKey!==key||
 p.sourceHost!=="static.tcgexchange.kr"||p.sourceAppearsPokemonKoreaOfficial||
 !p.ownedUrl.startsWith("https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/")||
 h.sourceHost!==p.sourceHost||h.ownedUrl!==p.ownedUrl||
 h.printedLanguage!=="Japanese"||h.koreanPrintImageVerified!==false||
 h.artworkThemesReviewed!==false||!h.holdReason?.trim()||
 p.imageCheck?.status!=="decoded_region_unverified"||
 p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
 p.preExistingThemeMemberships?.length!==0)
 throw Error("S2a held Japanese source incorrectly approved "+key);
}
// All 8 JP sources intentionally retain their existing master images and remain out of new themes.
if(JSON.stringify(set.cards)!==masterBefore||
old.some((x,i)=>JSON.stringify(x)!==oldSnapshots[i]))
 throw Error("Protected canonical set or previous themes modified");
meta.artworkReviewedCardCount=78;meta.reviewedCardCount=78;
meta.verifiedKoreanPrintImageCount=78;meta.verifiedSelfHostedImageCount=78;
meta.reviewedRanges=["001-030","031-060","061-078"];
meta.reviewedThemes=THEMES;meta.newlyAddedThemeSlotCount=114;
meta.preservedExistingThemeSlotCount=3;meta.heldNonKoreanSourceCount=8;
meta.heldRange="079-086";meta.partialReviewEvidence=REVIEW;
meta.imagePreflightEvidence=PROOF;meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="S2a 폭염워커 한글 인쇄 78/86장 12테마 검수. 신규 테마 누적 114건과 기존 3건 유지. 079-086은 이미지가 자체 저장소에 있어도 일본어 인쇄 8건이므로 한국판 확보 전 제외. 모든 원본 카드/보유 정보 및 S2/S3/S6K 이미지 보류 유지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global S6K artwork archive holds unexpectedly altered");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:SET,totalMasterCards:86,
  KoreanPrintArtworksReviewed:78,verifiedKoreanPrintImagesCumulative:78,
  ownedImageCandidatesDecodedInLastRange:26,verifiedKoreanImagesLastRange:18,
  heldJapanesePrintImages:8,heldRange:"079-086",
  newlyAddedThemeSlotsThisBatch:22,newlyAddedThemeSlotsCumulative:114,
  existingThemeSlotsPreserved:3,
  reviewedRanges:["001-030","031-060","061-078"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:8})
]);
console.log(JSON.stringify({set:SET,koreanReviewed:78,total:86,japaneseHeld:8,
 newThemeSlots:22,cumulativeNewThemeSlots:114,originalThemeSlotsPreserved:3,
 canonicalCardsAndOwnershipUnchanged:true}));
