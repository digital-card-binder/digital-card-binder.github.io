import {readFile,writeFile} from "node:fs/promises";
const {existsSync}=await import("node:fs");
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const write=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n","utf8");
const GLOBAL="s6K Korean print source pending: 089,090,092,094",DATE="2026-10-16";
const AR="data/audits/theme-s5r-s5i-082-091-eleven-Korean-photos-provisional-20261016.json";
const HOLDS="data/audits/theme-s5r-s5i-082-091-Japanese-image-holds-20261016.json";
const REPORT="data/audits/theme-s5r-s5i-082-091-provisional-progress-20261016.json";
const [audit,held,modern,legacy,themes,status,hosting,coverage,previousR,previousI]=await Promise.all([
 read(AR),read(HOLDS),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s5r-061-081-progress-20261016.json"),
 read("data/audits/theme-s5i-061-081-progress-20261016.json")
]);
if(audit.status!=="visually_approved_provisional_Korean_images_11_of_20"||
 audit.approvedCount!==11||audit.stillHeldCount!==9||
 audit.imagesAuthenticatedAsKoreanVisuals!==true||audit.appliedComplete!==false||
 held.status!=="pending_Korean_image_provenance"||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 audit.globalCheckpointPreserved!==GLOBAL||held.globalCheckpointPreserved!==GLOBAL)
 throw Error("Korean rare source approval or historic S6K hold unexpectedly changed");
const groups=new Map(themes.groups.map(t=>[t.code,t]));
if(!groups.has("color")||!Array.isArray(groups.get("color").cards))
 throw Error("Cannot safely update 12 independent themes");
