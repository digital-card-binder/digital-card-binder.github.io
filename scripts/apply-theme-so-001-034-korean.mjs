import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async (p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-so-001-034-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SO/001-034/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
 read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const matches=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()==="SO");
if(matches.length!==1||matches[0].cards?.length!==34)throw Error("SO Korean master expected 34 cards");
const master=matches[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===34){
 console.log("SO already complete; preserve all Korean cards and collection records");process.exit(0);
}
if(prior?.status==="complete"||(prior?.reviewedCardCount||0)>0||
 images.nextStart!=="SO canonical 001"||
 state.execution?.nextStart!=="SO canonical 001"||
 ev.set!=="SO"||ev.expectedCanonicalCards!==34||
 ev.physicallyNumberedCards!==30||ev.unnumberedBasicEnergyCards!==4||
 ev.internalCanonicalEnergies?.join(",")!=="31,32,33,34"||
 ev.approvedKoreanImages!==34||ev.ownedCDNImagesDecoded!==34||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==34||
 index.set!=="SO"||index.cardCount!==34||index.masterSetCardCount!==34||
 index.canonicalRange!=="001-034"||index.cards?.length!==34||
 index.verificationCounts?.verified!==34||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0||index.sheets?.length!==3||
 index.sheets?.[0]?.file!=="SO-001-034-01.webp.b64"||
 index.sheets?.[1]?.file!=="SO-001-034-02.webp.b64"||
 index.sheets?.[2]?.file!=="SO-001-034-03.webp.b64")
 throw Error("SO checkpoint, Korean proof, or owned CDN invariant mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing thematic group "+t);
for(const g of art.groups)for(const c of g.cards||[]){
 if(String(c.set||"").toUpperCase()==="SO"||/^SO_\d{3}$/.test(String(c.code||"").toUpperCase()))
 throw Error("Preserve pre-existing SO theme instead of duplicate: "+c.code+"/"+g.code);
}
const landscape=new Set([3,4,5,8,9,10,12,13,14]);
const energyNames=["기본 불꽃 에너지","기본 번개 에너지","기본 불꽃 에너지","기본 번개 에너지"];
overrides.sets??={};overrides.sets.so??={};
let verified=0,numbered=0,unnumbered=0,notPokemon=0,added=0;
const byTheme={};
for(let i=0;i<34;i++){
 const n=i+1,num=String(n).padStart(3,"0");
 const c=master.cards[i],p=index.cards[i],row=ev.items[i];
 if(!c||!p||!row||row.canonicalOrder!==n||p.canonicalOrder!==n||
 String(c.code||"").toLowerCase()!=="so_"+num+"/030"||
 row.masterCode?.toLowerCase()!==c.code.toLowerCase()||
 p.masterCode?.toLowerCase()!==c.code.toLowerCase()||
 row.cardKey!=="SO_"+num||row.koreanName!==c.name||p.name!==c.name||
 row.ownedCDNUrl!==p.cdnUrl||row.preExistingThemes?.length!==0||
 !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
 row.originalSourceRequests!==0||!Array.isArray(row.matchedThemes)||
 new Set(row.matchedThemes).size!==row.matchedThemes.length||
 row.proofImage!==A+"theme-visual-evidence/SO/001-034/SO-001-034-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
 p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
 !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
 throw Error("SO Korean print or image identity mismatch at "+n);
 if(n<=30){
  if(row.printedNumber!==num+"/030"||row.syntheticIdentifierOnly)
   throw Error("SO printed numbered 001-030 mismatch at "+n);
  numbered++;
 } else {
  if(row.printedNumber!==null||!row.syntheticIdentifierOnly||
    c.name!==energyNames[n-31]||row.illustrationType!=="basic_energy"||
    row.matchedThemes.length)
   throw Error("SO unnumbered basic energy internal-key mismatch at "+n);
  unnumbered++;
 }
 if(n<=16){
  const expected=landscape.has(n)?"season,color":"color";
  if(row.illustrationType!=="pokemon"||row.matchedThemes.join(",")!==expected||
     !row.colorCategory)throw Error("SO Pokémon art theme evidence mismatch "+n);
 }else{
  if(row.illustrationType==="pokemon"||row.matchedThemes.length)
   throw Error("SO non-Pokémon-supporter/energy/stadium should not be tagged "+n);
  notPokemon++;
 }
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage)c.sourceImage=c.image;
  c.image=p.cdnUrl;
 }
 overrides.sets.so[c.code.toLowerCase()]=p.cdnUrl;
 verified++;
 for(const theme of row.matchedThemes){
  if(!T.includes(theme))throw Error("unknown theme "+theme);
  groups.get(theme).cards.push({
   code:row.cardKey,name:c.name,series:"S",set:master.code,
   setName:master.displayName||master.name,
   cardNumber:row.printedNumber||"",rarity:c.rarity||"",
   category:theme==="color"?row.colorCategory:"계절·풍경",
   image:p.cdnUrl,
   evidence:"한국판 SO "+num+"/030 원본 일러스트 12테마 시각검수: "+row.artObservation+
   ". 사용자 소유 CDN 정상 디코딩 및 증빙 "+row.proofImage+"; 외부 원본 핫링크 없음."
  });
  byTheme[theme]=(byTheme[theme]||0)+1;added++;
 }
}
if(verified!==34||numbered!==30||unnumbered!==4||notPokemon!==18||added!==25||
 byTheme.color!==16||byTheme.season!==9||Object.keys(byTheme).length!==2||
 ev.themesAdded.color!==16||ev.themesAdded.season!==9)
 throw Error("SO strict 34 Korean images / four unnumbered energies / 25 theme slots mismatch");
