import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const ADD={173:["season"],174:["street"],175:["season"],176:["street"],177:[],178:["color"],179:["night","color"],180:["season"]};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s12a-151-180-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s12a/151-180/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s12a");
if(sets.length!==1||sets[0].cards?.length!==262)throw Error("Expected 262 Korean s12a slots");
const master=sets[0],prev=status.reviews?.[master.code],codesBefore=master.cards.map(x=>x.code);
if(prev?.reviewedCardCount>=180&&prev.reviewedRanges?.includes("151-180")){console.log("Already reviewed 151-180");process.exit(0);}
if(prev?.status!=="in_progress"||prev.reviewedCardCount!==150||
 prev.reviewedRanges?.at(-1)!=="121-150"||prev.nextStart!=="s12a canonical 151"||
 prev.verifiedSelfHostedImageCount!==150||
 status.execution?.nextStart!=="s12a canonical 151"||
 images.nextStart!=="s12a canonical 151"||
 ev.set!=="s12a"||ev.expectedCanonicalCards!==262||
 ev.range!=="canonical-order 151-180"||
 ev.visuallyReviewedKoreanCards!==30||ev.verifiedOwnedCDNImages!==30||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==30||
 ev.newThemeSlotsThisBatch?.season!==3||ev.newThemeSlotsThisBatch?.street!==2||
 ev.newThemeSlotsThisBatch?.color!==2||ev.newThemeSlotsThisBatch?.night!==1||
 proof.set!=="s12a"||proof.cardCount!==30||proof.masterSetCardCount!==262||
 proof.canonicalRange!=="151-180"||proof.cards?.length!==30||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s12a-151-180-01.webp.b64"||
 proof.sheets[1].file!=="s12a-151-180-02.webp.b64")
 throw Error("Prior completed s12a 150 checkpoint / 151-180 image evidence mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const theme of THEMES)if(!Array.isArray(groups.get(theme)?.cards))throw Error("Missing theme "+theme);
const current=new Map();
let previousSlots=0;
for(const g of art.groups)for(const c of g.cards||[]){
 const m=/^S12A_(\d{3})$/i.exec(String(c.code||""));
 if(!m)continue;
 previousSlots++;
 if(+m[1]>=151&&+m[1]<=180){
  const list=current.get(+m[1])||[];
  list.push(g.code);current.set(+m[1],list);
 }
}
if(previousSlots<246)throw Error("Older s12a theme cards lost");
overrides.sets??={};overrides.sets.s12a??={};
let trainerCount=0,pokemonCount=0,addedCount=0,preservedCount=0;
const additions={};
for(let i=0;i<30;i++){
 const n=i+151,num=String(n).padStart(3,"0"),pokemon=n>=173;
 const c=master.cards[n-1],p=proof.cards[i],row=ev.items[i];
 const priorThemes=(current.get(n)||[]).slice().sort();
 const verifiedPrior=(p.existingThemes||[]).slice().sort();
 const newThemes=ADD[n]||[];
 const fullThemes=[...new Set([...verifiedPrior,...newThemes])].sort();
 if(!c||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  c.code?.toLowerCase()!=="s12a_"+num+"/172"||
  p.masterCode?.toLowerCase()!==c.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==c.code.toLowerCase()||
  row.cardKey!=="S12A_"+num||row.printedNumber!==num+"/172"||
  p.name!==c.name||row.koreanName!==c.name||!c.name?.trim()||
  row.illustrationType!==(pokemon?"pokemon":"trainer_or_energy")||
  row.preExistingThemes?.slice().sort().join(",")!==verifiedPrior.join(",")||
  priorThemes.join(",")!==verifiedPrior.join(",")||
  row.newlyMatchedThemes?.join(",")!==newThemes.join(",")||
  row.matchedThemes?.slice().sort().join(",")!==fullThemes.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s12a/151-180/s12a-151-180-"+String(Math.ceil((n-150)/15)).padStart(2,"0")+".webp.b64"||
  row.decodedProof?.status!=="decoded"||
  p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
  p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !p.cdnUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/"))
 throw Error("Korean s12a 151-180 master identity, preserved slots or proof mismatch "+n);
 if(pokemon)pokemonCount++;else trainerCount++;
 preservedCount+=verifiedPrior.length;
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage)c.sourceImage=c.image;c.image=p.cdnUrl;}
 overrides.sets.s12a[c.code.toLowerCase()]=p.cdnUrl;
 for(const t of newThemes){
  const category=t==="color"?row.colorCategory:t==="season"?row.seasonCategory:t==="night"?row.nightCategory:row.streetCategory;
  if(!category||verifiedPrior.includes(t))throw Error("Invalid or duplicate new theme "+n+"/"+t);
  groups.get(t).cards.push({
    code:row.cardKey,name:c.name,series:"S",set:master.code,
    setName:master.displayName||master.name,
    cardNumber:num+"/172",rarity:c.rarity||"",
    category,image:p.cdnUrl,
    evidence:"한국판 s12a "+num+"/172 일러스트 재검수: "+row.artObservation+
     " 기존 테마 보존; "+row.proofImage+"; DCB CDN WEBP 디코딩, 외부 원본 미요청."
  });
  additions[t]=(additions[t]||0)+1;addedCount++;
 }
}
if(master.cards.map(x=>x.code).join(",")!==codesBefore.join(",")||
 trainerCount!==22||pokemonCount!==8||addedCount!==8||
 additions.season!==3||additions.street!==2||additions.color!==2||additions.night!==1||
 preservedCount!==13)
 throw Error("s12a 151-180 review or theme record integrity failure");