const configs=[
 {code:"s5r",prev:previousR,priorNew:120,expectedPriorMemberships:121,expectedAdds:5},
 {code:"s5i",prev:previousI,priorNew:114,expectedPriorMemberships:116,expectedAdds:6}
];
const state=[];
for(const cfg of configs){
 const setcode=cfg.code.toUpperCase();
 const matches=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===cfg.code);
 if(matches.length!==1||matches[0].cards?.length!==91||!modern.includes(matches[0]))
  throw Error("Original S5R / S5I master card count or source changed: "+cfg.code);
 const set=matches[0],codes=set.cards.map(c=>c.code);
 const metaKey=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===cfg.code);
 if(!metaKey)throw Error("Cannot find previous reviewed metadata "+cfg.code);
 const meta=status.reviews[metaKey],approved=audit.approved.filter(x=>x.set===cfg.code);
 const remaining=audit.remaining.filter(x=>x.set===cfg.code);
 if(approved.length!==cfg.expectedAdds||remaining.length!==10-cfg.expectedAdds)
  throw Error("Mismatch approved vs held count "+cfg.code);
 if(meta.artworkReviewedCardCount===81+cfg.expectedAdds&&
  meta.verifiedKoreanPrintImageCount===81+cfg.expectedAdds&&
  meta.provisionalKoreanImageNumbers?.length===cfg.expectedAdds){
  state.push({code:cfg.code,alreadyApplied:true});continue;
 }
 if(meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==81||meta.reviewedCardCount!==81||
 meta.verifiedKoreanPrintImageCount!==81||meta.verifiedSelfHostedImageCount!==81||
 meta.newlyAddedThemeSlotCount!==cfg.priorNew||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060","061-081"])||
 cfg.prev.KoreanPrintArtworksReviewed!==81||cfg.prev.heldRareCardNumbers?.length!==10||
 cfg.prev.globalCheckpointPreserved!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===cfg.code)?.status!=="in_progress")
  throw Error("Historic 81 Korean reviewed cards or theme checkpoint changed "+cfg.code);
 const oldThemeCards=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===cfg.code));
 if(oldThemeCards.length!==cfg.expectedPriorMemberships)
  throw Error("Existing artwork membership total changed: "+cfg.code+" "+oldThemeCards.length);
 const originalThemeJson=oldThemeCards.map(c=>JSON.stringify(c));
 const originalUnheld=set.cards.map((c,i)=>({key:c.code,other:JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k])=>!["image","sourceImage"].includes(k))))}));
 const added=[];
 for(const row of approved){
  const n=row.canonicalOrder,num=String(n).padStart(3,"0");
  const expectedCode=cfg.code+"_"+num+"/070",master=set.cards[n-1];
  const oldHold=held.foreignSourceHolds[cfg.code].cards[n-82];
  const own=row.targetAsset;
  if(!master||master.code.toLowerCase()!==expectedCode||row.code!==expectedCode||
   !oldHold||oldHold.code!==expectedCode||!["HR","UR"].includes(master.rarity)||
   row.status!=="approved_provisional_Korean_photo_watermarked"||
   !row.sourceHasRetailerWatermark||row.printedLanguageVisuallyIdentified!=="Korean"||
   !row.cardNumberArtworkVisuallyMatched||
   row.artworkThemes?.length!==1||row.artworkThemes[0]!=="color"||
   !row.colorCategory?.trim()||!own.startsWith("/assets/cards/korean-retail-sources-20261016/")||
   !own.endsWith("/"+num+".webp")||
   row.sourceImage!==`https://tcgbox.co.kr/web/product/big/${setcode}/${setcode}_${num}.jpg`)
   throw Error("Card/source metadata mismatch "+expectedCode);
  const asset=own.slice(1);
  if(!existsSync(asset))throw Error("Approved source image not staged on own GitHub Pages: "+asset);
  const bytes=await readFile(asset);
  if(bytes.length<3500||bytes.subarray(0,4).toString()!=="RIFF"||
   bytes.subarray(8,12).toString()!=="WEBP")
   throw Error("Invalid local encoded WEBP asset "+asset);
  if(master.sourceImage!==oldHold.sourceImage&&master.image!==oldHold.sourceImage)
   throw Error("Existing Japanese source unexpectedly altered "+expectedCode);
  if(themes.groups.some(g=>g.cards.some(c=>String(c.code||"").toUpperCase()===setcode+"_"+num)))
   throw Error("Existing artwork would be overwritten "+expectedCode);
  const originalImage=master.image, originalSource=master.sourceImage||"";
  master.image=own;master.sourceImage=own;
  groups.get("color").cards.push({
   code:setcode+"_"+num,name:master.name,series:"S",set:set.code,
   setName:set.displayName||(cfg.code==="s5r"?"연격마스터":"일격마스터"),
   cardNumber:num+"/070",rarity:master.rarity,
   category:row.colorCategory,image:own,
   evidence:"한국어 인쇄 희귀 카드 시각 대조 "+expectedCode+
    " (임시 리테일 출처, TCGBOX 워터마크 유지, "+
    "사진 백업: "+own+", 감사기록: "+AR+")"
  });
  added.push({number:n,code:expectedCode,originalImage,originalSource,localImage:own,
   watermark:true,provisional:true});
 }
 if(added.length!==cfg.expectedAdds||
    oldThemeCards.some((c,i)=>JSON.stringify(c)!==originalThemeJson[i])||
    oldThemeCards.some(c=>!themes.groups.some(g=>g.cards.includes(c)))||
    codes.some((code,i)=>code!==set.cards[i].code)||
    originalUnheld.some((c,i)=>c.other!==JSON.stringify(Object.fromEntries(
      Object.entries(set.cards[i]).filter(([k])=>!["image","sourceImage"].includes(k))))))
  throw Error("Pre-existing card ownership / artwork metadata changed "+cfg.code);
 for(const row of remaining){
  const n=row.n,num=String(n).padStart(3,"0"),card=set.cards[n-1];
  if(!card||String(card.code).toLowerCase()!==cfg.code+"_"+num+"/070"||
    !card.image?.startsWith("https://")||
    themes.groups.some(g=>g.cards.some(c=>String(c.code||"").toUpperCase()===setcode+"_"+num)))
   throw Error("One of the nine unresolved Japanese sources was wrongly approved "+cfg.code+"_"+num);
 }
 meta.artworkReviewedCardCount=81+added.length;
 meta.reviewedCardCount=81+added.length;
 meta.verifiedKoreanPrintImageCount=81+added.length;
 meta.verifiedSelfHostedImageCount=81+added.length;
 meta.newlyAddedThemeSlotCount=cfg.priorNew+added.length;
 meta.provisionalKoreanImageNumbers=added.map(x=>x.number);
 meta.provisionalImageAudit=AR;
 meta.heldRareCardNumbers=remaining.map(x=>x.n);
 meta.nextStart=cfg.code+" Korean rare image pending: "+remaining.map(x=>x.n).join(",");
 meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
 meta.note="앞서 한국판 81장 + 판매처 한국어 인쇄판 임시 소스 "+
 added.length+"장을 수집·시각검수. 9장 중 본 세트의 미검수 번호는 "+remaining.map(x=>x.n).join(",")+
 ". 워터마크 유지된 이미지들은 임시본이며 무워터마크 공식 한국판으로 추후 교체 필요. 원본 보유 키·기존 테마 항목 유지.";
 state.push({code:cfg.code,approved:added,stillHeld:remaining.map(x=>x.n),totalReviewed:81+added.length,
  cumulativeThemeAdditions:cfg.priorNew+added.length});
}
if(state.every(x=>x.alreadyApplied)){console.log("All provisional Korean rare photos already applied.");process.exit(0);}
if(state.some(x=>x.alreadyApplied))throw Error("Mixed partial applying state; abort");
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("S6K historic four Korean print holds mutated");
themes.updatedAt=DATE;status.updatedAt=DATE;
const result={schemaVersion:1,recordedAt:DATE,
 status:"provisional_11_Korean_images_applied_9_unresolved",
 verifiedKoreanRegionPhotosThisBatch:11,totalForeignHoldCountAfter:9,
 totalS5rReviewed:86,totalS5iReviewed:87,
 originalJapaneseImageEvidence:HOLDS,photoApproval:AR,sourceAttribution:"TCGBOX logo preserved in all 11 provisional images",
 cardKeysChanged:0,masterCardsAddedOrRemoved:0,globalCheckpointPreserved:GLOBAL,
 sets:state};
await Promise.all([
 write("data/series.json",modern),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",status),
 write(REPORT,result)
]);
console.log(JSON.stringify({status:result.status,sets:state.map(x=>({code:x.code,reviewed:x.totalReviewed,
 added:x.approved.length,stillHeld:x.stillHeld})),originalCardKeysPreserved:true}));
