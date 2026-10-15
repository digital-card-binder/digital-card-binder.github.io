import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n");
const CODE="s7D",DATE="2026-10-15",TOTAL=90;
const GROUPS=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const HELD=[80,81,82];
const PENDING="s7D Korean print source pending: 080,081,082";
const [a,b,c,proof,modern,legacy,themes,status,hosting,overrides]=await Promise.all([
 ...["001-030","031-060","061-090"].map(r=>read("data/audits/theme-s7d-"+r+"-Korean-art-review-20261015.json")),
 read("data/audits/theme-visual-evidence/s7d/001-090/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const reviews=[a,b,c],items=reviews.flatMap(r=>r.items);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE.toLowerCase());
if(sets.length!==1||sets[0].cards?.length!==TOTAL)throw Error("Expected exactly one Korean s7D 90-card set");
const set=sets[0],currentCode=set.code;
status.reviews??={};
const priorKey=Object.keys(status.reviews).find(k=>k.toLowerCase()===CODE.toLowerCase());
const prior=status.reviews[priorKey||currentCode]||{};
if(prior.artworkReviewedCardCount===90&&prior.reviewedCardCount===87&&
   JSON.stringify(prior.heldCards)===JSON.stringify(HELD.map(n=>"s7d_"+n+"/067"))){
 console.log("s7D 90 artwork themes and 87 Korean prints already applied; no changes.");
 process.exit(0);
}
if(status.execution?.nextStart!=="s7D canonical 001"||
   hosting.nextStart!=="s7D canonical 001"||
   (status.execution.currentSet||"").toLowerCase()!=="s7d"||
   (prior.reviewedCardCount||0)!==0)throw Error("Unsafe s7D starting checkpoint");
if(proof.set!=="s7d"||proof.masterSetCardCount!==90||
   proof.canonicalCardsChecked!==90||proof.verifiedOwnedCdnImageCount!==90||
   proof.unavailableOwnedCdnImageCount!==0||proof.printedNumberMatchCount!==90||
   proof.koreanNameNonemptyCount!==90||proof.sourceRequestCount!==0||
   proof.cards?.length!==90||items.length!==90||reviews.some(x=>x.set!==CODE||
      x.all12ThemesInspected!==true||x.items?.length!==30)||
   JSON.stringify(c.koreanPrintExceptionNumbers)!==JSON.stringify(HELD)||
   (a.koreanPrintExceptionNumbers||[]).length>0||(b.koreanPrintExceptionNumbers||[]).length>0)
 throw Error("Incomplete Korean 90 artwork or foreign-print exception proof");
const gm=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of GROUPS)if(!Array.isArray(gm.get(t)?.cards))throw Error("Missing theme "+t);
const originalIds=set.cards.map(x=>x.code),counts={},issues=[];
overrides.sets??={};overrides.sets[currentCode]??={};
for(let i=0;i<TOTAL;i++){
 const n=i+1,id=String(n).padStart(3,"0"),key="S7D_"+id;
 const master=set.cards[i],p=proof.cards[i],r=items[i],expected="s7d_"+id+"/067";
 if(!p||!r||!master||p.canonicalOrder!==n||r.canonicalOrder!==n||r.cardKey!==key||
   String(master.code||"").toLowerCase()!==expected||p.masterCode.toLowerCase()!==expected||
   p.expectedPrintedNumber!==id+"/067"||!p.printedNumberMatches||
   p.name!==master.name||r.name!==master.name||!r.artObservation?.trim()||
   p.rawSource!==(master.sourceImage||master.image)||
   p.imageCheck?.status!=="decoded"||p.imageCheck.http!==200||
   p.imageCheck.format!=="WEBP"||p.imageCheck.dimensions?.[0]<200||
   p.imageCheck.dimensions?.[1]<250||
   !p.ownedCdnUrl.startsWith("https://dcb-card-images-")||
   (p.priorThemes||[]).length!==0)
  throw Error("Missing canonical s7D owned-artwork evidence "+n);
 const srcHost=new URL(p.rawSource).hostname;
 if(!["cards.image.pokemonkorea.co.kr","static.tcgexchange.kr"].includes(srcHost))
  throw Error("Untrusted origin image "+n);
 const assigned=new Set(r.matchedThemes);
 if(!assigned.has("color")||assigned.size!==r.matchedThemes.length||
   [...assigned].some(t=>!GROUPS.includes(t)||!r.categories?.[t]?.trim())||
   Object.keys(r.categories||{}).some(t=>!assigned.has(t)))
  throw Error("Missing manually reviewed category "+n);
 for(const t of GROUPS){
  const group=gm.get(t);
  if(group.cards.some(x=>String(x.code||"").toUpperCase()===key))
   throw Error("Existing theme card was unexpectedly present "+n+" "+t);
  if(!assigned.has(t))continue;
  const foreign=HELD.includes(n);
  group.cards.push({
   code:key,name:master.name,series:"S",set:currentCode,
   setName:set.displayName||"마천퍼펙트",cardNumber:id+"/067",rarity:master.rarity||"",
   category:r.categories[t],image:p.ownedCdnUrl,
   evidence:"한국판 마천퍼펙트 S7D "+id+"/067 일러스트 시트 검수: "+r.artObservation+
   (foreign?" (일본어 인쇄 임시 이미지: 한국어 인쇄판 실물사진 확보 전 완료 처리 금지)":"")
  });
  counts[t]=(counts[t]||0)+1;
 }
 if(!master.sourceImage)master.sourceImage=p.rawSource;
 master.image=p.ownedCdnUrl;
 if(HELD.includes(n)){
  master.koreanPrintImagePending=true;
  issues.push({code:master.code,name:master.name,issue:"Japanese-language image placeholder; Korean print not yet self-hosted"});
 }
 overrides.sets[currentCode][String(master.code).toLowerCase()]=p.ownedCdnUrl;
}
if(JSON.stringify(originalIds)!==JSON.stringify(set.cards.map(x=>x.code)))
 throw Error("Canonical identifiers were changed");
const expectedCounts={color:90,season:46,night:6,sunset:1,sleeping:1,street:3,food:1};
for(const [t,c]of Object.entries(expectedCounts))if(counts[t]!==c)throw Error("Wrong "+t+" review slots");
if(Object.keys(counts).length!==Object.keys(expectedCounts).length||
 Object.values(counts).reduce((a,b)=>a+b,0)!==148||issues.length!==3)
 throw Error("Miscount of independently reviewed image slots / foreign prints");
status.reviews[priorKey||currentCode]={...prior,status:"in_progress",reviewedAt:DATE,
 artworkReviewedCardCount:90,reviewedCardCount:87,
 verifiedSelfHostedImageCount:90,verifiedKoreanPrintImageCount:87,
 heldCards:HELD.map(n=>"s7d_"+n+"/067"),unresolvedImageIssues:issues,
 reviewedRanges:["001-090 (art complete; Korean 080-082 pending)"],
 reviewedThemes:GROUPS,newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+148,
 partialReviewEvidence:"data/audits/theme-s7d-061-090-Korean-art-review-20261015.json",
 archiveVerificationStatus:"90_owned_image_art_87_Korean_language_verified_3_Japanese_print_placeholders",
 nextStart:PENDING,
 note:"마천퍼펙트 90개 전 카드 아트·12테마 검수와 148 테마 슬롯 반영. 80,81,82번 일본어 인쇄 이미지 때문에 한국판 이미지 검수는 87/90. 외국판 사진을 한국판으로 오인하지 말 것."
};
status.execution.currentEra="S";status.execution.currentSet=currentCode;
status.execution.lastSafeCheckpoint="s7D artworks 001-090, Korean print scans 87/90 (missing 080,081,082)";
status.execution.nextStart=PENDING;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({task:8,set:currentCode,range:"canonical 001-090 Korean Sky Perfection",
 canonicalCardCount:90,artworkVisuallyVerifiedCount:90,artworkPendingCount:0,
 selfHostedReferenceCountAfter:90,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"90_owned_display_art_87_Korean_3_Japanese_placeholder",
 verifiedImageCount:90,unverifiedImageCount:0,brokenReferenceCount:0,
 koreanPrintImagesConfirmed:87,koreanPrintImagesPending:3,themeAdditions:counts,
 newlyInternalizedReferenceCount:90,nextStart:PENDING,
 note:"Three rainbow rare cards 080-082 are foreign print photos; Korean photos must be sourced."});
hosting.nextStart=PENDING;hosting.updatedAt=DATE;themes.updatedAt=DATE;
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
 save("data/audits/theme-series-review-status.json",status),
 save("data/audits/theme-image-selfhost-audit.json",hosting),
 save("data/audits/theme-s7d-001-090-progress-20261015.json",{
  schemaVersion:1,recordedAt:DATE,set:currentCode,status:"in_progress",
  totalMasterCards:90,artworkReviewed:90,verifiedKoreanPrintImages:87,
  ownedImagesVerified:90,pendingKoreanImages:issues.map(x=>x.code),
  remainingUnreviewedKoreanPrints:3,all12ThemesReviewed:true,
  newThemeSlotsThisBatch:counts,added:148,nextStart:PENDING,
  proof:"data/audits/theme-visual-evidence/s7d/001-090/visual-index.json",
  caution:"080,081,082 Korean print cards are known to exist, but display images show Japanese script and remain held."
 })
]);
console.log(JSON.stringify({set:currentCode,artworks:90,koreanPrints:87,
 themeAdded:148,pending:issues,next:PENDING}));
