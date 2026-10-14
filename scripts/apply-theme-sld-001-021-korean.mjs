import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-sld-001-021-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SLD/001-021/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
 read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SLD");
if(matches.length!==1||matches[0].cards?.length!==21)throw Error("SLD Korean master expected 21 cards");
const master=matches[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===21){
 console.log("SLD already complete; do not overwrite");process.exit(0);
}
if(prior?.status==="complete"||(prior?.reviewedCardCount||0)>0||
 images.nextStart!=="SLD canonical 001"||
 state.execution?.nextStart!=="SLD canonical 001"||
 ev.set!=="SLD"||ev.expectedCanonicalCards!==21||
 ev.physicallyNumberedCards!==20||ev.unnumberedBasicEnergyCards!==1||
 ev.internallyIndexedEnergyCanonicalOrder!==21||
 ev.items?.length!==21||ev.approvedKoreanImages!==21||
 ev.ownedCDNImagesDecoded!==21||ev.originImageRequests!==0||!ev.all12ThemesInspected||
 index.set!=="SLD"||index.cardCount!==21||index.masterSetCardCount!==21||
 index.cards?.length!==21||index.verificationCounts?.verified!==21||
 index.verificationCounts?.missing!==0||index.masterMissingKoreanNames!==0||
 index.sheets?.[0]?.file!=="SLD-001-021-01.webp.b64"||
 index.sheets?.[1]?.file!=="SLD-001-021-02.webp.b64")
 throw Error("SLD checkpoint / Korean artwork proof or own CDN invalid");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing independent theme "+t);
for(const g of art.groups)for(const c of g.cards||[]){
 if(String(c.set||"").toUpperCase()==="SLD"||/^SLD_\d{3}$/.test(String(c.code||"").toUpperCase()))
  throw Error("Existing SLD thematic evidence must not be overwritten: "+c.code+"/"+g.code);
}
overrides.sets??={};overrides.sets.sld??={};
const expectedSeason=new Set([2,3,4,5]);const expectedStreet=new Set([6]);
let verified=0,addedCount=0,trainerEnergy=0,unprinted=0;const byTheme={};
for(let i=0;i<21;i++){
 const n=i+1,num=String(n).padStart(3,"0"),c=master.cards[i],p=index.cards[i],row=ev.items[i];
 if(!c||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  row.cardKey!=="SLD_"+num||String(c.code||"").toLowerCase()!=="sld_"+num+"/020"||
  String(p.masterCode).toLowerCase()!==c.code.toLowerCase()||
  String(row.masterCode).toLowerCase()!==c.code.toLowerCase()||
  row.koreanName!==c.name||p.name!==c.name||row.ownedCDNUrl!==p.cdnUrl||
  row.preExistingThemes?.length!==0||!row.imageInKorean||!row.all12ThemesInspected||
  !row.artObservation?.trim()||row.originalSourceRequests!==0||
  !Array.isArray(row.matchedThemes)||new Set(row.matchedThemes).size!==row.matchedThemes.length||
  row.proofImage!==A+"theme-visual-evidence/SLD/001-021/SLD-001-021-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
  p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
  throw Error("SLD printed Korean/card identity or owned CDN image mismatch at "+n);
 if(n===21){
  if(row.printedNumber!==null||!row.syntheticIdentifierOnly||
   c.name!=="기본 악 에너지"||row.illustrationType!=="basic_energy"||
   row.matchedThemes.length!==0)throw Error("SLD final basic fighting energy is unnumbered Korean print");
  unprinted++;
 }else if(row.printedNumber!==num+"/020"||row.syntheticIdentifierOnly)
  throw Error("SLD physically printed 001/020 to 020/020 card number mismatch "+n);
 if(n<=10){
  if(row.illustrationType!=="pokemon"||
   row.matchedThemes?.join(",")!==(expectedSeason.has(n)?"season,color":expectedStreet.has(n)?"street,color":"color")||
   !row.colorCategory)
   throw Error("SLD visual Pokémon theme proof mismatch "+n);
 }else{
  if(row.illustrationType==="pokemon"||row.matchedThemes.length)
   throw Error("Item/supporter or energy improperly assigned Pokémon-theme "+n);
  trainerEnergy++;
 }
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage)c.sourceImage=c.image;
  c.image=p.cdnUrl;
 }
 overrides.sets.sld[c.code.toLowerCase()]=p.cdnUrl;
 verified++;
 for(const t of row.matchedThemes){
  const g=groups.get(t);
  if(!g)throw Error("unknown art theme "+t);
  g.cards.push({
   code:row.cardKey,name:c.name,series:"S",set:master.code,setName:master.displayName||master.name,
   cardNumber:row.printedNumber||"",rarity:c.rarity||"",
   category:t==="color"?row.colorCategory:"계절·풍경",
   image:p.cdnUrl,
   evidence:"한국판 SLD "+(row.printedNumber||"무번호 기본 에너지")+
     " 원본 그림 12테마 검수: "+row.artObservation+
     ". 자체 CDN 원본 이미지 디코딩 확인 "+row.proofImage+
     "; 외부 원본 핫링크 없음."
  });
  addedCount++;byTheme[t]=(byTheme[t]||0)+1;
 }
}
if(verified!==21||unprinted!==1||trainerEnergy!==11||addedCount!==15||
 byTheme.color!==10||byTheme.season!==4||byTheme.street!==1||Object.keys(byTheme).length!==3||
 ev.themesAdded.color!==10||ev.themesAdded.season!==4||ev.themesAdded.street!==1)
 throw Error("SLD complete 21 images / 15 thematic slots / 1 unnumbered energy mismatch");
