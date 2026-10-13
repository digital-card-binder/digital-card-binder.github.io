import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,o)=>writeFile(p,JSON.stringify(o,null,2)+"\n");
const root="data/audits/";
const T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(root+"theme-sh-001-059-Korean-art-review-20261014.json"),
 read(root+"theme-visual-evidence/SH/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(root+"theme-series-review-status.json"),
 read(root+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const masters=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SH");
if(masters.length!==1||masters[0].cards?.length!==59)throw Error("SH master must have exactly 59 Korean canonical records");
const master=masters[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===59){console.log("SH already complete");process.exit(0);}
if(prior?.status==="complete"||(prior?.reviewedCardCount||0)>0||
 images.nextStart!=="SH canonical 001"||ev.set!=="SH"||ev.expectedCanonicalCards!==59||
 ev.officiallyNumberedCards!==53||ev.unnumberedBasicEnergyCards!==6||
 ev.items?.length!==59||ev.approvedKoreanPrintedImages!==59||
 ev.requiredExistingThemeSlotsPreserved!==1||
 index.cardCount!==59||index.cards?.length!==59||
 index.verificationCounts?.verified!==59||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0||
 JSON.stringify(index.existingThemeRecords)!==JSON.stringify({"SH_038":["sleeping"]})||
 JSON.stringify(ev.existingThemeRecords)!==JSON.stringify({"SH_038":["sleeping"]}))
 throw Error("SH full-set evidence or initial checkpoint mismatch: refuse unsafe changes");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing independent theme "+t);
const priorSlots=[];
for(const g of art.groups)for(const c of g.cards||[]){
 const id=String(c.code||"").toUpperCase();
 if(String(c.set||"").toUpperCase()==="SH"||/^SH_\d{3}$/.test(id))priorSlots.push({id,theme:g.code,card:c});
}
if(priorSlots.length!==1||priorSlots[0].id!=="SH_038"||priorSlots[0].theme!=="sleeping")
 throw Error("Existing SH themes changed; preserve instead of duplicating");
const energies=["기본 풀 에너지","기본 불꽃 에너지","기본 물 에너지","기본 번개 에너지","기본 격투 에너지","기본 악 에너지"];
overrides.sets??={};overrides.sets.sh??={};
let owned=0,added=0,preserved=0,energyCount=0,oldImagePointersPreserved=0;
const byTheme={};
for(let i=0;i<59;i++){
 const n=i+1,c=master.cards[i],p=index.cards[i],row=ev.items[i];
 const key="SH_"+String(n).padStart(3,"0");
 if(!c||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
 row.cardKey!==key||String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
 String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
 row.koreanName!==c.name||p.name!==c.name||row.ownedCDNUrl!==p.cdnUrl||
 row.proofImage!=="data/audits/theme-visual-evidence/SH/SH-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
 !row.imageInKorean||!row.all12ThemesInspected||!String(row.artObservation||"").trim()||
 !Array.isArray(row.matchedThemes)||new Set(row.matchedThemes).size!==row.matchedThemes.length||
 row.matchedThemes.some(t=>!T.includes(t))||
 p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
 !/^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\//.test(p.cdnUrl))
 throw Error("SH Korean artwork or own archive mismatch at "+n);
 if(n<=53){
  if(row.physicalPrintedNumber!==String(n).padStart(3,"0")+"/053"||row.syntheticIdentifierOnly||
    String(c.code)!=="sh_"+String(n).padStart(3,"0")+"/053")
   throw Error("Incorrect physical Korean SH number "+n);
 }else{
  if(row.physicalPrintedNumber!==null||!row.syntheticIdentifierOnly||
    row.koreanName!==energies[n-54]||
    String(c.code)!=="sh_"+String(n).padStart(3,"0")+"/053")
   throw Error("SH 054–059 basic energy identifiers are internal, not physically printed: "+n);
  energyCount++;
 }
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage){c.sourceImage=c.image;oldImagePointersPreserved++;}
  c.image=p.cdnUrl;
 }
 overrides.sets.sh[c.code.toLowerCase()]=p.cdnUrl;
 owned++;
 for(const t of row.matchedThemes){
  const existing=priorSlots.find(x=>x.id===key&&x.theme===t);
  if(existing){
   if(key!=="SH_038"||t!=="sleeping")throw Error("Unexpected duplicate SH art theme "+key);
   if(existing.card.image!==p.cdnUrl){
    if(existing.card.image&&!existing.card.sourceImage)existing.card.sourceImage=existing.card.image;
    existing.card.image=p.cdnUrl;
   }
   preserved++;continue;
  }
  const g=groups.get(t);
  g.cards.push({
    code:key,name:c.name,series:"S",set:master.code,setName:master.name,
    cardNumber:n>=54?"":c.code.split("_")[1],rarity:c.rarity||"",
    category:g.cards[0]?.category||g.name,image:p.cdnUrl,
    printedNumberStatus:n>=54?"unnumbered_energy_master_key_is_internal":undefined,
    evidence:"한국판 SH 카드 일러스트 12테마 전수검수: "+row.artObservation+
       ". 확인 시트 "+row.proofImage+
       (n>=54?" 무번호 기본 에너지, 내부 번호는 실물 인쇄번호 아님.":"")+
       " 자체 CDN 이용, 외부 원본 핫링크 없음."
  });
  added++;byTheme[t]=(byTheme[t]||0)+1;
 }
}
if(owned!==59||energyCount!==6||preserved!==1||added!==96)
 throw Error("SH original 59 cards, six energies, one preserved sleeping and 96 new slots required");
state.reviews??={};
state.reviews[master.code]={
 ...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:59,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:59,
 newlyAddedThemeSlotCount:added,priorThemeSlotsPreserved:preserved,
 KoreanEnergyPrintedIdentification:"054–059 are six unnumbered basic energies, not physically printed 054/053–059/053",
 fullSetEvidence:root+"theme-sh-001-059-Korean-art-review-20261014.json",
 archiveVerificationStatus:"59_Korean_own_CDN_images_decoded_and_12_themes_inspected",
 note:"SH 패밀리 카드 한국판 53장 인쇄번호와 무번호 기본 에너지 6장 확인. SH_038 잠만보 수면 도감 기존 기록 1건 보존. 자체 CDN 적용. 소유 상태 불변."
};
images.batches.push({
 task:6,set:"SH",range:"canonical 001-059 full Korean Family Card Game",canonicalCardCount:59,
 artworkVisuallyVerifiedCount:59,artworkPendingCount:0,
 selfHostedReferenceCountAfter:59,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"59_Korean_own_CDN_original_images_decoded",
 verifiedImageCount:59,unverifiedImageCount:0,brokenReferenceCount:0,
 unnumberedBasicEnergiesInternalKeysPreserved:6,priorThemeSlotsPreserved:1,themeAdditions:byTheme,
 nextStart:"SP5 canonical 001",
 note:"53 printed Korean numbers plus 6 unnumbered basic energies. Preserve existing SH_038 sleeping theme; no external origin image request."
});
images.nextStart="SP5 canonical 001";images.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"SH",status:"complete",
 KoreanMasterCards:59,actualPrintedNumberCards:53,unnumberedBasicEnergiesWithInternalKeys:6,
 KoreanArtVerified:59,ownedCdnImages:59,newThemeSlots:added,themesAdded:byTheme,
 priorThemeSlotsPreserved:preserved,
 initialArtworkAudit:root+"theme-visual-evidence/SH/visual-index.json",
 fullReviewEvidence:root+"theme-sh-001-059-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SP5 canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(root+"theme-series-review-status.json",state),
 save(root+"theme-image-selfhost-audit.json",images),
 save(root+"theme-sh-set-progress-20261014.json",report)
]);
console.log(JSON.stringify({set:"SH",cards:owned,newThemeSlots:added,preservedThemeSlots:preserved,themesAdded:byTheme,next:images.nextStart,ownershipStateChanges:0},null,2));
