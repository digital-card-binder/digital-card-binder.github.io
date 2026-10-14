import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-sll-001-022-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SLL/001-022/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
 read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SLL");
if(matches.length!==1||matches[0].cards?.length!==22)throw Error("SLL Korean master expected 22 cards");
const master=matches[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===22){
 console.log("SLL already complete; do not overwrite");process.exit(0);
}
if(prior?.status==="complete"||(prior?.reviewedCardCount||0)>0||
 images.nextStart!=="SLL canonical 001"||
 state.execution?.nextStart!=="SLL canonical 001"||
 ev.set!=="SLL"||ev.expectedCanonicalCards!==22||
 ev.physicallyNumberedCards!==21||ev.unnumberedBasicEnergyCards!==1||
 ev.internallyIndexedEnergyCanonicalOrder!==22||
 ev.items?.length!==22||ev.approvedKoreanImages!==22||
 ev.ownedCDNImagesDecoded!==22||ev.originImageRequests!==0||!ev.all12ThemesInspected||
 index.set!=="SLL"||index.cardCount!==22||index.masterSetCardCount!==22||
 index.cards?.length!==22||index.verificationCounts?.verified!==22||
 index.verificationCounts?.missing!==0||index.masterMissingKoreanNames!==0||
 index.sheets?.[0]?.file!=="SLL-001-022-01.webp.b64"||
 index.sheets?.[1]?.file!=="SLL-001-022-02.webp.b64")
 throw Error("SLL checkpoint / Korean artwork proof or own CDN invalid");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing independent theme "+t);
for(const g of art.groups)for(const c of g.cards||[]){
 if(String(c.set||"").toUpperCase()==="SLL"||/^SLL_\d{3}$/.test(String(c.code||"").toUpperCase()))
  throw Error("Existing SLL thematic evidence must not be overwritten: "+c.code+"/"+g.code);
}
overrides.sets??={};overrides.sets.sll??={};
const expectedSeason=new Set([1,2,3,7,8,9]);
let verified=0,addedCount=0,trainerEnergy=0,unprinted=0;const byTheme={};
for(let i=0;i<22;i++){
 const n=i+1,num=String(n).padStart(3,"0"),c=master.cards[i],p=index.cards[i],row=ev.items[i];
 if(!c||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  row.cardKey!=="SLL_"+num||String(c.code||"").toLowerCase()!=="sll_"+num+"/021"||
  String(p.masterCode).toLowerCase()!==c.code.toLowerCase()||
  String(row.masterCode).toLowerCase()!==c.code.toLowerCase()||
  row.koreanName!==c.name||p.name!==c.name||row.ownedCDNUrl!==p.cdnUrl||
  row.preExistingThemes?.length!==0||!row.imageInKorean||!row.all12ThemesInspected||
  !row.artObservation?.trim()||row.originalSourceRequests!==0||
  !Array.isArray(row.matchedThemes)||new Set(row.matchedThemes).size!==row.matchedThemes.length||
  row.proofImage!==A+"theme-visual-evidence/SLL/001-022/SLL-001-022-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
  p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
  throw Error("SLL printed Korean/card identity or owned CDN image mismatch at "+n);
 if(n===22){
  if(row.printedNumber!==null||!row.syntheticIdentifierOnly||
   c.name!=="기본 격투 에너지"||row.illustrationType!=="basic_energy"||
   row.matchedThemes.length!==0)throw Error("SLL final basic fighting energy is unnumbered Korean print");
  unprinted++;
 }else if(row.printedNumber!==num+"/021"||row.syntheticIdentifierOnly)
  throw Error("SLL physically printed 001/021 to 021/021 card number mismatch "+n);
 if(n<=10){
  if(row.illustrationType!=="pokemon"||
   row.matchedThemes?.join(",")!==(expectedSeason.has(n)?"season,color":"color")||
   !row.colorCategory)
   throw Error("SLL visual Pokémon theme proof mismatch "+n);
 }else{
  if(row.illustrationType==="pokemon"||row.matchedThemes.length)
   throw Error("Item/supporter or energy improperly assigned Pokémon-theme "+n);
  trainerEnergy++;
 }
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage)c.sourceImage=c.image;
  c.image=p.cdnUrl;
 }
 overrides.sets.sll[c.code.toLowerCase()]=p.cdnUrl;
 verified++;
 for(const t of row.matchedThemes){
  const g=groups.get(t);
  if(!g)throw Error("unknown art theme "+t);
  g.cards.push({
   code:row.cardKey,name:c.name,series:"S",set:master.code,setName:master.displayName||master.name,
   cardNumber:row.printedNumber||"",rarity:c.rarity||"",
   category:t==="color"?row.colorCategory:"계절·풍경",
   image:p.cdnUrl,
   evidence:"한국판 SLL "+(row.printedNumber||"무번호 기본 에너지")+
     " 원본 그림 12테마 검수: "+row.artObservation+
     ". 자체 CDN 원본 이미지 디코딩 확인 "+row.proofImage+
     "; 외부 원본 핫링크 없음."
  });
  addedCount++;byTheme[t]=(byTheme[t]||0)+1;
 }
}
if(verified!==22||unprinted!==1||trainerEnergy!==12||addedCount!==16||
 byTheme.color!==10||byTheme.season!==6||Object.keys(byTheme).length!==2||
 ev.themesAdded.color!==10||ev.themesAdded.season!==6)
 throw Error("SLL complete 22 images / 16 thematic slots / 1 unnumbered energy mismatch");
