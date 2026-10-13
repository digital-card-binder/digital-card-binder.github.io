import{readFile,writeFile}from"node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const a="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(a+"theme-sp3-001-006-Korean-art-review-20261014.json"),
 read(a+"theme-visual-evidence/SP3/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(a+"theme-series-review-status.json"),
 read(a+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const results=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SP3");
if(results.length!==1||results[0].cards?.length!==6)throw Error("SP3 Korean starter master not 6");
const master=results[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===6){
 console.log("SP3 already complete");process.exit(0);
}
if(prior?.status==="complete"||prior?.reviewedCardCount>0||
 images.nextStart!=="SP3 canonical 001"||
 ev.set!=="SP3"||ev.expectedCanonicalCards!==6||
 ev.officiallyNumberedCards!==6||ev.unnumberedBasicEnergyCards!==0||
 ev.items?.length!==6||ev.approvedKoreanPrintedImages!==6||
 index.cardCount!==6||index.cards?.length!==6||
 index.verificationCounts?.verified!==6||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)
 throw Error("SP3 safe Korean set starting checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing separate art theme "+t);
const old=new Map();
for(const g of art.groups)for(const c of g.cards||[]){
 const id=String(c.code||"").toUpperCase();
 if(String(c.set||"").toUpperCase()==="SP3"||/^SP3_\d{3}$/.test(id)){
  const existing=old.get(id)||[];
  if(existing.includes(g.code))throw Error("Duplicate theme previously exists "+id);
  existing.push(g.code);old.set(id,existing);
 }
}
if(old.size!==0)throw Error("Unknown prior SP3 theme assignments must be preserved, not overwritten");
overrides.sets??={};overrides.sets["sp3"]??={};
let owned=0,added=0,unnumbered=0,previousSourcePreserved=0;const addedThemes={};
for(let i=0;i<6;i++){
 const c=master.cards[i],p=index.cards[i],row=ev.items[i],n=i+1;
 const key="SP3_"+String(n).padStart(3,"0");
 if(!c||!p||!row||row.canonicalOrder!==n||
    p.canonicalOrder!==n||row.cardKey!==key||
    String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
    String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
    c.name!==row.koreanName||c.name!==p.name||
    row.ownedCDNUrl!==p.cdnUrl||
    row.proofImage!=="data/audits/theme-visual-evidence/SP3/SP3-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
    !row.imageInKorean||!row.all12ThemesInspected||
    !String(row.artObservation||"").trim()||
    !Array.isArray(row.matchedThemes)||
    new Set(row.matchedThemes).size!==row.matchedThemes.length||
    row.matchedThemes.some(t=>!T.includes(t))||
    p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
    p.imageCheck?.format!=="WEBP"||
    p.imageCheck?.dimensions?.join(",")!=="420,586"||
    !/^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\//.test(p.cdnUrl))
  throw Error("Unmatched exact 6 Korean SP3 printed cards/own CDNs at canonical "+n);
 if(row.physicalPrintedNumber!==String(n).padStart(3,"0")+"/006"||
    row.syntheticIdentifierOnly||String(c.code)!=="sp3_"+String(n).padStart(3,"0")+"/006")
   throw Error("SP3 all six cards must have actual Korean printed card numbers "+key);
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage){c.sourceImage=c.image;previousSourcePreserved++;}
  c.image=p.cdnUrl;
 }
 overrides.sets["sp3"][c.code.toLowerCase()]=p.cdnUrl;
 owned++;
 for(const t of row.matchedThemes){
  const g=groups.get(t);
  g.cards.push({
   code:key,name:c.name,series:"S",set:master.code,setName:master.name,
   cardNumber:c.code.split("_")[1],rarity:c.rarity||"",
   category:g.cards[0]?.category||g.name,
   image:p.cdnUrl,
   printedNumberStatus:undefined,
   evidence:"한국판 SP3 카드 실물 일러스트 12테마 시각검수: "+row.artObservation+
      ". 확인 시트 "+row.proofImage+
      ""+
      " 자가 CDN, 외부 원본 핫링크 없음."
  });
  addedThemes[t]=(addedThemes[t]||0)+1;added++;
 }
}
if(owned!==6||unnumbered!==0)throw Error("SP3 must contain six verified printed originals and zero unnumbered cards");
state.reviews??={};
state.reviews[master.code]={
 ...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:6,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:6,
 newlyAddedThemeSlotCount:added,priorThemeSlotsPreserved:0,
 KoreanEnergyPrintedIdentification:"All six SP3 Korean cards numbered 001/006–006/006 physically printed; no unnumbered energy",
 fullSetEvidence:"data/audits/theme-sp3-001-006-Korean-art-review-20261014.json",
 archiveVerificationStatus:"6_Korean_owned_CDNBinaries_decoded_and_originals_artwork_reviewed",
 note:"SP3 백은의 랜스·칠흑의 가이스트 BOX 한국판 6장 인쇄번호 카드 전수검수. 무번호 기본 에너지 없음. 이미지 자체 CDN 적용. 수집 상태 불변."
};
images.batches.push({task:6,set:master.code,range:"canonical 001-006 full Korean Calyrex special box art and print identity",
 canonicalCardCount:6,artworkVisuallyVerifiedCount:6,artworkPendingCount:0,
 selfHostedReferenceCountAfter:6,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"6_Korean_own_CDN_original_images_decoded",
 verifiedImageCount:6,unverifiedImageCount:0,brokenReferenceCount:0,
 unnumberedBasicEnergiesInternalKeysPreserved:0,themeAdditions:addedThemes,
 nextStart:"SGI canonical 001",
 note:"6 physically numbered Korean cards, zero unnumbered energy cards; 12 themes inspected against own CDN proof only."});
images.nextStart="SGI canonical 001";images.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"SP3",status:"complete",
 KoreanMasterCards:6,actualPrintedNumberCards:6,
 unnumberedBasicEnergiesWithInternalKeys:0,
 KoreanArtVerified:6,ownedCdnImages:6,
 newThemeSlots:added,themesAdded:addedThemes,
 initialArtworkAudit:"data/audits/theme-visual-evidence/SP3/visual-index.json",
 fullReviewEvidence:"data/audits/theme-sp3-001-006-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,
 nextSafeStart:"SGI canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(a+"theme-series-review-status.json",state),
 save(a+"theme-image-selfhost-audit.json",images),
 save(a+"theme-sp3-set-progress-20261014.json",report)
]);
console.log(JSON.stringify({set:"SP3",approved:owned,themeSlots:added,byTheme:addedThemes,unnumbered,originDownloads:0,next:images.nextStart},null,2));