state.reviews??={};
state.reviews[master.code]={...prior,status:"complete",reviewedAt:"2026-10-14",
 reviewedCardCount:34,reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:34,
 newlyAddedThemeSlotCount:25,priorThemeSlotsPreserved:0,
 KoreanPhysicalNumberPolicy:"SO 001/030–030/030 physically numbered, SO_031..SO_034 are four separate unnumbered basic energy internal slots",
 fullSetEvidence:A+"theme-so-001-034-Korean-art-review-20261014.json",
 archiveVerificationStatus:"34_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 note:"한국판 리자몽 VSTAR VS 레쿠쟈 VMAX 스페셜 덱 34장 전수검수. 실제 인쇄번호 30장과 무번호 에너지 4장 유지, 16장 포켓몬 그림 25개 테마 슬롯 검수. 기존 수집 정보 불변, 원본 외부 요청 0."};
state.execution.currentEra="S";state.execution.currentSet="sD";
state.execution.lastSafeCheckpoint="SO canonical 001-034 (34/34) Korean artwork and owned CDN images checked, four unnumbered energies";
state.execution.nextStart="sD canonical 001";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SO",range:"canonical 001-034 Korean Charizard VSTAR vs Rayquaza VMAX decks",
 canonicalCardCount:34,artworkVisuallyVerifiedCount:34,artworkPendingCount:0,
 selfHostedReferenceCountAfter:34,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"34_Korean_owned_CDN_images_decoded",
 verifiedImageCount:34,unverifiedImageCount:0,brokenReferenceCount:0,
 physicallyNumberedCards:30,unnumberedBasicEnergiesInternalKeysPreserved:4,
 themeAdditions:byTheme,nextStart:"sD canonical 001",
 note:"34 exact Korean cards, including four distinct internal slots for unnumbered basic energies. No third-party image origin calls and collection data unchanged."});
images.nextStart="sD canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"SO",status:"complete",
 KoreanMasterCards:34,actualPrintedNumberCards:30,
 unnumberedBasicEnergyInternalIdentifierCount:4,
 KoreanArtVerified:34,ownedCDNImagesVerified:34,themeSlotsAdded:25,
 byTheme,proof:A+"theme-visual-evidence/SO/001-034/visual-index.json",
 fullSetEvidence:A+"theme-so-001-034-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"sD canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-so-set-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"SO",reviewed:verified,images:34,
 themeSlots:added,byTheme,unnumbered,originalRequests:0,ownershipChanges:0,next:images.nextStart}));
