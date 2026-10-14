import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s12a-001-030-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s12a/001-030/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s12a");
if(sets.length!==1||sets[0].cards?.length!==262)throw Error("Korean s12a 262-card master missing");
const master=sets[0],prior=status.reviews?.[master.code],oldCodes=master.cards.map(c=>c.code);
if(prior?.reviewedCardCount>=30&&prior.reviewedRanges?.includes("001-030")){
 console.log("s12a first 30 safely checkpointed already, do not overwrite");process.exit(0);
}
if((prior?.reviewedCardCount||0)!==0||prior?.status==="complete"||
 status.execution?.nextStart!=="s12a canonical 001"||
 images.nextStart!=="s12a canonical 001"||
 ev.set!=="s12a"||ev.expectedCanonicalCards!==262||ev.range!=="canonical-order 001-030"||
 ev.printedSetNumberTotal!==172||ev.visuallyReviewedKoreanCards!==30||
 ev.verifiedOwnedCDNImages!==30||ev.originImageRequests!==0||!ev.all12ThemesInspected||
 ev.items?.length!==30||ev.themeSlotsThisBatch?.season!==19||
 ev.themeSlotsThisBatch?.color!==30||proof.set!=="s12a"||
 proof.cardCount!==30||proof.masterSetCardCount!==262||
 proof.canonicalRange!=="001-030"||proof.cards?.length!==30||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s12a-001-030-01.webp.b64"||
 proof.sheets[1].file!=="s12a-001-030-02.webp.b64")
 throw Error("s12a Korean artwork checkpoint or image audit invariant failed");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const theme of THEMES)if(!Array.isArray(groups.get(theme)?.cards))throw Error("Missing theme: "+theme);
let existingOutsideBatch=0;
for(const group of art.groups)for(const row of group.cards||[]){
 const match=/^S12A_(\d{3})$/i.exec(String(row.code||""));
 if(match){
  if(+match[1]>=1&&+match[1]<=30)throw Error("Existing s12a 001-030 theme must be preserved, not duplicated");
  existingOutsideBatch++;
 }
}
const landscapes=new Set([1,2,3,4,6,7,8,9,10,11,12,15,16,23,24,25,26,29,30]);
overrides.sets??={};overrides.sets.s12a??={};
let checked=0,slots=0;const byTheme={};
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),c=master.cards[i],p=proof.cards[i],row=ev.items[i];
 const expected=[...(landscapes.has(n)?["season"]:[]),"color"];
 if(!c||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  c.code?.toLowerCase()!=="s12a_"+num+"/172"||
  p.masterCode?.toLowerCase()!==c.code?.toLowerCase()||
  row.masterCode?.toLowerCase()!==c.code?.toLowerCase()||
  row.cardKey!=="S12A_"+num||row.printedNumber!==num+"/172"||
  row.koreanName!==c.name||p.name!==c.name||!c.name?.trim()||
  row.illustrationType!=="pokemon"||row.preExistingThemes?.length!==0||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.matchedThemes?.join(",")!==expected.join(",")||
  !row.colorCategory||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s12a/001-030/s12a-001-030-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  p.existingThemes?.length!==0||p.imageCheck?.status!=="decoded"||
  p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
  p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !p.cdnUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/"))
  throw Error("s12a Korean artwork identity and CDN proof mismatch at "+n);
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage)c.sourceImage=c.image;c.image=p.cdnUrl;}
 overrides.sets.s12a[c.code.toLowerCase()]=p.cdnUrl;
 for(const theme of expected){
  const group=groups.get(theme);
  group.cards.push({
   code:row.cardKey,name:c.name,series:"S",set:master.code,
   setName:master.displayName||master.name,cardNumber:num+"/172",rarity:c.rarity||"",
   category:theme==="color"?row.colorCategory:row.seasonCategory||"계절·풍경",
   image:p.cdnUrl,
   evidence:"한국판 s12a "+num+"/172 실물 일러스트 12테마 전수 판독: "+row.artObservation+
   ". 확인 이미지 "+row.proofImage+"; 모던 자체 CDN 정상 디코딩, 외부 원본 요청 없음."
  });
  byTheme[theme]=(byTheme[theme]||0)+1;slots++;
 }
 checked++;
}
if(master.cards.map(c=>c.code).join(",")!==oldCodes.join(",")||
 checked!==30||slots!==49||byTheme.season!==19||byTheme.color!==30)
 throw Error("s12a first 30 card identity or thematic insertion count changed");
status.reviews??={};
status.reviews[master.code]={...prior,status:"in_progress",
 reviewedAt:"2026-10-14",reviewedCardCount:30,verifiedSelfHostedImageCount:30,
 reviewedRanges:["001-030"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:49,priorThemeSlotsPreserved:existingOutsideBatch,
 partialReviewEvidence:A+"theme-s12a-001-030-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s12a_001-030_30_Korean_modern_owned_CDN_images_decoded",
 nextStart:"s12a canonical 031",
 note:"한국판 VSTAR 유니버스 262장 중 001-030 일러스트 30장 실물 12테마 검수 및 자체 CDN 확인. 49개 테마 슬롯 추가. 기존 173번 이상 테마, 마스터 카드 키 및 사용자 수집정보 유지. 다음 031부터."};
status.execution.currentEra="S";status.execution.currentSet="s12a";
status.execution.lastSafeCheckpoint="s12a canonical 001-030 (30/262) Korean artworks and modern own CDN images verified";
status.execution.nextStart="s12a canonical 031";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s12a",range:"canonical 001-030 Korean VSTAR Universe partial",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_modern_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:byTheme,nextStart:"s12a canonical 031",
 note:"30 original numbered Korean s12a Pokémon artworks checked via user-owned modern CDN only. No origin fetch or ownership writes. Rest of 262-card set not complete."});
images.nextStart="s12a canonical 031";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s12a",status:"in_progress",
 totalMasterCards:262,reviewedCanonicalCards:30,remainingUnreviewed:232,
 KoreanArtVerified:30,ownedCDNImagesVerified:30,themeSlotsAddedThisBatch:49,
 byTheme,existingHighNumberThemeSlotsPreserved:existingOutsideBatch,
 proof:A+"theme-visual-evidence/s12a/001-030/visual-index.json",
 visualReviewEvidence:A+"theme-s12a-001-030-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s12a canonical 031"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s12a-001-030-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s12a",reviewed:checked,verifiedImageCount:30,
 themeSlotsAdded:slots,byTheme,originalThemeSlotsPreserved:existingOutsideBatch,
 next:images.nextStart,originalSourceRequests:0,ownershipStateChanges:0}));
