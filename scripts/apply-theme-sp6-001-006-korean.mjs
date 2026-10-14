import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async (p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const themes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,proof,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-sp6-001-006-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SP6/001-006/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
 read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const entries=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()==="SP6");
if(entries.length!==1||entries[0].cards?.length!==6)throw Error("SP6 Korean master must contain six cards");
const master=entries[0],prior=state.reviews?.[master.code];
if(prior?.status==="complete"&&prior.reviewedCardCount===6){
 console.log("SP6 already complete, keep verified data");process.exit(0);
}
if(prior?.status==="complete"||(prior?.reviewedCardCount||0)>0||
 images.nextStart!=="SP6 canonical 001"||
 state.execution?.nextStart!=="SP6 canonical 001"||
 ev.set!=="SP6"||ev.expectedCanonicalCards!==6||
 ev.physicallyNumberedCards!==6||ev.unnumberedBasicEnergyCards!==0||
 ev.approvedKoreanImages!==6||ev.ownedCDNImagesDecoded!==6||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==6||
 proof.set!=="SP6"||proof.cardCount!==6||proof.masterSetCardCount!==6||
 proof.canonicalRange!=="001-006"||proof.cards?.length!==6||
 proof.verificationCounts?.verified!==6||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||
 proof.sheets?.[0]?.file!=="SP6-001-006-01.webp.b64")
 throw Error("SP6 checkpoint or owned Korean image proofs invalid");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of themes)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing theme "+t);
for(const g of art.groups)for(const c of g.cards||[])if(
 String(c.set||"").toUpperCase()==="SP6"||
 /^SP6_\d{3}$/.test(String(c.code||"").toUpperCase()))
 throw Error("SP6 theme already exists, do not duplicate "+c.code+"/"+g.code);
overrides.sets??={};overrides.sets.sp6??={};
let checked=0,added=0;
for(let i=0;i<6;i++){
 const n=i+1,num=String(n).padStart(3,"0"),c=master.cards[i],row=ev.items[i],p=proof.cards[i];
 if(!c||!row||!p||row.canonicalOrder!==n||p.canonicalOrder!==n||
  String(c.code||"").toLowerCase()!=="sp6_"+num+"/006"||
  row.masterCode?.toLowerCase()!==c.code.toLowerCase()||
  p.masterCode?.toLowerCase()!==c.code.toLowerCase()||
  row.cardKey!=="SP6_"+num||row.printedNumber!==num+"/006"||
  row.koreanName!==c.name||p.name!==c.name||
  row.ownedCDNUrl!==p.cdnUrl||row.preExistingThemes?.length!==0||
  row.illustrationType!=="pokemon"||!row.imageInKorean||!row.all12ThemesInspected||
  !row.artObservation?.trim()||row.matchedThemes?.join(",")!=="color"||
  !row.colorCategory||row.originalSourceRequests!==0||
  row.proofImage!==A+"theme-visual-evidence/SP6/001-006/SP6-001-006-01.webp.b64"||
  p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
  p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
  throw Error("SP6 card artwork and exact Korean printed number mismatch "+n);
 if(c.image!==p.cdnUrl){
  if(c.image&&!c.sourceImage)c.sourceImage=c.image;
  c.image=p.cdnUrl;
 }
 overrides.sets.sp6[c.code.toLowerCase()]=p.cdnUrl;
 groups.get("color").cards.push({
  code:row.cardKey,name:c.name,series:"S",set:master.code,setName:master.displayName||master.name,
  cardNumber:num+"/006",rarity:c.rarity||"",category:row.colorCategory,
  image:p.cdnUrl,
  evidence:"한국판 SP6 "+num+"/006 일러스트 12테마 시각검수: "+row.artObservation+
  ". 소유 CDN 이미지 디코딩 증빙 "+row.proofImage+"; 외부 이미지 원본 다운로드 없음."
 });
 checked++;added++;
}
if(checked!==6||added!==6||ev.themesAdded.color!==6||
 Object.keys(ev.themesAdded).length!==1)throw Error("SP6 six Korean card and color assignment invariant failed");
state.reviews??={};
state.reviews[master.code]={...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:6,
 reviewedThemes:themes,heldCards:[],verifiedSelfHostedImageCount:6,
 newlyAddedThemeSlotCount:6,priorThemeSlotsPreserved:0,
 fullSetEvidence:A+"theme-sp6-001-006-Korean-art-review-20261014.json",
 archiveVerificationStatus:"6_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 note:"한국판 VSTAR 스페셜 세트 6/6 실물 인쇄번호 및 12테마 시각검수 완료. 여섯 V/VSTAR 모두 컬러 테마. 외부 원본 요청 및 수집 상태 변경 없음."};
state.execution.currentEra="S";state.execution.currentSet="SO";
state.execution.lastSafeCheckpoint="SP6 canonical 001-006 (6/6) Korean art and own CDN images verified";
state.execution.nextStart="SO canonical 001";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SP6",range:"canonical 001-006 Korean VSTAR Special Set",
 canonicalCardCount:6,artworkVisuallyVerifiedCount:6,artworkPendingCount:0,
 selfHostedReferenceCountAfter:6,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"6_Korean_owned_CDN_images_decoded",
 verifiedImageCount:6,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:{color:6},nextStart:"SO canonical 001",
 note:"Six physically numbered Korean V and VSTAR cards. No third-party original image requests. Collection unchanged."});
images.nextStart="SO canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"SP6",status:"complete",
 KoreanMasterCards:6,actualPrintedNumberCards:6,
 KoreanArtVerified:6,ownedCDNImagesVerified:6,themeSlotsAdded:6,
 byTheme:{color:6},proof:A+"theme-visual-evidence/SP6/001-006/visual-index.json",
 fullSetEvidence:A+"theme-sp6-001-006-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SO canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-sp6-set-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"SP6",KoreanCards:checked,ownedImages:6,themeSlotsAdded:6,
 originRequests:0,ownershipChanges:0,next:images.nextStart}));
