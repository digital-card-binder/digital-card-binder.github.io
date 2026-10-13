import{readFile,writeFile}from"node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const a="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(a+"theme-sp4-001-008-Korean-art-review-20261014.json"),
 read(a+"theme-visual-evidence/SP4/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(a+"theme-series-review-status.json"),
 read(a+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const results=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SP4");
if(results.length!==1||results[0].cards?.length!==8)throw Error("SP4 Korean starter master not 8");
const master=results[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===8){
 console.log("SP4 already complete");process.exit(0);
}
if(prior?.status==="complete"||prior?.reviewedCardCount>0||
 images.nextStart!=="SP4 canonical 001"||
 ev.set!=="SP4"||ev.expectedCanonicalCards!==8||
 ev.officiallyNumberedCards!==4||ev.unnumberedBasicEnergyCards!==4||
 ev.items?.length!==8||ev.approvedKoreanPrintedImages!==8||
 index.cardCount!==8||index.cards?.length!==8||
 index.verificationCounts?.verified!==8||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)
 throw Error("SP4 safe Korean set starting checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing separate art theme "+t);
const old=new Map();
for(const g of art.groups)for(const c of g.cards||[]){
 const id=String(c.code||"").toUpperCase();
 if(String(c.set||"").toUpperCase()==="SP4"||/^SP4_\d{3}$/.test(id)){
  const existing=old.get(id)||[];
  if(existing.includes(g.code))throw Error("Duplicate theme previously exists "+id);
  existing.push(g.code);old.set(id,existing);
 }
}
if(old.size!==0)throw Error("Unknown prior SP4 theme assignments must be preserved, not overwritten");
overrides.sets??={};overrides.sets["sp4"]??={};
let owned=0,added=0,unnumbered=0,previousSourcePreserved=0;const addedThemes={};
for(let i=0;i<8;i++){
 const c=master.cards[i],p=index.cards[i],row=ev.items[i],n=i+1;
 const key="SP4_"+String(n).padStart(3,"0");
 if(!c||!p||!row||row.canonicalOrder!==n||
    p.canonicalOrder!==n||row.cardKey!==key||
    String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
    String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
    c.name!==row.koreanName||c.name!==p.name||
    row.ownedCDNUrl!==p.cdnUrl||
    row.proofImage!=="data/audits/theme-visual-evidence/SP4/SP4-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
    !row.imageInKorean||!row.all12ThemesInspected||
    !String(row.artObservation||"").trim()||
    !Array.isArray(row.matchedThemes)||
    new Set(row.matchedThemes).size!==row.matchedThemes.length||
    row.matchedThemes.some(t=>!T.includes(t))||
    p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
    p.imageCheck?.format!=="WEBP"||
    p.imageCheck?.dimensions?.join(",")!=="420,586"||
    !/^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\//.test(p.cdnUrl))
  throw Error("Unmatched exact 8 Korean SP4 printed cards/own CDNs at canonical "+n);
 if(n>=5){
  const expected=["기본 불꽃 에너지","기본 물 에너지","기본 번개 에너지","기본 초 에너지"];
  if(row.physicalPrintedNumber!==null||
     !row.syntheticIdentifierOnly||row.koreanName!==expected[n-5]||
     String(c.code)!=="sp4_"+String(n).padStart(3,"0")+"/004")
    throw Error("SP4 energy 005–008 are unnumbered physical cards; numbered keys are internal only: "+n);
  unnumbered++;
 }else if(row.physicalPrintedNumber!==String(n).padStart(3,"0")+"/004"||
          row.syntheticIdentifierOnly)
   throw Error("Printed Korean SP4 card number mismatch "+key);
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage){c.sourceImage=c.image;previousSourcePreserved++;}
  c.image=p.cdnUrl;
 }
 overrides.sets["sp4"][c.code.toLowerCase()]=p.cdnUrl;
 owned++;
 for(const t of row.matchedThemes){
  const g=groups.get(t);
  g.cards.push({
   code:key,name:c.name,series:"S",set:master.code,setName:master.name,
   cardNumber:n>=5?"":c.code.split("_")[1],rarity:c.rarity||"",
   category:g.cards[0]?.category||g.name,
   image:p.cdnUrl,
   printedNumberStatus:n>=5?"unnumbered_energy_master_key_is_internal":undefined,
   evidence:"한국판 SP4 카드 실물 일러스트 12테마 시각검수: "+row.artObservation+
      ". 확인 시트 "+row.proofImage+
      (n>=5?" 무번호 기본 에너지, 내부 키는 인쇄번호 아님.":"")+
      " 자가 CDN, 외부 원본 핫링크 없음."
  });
  addedThemes[t]=(addedThemes[t]||0)+1;added++;
 }
}
if(owned!==8||unnumbered!==4)throw Error("Eight originals and four unnumbered energies did not match Korean master");
state.reviews??={};
state.reviews[master.code]={
 ...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:8,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:8,
 newlyAddedThemeSlotCount:added,priorThemeSlotsPreserved:0,
 KoreanEnergyPrintedIdentification:"5th–8th cards are four unnumbered basic energies; 005/004–008/004 are internal master keys, not physically printed IDs",
 fullSetEvidence:"data/audits/theme-sp4-001-008-Korean-art-review-20261014.json",
 archiveVerificationStatus:"8_Korean_owned_CDNBinaries_decoded_and_originals_artwork_reviewed",
 note:"SP4 VMAX 스페셜 세트 「이브이 히어로즈」 한국판 4장 인쇄번호 카드와 무번호 기본 에너지 4장, 총 8장 12테마 검수 및 자체 CDN 적용. 수집 상태 불변."
};
images.batches.push({task:6,set:master.code,range:"canonical 001-008 full Korean VMAX Special Set 8 cards and four unnumbered energies",
 canonicalCardCount:8,artworkVisuallyVerifiedCount:8,artworkPendingCount:0,
 selfHostedReferenceCountAfter:8,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"8_Korean_own_CDN_original_images_decoded",
 verifiedImageCount:8,unverifiedImageCount:0,brokenReferenceCount:0,
 unnumberedBasicEnergiesInternalKeysPreserved:4,themeAdditions:addedThemes,
 nextStart:"SH canonical 001",
 note:"4 printed Korean card numbers + four genuinely unnumbered basic energies. 12 independent themes inspected; no offsite image requests."});
images.nextStart="SH canonical 001";images.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"SP4",status:"complete",
 KoreanMasterCards:8,actualPrintedNumberCards:4,
 unnumberedBasicEnergiesWithInternalKeys:4,
 KoreanArtVerified:8,ownedCdnImages:8,
 newThemeSlots:added,themesAdded:addedThemes,
 initialArtworkAudit:"data/audits/theme-visual-evidence/SP4/visual-index.json",
 fullReviewEvidence:"data/audits/theme-sp4-001-008-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,
 nextSafeStart:"SH canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(a+"theme-series-review-status.json",state),
 save(a+"theme-image-selfhost-audit.json",images),
 save(a+"theme-sp4-set-progress-20261014.json",report)
]);
console.log(JSON.stringify({set:"SP4",approved:owned,themeSlots:added,byTheme:addedThemes,unnumbered,originDownloads:0,next:images.nextStart},null,2));