status.reviews[master.code]={...prev,status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:180,verifiedSelfHostedImageCount:180,
 reviewedRanges:[...prev.reviewedRanges,"151-180"],
 reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prev.newlyAddedThemeSlotCount||0)+addedCount,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s12a-151-180-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s12a_001-180_180_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s12a canonical 181",
 note:"한국판 VSTAR 유니버스 262장 중 001-180까지 실제 카드와 12테마 검수. 이번 AR 8장의 기존 13건 유지하고 풍경 3·거리 2·컬러 2·밤 1 추가. 트레이너 22장은 포켓몬 테마에서 제외. 수집 원본 변경 없음."};
status.execution.currentEra="S";status.execution.currentSet="s12a";
status.execution.lastSafeCheckpoint="s12a canonical 001-180 (180/262) Korean artwork and 180 DCB-owned CDN images verified";
status.execution.nextStart="s12a canonical 181";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s12a",range:"canonical 151-180 Korean VSTAR Universe",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_DCB_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:30,legacyArchiveImages:0,pokemonCardsWithPreservedThemes:8,
 priorThemeSlotsPreserved:preservedCount,trainerStadiumAndEnergyCardsExcluded:22,
 themeAdditions:additions,nextStart:"s12a canonical 181",
 note:"All 30 Korean prints decoded and artwork checked. AR existing placements retained and 8 evidence-backed new category slots added; no external requests."});
images.nextStart="s12a canonical 181";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s12a",status:"in_progress",
 totalMasterCards:262,reviewedCanonicalCards:180,remainingUnreviewed:82,
 KoreanArtVerified:180,ownedCDNImagesVerified:180,
 newlyAddedThisBatch:addedCount,totalNewThemeSlots:status.reviews[master.code].newlyAddedThemeSlotCount,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:30,legacyArchiveImages:0,
 existingARThemeSlotsKept:preservedCount,trainerStadiumAndEnergyCardsExcluded:22,
 proof:A+"theme-visual-evidence/s12a/151-180/visual-index.json",
 visualReviewEvidence:A+"theme-s12a-151-180-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s12a canonical 181"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s12a-151-180-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s12a",reviewed:180,verifiedImages:180,
 pokemonCount,trainerCount,existingThemeSlotsKept:preservedCount,
 newThemeSlots:addedCount,additions,nextStart:images.nextStart}));
