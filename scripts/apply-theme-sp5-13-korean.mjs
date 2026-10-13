import{readFile,writeFile}from"node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const a="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(a+"theme-sp5-001-013-Korean-art-review-20261014.json"),
 read(a+"theme-visual-evidence/SP5/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(a+"theme-series-review-status.json"),
 read(a+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const results=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SP5");
if(results.length!==1||results[0].cards?.length!==13)throw Error("SP5 Korean starter master not 13");
const master=results[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===13){
 console.log("SP5 already complete");process.exit(0);
}
if(prior?.status==="complete"||prior?.reviewedCardCount>0||
 images.nextStart!=="SP5 canonical 001"||
 ev.set!=="SP5"||ev.expectedCanonicalCards!==13||
 ev.officiallyNumberedCards!==13||ev.unnumberedBasicEnergyCards!==0||
 ev.items?.length!==13||ev.approvedKoreanPrintedImages!==13||
 index.cardCount!==13||index.cards?.length!==13||
 index.verificationCounts?.verified!==13||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)
 throw Error("SP5 safe Korean set starting checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing separate art theme "+t);
const old=new Map();
for(const g of art.groups)for(const c of g.cards||[]){
 const id=String(c.code||"").toUpperCase();
 if(String(c.set||"").toUpperCase()==="SP5"||/^SP5_\d{3}$/.test(id)){
  const existing=old.get(id)||[];
  if(existing.includes(g.code))throw Error("Duplicate theme previously exists "+id);
  existing.push(g.code);old.set(id,existing);
 }
}
if(old.size!==0)throw Error("Unknown prior SP5 theme assignments must be preserved, not overwritten");
overrides.sets??={};overrides.sets["sp5"]??={};
let owned=0,added=0,unnumbered=0,previousSourcePreserved=0;const addedThemes={};
for(let i=0;i<13;i++){
 const c=master.cards[i],p=index.cards[i],row=ev.items[i],n=i+1;
 const key="SP5_"+String(n).padStart(3,"0");
 if(!c||!p||!row||row.canonicalOrder!==n||
    p.canonicalOrder!==n||row.cardKey!==key||
    String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
    String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
    c.name!==row.koreanName||c.name!==p.name||
    row.ownedCDNUrl!==p.cdnUrl||
    row.proofImage!=="data/audits/theme-visual-evidence/SP5/SP5-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
    !row.imageInKorean||!row.all12ThemesInspected||
    !String(row.artObservation||"").trim()||
    !Array.isArray(row.matchedThemes)||
    new Set(row.matchedThemes).size!==row.matchedThemes.length||
    row.matchedThemes.some(t=>!T.includes(t))||
    p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
    p.imageCheck?.format!=="WEBP"||
    (n<=12? p.imageCheck?.dimensions?.join(",")!==([[239,334],[240,334],[239,334],[240,335]][(n-1)%4].join(",")): p.imageCheck?.dimensions?.join(",")!=="420,586")||
    !/^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\//.test(p.cdnUrl))
  throw Error("Unmatched exact 13 Korean SP5 printed cards/own CDNs at canonical "+n);
 if(row.physicalPrintedNumber!==String(n).padStart(3,"0")+"/013"||
    row.syntheticIdentifierOnly||String(c.code)!=="sp5_"+String(n).padStart(3,"0")+"/013")
   throw Error("SP5 all 13 physical Korean panel/card numbers must be preserved "+key);
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage){c.sourceImage=c.image;previousSourcePreserved++;}
  c.image=p.cdnUrl;
 }
 overrides.sets["sp5"][c.code.toLowerCase()]=p.cdnUrl;
 owned++;
 for(const t of row.matchedThemes){
  const g=groups.get(t);
  g.cards.push({
   code:key,name:c.name,series:"S",set:master.code,setName:master.name,
   cardNumber:c.code.split("_")[1],rarity:c.rarity||"",
   category:g.cards[0]?.category||g.name,
   image:p.cdnUrl,
   printedNumberStatus:undefined,
   evidence:"한국판 SP5 카드 실물 일러스트 12테마 시각검수: "+row.artObservation+
      ". 확인 시트 "+row.proofImage+
      ""+
      " 자가 CDN, 외부 원본 핫링크 없음."
  });
  addedThemes[t]=(addedThemes[t]||0)+1;added++;
 }
}
if(owned!==13||unnumbered!==0||added!==26)throw Error("SP5 requires thirteen printed originals, twelve connected quadrants, one professor and 26 theme slots");
state.reviews??={};
state.reviews[master.code]={
 ...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:13,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:13,
 newlyAddedThemeSlotCount:added,priorThemeSlotsPreserved:0,
 KoreanEnergyPrintedIdentification:"All 13 physical Korean SP5 numbers 001/013–013/013; no synthetic unnumbered energy cards",
 fullSetEvidence:"data/audits/theme-sp5-001-013-Korean-art-review-20261014.json",
 archiveVerificationStatus:"13_Korean_owned_CDNBinaries_decoded_and_originals_artwork_reviewed",
 note:"SP5 한국판 3종 V-UNION의 12개 독립 인쇄번호 패널과 버넷박사 1장, 총 13장 자체 CDN 및 12테마 전수검수. connected 패널 연결성 보존. 수집 상태 불변."
};
images.batches.push({task:6,set:master.code,range:"canonical 001-013 full Korean three V-UNION four-panel artworks and Burnet",
 canonicalCardCount:13,artworkVisuallyVerifiedCount:13,artworkPendingCount:0,
 selfHostedReferenceCountAfter:13,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"13_Korean_own_CDN_original_images_decoded",
 verifiedImageCount:13,unverifiedImageCount:0,brokenReferenceCount:0,
 unnumberedBasicEnergiesInternalKeysPreserved:0,themeAdditions:addedThemes,
 nextStart:"S8a-P canonical 001",
 note:"Thirteen physically numbered Korean cards: three four-panel V-UNION connected illustrations plus Professor Burnet. No external origin traffic."});
images.nextStart="S8a-P canonical 001";images.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"SP5",status:"complete",
 KoreanMasterCards:13,actualPrintedNumberCards:13,
 unnumberedBasicEnergiesWithInternalKeys:0,
 KoreanArtVerified:13,ownedCdnImages:13,
 newThemeSlots:added,themesAdded:addedThemes,
 initialArtworkAudit:"data/audits/theme-visual-evidence/SP5/visual-index.json",
 fullReviewEvidence:"data/audits/theme-sp5-001-013-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,
 nextSafeStart:"S8a-P canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(a+"theme-series-review-status.json",state),
 save(a+"theme-image-selfhost-audit.json",images),
 save(a+"theme-sp5-set-progress-20261014.json",report)
]);
console.log(JSON.stringify({set:"SP5",approved:owned,themeSlots:added,byTheme:addedThemes,unnumbered,originDownloads:0,next:images.nextStart},null,2));
