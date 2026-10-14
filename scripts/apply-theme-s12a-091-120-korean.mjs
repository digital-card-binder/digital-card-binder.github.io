import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s12a-091-120-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s12a/091-120/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s12a");
if(sets.length!==1||sets[0].cards?.length!==262)throw Error("Korean s12a 262-card master missing");
const master=sets[0],prior=status.reviews?.[master.code],priorCodes=master.cards.map(c=>c.code);
if(prior?.reviewedCardCount>=120&&prior.reviewedRanges?.includes("091-120")){
 console.log("s12a 091-120 already reviewed, do not overwrite");process.exit(0);
}
if(prior?.status!=="in_progress"||prior.reviewedCardCount!==90||
 prior.reviewedRanges?.at(-1)!=="061-090"||
 prior.nextStart!=="s12a canonical 091"||
 prior.verifiedSelfHostedImageCount!==90||
 images.nextStart!=="s12a canonical 091"||
 status.execution?.nextStart!=="s12a canonical 091"||
 ev.set!=="s12a"||ev.expectedCanonicalCards!==262||ev.range!=="canonical-order 091-120"||
 ev.visuallyReviewedKoreanCards!==30||ev.verifiedOwnedCDNImages!==30||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==30||
 ev.themeSlotsThisBatch?.season!==12||
 ev.themeSlotsThisBatch?.color!==30||ev.themeSlotsThisBatch?.street!==4||ev.themeSlotsThisBatch?.sunset!==1||
 ev.sourceArchiveBreakdown?.modern!==30||ev.sourceArchiveBreakdown?.legacy!==0||
 proof.set!=="s12a"||proof.cardCount!==30||proof.masterSetCardCount!==262||
 proof.canonicalRange!=="091-120"||proof.cards?.length!==30||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s12a-091-120-01.webp.b64"||
 proof.sheets[1].file!=="s12a-091-120-02.webp.b64")
 throw Error("s12a 091-120 checkpoint / Korean proofs mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const name of THEMES)if(!Array.isArray(groups.get(name)?.cards))throw Error("missing theme "+name);
let previousSlots=0;
for(const g of art.groups)for(const card of g.cards||[]){
 const m=/^S12A_(\d{3})$/i.exec(String(card.code||""));
 if(m){
  if(+m[1]>=91&&+m[1]<=120)throw Error("Theme already exists for s12a canonical 091-120: "+card.code+"/"+g.code);
  previousSlots++;
 }
}
if(previousSlots<49)throw Error("Prior s12a themed cards missing");
const scenery=new Set([91,92,93,97,98,104,112,113,114,118,119,120]),sunsets=new Set([95]),streets=new Set([94,95,96,112]);
overrides.sets??={};overrides.sets.s12a??={};
let count=0,slotCount=0,modernSeen=0,legacySeen=0;
const additions={};
for(let i=0;i<30;i++){
 const n=91+i,num=String(n).padStart(3,"0"),c=master.cards[n-1],p=proof.cards[i],row=ev.items[i];
 const expected=[...(scenery.has(n)?["season"]:[]),"color",...(sunsets.has(n)?["sunset"]:[]),...(streets.has(n)?["street"]:[])];
 const host=p.cdnUrl?.split("/")[2];
 if(!c||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  c.code?.toLowerCase()!=="s12a_"+num+"/172"||
  p.masterCode?.toLowerCase()!==c.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==c.code.toLowerCase()||
  row.cardKey!=="S12A_"+num||row.printedNumber!==num+"/172"||
  row.koreanName!==c.name||p.name!==c.name||!c.name?.trim()||
  row.illustrationType!=="pokemon"||row.preExistingThemes?.length!==0||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.matchedThemes?.join(",")!==expected.join(",")||
  !row.colorCategory||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s12a/091-120/s12a-091-120-"+String(Math.ceil((n-90)/15)).padStart(2,"0")+".webp.b64"||
  p.existingThemes?.length!==0||p.imageCheck?.status!=="decoded"||
  p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
  p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !["dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"].includes(host))
  throw Error("Korean s12a 091-120 artwork or owned CDN identity mismatch at "+n);
 if(host==="dcb-card-images-modern-2026.pages.dev")modernSeen++;else legacySeen++;
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage)c.sourceImage=c.image;c.image=p.cdnUrl;}
 overrides.sets.s12a[c.code.toLowerCase()]=p.cdnUrl;
 for(const theme of expected){
  groups.get(theme).cards.push({
   code:row.cardKey,name:c.name,series:"S",set:master.code,
   setName:master.displayName||master.name,cardNumber:num+"/172",rarity:c.rarity||"",
   category:theme==="color"?row.colorCategory:theme==="sunset"?row.sunsetCategory:
      theme==="street"?row.streetCategory:row.seasonCategory,
   image:p.cdnUrl,evidence:"한국판 s12a "+num+"/172 12테마 실제 일러스트 검수: "+
    row.artObservation+". 이미지 "+row.proofImage+"; DCB 보유 CDN 디코딩 성공, 외부 원본 요청 없음."
  });
  additions[theme]=(additions[theme]||0)+1;slotCount++;
 }
 count++;
}
if(master.cards.map(c=>c.code).join(",")!==priorCodes.join(",")||
 count!==30||slotCount!==47||modernSeen!==30||legacySeen!==0||
 additions.season!==12||additions.color!==30||additions.street!==4||additions.sunset!==1)
 throw Error("s12a second 30 cards / theme counts or archive routing mismatch");
status.reviews[master.code]={...prior,status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:120,verifiedSelfHostedImageCount:120,
 reviewedRanges:[...prior.reviewedRanges,"091-120"],
 reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:prior.newlyAddedThemeSlotCount+slotCount,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s12a-091-120-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s12a_001-120_120_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s12a canonical 121",
 note:"VSTAR 유니버스 262장 중 001-120 실물 검수. 이번 배치 30장 이미지 확인 후 47개 테마 분류 추가. 모든 이미지가 모던 보유 CDN에서 검증됨. 고번호 기존 테마·수집 정보 보존."};
status.execution.currentEra="S";status.execution.currentSet="s12a";
status.execution.lastSafeCheckpoint="s12a canonical 001-120 (120/262) Korean artwork and 120 DCB-owned CDN images verified";
status.execution.nextStart="s12a canonical 121";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s12a",range:"canonical 091-120 Korean VSTAR Universe",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_DCB_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:30,legacyArchiveImages:0,
 themeAdditions:additions,nextStart:"s12a canonical 121",
 note:"30 Korean cards reviewed using user-owned Cloudflare CDN; original third-party source hosts never requested. User collection unchanged."});
images.nextStart="s12a canonical 121";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s12a",status:"in_progress",
 totalMasterCards:262,reviewedCanonicalCards:120,remainingUnreviewed:142,
 KoreanArtVerified:120,ownedCDNImagesVerified:120,
 newlyAddedThisBatch:slotCount,totalNewThemeSlots:status.reviews[master.code].newlyAddedThemeSlotCount,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:30,legacyArchiveImages:0,
 proof:A+"theme-visual-evidence/s12a/091-120/visual-index.json",
 visualReviewEvidence:A+"theme-s12a-091-120-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s12a canonical 121"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s12a-091-120-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s12a",reviewed:120,verifiedImages:120,addedThisBatch:slotCount,
 totalNewSlots:status.reviews[master.code].newlyAddedThemeSlotCount,
 additions,priorThemeSlotsPreserved:previousSlots,originDownloads:0,next:images.nextStart}));