state.reviews??={};
state.reviews[master.code]={
 ...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:22,
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:22,
 newlyAddedThemeSlotCount:16,priorThemeSlotsPreserved:0,
 KoreanPhysicalNumberPolicy:"SLL 001/021–021/021 are printed, basic fighting energy card 22 uses internal canonical ID SLL_022 (not printed 022/021)",
 fullSetEvidence:A+"theme-sll-001-022-Korean-art-review-20261014.json",
 archiveVerificationStatus:"22_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 note:"한국판 스타터 세트 VSTAR 루카리오 22장 실제 그림 전수검수. 인쇄번호 21장과 무번호 기본 격투 에너지 1장 구분. 테마 16슬롯, 소유 기록 불변. 외부 원본 트래픽 0."};
state.execution.currentEra="S";state.execution.currentSet="SLD";
state.execution.lastSafeCheckpoint="SLL canonical 001-022 (22/22) Korean artwork and owned CDN verified; one energy unnumbered";
state.execution.nextStart="SLD canonical 001";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SLL",range:"canonical 001-022 full Korean Lucario VSTAR starter",
 canonicalCardCount:22,artworkVisuallyVerifiedCount:22,artworkPendingCount:0,
 selfHostedReferenceCountAfter:22,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"22_Korean_owned_CDN_images_decoded",
 verifiedImageCount:22,unverifiedImageCount:0,brokenReferenceCount:0,
 physicalNumberedCards:21,unnumberedBasicEnergiesInternalKeysPreserved:1,
 themeAdditions:byTheme,nextStart:"SLD canonical 001",
 note:"22 Korean cards visually inspected and decoded from DCB-owned CDN, no origin requests; physical energy numbering distinguished."});
images.nextStart="SLD canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"SLL",status:"complete",
 KoreanMasterCards:22,actualPrintedNumberCards:21,unnumberedEnergyInternalIdentifierCount:1,
 KoreanArtVerified:22,ownedCDNImagesVerified:22,themeSlotsAdded:16,
 byTheme,proof:A+"theme-visual-evidence/SLL/001-022/visual-index.json",
 fullSetEvidence:A+"theme-sll-001-022-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SLD canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-sll-set-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"SLL",status:"complete",KoreanCards:verified,ownedImages:22,
 themeSlotsAdded:addedCount,byTheme,unnumberedEnergy:unprinted,ownershipChanges:0,
 originRequests:0,next:images.nextStart}));
