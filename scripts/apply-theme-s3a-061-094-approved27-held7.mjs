import {readFile,writeFile} from "node:fs/promises";
const j=async f=>JSON.parse(await readFile(f,"utf8"));
const save=async(f,o)=>writeFile(f,JSON.stringify(o,null,2)+"\n","utf8");
const CODE="s3a",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const REVIEW="data/audits/theme-s3a-061-094-partial-Korean-art-review-20261017.json";
const GATE="data/audits/theme-s3a-061-094-korean-print-gate-20261017.json";
const PROGRESS="data/audits/theme-s3a-061-094-partial-progress-20261017.json";
const PREVIOUS="data/audits/theme-s3a-031-060-progress-20261017.json";
const NEXT="S3a 한국판 이미지 대체 필요 086-089 및 092-094 (7장)";
const [review,gate,p1,p2,previous,modern,legacy,themes,state,hosting,coverage]=await Promise.all([
 j(REVIEW),j(GATE),j("data/audits/theme-visual-evidence/s3a/061-090/visual-index.json"),
 j("data/audits/theme-visual-evidence/s3a/091-094/visual-index.json"),j(PREVIOUS),
 j("data/series.json"),j("data/series-legacy.json"),j("data/art-themes.json"),
 j("data/audits/theme-series-review-status.json"),j("data/audits/theme-image-selfhost-audit.json"),
 j("data/audits/theme-series-coverage.json")
]);
const sourceSet=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(sourceSet.length!==1||sourceSet[0].cards?.length!==94)throw Error("S3a master canonical set changed");
const set=sourceSet[0],masterKeys=JSON.stringify(set.cards.map(c=>c.code));
const statKey=Object.keys(state.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!statKey)throw Error("S3a first 60 review checkpoint missing");
const meta=state.reviews[statKey];
if(meta.artworkReviewedCardCount===87&&meta.newlyAddedThemeSlotCount===128&&meta.reviewedRanges?.includes("090-091")){
 console.log("S3a Korean 27 approved / 7 Japanese image holds already applied; safe no-op");
 process.exit(0);
}
if(state.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="in_progress"||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==60||meta.reviewedCardCount!==60||
 meta.verifiedKoreanPrintImageCount!==60||meta.verifiedSelfHostedImageCount!==60||
 meta.newlyAddedThemeSlotCount!==96||meta.preservedExistingThemeSlotCount!==1||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 previous.totalMasterCards!==94||previous.KoreanPrintArtworksReviewed!==60||
 previous.newlyAddedThemeSlotsCumulative!==96||previous.globalCheckpointPreserved!==GLOBAL)
 throw Error("Prior 60 Korean prints or global held source checkpoint changed");
const held=[86,87,88,89,92,93,94],approved=[...Array.from({length:25},(_,i)=>61+i),90,91];
const data=[...(p1.cards||[]),...(p2.cards||[])];
if(gate.masterCanonicalCount!==94||gate.ownedArchiveImagesDecoded!==34||
 gate.confirmedKoreanPrintedCount!==27||gate.notKoreanPrintCount!==7||
 JSON.stringify(gate.heldNumbers)!==JSON.stringify(held)||
 JSON.stringify(gate.approvedKoreanNumbers)!==JSON.stringify(approved)||
 gate.held?.length!==7||data.length!==34||gate.globalCheckpointPreserved!==GLOBAL||
 data.some(c=>c.imageCheck?.status!=="decoded_region_unverified")||
 held.some(n=>!gate.held.some(x=>x.canonicalOrder===n)))
 throw Error("Japanese 7-image hold or owned CDN preflight not established");
if(review.status!=="manual_Korean_art_12_theme_partial_27_with_7_Japanese_image_holds"||
 review.set!==CODE||review.approvedKoreanCardCount!==27||
 review.ownedCDNDecodedCandidateCount!==34||review.heldJapanesePrintedCount!==7||
 review.koreanPrintGate!==GATE||review.items?.length!==27||
 review.themeAdditions!==32||review.existingThemesInApprovedCards!==0||
 !review.all12ThemesInspectedForApprovedKoreanCards||!review.noMasterOrOwnershipChanges||
 JSON.stringify(review.heldNumbers)!==JSON.stringify(held)||
 JSON.stringify(review.approvedKoreanNumbers)!==JSON.stringify(approved)||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalCheckpointPreserved!==GLOBAL)
 throw Error("S3a 27-Korean review / 7-Japanese hold evidence incomplete");
