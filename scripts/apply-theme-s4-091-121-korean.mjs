import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s4",DATE="2026-10-17";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s4-091-121-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s4/091-121/visual-index.json";
const PREVIOUS="data/audits/theme-s4-061-090-progress-20261017.json";
const PROGRESS="data/audits/theme-s4-091-121-progress-20261017.json";
const NEXT="S4 121/121 Korean artworks strictly complete; next pending S3a Korean source and 12-theme visual review";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json")
]);
const sources=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(sources.length!==1||sources[0].cards?.length!==121)
 throw Error("Original Korean S4 master must have 121 cards");
const set=sources[0],originalKeys=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!key)throw Error("Prior approved S4 status missing");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===121&&meta.reviewedCardCount===121&&
 meta.status==="complete"&&meta.newlyAddedThemeSlotCount===194){
 console.log("S4 all 121 Korean print artwork themes already approved; safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="in_progress"||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==90||meta.reviewedCardCount!==90||
 meta.verifiedKoreanPrintImageCount!==90||meta.verifiedSelfHostedImageCount!==90||
 meta.newlyAddedThemeSlotCount!==158||meta.preservedExistingThemeSlotCount!==2||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060","061-090"])||
 previous.KoreanPrintArtworksReviewed!==90||
 previous.newlyAddedThemeSlotsCumulative!==158||
 previous.existingThemeSlotsPreserved!==2||
 previous.globalCheckpointPreserved!==GLOBAL||previous.totalMasterCards!==121)
 throw Error("S4 third approved checkpoint or global s6K pending evidence altered");
if(review.set!==CODE||review.range!=="091-121"||review.artworksReviewed!==31||
 review.verifiedKoreanPrintImagesInRange!==31||review.ownedCDNImagesDecoded!==31||
 review.status!=="manual_Korean_art_12_theme_reviewed_with_nonofficial_provenance"||
 review.officialSourceCardsInRange!==21||
 review.nonofficialSourceKoreanPrintCardsInRange!==10||
 review.officialProvenanceOfNonofficialImagesConfirmed!==false||
 !review.all12ThemesInspected||review.existingThemesInThisRange!==0||
 review.themeAdditions!==36||!review.noMasterOrOwnershipChanges||
 review.items?.length!==31||review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 proof.set!==CODE||proof.range!=="091-121"||proof.masterCanonicalCards!==121||
 proof.checkedCardCount!==31||proof.ownedImageDecodedCount!==31||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.sourceHostCounts?.["cards.image.pokemonkorea.co.kr"]!==21||
 proof.sourceHostCounts?.["static.tcgexchange.kr"]!==10||
 proof.cards?.length!==31||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Final 31 S4 Korean artwork evidence or own archive provenance incomplete");
const byCode=new Map(themes.groups.map(g=>[g.code,g]));
if(byCode.size!==12||THEMES.some(t=>!Array.isArray(byCode.get(t)?.cards)))
 throw Error("Twelve independent artwork themes missing");
const before=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
const beforeJson=before.map(c=>JSON.stringify(c));
if(before.length!==160||
 byCode.get("food").cards.filter(c=>
  String(c.set||"").toLowerCase()===CODE&&String(c.code||"").toUpperCase()==="S4_027").length!==1||
 byCode.get("sleeping").cards.filter(c=>
  String(c.set||"").toLowerCase()===CODE&&String(c.code||"").toUpperCase()==="S4_084").length!==1)
 throw Error("Prior S4 approved 158 new and original 2 theme entries missing");
const finalExisting=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE&&
 Number(String(c.cardNumber||"").split("/")[0])>=91&&
 Number(String(c.cardNumber||"").split("/")[0])<=121));