state.reviews??={};
state.reviews[master.code]={
 ...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:21,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:21,
 newlyAddedThemeSlotCount:15,priorThemeSlotsPreserved:0,
 KoreanPhysicalNumberPolicy:"SLD 001/020–020/020 are printed, basic dark energy card 21 uses internal canonical ID SLD_021 (not printed 021/020)",
 fullSetEvidence:A+"theme-sld-001-021-Korean-art-review-20261014.json",
 archiveVerificationStatus:"22_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 note:"한국판 스타터 세트 VSTAR 다크라이 21장 실제 그림 전수검수. 인쇄번호 20장과 무번호 기본 악 에너지 1장 구분. 테마 15슬롯, 소유 기록 불변. 외부 원본 트래픽 0."};
state.execution.currentEra="S";state.execution.currentSet="SPZ";
state.execution.lastSafeCheckpoint="SLD canonical 001-021 (21/21) Korean artwork and owned CDN verified; one energy unnumbered";
state.execution.nextStart="SPZ canonical 001";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SLD",range:"canonical 001-021 full Korean Darkrai VSTAR starter",
 canonicalCardCount:21,artworkVisuallyVerifiedCount:21,artworkPendingCount:0,
 selfHostedReferenceCountAfter:21,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"22_Korean_owned_CDN_images_decoded",
 verifiedImageCount:21,unverifiedImageCount:0,brokenReferenceCount:0,
 physicalNumberedCards:20,unnumberedBasicEnergiesInternalKeysPreserved:1,
 themeAdditions:byTheme,nextStart:"SPZ canonical 001",
 note:"21 Korean cards visually inspected and decoded from DCB-owned CDN, no origin requests; physical energy numbering distinguished."});
images.nextStart="SPZ canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"SLD",status:"complete",
 KoreanMasterCards:21,actualPrintedNumberCards:20,unnumberedEnergyInternalIdentifierCount:1,
 KoreanArtVerified:21,ownedCDNImagesVerified:21,themeSlotsAdded:15,
 byTheme,proof:A+"theme-visual-evidence/SLD/001-021/visual-index.json",
 fullSetEvidence:A+"theme-sld-001-021-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SPZ canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-sld-set-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"SLD",status:"complete",KoreanCards:verified,ownedImages:21,
 themeSlotsAdded:addedCount,byTheme,unnumberedEnergy:unprinted,ownershipChanges:0,
 originRequests:0,next:images.nextStart}));