const groups=new Map(themes.groups.map(x=>[x.code,x]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("12 artwork themes changed");
const original=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||/^s3a_/i.test(String(c.code||""))));
const originalSnapshots=original.map(x=>JSON.stringify(x));
if(original.length!==97||
 groups.get("sleeping").cards.filter(x=>String(x.code||"").toUpperCase().split("/")[0]==="S3A_028").length!==1||
 original.some(x=>approved.includes(Number(String(x.code||"").split("_").pop().split("/")[0]))))
 throw Error("Earlier approved S3a thematic records changed or next range already partially indexed");
const add=[],counts={};
for(let i=0;i<approved.length;i++){
 const n=approved[i],p=data.find(c=>c.canonicalOrder===n),r=review.items[i],card=set.cards[n-1];
 const num=String(n).padStart(3,"0"),id="S3a_"+num;
 if(!p||!r||!card||r.canonicalOrder!==n||r.name!==card.name||p.name!==card.name||
 r.cardKey.toUpperCase()!==id.toUpperCase()||
 String(card.code||"").toLowerCase()!=="s3a_"+num+"/076"||
 String(p.code||"").toLowerCase()!=="s3a_"+num+"/076"||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.preExistingThemeRecordsPreserved?.length!==0||p.preExistingThemeMemberships?.length!==0||
 p.sourceHost!==r.sourceHost||
 !["cards.image.pokemonkorea.co.kr","static.tcgexchange.kr"].includes(p.sourceHost)||
 r.sourceEvidence!==(p.sourceAppearsPokemonKoreaOfficial?
 "pokemonkorea-catalogue-url-and-dcb-owned-decoded-image":"retail-korean-printed-photo-and-dcb-owned-decoded-image")||
 !p.ownedUrl?.startsWith("https://dcb-card-images-")||
 p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
 !/^[0-9a-f]{64}$/.test(p.imageCheck?.sha256||"")||
 !["C","U","SR","HR"].includes(r.rarity))
 throw Error("S3a verified Korean printed identity differs "+num);
 const selected=new Set(r.matchedThemes||[]);
 if(selected.size!==r.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid artwork theme at "+num);
 for(const theme of selected){
  const g=groups.get(theme);
  if(g.cards.some(c=>String(c.code||"").toUpperCase().split("/")[0]===id.toUpperCase()))
   throw Error("Duplicate theme classification "+id+"/"+theme);
  g.cards.push({code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"전설의 고동",cardNumber:num+"/076",
   rarity:card.rarity||r.rarity,category:r.categories[theme],image:p.ownedUrl,
   evidence:"한국어 인쇄 S3a "+num+"/076와 DCB 자체 보관 WebP 시각 검수. "+
     r.artObservation+" ("+REVIEW+"). 이미지 원출처 "+p.sourceHost});
  add.push({n,theme});counts[theme]=(counts[theme]||0)+1;
 }
}
if(add.length!==32||THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==masterKeys||
 original.some((x,i)=>JSON.stringify(x)!==originalSnapshots[i]))
 throw Error("Approved 27 Korean slots do not match 12-theme additions or preserve existing data");
meta.artworkReviewedCardCount=87;meta.reviewedCardCount=87;
meta.verifiedKoreanPrintImageCount=87;meta.verifiedSelfHostedImageCount=87;
meta.reviewedRanges=["001-030","031-060","061-085","090-091"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=128;meta.preservedExistingThemeSlotCount=1;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=GATE;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.heldCards=held.map(n=>"S3a_"+String(n).padStart(3,"0"));
meta.note="S3a 94장 중 실제 한국어 인쇄 이미지 87장을 12테마 검수(기존 60+추가 27), 신규 테마 수록 128건 및 기존 S3A_028 보존. 나머지 7장(086-089, 092-094)은 현재 자체 CDN에도 일본어 카드가 저장되어 한국판 검수 보류. 한국판 이미지 구하기 전까지 complete 금지.";
state.updatedAt=DATE;themes.updatedAt=DATE;
if(state.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)throw Error("S6K global held sources lost");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",state),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:94,
  KoreanPrintArtworksReviewed:87,sourceImagesSelfHostedDecoded:94,
  verifiedKoreanOwnedImageCount:87,heldJapaneseImageCount:7,
  newlyAddedThemeSlotsThisBatch:32,newlyAddedThemeSlotsCumulative:128,
  existingThemeSlotsPreserved:1,
  reviewedRanges:["001-030","031-060","061-085","090-091"],
  status:"in_progress",complete:false,nextStart:NEXT,
  heldNumbers:held,globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  koreanPrintGate:GATE,remainingImageAndArtworkCount:7})
]);
console.log(JSON.stringify({set:CODE,koreanApproved:87,total:94,heldJapanese:held,
 newThemeSlotsThisBatch:32,cumulativeNewThemeSlots:128,masterKeysAndOwnershipUnchanged:true}));
