import{readFile,writeFile}from"node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const a="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(a+"theme-s8a-p-001-025-Korean-art-review-20261014.json"),
 read(a+"theme-visual-evidence/S8a-P/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(a+"theme-series-review-status.json"),
 read(a+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const results=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="S8A-P");
if(results.length!==1||results[0].cards?.length!==25)throw Error("S8a-P Korean starter master not 25");
const master=results[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===25){
 console.log("S8a-P already complete");process.exit(0);
}
if(prior?.status==="complete"||prior?.reviewedCardCount>0||
 images.nextStart!=="S8a-P canonical 001"||
 ev.set!=="S8a-P"||ev.expectedCanonicalCards!==25||
 ev.officiallyNumberedCards!==25||ev.unnumberedBasicEnergyCards!==0||
 ev.items?.length!==25||ev.approvedKoreanPrintedImages!==25||
 index.cardCount!==25||index.cards?.length!==25||
 index.verificationCounts?.verified!==25||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)
 throw Error("S8a-P safe Korean set starting checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing separate art theme "+t);
const old=new Map();
for(const g of art.groups)for(const c of g.cards||[]){
 const id=String(c.code||"").toUpperCase();
 if(String(c.set||"").toUpperCase()==="S8A-P"||/^S8A-P_\d{3}$/.test(id)){
  const existing=old.get(id)||[];
  if(existing.includes(g.code))throw Error("Duplicate theme previously exists "+id);
  existing.push(g.code);old.set(id,existing);
 }
}
if(old.size!==0)throw Error("Unknown prior S8a-P theme assignments must be preserved, not overwritten");
overrides.sets??={};overrides.sets["s8a-p"]??={};
let owned=0,added=0,unnumbered=0,previousSourcePreserved=0;const addedThemes={};
for(let i=0;i<25;i++){
 const c=master.cards[i],p=index.cards[i],row=ev.items[i],n=i+1;
 const key="S8a-P_"+String(n).padStart(3,"0");
 if(!c||!p||!row||row.canonicalOrder!==n||
    p.canonicalOrder!==n||row.cardKey!==key||
    String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
    String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
    c.name!==row.koreanName||c.name!==p.name||
    row.ownedCDNUrl!==p.cdnUrl||
    row.proofImage!=="data/audits/theme-visual-evidence/S8a-P/S8a-P-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
    !row.imageInKorean||!row.all12ThemesInspected||
    !String(row.artObservation||"").trim()||
    !Array.isArray(row.matchedThemes)||
    new Set(row.matchedThemes).size!==row.matchedThemes.length||
    row.matchedThemes.some(t=>!T.includes(t))||
    p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
    p.imageCheck?.format!=="WEBP"||
    !(n===16?p.imageCheck?.dimensions?.join(",")==="286,400":(p.imageCheck?.dimensions?.[0]===420&&p.imageCheck?.dimensions?.[1]>=580&&p.imageCheck?.dimensions?.[1]<=610))||
    !/^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\//.test(p.cdnUrl))
  throw Error("Unmatched exact 25 Korean S8a-P printed cards/own CDNs at canonical "+n);
 if(row.physicalPrintedNumber!==String(n).padStart(3,"0")+"/025"||
    row.syntheticIdentifierOnly||String(c.code)!=="s8a-p_"+String(n).padStart(3,"0")+"/025")
   throw Error("25th Anniversary Korean promo printed identity mismatch "+key);
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage){c.sourceImage=c.image;previousSourcePreserved++;}
  c.image=p.cdnUrl;
 }
 overrides.sets["s8a-p"][c.code.toLowerCase()]=p.cdnUrl;
 owned++;
 for(const t of row.matchedThemes){
  const g=groups.get(t);
  g.cards.push({
   code:key,name:c.name,series:"S",set:master.code,setName:master.name,
   cardNumber:c.code.split("_")[1],rarity:c.rarity||"",
   category:g.cards[0]?.category||g.name,
   image:p.cdnUrl,
   printedNumberStatus:undefined,
   evidence:"한국판 S8a-P 카드 실물 일러스트 12테마 시각검수: "+row.artObservation+
      ". 확인 시트 "+row.proofImage+
      ""+
      " 자가 CDN, 외부 원본 핫링크 없음."
  });
  addedThemes[t]=(addedThemes[t]||0)+1;added++;
 }
}
if(owned!==25||unnumbered!==0||added!==36)throw Error("Korean S8a-P requires 25 printed original cards and 36 distinct theme slots");
state.reviews??={};
state.reviews[master.code]={
 ...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:25,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:25,
 newlyAddedThemeSlotCount:added,priorThemeSlotsPreserved:0,
 KoreanEnergyPrintedIdentification:"All 25 Korean 25th Anniversary promo cards physically numbered 001/025–025/025; no basic energy extras",
 fullSetEvidence:"data/audits/theme-s8a-p-001-025-Korean-art-review-20261014.json",
 archiveVerificationStatus:"25_Korean_owned_CDNBinaries_decoded_and_originals_artwork_reviewed",
 note:"한국판 25주년 프로모 카드 팩 001/025–025/025 전수검수. 레트로 카드 프레임 및 각 25주년 로고 확인. 자체 CDN 이미지 적용, 수집 상태 불변."
};
images.batches.push({task:6,set:master.code,range:"canonical 001-025 full Korean 25th Anniversary promo artworks and printed identity",
 canonicalCardCount:25,artworkVisuallyVerifiedCount:25,artworkPendingCount:0,
 selfHostedReferenceCountAfter:25,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"25_Korean_own_CDN_original_images_decoded",
 verifiedImageCount:25,unverifiedImageCount:0,brokenReferenceCount:0,
 unnumberedBasicEnergiesInternalKeysPreserved:0,themeAdditions:addedThemes,
 nextStart:"SJ canonical 001",
 note:"25 numbered Korean 25th Anniversary promo artworks. Decoded own-CDN archive only, zero external-origin image requests."});
images.nextStart="SJ canonical 001";images.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"S8a-P",status:"complete",
 KoreanMasterCards:25,actualPrintedNumberCards:25,
 unnumberedBasicEnergiesWithInternalKeys:0,
 KoreanArtVerified:25,ownedCdnImages:25,
 newThemeSlots:added,themesAdded:addedThemes,
 initialArtworkAudit:"data/audits/theme-visual-evidence/S8a-P/visual-index.json",
 fullReviewEvidence:"data/audits/theme-s8a-p-001-025-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,
 nextSafeStart:"SJ canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(a+"theme-series-review-status.json",state),
 save(a+"theme-image-selfhost-audit.json",images),
 save(a+"theme-s8a-p-set-progress-20261014.json",report)
]);
console.log(JSON.stringify({set:"S8a-P",approved:owned,themeSlots:added,byTheme:addedThemes,unnumbered,originDownloads:0,next:images.nextStart},null,2));