if(finalExisting.length)throw Error("Unexpected previously approved final 31 S4 theme entries");
const additions=[],counts={};
for(let i=0;i<31;i++){
 const n=i+91,num=String(n).padStart(3,"0"),id="S4_"+num,canonical="s4_"+num+"/100";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[n-1];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==id.toUpperCase()||
 row.name!==card.name||pre.name!==card.name||
 String(pre.code||"").toLowerCase()!==canonical||
 String(card.code||"").toLowerCase()!==canonical||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 String(pre.sourceUrl||"")!==String(card.sourceImage||card.image||"")||
 !/^[0-9a-f]{64}$/.test(pre.imageCheck?.sha256||"")||
 pre.imageCheck?.status!=="decoded_region_unverified"||
 pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP"||
 pre.imageCheck?.dimensions?.[0]!==420||
 ![586,587,593].includes(pre.imageCheck?.dimensions?.[1])||
 !["C","U","R","RR","RRR","SR","HR","UR"].includes(row.rarity)||
 JSON.stringify(row.preExistingThemeRecordsPreserved)!=="[]"||
 JSON.stringify(pre.preExistingThemeMemberships||[])!=="[]")
 throw Error("S4 final artwork, print number, name or source mismatch at "+num);
 if(n<=111){
  if(!pre.sourceAppearsPokemonKoreaOfficial||
   pre.sourceHost!=="cards.image.pokemonkorea.co.kr"||
   pre.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S4/S4_"+num+".png"||
   pre.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S4/S4_"+num+".webp"||
   row.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image")
   throw Error("S4 Korean official original/owned image mismatch at "+num);
 }else{
  if(pre.sourceAppearsPokemonKoreaOfficial||
   pre.sourceHost!=="static.tcgexchange.kr"||
   !/^https:\/\/static\.tcgexchange\.kr\/[0-9a-f]{32}\.(png|jpg)$/.test(pre.sourceUrl)||
   !/^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\/external\/static\.tcgexchange\.kr\/[0-9a-f]{16}\.webp$/.test(pre.ownedUrl)||
   row.sourceEvidence!=="thirdparty-korean-printed-image-and-dcb-owned-legacy-mirror-not-official")
   throw Error("S4 112-121 third-party Korean-print source incorrectly marked official "+num);
 }
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid final 31 12-theme classification "+num);
 for(const theme of selected){
  const group=byCode.get(theme);
  if(group.cards.some(c=>String(c.code||"").toUpperCase()===id.toUpperCase()||
    (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/100")))
   throw Error("Duplicate S4 theme member "+id+"/"+theme);
  group.cards.push({
   code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"앙천의 볼트태클",cardNumber:num+"/100",
   rarity:card.rarity||row.rarity,category:row.categories[theme],
   image:pre.ownedUrl,
   evidence:(n<=111?"포켓몬코리아 한국판 공식 이미지 및 자체 CDN":"외부 사진 static.tcgexchange.kr 한국어 인쇄본과 DCB 자체 레거시 CDN, 공식 이미지 원본 출처 아님")+
    " S4 "+num+"/100 12테마 실물 삽화 시각검수. "+row.artObservation+" ("+REVIEW+")"
  });
  additions.push({n,theme});counts[theme]=(counts[theme]||0)+1;
 }
}
if(additions.length!==36||
 THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==originalKeys||
 before.some((c,i)=>JSON.stringify(c)!==beforeJson[i]))
 throw Error("S4 final 31 approved additions mismatch or existing artworks overwritten");
meta.artworkReviewedCardCount=121;meta.reviewedCardCount=121;
meta.verifiedKoreanPrintImageCount=121;meta.verifiedSelfHostedImageCount=121;
meta.reviewedRanges=["001-030","031-060","061-090","091-121"];
meta.reviewedThemes=THEMES;meta.newlyAddedThemeSlotCount=194;
meta.preservedExistingThemeSlotCount=2;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="complete";meta.complete=true;
meta.note="S4 앙천의 볼트태클 전체 121개 canonical 카드 번호를 한국어 카드 실물로 12테마 전수검수, 자체 CDN 121개 확인. 신규 테마 슬롯 194개, 기존 원본 food S4_027 및 sleeping S4_084 2개 보존. 마지막 112-121 10장은 공식 원본이 아닌 외부 한국어 인쇄본 사진과 DCB 자체 레거시 저장소에 근거함. 마스터 DB와 보유 키 변경 없음.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Unresolved S6K Korean print holds altered");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
  schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:121,
  KoreanPrintArtworksReviewed:121,sourceImagesSelfHostedDecoded:121,
  newlyAddedThemeSlotsThisBatch:36,newlyAddedThemeSlotsCumulative:194,
  existingThemeSlotsPreserved:2,
  reviewedRanges:["001-030","031-060","061-090","091-121"],
  status:"complete",complete:true,nextStart:NEXT,
  officialSourceCardsLastBatch:21,thirdPartyKoreanPrintCardsLastBatch:10,
  officialProvenanceOfThirdPartyOriginalsConfirmed:false,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:0
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:121,total:121,strictComplete:true,
 newThemeSlotsThisBatch:36,cumulativeNewSlots:194,existingTwoPreserved:true,
 sourceVerifiedOfficialLastBatch:21,nonofficialKoreanLastBatch:10,
 masterUnchanged:true,globalHoldPreserved:true}));
