import{readFile,writeFile}from"node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const a="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(a+"theme-sj-001-032-Korean-art-review-20261014.json"),
 read(a+"theme-visual-evidence/SJ/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(a+"theme-series-review-status.json"),
 read(a+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const results=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SJ");
if(results.length!==1||results[0].cards?.length!==32)throw Error("SJ Korean starter master not 32");
const master=results[0],prior=state.reviews?.[master.code];
if(ev.physicallyVerifiedKoreanSecretPrintedNumbers?.join(",")!=="029/028,030/028"||!ev.secretNumberEvidence)throw Error("SJ secret print evidence absent");
if(prior?.status==="complete"&&prior.reviewedCardCount===32){
 console.log("SJ already complete");process.exit(0);
}
if(prior?.status==="complete"||prior?.reviewedCardCount>0||
 images.nextStart!=="SJ canonical 001"||
 ev.set!=="SJ"||ev.expectedCanonicalCards!==32||
 ev.officiallyNumberedCards!==30||ev.unnumberedBasicEnergyCards!==2||
 ev.items?.length!==32||ev.approvedKoreanPrintedImages!==32||
 index.cardCount!==32||index.cards?.length!==32||
 index.verificationCounts?.verified!==32||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)
 throw Error("SJ safe Korean set starting checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing separate art theme "+t);
const old=new Map();
for(const g of art.groups)for(const c of g.cards||[]){
 const id=String(c.code||"").toUpperCase();
 if(String(c.set||"").toUpperCase()==="SJ"||/^SJ_\d{3}$/.test(id)){
  const existing=old.get(id)||[];
  if(existing.includes(g.code))throw Error("Duplicate theme previously exists "+id);
  existing.push(g.code);old.set(id,existing);
 }
}
if(old.size!==0)throw Error("Unknown prior SJ theme assignments must be preserved, not overwritten");
overrides.sets??={};overrides.sets["sj"]??={};
let owned=0,added=0,unnumbered=0,previousSourcePreserved=0;const addedThemes={};
for(let i=0;i<32;i++){
 const c=master.cards[i],p=index.cards[i],row=ev.items[i],n=i+1;
 const key="SJ_"+String(n).padStart(3,"0");
 if(!c||!p||!row||row.canonicalOrder!==n||
    p.canonicalOrder!==n||row.cardKey!==key||
    String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
    String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
    c.name!==row.koreanName||c.name!==p.name||
    row.ownedCDNUrl!==p.cdnUrl||
    row.proofImage!=="data/audits/theme-visual-evidence/SJ/SJ-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
    !row.imageInKorean||!row.all12ThemesInspected||
    !String(row.artObservation||"").trim()||
    !Array.isArray(row.matchedThemes)||
    new Set(row.matchedThemes).size!==row.matchedThemes.length||
    row.matchedThemes.some(t=>!T.includes(t))||
    p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
    p.imageCheck?.format!=="WEBP"||
    p.imageCheck?.dimensions?.join(",")!=="420,586"||
    !/^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\//.test(p.cdnUrl))
  throw Error("Unmatched exact 32 Korean SJ printed cards/own CDNs at canonical "+n);
 if(n>=31){
  const expected=["기본 악 에너지","기본 강철 에너지"];
  if(row.physicalPrintedNumber!==null||
     !row.syntheticIdentifierOnly||row.koreanName!==expected[n-31]||
     String(c.code)!=="sj_"+String(n).padStart(3,"0")+"/028")
    throw Error("SJ energy 031–032 are unnumbered physical cards; numbered keys are internal only: "+n);
  unnumbered++;
 }else if((n===29||n===30)&&(!row.secretNumberPhysicallyVerified||!row.secretPrintedNumberEvidence))throw Error("SJ secret number physically unverified");
 else if(row.physicalPrintedNumber!==String(n).padStart(3,"0")+"/028"||
          row.syntheticIdentifierOnly)
   throw Error("Printed Korean SJ card number mismatch "+key);
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage){c.sourceImage=c.image;previousSourcePreserved++;}
  c.image=p.cdnUrl;
 }
 overrides.sets["sj"][c.code.toLowerCase()]=p.cdnUrl;
 owned++;
 for(const t of row.matchedThemes){
  const g=groups.get(t);
  g.cards.push({
   code:key,name:c.name,series:"S",set:master.code,setName:master.name,
   cardNumber:n>=31?"":c.code.split("_")[1],rarity:c.rarity||"",
   category:g.cards[0]?.category||g.name,
   image:p.cdnUrl,
   printedNumberStatus:n>=31?"unnumbered_energy_master_key_is_internal":undefined,
   evidence:"한국판 SJ 카드 실물 일러스트 12테마 시각검수: "+row.artObservation+
      ". 확인 시트 "+row.proofImage+
      (n>=31?" 무번호 기본 에너지, 내부 키는 인쇄번호 아님.":"")+
      " 자가 CDN, 외부 원본 핫링크 없음."
  });
  addedThemes[t]=(addedThemes[t]||0)+1;added++;
 }
}
if(owned!==32||unnumbered!==2)throw Error("SJ requires 30 numbered Korean cards and 2 unnumbered energies");
state.reviews??={};
state.reviews[master.code]={
 ...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:32,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:32,
 newlyAddedThemeSlotCount:added,priorThemeSlotsPreserved:0,
 KoreanEnergyPrintedIdentification:"SJ 029/028 & 030/028 are physically printed secret cards, 031/028 & 032/028 are internal unnumbered energy keys",
 fullSetEvidence:"data/audits/theme-sj-001-032-Korean-art-review-20261014.json",
 archiveVerificationStatus:"32_Korean_owned_CDNBinaries_decoded_and_originals_artwork_reviewed",
 note:"SJ 한국판 인쇄번호 카드 30장과 무번호 기본 에너지 2장, 비밀 번호 029/028 및 030/028 실제 인쇄 확인. 32장 자체 CDN 검증. 소유 상태 불변."
};
images.batches.push({task:6,set:master.code,range:"canonical 001-032 full Korean Zacian Zamazenta vs Eternatus 32 cards with two numbered secret rares",
 canonicalCardCount:32,artworkVisuallyVerifiedCount:32,artworkPendingCount:0,
 selfHostedReferenceCountAfter:32,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"32_Korean_own_CDN_original_images_decoded",
 verifiedImageCount:32,unverifiedImageCount:0,brokenReferenceCount:0,
 unnumberedBasicEnergiesInternalKeysPreserved:2,themeAdditions:addedThemes,
 nextStart:"S8a-G canonical 001",
 note:"30 numbered Korean cards including 029/028 and 030/028 secret rares, and two unnumbered basic energies. No offsite requests."});
images.nextStart="S8a-G canonical 001";images.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"SJ",status:"complete",
 KoreanMasterCards:32,actualPrintedNumberCards:30,
 unnumberedBasicEnergiesWithInternalKeys:2,
 KoreanArtVerified:32,ownedCdnImages:32,
 newThemeSlots:added,themesAdded:addedThemes,
 initialArtworkAudit:"data/audits/theme-visual-evidence/SJ/visual-index.json",
 fullReviewEvidence:"data/audits/theme-sj-001-032-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,
 nextSafeStart:"S8a-G canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(a+"theme-series-review-status.json",state),
 save(a+"theme-image-selfhost-audit.json",images),
 save(a+"theme-sj-set-progress-20261014.json",report)
]);
console.log(JSON.stringify({set:"SJ",approved:owned,themeSlots:added,byTheme:addedThemes,unnumbered,originDownloads:0,next:images.nextStart},null,2));
