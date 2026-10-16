import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,obj)=>writeFile(p,JSON.stringify(obj,null,2)+"\n","utf8");
const DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const CONFIGS=[
 {code:"s5r",oldMemberships:92,prevAdded:91,newAdded:29,cumulative:120,originalExtraCount:1},
 {code:"s5i",oldMemberships:90,prevAdded:88,newAdded:26,cumulative:114,originalExtraCount:2}
];
const [modern,legacy,themes,status,hosting,coverage,holds]=await Promise.all([
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s5r-s5i-082-091-Japanese-image-holds-20261016.json")
]);
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 holds.globalCheckpointPreserved!==GLOBAL||holds.status!=="pending_Korean_image_provenance")
 throw Error("Critical previous Korean source checkpoint changed");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing theme "+t);
const staged=[];
for(const cfg of CONFIGS){
 const {code}=cfg,CODE=code.toUpperCase();
 const PREVIOUS=`data/audits/theme-${code}-031-060-progress-20261016.json`;
 const ART=`data/audits/theme-${code}-061-081-Korean-art-review-20261016.json`;
 const PREFLIGHT=`data/audits/theme-visual-evidence/${code}/061-091/visual-index.json`;
 const PROGRESS=`data/audits/theme-${code}-061-081-progress-20261016.json`;
 const NEXT=`${code} Korean rare print source pending: 082-091`;
 const [review,proof,previous]=await Promise.all([read(ART),read(PREFLIGHT),read(PREVIOUS)]);
 const sources=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===code);
 if(sources.length!==1||sources[0].cards?.length!==91)throw Error(CODE+" canonical 91 slots altered");
 const set=sources[0],oldMasterIDs=JSON.stringify(set.cards.map(c=>c.code));
 const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===code);
 if(!key)throw Error("Missing "+CODE+" first sixty review state");
 const meta=status.reviews[key];
 if(meta.artworkReviewedCardCount===81&&meta.reviewedRanges?.includes("061-081")){
  staged.push({code,alreadyApplied:true});continue;
 }
 if(meta.status!=="in_progress"||meta.complete!==false||
 meta.reviewedCardCount!==60||meta.artworkReviewedCardCount!==60||
 meta.verifiedKoreanPrintImageCount!==60||meta.verifiedSelfHostedImageCount!==60||
 meta.newlyAddedThemeSlotCount!==cfg.prevAdded||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 previous.KoreanPrintArtworksReviewed!==60||
 previous.totalNewThemeSlots!==cfg.prevAdded||
 previous.globalCheckpointPreserved!==GLOBAL||
 coverage.sets.find(x=>String(x.code||"").toLowerCase()===code)?.status!=="in_progress")
 throw Error("Prior "+CODE+" Korean 60-card checkpoint changed; stop");
 if(review.set!==code||review.range!=="061-081"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==21||
 review.verifiedKoreanPrintImagesInRange!==21||review.ownedCDNImagesDecoded!==21||
 !review.noMasterOrOwnershipChanges||review.themeAdditions!==cfg.newAdded||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.items?.length!==21||
 JSON.stringify(review.heldJapaneseSourceNumbers)!==JSON.stringify(Array.from({length:10},(_,i)=>82+i))||
 review.globalHoldUnchanged!==GLOBAL||
 proof.set!==code||proof.range!=="061-091"||proof.checkedCardCount!==31||
 proof.ownedImageDecodedCount!==31||proof.ownedImageMissingCount!==0||
 proof.preExistingThemeMemberships!==(code==="s5i"?2:0)||
 proof.cards?.length!==31||proof.globalCheckpointPreserved!==GLOBAL||
 holds.foreignSourceHolds?.[code]?.holdCount!==10)
 throw Error("Unverified official Korean 061-081 or Japanese 082-091 holds "+CODE);
 for(let i=21;i<31;i++){
  const rare=proof.cards[i],hold=holds.foreignSourceHolds[code].cards[i-21];
  if(!rare||rare.canonicalOrder!==i+61||!hold||
     hold.canonicalOrder!==i+61||rare.sourceHost!=="static.tcgexchange.kr"||
     hold.regionStatus!=="visually_observed_Japanese_card_Korean_image_missing")
   throw Error("Unsafe: missing JP rare card hold "+CODE+" "+(i+61));
 }
 const existing=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===code));
 if(existing.length!==cfg.oldMemberships||
 existing.some(c=>!themes.groups.some(g=>g.cards.includes(c))))
  throw Error("Previously approved Korean "+CODE+" artwork memberships changed");
 const originalCopies=existing.map(c=>JSON.stringify(c));
 if(code==="s5r"&&!groups.get("season").cards.some(c=>
  String(c.code||"").toUpperCase()==="S5R_006"&&c.name==="체리꼬"))
  throw Error("Protect existing S5R_006 Cherry Spring artwork");
 const additions=[],counts={};
 for(let i=0;i<21;i++){
  const n=i+61,num=String(n).padStart(3,"0"),key=CODE+"_"+num;
  const card=set.cards[n-1],row=review.items[i],pre=proof.cards[i];
  if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
   String(row.cardKey||"").toUpperCase()!==key||
   row.name!==card.name||pre.name!==card.name||
   String(card.code||"").toLowerCase()!==code+"_"+num+"/070"||
   String(pre.code||"").toLowerCase()!==code+"_"+num+"/070"||
   !row.koreanPrintImageVerified||!row.artObservation?.trim()||
   !pre.sourceAppearsPokemonKoreaOfficial||
   !pre.sourceUrl?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5/")||
   !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S5/")||
   pre.imageCheck?.status!=="decoded_region_unverified"||
   pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP")
   throw Error("Official Korean print not verified "+CODE+" "+num);
  const selected=new Set(row.matchedThemes||[]);
  if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
   [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
   Object.keys(row.categories||{}).some(t=>!selected.has(t)))
   throw Error("Bad artwork theme "+CODE+" "+num);
  const preexisting=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.code||"").toUpperCase()===key));
  if(code==="s5i"&&n===77){
   if(preexisting.length!==2||
    !groups.get("sleeping").cards.includes(preexisting[0])&&!groups.get("sleeping").cards.includes(preexisting[1])||
    !groups.get("food").cards.includes(preexisting[0])&&!groups.get("food").cards.includes(preexisting[1])||
    JSON.stringify(row.originalPreserved)!==JSON.stringify(["sleeping","food"]))
    throw Error("Protect existing two S5I_077 sleep/food artwork memberships");
  }else if(preexisting.length)throw Error("Refuse to replace live artwork "+CODE+" "+num);
  for(const theme of selected){
   if(code==="s5i"&&n===77&&["sleeping","food"].includes(theme))continue;
   groups.get(theme).cards.push({
    code:key,name:card.name,series:"S",set:set.code,setName:set.displayName||(code==="s5r"?"연격마스터":"일격마스터"),
    cardNumber:num+"/070",rarity:card.rarity||"",category:row.categories[theme],
    image:pre.ownedUrl,
    evidence:"공식 한국판 "+CODE+" "+num+"/070 12개 독립 테마 삽화 검수: "+row.artObservation+" ("+ART+")"
   });
   counts[theme]=(counts[theme]||0)+1;additions.push({number:n,theme});
  }
 }
 if(additions.length!==cfg.newAdded||THEMES.some(t=>
  (counts[t]||0)!==(review.themeCounts?.[t]||0)-(code==="s5i"&&["sleeping","food"].includes(t)?1:0))||
  JSON.stringify(set.cards.map(c=>c.code))!==oldMasterIDs||
  existing.some((c,i)=>JSON.stringify(c)!==originalCopies[i])||
  existing.some(c=>!themes.groups.some(g=>g.cards.includes(c))))
  throw Error("Korean theme count or existing ownership IDs changed "+CODE);
 meta.artworkReviewedCardCount=81;meta.reviewedCardCount=81;
 meta.verifiedKoreanPrintImageCount=81;meta.verifiedSelfHostedImageCount=81;
 meta.reviewedRanges=["001-030","031-060","061-081"];
 meta.reviewedThemes=THEMES;meta.newlyAddedThemeSlotCount=cfg.cumulative;
 meta.partialReviewEvidence=ART;meta.imagePreflightEvidence=PREFLIGHT;
 meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
 meta.heldRareCardNumbers=Array.from({length:10},(_,i)=>82+i);
 meta.heldForeignImageEvidence="data/audits/theme-s5r-s5i-082-091-Japanese-image-holds-20261016.json";
 meta.note=CODE+" 91장 중 공식 한국판 001~081번 12테마 검수 완료. 082~091번 현재 일본어판 이미지로 추후 한국판 출처 10개 추가 확인 필요. 기존 도감 카드 보유 ID 보존; 미검증 희귀 10장 때문에 완료 표시 금지.";
 staged.push({code,progress:PROGRESS,
  payload:{schemaVersion:1,recordedAt:DATE,set:code,totalMasterCards:91,
   KoreanPrintArtworksReviewed:81,sourceImagesSelfHostedDecoded:81,
   newlyAddedThemeSlotsThisBatch:cfg.newAdded,newlyAddedThemeSlotsCumulative:cfg.cumulative,
   existingThemeEntriesPreserved:cfg.originalExtraCount,
   reviewedRanges:["001-030","031-060","061-081"],
   heldRareCardNumbers:Array.from({length:10},(_,i)=>82+i),
   heldSourceRegion:"Japanese_print_image_not_approved_as_Korean",
   status:"in_progress",complete:false,nextStart:NEXT,globalCheckpointPreserved:GLOBAL,
   manualReview:ART,ownedImagePreflight:PREFLIGHT,
   heldForeignImageEvidence:meta.heldForeignImageEvidence
  },additions:additions.length});
}
if(staged.every(s=>s.alreadyApplied)){console.log("S5R and S5I first 81 already complete; safe no-op");process.exit(0);}
if(staged.some(s=>s.alreadyApplied))throw Error("Mixed partial state: refuse unsafe combined update");
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global S6K source holds changed");
themes.updatedAt=DATE;status.updatedAt=DATE;
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 ...staged.map(s=>save(s.progress,s.payload))
]);
console.log(JSON.stringify({sets:staged.map(({code,additions})=>({code,reviewed:81,of:91,addedThisBatch:additions,heldForeignImageCount:10})),allMasterCardKeysPreserved:true,globalCheckpoint:GLOBAL}));
