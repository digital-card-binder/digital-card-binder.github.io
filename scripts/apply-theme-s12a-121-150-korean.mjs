import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,value)=>writeFile(p,JSON.stringify(value,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s12a-121-150-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s12a/121-150/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s12a");
if(sets.length!==1||sets[0].cards?.length!==262)throw Error("Missing the 262-slot Korean VSTAR Universe master");
const master=sets[0],prior=status.reviews?.[master.code],priorCodes=master.cards.map(c=>c.code);
if(prior?.reviewedCardCount>=150&&prior.reviewedRanges?.includes("121-150")){
 console.log("Already committed s12a 121-150; no duplicate write");process.exit(0);
}
if(prior?.status!=="in_progress"||prior.reviewedCardCount!==120||
 prior.reviewedRanges?.at(-1)!=="091-120"||
 prior.nextStart!=="s12a canonical 121"||
 prior.verifiedSelfHostedImageCount!==120||
 images.nextStart!=="s12a canonical 121"||
 status.execution?.nextStart!=="s12a canonical 121"||
 ev.set!=="s12a"||ev.expectedCanonicalCards!==262||
 ev.range!=="canonical-order 121-150"||ev.visuallyReviewedKoreanCards!==30||
 ev.verifiedOwnedCDNImages!==30||ev.originImageRequests!==0||
 !ev.all12ThemesInspected||ev.items?.length!==30||
 ev.themeSlotsThisBatch?.season!==4||ev.themeSlotsThisBatch?.color!==11||
 proof.set!=="s12a"||proof.cardCount!==30||
 proof.masterSetCardCount!==262||proof.canonicalRange!=="121-150"||
 proof.cards?.length!==30||proof.verificationCounts?.verified!==30||
 proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s12a-121-150-01.webp.b64"||
 proof.sheets[1].file!=="s12a-121-150-02.webp.b64")
 throw Error("Cannot advance past the safe 120-card checkpoint: evidence mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const theme of THEMES)if(!Array.isArray(groups.get(theme)?.cards))throw Error("Missing theme "+theme);
let previousSlots=0;
for(const g of art.groups)for(const card of g.cards||[]){
 const m=/^S12A_(\d{3})$/i.exec(String(card.code||""));
 if(!m)continue;
 if(+m[1]>=121&&+m[1]<=150)throw Error("Would duplicate pre-existing themed card "+card.code);
 previousSlots++;
}
if(previousSlots<188)throw Error("Previous Korean s12a art placements unexpectedly missing");
const scene=new Set([121,122,123,130]);
overrides.sets??={};overrides.sets.s12a??={};
let pokemonCount=0,trainerCount=0,slotCount=0;
const additions={};
for(let i=0;i<30;i++){
 const n=i+121,num=String(n).padStart(3,"0");
 const card=master.cards[n-1],p=proof.cards[i],row=ev.items[i];
 const isPokemon=n<=131;
 const expected=isPokemon?[...(scene.has(n)?["season"]:[]),"color"]:[];
 if(!card||!p||!row||p.canonicalOrder!==n||
  row.canonicalOrder!==n||card.code?.toLowerCase()!=="s12a_"+num+"/172"||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=="S12A_"+num||row.printedNumber!==num+"/172"||
  p.name!==card.name||row.koreanName!==card.name||!card.name?.trim()||
  row.illustrationType!==(isPokemon?"pokemon":"trainer")||
  row.matchedThemes?.join(",")!==expected.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||
  !row.artObservation?.trim()||row.originalSourceRequests!==0||
  row.preExistingThemes?.length!==0||p.existingThemes?.length!==0||
  p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
  p.imageCheck?.format!=="WEBP"||
  p.imageCheck?.dimensions?.join(",")!=="420,586"||
  row.decodedProof?.status!=="decoded"||
  row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s12a/121-150/s12a-121-150-"+String(Math.ceil((n-120)/15)).padStart(2,"0")+".webp.b64"||
  !p.cdnUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/"))
   throw Error("Korean image / artwork / master identity mismatch "+n);
 if(isPokemon)pokemonCount++;else trainerCount++;
 if(card.image!==p.cdnUrl){
  if(card.image&&!card.sourceImage)card.sourceImage=card.image;
  card.image=p.cdnUrl;
 }
 overrides.sets.s12a[card.code.toLowerCase()]=p.cdnUrl;
 for(const theme of expected){
  if(theme==="color"&&!row.colorCategory||theme==="season"&&!row.seasonCategory)
   throw Error("Missing classification category "+n);
  groups.get(theme).cards.push({
   code:row.cardKey,name:card.name,series:"S",set:master.code,
   setName:master.displayName||master.name,cardNumber:num+"/172",
   rarity:card.rarity||"",
   category:theme==="color"?row.colorCategory:row.seasonCategory,
   image:p.cdnUrl,
   evidence:"한국판 s12a "+num+"/172 12테마 그림 검수: "+row.artObservation+
    " 증빙 "+row.proofImage+"; DCB 소유 CDN WEBP 420x586 검증, 원본 외부 요청 없음."
  });
  additions[theme]=(additions[theme]||0)+1;slotCount++;
 }
}
if(master.cards.map(c=>c.code).join(",")!==priorCodes.join(",")||
 pokemonCount!==11||trainerCount!==19||slotCount!==15||
 additions.color!==11||additions.season!==4)
 throw Error("s12a 121-150 batch totals incorrect");
status.reviews[master.code]={...prior,status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:150,verifiedSelfHostedImageCount:150,
 reviewedRanges:[...prior.reviewedRanges,"121-150"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+slotCount,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s12a-121-150-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s12a_001-150_150_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s12a canonical 151",
 note:"한국판 VSTAR 유니버스 262장 중 001-150까지 실물 카드 12테마 검수. 이번 30장 그림/자체 CDN 확인; 포켓몬 11장에 컬러 11, 자연 풍경 4 추가; 트레이너 19장은 부적절한 포켓몬 테마에 넣지 않음. 모든 수집 키 유지."};
status.execution.currentEra="S";status.execution.currentSet="s12a";
status.execution.lastSafeCheckpoint="s12a canonical 001-150 (150/262) Korean artwork and 150 DCB-owned CDN images verified";
status.execution.nextStart="s12a canonical 151";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s12a",range:"canonical 121-150 Korean VSTAR Universe",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_DCB_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:30,legacyArchiveImages:0,trainerCardsExcludedFromPokemonThemes:19,
 themeAdditions:additions,nextStart:"s12a canonical 151",
 note:"30 printed Korean card images inspected on self-hosted CDN. Only 11 Pokémon artworks receive themes; no source-host download or ownership state changes."});
images.nextStart="s12a canonical 151";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s12a",status:"in_progress",
 totalMasterCards:262,reviewedCanonicalCards:150,remainingUnreviewed:112,
 KoreanArtVerified:150,ownedCDNImagesVerified:150,
 newlyAddedThisBatch:slotCount,totalNewThemeSlots:status.reviews[master.code].newlyAddedThemeSlotCount,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:30,legacyArchiveImages:0,trainerCardsExcluded:19,
 proof:A+"theme-visual-evidence/s12a/121-150/visual-index.json",
 visualReviewEvidence:A+"theme-s12a-121-150-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s12a canonical 151"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s12a-121-150-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s12a",reviewed:150,verifiedImages:150,
 pokemonCount,trainerCount,newThemeSlots:slotCount,additions,
 totalNewThemeSlots:status.reviews[master.code].newlyAddedThemeSlotCount,
 nextStart:images.nextStart}));
