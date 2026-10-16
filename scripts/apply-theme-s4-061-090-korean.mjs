import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s4",DATE="2026-10-17";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s4-061-090-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s4/061-090/visual-index.json";
const PREVIOUS="data/audits/theme-s4-031-060-progress-20261017.json";
const PROGRESS="data/audits/theme-s4-061-090-progress-20261017.json";
const NEXT="s4 Korean 091-121 printed artwork source and 12-theme visual review";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json")
]);
const sources=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(sources.length!==1||sources[0].cards?.length!==121)throw Error("Original S4 master must have 121 cards");
const set=sources[0],originalKeys=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!key)throw Error("S4 previously approved batch missing");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===90&&meta.reviewedRanges?.includes("061-090")&&meta.newlyAddedThemeSlotCount===158){
 console.log("S4 third 30 Korean artworks already applied; safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="in_progress"||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==60||meta.reviewedCardCount!==60||
 meta.verifiedKoreanPrintImageCount!==60||meta.verifiedSelfHostedImageCount!==60||
 meta.newlyAddedThemeSlotCount!==103||meta.preservedExistingThemeSlotCount!==1||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 previous.KoreanPrintArtworksReviewed!==60||
 previous.newlyAddedThemeSlotsCumulative!==103||
 previous.existingThemeSlotsPreserved!==1||
 previous.globalCheckpointPreserved!==GLOBAL||previous.totalMasterCards!==121)
 throw Error("S4 second approved checkpoint or global S6K holds changed");
if(review.set!==CODE||review.range!=="061-090"||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.status!=="manual_Korean_art_12_theme_reviewed"||!review.all12ThemesInspected||
 review.existingThemesInThisRange!==1||review.themeAdditions!==55||
 JSON.stringify(review.existingMembershipsPreserved)!==JSON.stringify(["S4_084 sleeping"])||
 !review.noMasterOrOwnershipChanges||review.items?.length!==30||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.range!=="061-090"||proof.masterCanonicalCards!==121||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==1||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S4 third 30 Korean visual/image evidence incomplete");
const groupByCode=new Map(themes.groups.map(g=>[g.code,g]));
if(groupByCode.size!==12||THEMES.some(t=>!Array.isArray(groupByCode.get(t)?.cards)))
 throw Error("Theme taxonomy changed");
const before=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
const beforeJson=before.map(c=>JSON.stringify(c));
if(before.length!==105||
 groupByCode.get("food").cards.filter(c=>
  String(c.set||"").toLowerCase()===CODE&&String(c.code||"").toUpperCase()==="S4_027").length!==1||
 groupByCode.get("sleeping").cards.filter(c=>
  String(c.set||"").toLowerCase()===CODE&&String(c.code||"").toUpperCase()==="S4_084").length!==1)
 throw Error("Previous S4 103 new entries and original food/sleeping records changed");
const inRange=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE &&
 Number(String(c.cardNumber||"").split("/")[0])>=61 &&
 Number(String(c.cardNumber||"").split("/")[0])<=90
 ).map(c=>({theme:g.code,code:String(c.code||"").toUpperCase()})));
if(inRange.length!==1||inRange[0].code!=="S4_084"||inRange[0].theme!=="sleeping")
 throw Error("Expected S4_084 preexisting sleeping theme must remain intact");
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=i+61,num=String(n).padStart(3,"0"),id="S4_"+num,canonical="s4_"+num+"/100";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[n-1];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==id.toUpperCase()||
 row.name!==card.name||pre.name!==card.name||
 String(pre.code||"").toLowerCase()!==canonical||
 String(card.code||"").toLowerCase()!==canonical||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 row.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !pre.sourceAppearsPokemonKoreaOfficial||
 pre.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 pre.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S4/S4_"+num+".png"||
 pre.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S4/S4_"+num+".webp"||
 pre.imageCheck?.status!=="decoded_region_unverified"||
 pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP"||
 !/^[0-9a-f]{64}$/.test(pre.imageCheck?.sha256||"")||
 pre.imageCheck?.dimensions?.[0]!==420||
 pre.imageCheck?.dimensions?.[1]!==586||
 !["C","U","R","RR","RRR"].includes(row.rarity))
 throw Error("S4 verified Korean image mismatch "+num);
 const expectedExisting=n===84?["sleeping"]:[];
 if(JSON.stringify(row.preExistingThemeRecordsPreserved)!==JSON.stringify(expectedExisting)||
 JSON.stringify(pre.preExistingThemeMemberships||[])!==JSON.stringify(expectedExisting))
 throw Error("Existing S4 sleeping theme is not intact "+num);
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t))||
 expectedExisting.some(t=>!selected.has(t)))
 throw Error("S4 12-theme membership mismatch "+num);
 for(const theme of selected){
  if(expectedExisting.includes(theme))continue;
  const group=groupByCode.get(theme);
  if(group.cards.some(c=>String(c.code||"").toUpperCase()===id.toUpperCase()||
    (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/100")))
   throw Error("Duplicate S4 061-090 theme "+id+"/"+theme);
  group.cards.push({
   code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"앙천의 볼트태클",cardNumber:num+"/100",
   rarity:card.rarity||row.rarity,category:row.categories[theme],
   image:pre.ownedUrl,
   evidence:"포켓몬코리아 한국어 인쇄 S4 "+num+"/100 카드 및 DCB 자체 보관 WebP 시각 검수. "+row.artObservation+" ("+REVIEW+")"
  });
  additions.push({n,theme});counts[theme]=(counts[theme]||0)+1;
 }
}
if(additions.length!==55||
 THEMES.some(t=>(counts[t]||0)!==((review.themeCounts?.[t]||0)-(t==="sleeping"?1:0)))||
 JSON.stringify(set.cards.map(c=>c.code))!==originalKeys||
 before.some((c,i)=>JSON.stringify(c)!==beforeJson[i]))
 throw Error("S4 third batch artwork additions don't match reviewed 12-theme map");
meta.artworkReviewedCardCount=90;meta.reviewedCardCount=90;
meta.verifiedKoreanPrintImageCount=90;meta.verifiedSelfHostedImageCount=90;
meta.reviewedRanges=["001-030","031-060","061-090"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=158;meta.preservedExistingThemeSlotCount=2;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.note="S4 121장 중 001~090번 한국판 카드 이미지와 12테마 시각검수 완료, 신규 수록 누적 158개. 최초 음식 S4_027 및 잠자는 포켓몬 S4_084 테마 기록을 무수정 유지. 091-121 검사 완료 전 세트 complete 처리 금지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global s6K Korean printed image holds changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:121,
 KoreanPrintArtworksReviewed:90,sourceImagesSelfHostedDecoded:90,
 newlyAddedThemeSlotsThisBatch:55,newlyAddedThemeSlotsCumulative:158,
 existingThemeSlotsPreserved:2,
 reviewedRanges:["001-030","031-060","061-090"],
 status:"in_progress",complete:false,nextStart:NEXT,
 globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
 ownedImagePreflight:PROOF,remainingImageAndArtworkCount:31
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:90,total:121,newThemeSlotsThisBatch:55,cumulativeNewSlots:158,originalTwoThemeSlotsPreserved:true,masterUnchanged:true,globalHoldPreserved:true}));
