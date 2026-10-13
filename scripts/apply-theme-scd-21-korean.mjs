import{readFile,writeFile}from"node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const a="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(a+"theme-scd-001-021-Korean-art-review-20261014.json"),
 read(a+"theme-visual-evidence/SCD/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(a+"theme-series-review-status.json"),
 read(a+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const results=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SCD");
if(results.length!==1||results[0].cards?.length!==21)throw Error("SCD Korean starter master not 21");
const master=results[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===21){
 console.log("SCD already complete");process.exit(0);
}
if(prior?.status==="complete"||prior?.reviewedCardCount>0||
 images.nextStart!=="SCD canonical 001"||
 ev.set!=="SCD"||ev.expectedCanonicalCards!==21||
 ev.officiallyNumberedCards!==20||ev.unnumberedBasicEnergyCards!==1||
 ev.items?.length!==21||ev.approvedKoreanPrintedImages!==21||
 index.cardCount!==21||index.cards?.length!==21||
 index.verificationCounts?.verified!==21||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)
 throw Error("SCD safe Korean set starting checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing separate art theme "+t);
const old=new Map();
for(const g of art.groups)for(const c of g.cards||[]){
 const id=String(c.code||"").toUpperCase();
 if(String(c.set||"").toUpperCase()==="SCD"||/^SCD_\d{3}$/.test(id)){
  const existing=old.get(id)||[];
  if(existing.includes(g.code))throw Error("Duplicate theme previously exists "+id);
  existing.push(g.code);old.set(id,existing);
 }
}
if(old.size!==0)throw Error("Unknown prior SCD theme assignments must be preserved, not overwritten");
overrides.sets??={};overrides.sets["scd"]??={};
let owned=0,added=0,unnumbered=0,previousSourcePreserved=0;const addedThemes={};
for(let i=0;i<21;i++){
 const c=master.cards[i],p=index.cards[i],row=ev.items[i],n=i+1;
 const key="SCD_"+String(n).padStart(3,"0");
 if(!c||!p||!row||row.canonicalOrder!==n||
    p.canonicalOrder!==n||row.cardKey!==key||
    String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
    String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
    c.name!==row.koreanName||c.name!==p.name||
    row.ownedCDNUrl!==p.cdnUrl||
    row.proofImage!=="data/audits/theme-visual-evidence/SCD/SCD-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
    !row.imageInKorean||!row.all12ThemesInspected||
    !String(row.artObservation||"").trim()||
    !Array.isArray(row.matchedThemes)||
    new Set(row.matchedThemes).size!==row.matchedThemes.length||
    row.matchedThemes.some(t=>!T.includes(t))||
    p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
    p.imageCheck?.format!=="WEBP"||
    p.imageCheck?.dimensions?.join(",")!=="420,586"||
    !/^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\//.test(p.cdnUrl))
  throw Error("Unmatched exact 21 Korean SCD printed cards/own CDNs at canonical "+n);
 if(n===21){
  if(row.physicalPrintedNumber!==null||
     !row.syntheticIdentifierOnly||row.koreanName!=="기본 악 에너지"||
     String(c.code)!=="scd_021/020")
    throw Error("Do not claim synthetic dark energy 021/020 is physically printed");
  unnumbered++;
 }else if(row.physicalPrintedNumber!==String(n).padStart(3,"0")+"/020"||
          row.syntheticIdentifierOnly)
   throw Error("Printed Korean SCD card number mismatch "+key);
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage){c.sourceImage=c.image;previousSourcePreserved++;}
  c.image=p.cdnUrl;
 }
 overrides.sets["scd"][c.code.toLowerCase()]=p.cdnUrl;
 owned++;
 for(const t of row.matchedThemes){
  const g=groups.get(t);
  g.cards.push({
   code:key,name:c.name,series:"S",set:master.code,setName:master.name,
   cardNumber:n===21?"":c.code.split("_")[1],rarity:c.rarity||"",
   category:g.cards[0]?.category||g.name,
   image:p.cdnUrl,
   printedNumberStatus:n===21?"unnumbered_energy_master_key_is_internal":undefined,
   evidence:"한국판 SCD 카드 실물 일러스트 12테마 시각검수: "+row.artObservation+
      ". 확인 시트 "+row.proofImage+
      (n===21?" 무번호 기본 악 에너지, 내부 키는 인쇄번호 아님.":"")+
      " 자가 CDN, 외부 원본 핫링크 없음."
  });
  addedThemes[t]=(addedThemes[t]||0)+1;added++;
 }
}
if(owned!==21||unnumbered!==1)throw Error("21 accepted Korean and one unnumbered energy not confirmed");
state.reviews??={};
state.reviews[master.code]={
 ...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:21,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:21,
 newlyAddedThemeSlotCount:added,priorThemeSlotsPreserved:0,
 KoreanEnergyPrintedIdentification:"21st card is unnumbered dark energy; 021/020 only internal master key",
 fullSetEvidence:"data/audits/theme-scd-001-021-Korean-art-review-20261014.json",
 archiveVerificationStatus:"21_Korean_owned_CDNBinaries_decoded_and_originals_artwork_reviewed",
 note:"SCD 오롱털 VMAX 스타터 20장 인쇄번호 카드와 무번호 악 에너지 1장, 총 21장 한국판 그림 12테마 전수검수. 이미지 자체 CDN 적용. 수집 상태 불변."
};
images.batches.push({task:6,set:master.code,range:"canonical 001-021 full Korean Grimmsnarl VMAX starter art and print identity",
 canonicalCardCount:21,artworkVisuallyVerifiedCount:21,artworkPendingCount:0,
 selfHostedReferenceCountAfter:21,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"21_Korean_own_CDN_original_images_decoded",
 verifiedImageCount:21,unverifiedImageCount:0,brokenReferenceCount:0,
 unnumberedDarkEnergyInternalKeyPreserved:1,themeAdditions:addedThemes,
 nextStart:"SCR canonical 001",
 note:"20 printed Korean card numbers + 1 genuinely unnumbered basic dark energy. 12 independent themes inspected; no offsite image requests."});
images.nextStart="SCR canonical 001";images.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"SCD",status:"complete",
 KoreanMasterCards:21,actualPrintedNumberCards:20,
 unnumberedBasicDarkEnergyWithInternalKey:1,
 KoreanArtVerified:21,ownedCdnImages:21,
 newThemeSlots:added,themesAdded:addedThemes,
 initialArtworkAudit:"data/audits/theme-visual-evidence/SCD/visual-index.json",
 fullReviewEvidence:"data/audits/theme-scd-001-021-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,
 nextSafeStart:"SCR canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(a+"theme-series-review-status.json",state),
 save(a+"theme-image-selfhost-audit.json",images),
 save(a+"theme-scd-set-progress-20261014.json",report)
]);
console.log(JSON.stringify({set:"SCD",approved:owned,themeSlots:added,byTheme:addedThemes,unnumbered,originDownloads:0,next:images.nextStart},null,2));
