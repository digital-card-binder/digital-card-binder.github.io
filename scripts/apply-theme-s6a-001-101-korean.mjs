import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n");
const CODE="s6a",DATE="2026-10-15",TOTAL=101;
const GROUPS=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const HELD=[88,92,96,97,99,100,101];
const PENDING="s6a Korean print source pending: 088,092,096,097,099,100,101";
const [a,b,c,proof,modern,legacy,themes,status,hosting,overrides]=await Promise.all([
 ...["001-035","036-070","071-101"].map(r=>read("data/audits/theme-s6a-"+r+"-Korean-art-review-20261015.json")),
 read("data/audits/theme-visual-evidence/s6a/001-101/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const parts=[a,b,c],items=parts.flatMap(x=>x.items);
const sets=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(sets.length!==1||sets[0].cards?.length!==TOTAL)throw Error("Expected exactly one 101-card Korean Eevee Heroes master");
const set=sets[0],priorKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE),prior=status.reviews?.[priorKey||set.code]||{};
if(prior.artworkReviewedCardCount===101&&prior.reviewedCardCount===94){
 console.log("s6a already reviewed with seven Korean print exceptions; safe skip");
 process.exit(0);
}
if(status.execution?.nextStart!=="s6a canonical 001"||
 hosting.nextStart!=="s6a canonical 001"||
 String(status.execution.currentSet).toLowerCase()!==CODE||
 (prior.reviewedCardCount||0)!==0)
 throw Error("Unsafe Korean s6a initial checkpoint; existing work unchanged");
if(proof.set!==CODE||proof.masterSetCardCount!==101||
 proof.canonicalCardsChecked!==101||proof.cards?.length!==101||
 proof.verifiedOwnedCdnImageCount!==101||proof.unavailableOwnedCdnImageCount!==0||
 proof.printedNumberMatchCount!==101||proof.koreanNameNonemptyCount!==101||
 proof.sourceRequestCount!==0||items.length!==101||
 parts.some(x=>x.set!==CODE||x.all12ThemesInspected!==true||
  x.sourceImagesRequested!==0)||a.items?.length!==35||b.items?.length!==35||
 c.items?.length!==31||JSON.stringify(c.printLanguageReviewExceptions)!==JSON.stringify(HELD))
 throw Error("Incomplete s6a card numbers, hosted image proof, art themes or foreign-print exceptions");
const gm=new Map(themes.groups.map(g=>[g.code,g]));
for(const name of GROUPS)if(!Array.isArray(gm.get(name)?.cards))throw Error("Missing theme group "+name);
const unchanged=set.cards.map(c=>c.code);
const counts={},preserved={},issues=[];
overrides.sets??={};overrides.sets[set.code]??={};
for(let i=0;i<TOTAL;i++){
 const n=i+1,id=String(n).padStart(3,"0"),key="S6A_"+id,code="s6a_"+id+"/069";
 const row=items[i],p=proof.cards[i],master=set.cards[i],foreign=HELD.includes(n);
 if(!row||!p||!master||p.canonicalOrder!==n||row.canonicalOrder!==n||
 row.cardKey!==key||String(master.code).toLowerCase()!==code||
 String(p.masterCode).toLowerCase()!==code||p.expectedPrintedNumber!==id+"/069"||
 !p.printedNumberMatches||p.name!==master.name||row.name!==master.name||
 !row.artObservation?.trim()||p.rawSource!==(master.sourceImage||master.image)||
 p.imageCheck?.status!=="decoded"||p.imageCheck.http!==200||
 p.imageCheck.format!=="WEBP"||p.imageCheck.dimensions?.[0]<200||
 p.imageCheck.dimensions?.[1]<250||
 !p.ownedCdnUrl?.startsWith("https://dcb-card-images-"))
 throw Error("Unsafe Korean artwork or master card "+n);
 const sourceHost=new URL(p.rawSource).hostname;
 if(!["cards.image.pokemonkorea.co.kr","static.tcgexchange.kr"].includes(sourceHost))
 throw Error("Unexpected Korean art source host "+n);
 const old=n===95?["night"]:[];
 if(JSON.stringify(p.priorThemes)!==JSON.stringify(old))
  throw Error("Existing independent motif data unexpectedly changed at "+n);
 const assigned=new Set(row.matchedThemes);
 if(assigned.size!==row.matchedThemes.length||!assigned.has("color")||
 [...assigned].some(t=>!GROUPS.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!assigned.has(t)))
 throw Error("Invalid visual category "+n);
 if(n===95&&!assigned.has("night"))throw Error("Existing moonlight Umbreon membership lost");
 for(const t of GROUPS){
  const g=gm.get(t);
  const existing=g.cards.filter(x=>String(x.code||"").toUpperCase()===key);
  if(existing.length!==(old.includes(t)?1:0))throw Error("Theme slot changed unexpectedly "+n+" "+t);
  if(old.includes(t)){
   if(!assigned.has(t)||existing[0].name!==master.name)throw Error("Existing S6A theme identity mismatch "+n);
   existing[0].image=p.ownedCdnUrl;preserved[t]=(preserved[t]||0)+1;continue;
  }
  if(!assigned.has(t))continue;
  g.cards.push({code:key,name:master.name,series:"S",set:set.code,
   setName:set.displayName||"이브이 히어로즈",cardNumber:id+"/069",
   rarity:master.rarity||"",category:row.categories[t],image:p.ownedCdnUrl,
   evidence:"한국판 이브이 히어로즈 s6a "+id+"/069 시각 검수: "+row.artObservation+
    (foreign?" (해외판 인쇄 임시 이미지: 한국어 이미지 교체 필수)":"")});
  counts[t]=(counts[t]||0)+1;
 }
 if(!master.sourceImage)master.sourceImage=p.rawSource;
 master.image=p.ownedCdnUrl;
 if(foreign){
  master.koreanPrintImagePending=true;
  issues.push({code:master.code,name:master.name,issue:"Japanese print scan placeholder: Korean photograph not verified"});
 }
 overrides.sets[set.code][String(master.code).toLowerCase()]=p.ownedCdnUrl;
}
if(JSON.stringify(unchanged)!==JSON.stringify(set.cards.map(x=>x.code)))
 throw Error("Canonical card identifiers altered");
const expected={color:101,season:53,street:15,cameo:3,sunset:1,night:3,food:1};
const added=Object.values(counts).reduce((x,y)=>x+y,0);
if(JSON.stringify(counts)!==JSON.stringify(expected)&&
 GROUPS.some(t=>(counts[t]||0)!==(expected[t]||0)))throw Error("Visual theme slot counts mismatch");
if(added!==177||JSON.stringify(preserved)!==JSON.stringify({night:1})||issues.length!==7)
 throw Error("Prior themes, new cards or foreign print exception count invalid");
status.reviews??={};status.reviews[priorKey||set.code]={...prior,status:"in_progress",reviewedAt:DATE,
 artworkReviewedCardCount:TOTAL,reviewedCardCount:94,verifiedSelfHostedImageCount:101,
 verifiedKoreanPrintImageCount:94,heldCards:HELD.map(n=>"s6a_"+n+"/069"),
 unresolvedImageIssues:issues,reviewedRanges:["001-101 (art reviewed; seven Korean prints pending)"],
 reviewedThemes:GROUPS,newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+added,
 partialReviewEvidence:"data/audits/theme-s6a-071-101-Korean-art-review-20261015.json",
 archiveVerificationStatus:"101_illustrations_94_Korean_print_7_foreign_language_placeholders",
 nextStart:PENDING,note:"이브이 히어로즈 한국판 101개 일러스트의 12테마 검수 완료. 94개 한국어판 인쇄 확인; 88,92,96,97,99,100,101 외국판 임시 이미지 보류. 기존 95 블래키 VMAX 밤 테마 보존."
};
status.execution.currentEra="S";status.execution.currentSet=set.code;
status.execution.lastSafeCheckpoint="s6a illustrations 101/101 and Korean print images 94/101; seven images held";
status.execution.nextStart=PENDING;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({task:9,set:set.code,range:"canonical 001-101 Korean Eevee Heroes",
 canonicalCardCount:101,artworkVisuallyVerifiedCount:101,artworkPendingCount:0,
 selfHostedReferenceCountAfter:101,externalImageReferenceCountAfter:0,
 verifiedImageCount:101,unverifiedImageCount:0,brokenReferenceCount:0,
 koreanPrintImagesConfirmed:94,koreanPrintImagesPending:7,themeAdditions:counts,
 previousThemeEntriesPreserved:preserved,newlyInternalizedReferenceCount:101,
 nextStart:PENDING,note:"All 101 artwork representations checked. 7 foreign-language card scans remain held."});
hosting.nextStart=PENDING;hosting.updatedAt=DATE;themes.updatedAt=DATE;
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
 save("data/audits/theme-series-review-status.json",status),
 save("data/audits/theme-image-selfhost-audit.json",hosting),
 save("data/audits/theme-s6a-001-101-progress-20261015.json",{
  schemaVersion:1,recordedAt:DATE,set:set.code,status:"in_progress",
  totalMasterCards:101,artworkReviewed:101,verifiedKoreanPrintImages:94,
  ownedImagesVerified:101,all12ThemesReviewed:true,pendingKoreanImages:issues.map(x=>x.code),
  remainingUnreviewedKoreanPrints:7,themeCounts:counts,newThemeSlotsAdded:added,
  existingThemesPreserved:preserved,nextStart:PENDING,
  proof:"data/audits/theme-visual-evidence/s6a/001-101/visual-index.json"
 })
]);
console.log(JSON.stringify({set:set.code,artworks:101,prints:94,added,
 priorThemePreserved:preserved,exceptions:issues,next:PENDING}));
