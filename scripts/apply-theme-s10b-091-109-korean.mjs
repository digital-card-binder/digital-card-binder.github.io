import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const proof=await read(A+"theme-visual-evidence/s10b/091-109/visual-index.json");
const ev=await read(A+"theme-s10b-091-109-Korean-art-review-20261014.json");
const [modern,legacy,art,status,images,overrides]=await Promise.all([
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const master=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s10b");
if(master.length!==1||master[0].cards.length!==109)throw Error("S10b Korean 109-card master mismatch");
const group=master[0],prior=status.reviews[group.code],originalCodes=group.cards.map(c=>c.code);
if(prior?.reviewedRanges?.includes("091-101")&&prior?.reviewedCardCount>=101){console.log("Already committed 091-101; eight energy cards remain evidence holds");process.exit(0);}
if(prior?.reviewedCardCount!==90||!prior.reviewedRanges?.includes("061-090")||
 status.execution?.nextStart!=="s10b canonical 091"||images.nextStart!=="s10b canonical 091"||
 ev.set!=="s10b"||ev.range!=="canonical-order 091-109"||ev.strictlyReviewedRange!=="091-101"||
 ev.visuallyReviewedKoreanCards!==11||ev.verifiedOwnedCDNImages!==11||ev.heldForPrintEvidence!==8||
 ev.items?.length!==11||ev.heldCards?.length!==8||ev.originImageRequests!==0||
 !ev.all12ThemesInspectedForReviewedCards||JSON.stringify(ev.newThemeSlotsThisBatch)!=='{"color":1}'||
 proof.set!=="s10b"||proof.cardCount!==19||proof.cards?.length!==19||
 proof.verificationCounts?.verified!==19||proof.verificationCounts?.missing!==0||
 proof.canonicalRange!=="091-109"||proof.sheets?.length!==2)
 throw Error("S10b final-range evidence or prior checkpoint mismatch");
const existing=new Map();
for(const t of art.groups)for(const x of t.cards||[]){
 const m=/^S10B_(\d{3})$/i.exec(x.code||"");
 if(m&&Number(m[1])>=91&&Number(m[1])<=101){
  const key=Number(m[1]);existing.set(key,[...(existing.get(key)||[]),t.code]);
 }
}
let count=0;
overrides.sets??={};overrides.sets.s10b??={};
const color=art.groups.find(g=>g.code==="color");
if(!color?.cards)throw Error("color theme absent");
for(let i=0;i<11;i++){
 const n=91+i,num=String(n).padStart(3,"0"),m=group.cards[90+i],p=proof.cards[i],e=ev.items[i];
 const typ=n===91?"pokemon":n<=93?"item":"energy";
 if(!m||!p||!e||p.canonicalOrder!==n||e.canonicalOrder!==n||
  m.code!=="s10b_"+num+"/071"||p.masterCode!==m.code||e.masterCode!==m.code||
  m.name!==p.name||m.name!==e.koreanName||e.illustrationType!==typ||
  e.preExistingThemes?.length!==0||p.existingThemes?.length!==0||(existing.get(n)||[]).length!==0||
  e.newlyMatchedThemes.join(",")!==(n===91?"color":"")||
  !e.imageInKorean||!e.all12ThemesInspected||!e.artObservation||
  e.ownedCDNUrl!==p.cdnUrl||p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
  p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !p.cdnUrl.startsWith("https://dcb-card-images-modern-2026.pages.dev/"))
  throw Error("S10b strict Korean card match failed at "+n);
 if(m.image!==p.cdnUrl){if(m.image&&!m.sourceImage)m.sourceImage=m.image;m.image=p.cdnUrl;}
 overrides.sets.s10b[m.code.toLowerCase()]=p.cdnUrl;
 if(n===91){
  color.cards.push({code:e.cardKey,name:m.name,series:"S",set:group.code,setName:group.displayName||group.name,
   cardNumber:num+"/071",rarity:m.rarity||"",category:e.colorCategory,image:p.cdnUrl,
   evidence:"한국판 Pokémon GO "+num+"/071 한국어 원본 일러스트 검수: "+e.artObservation+" 증빙 "+e.proofImage});
  count++;
 }
}
for(let i=0;i<8;i++){
 const n=102+i,hold=ev.heldCards[i],p=proof.cards[n-91],earlier=proof.cards[94+i-91];
 if(hold?.canonicalOrder!==n||hold?.appearsToDuplicateCanonicalOrder!==94+i||
    hold.masterCode!==group.cards[n-1]?.code||!hold.koreanName.endsWith("No.")||
    p?.imageCheck?.status!=="decoded"||!p.cdnUrl.startsWith("https://dcb-card-images-legacy-2026.pages.dev/")||
    earlier?.imageCheck?.status!=="decoded")
  throw Error("Unresolved energy variant missing evidence hold "+n);
}
if(count!==1||group.cards.map(c=>c.code).join(",")!==originalCodes.join(","))throw Error("S10b catalog identity changed");
const holds=ev.heldCards.map(h=>({cardKey:h.cardKey,canonicalOrder:h.canonicalOrder,masterCode:h.masterCode,reason:h.heldReason}));
status.reviews[group.code]={...prior,status:"in_progress",reviewedAt:"2026-10-14",reviewedCardCount:101,
 verifiedSelfHostedImageCount:101,reviewedRanges:[...prior.reviewedRanges,"091-101"],heldCards:holds,
 newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+count,
 partialReviewEvidence:A+"theme-s10b-091-109-Korean-art-review-20261014.json",
 archiveVerificationStatus:"101_verified_Korean_card_prints_8_energy_variants_held",
 nextStart:"s10b canonical 102 evidence",
 note:"Pokémon GO 한국판 101/109 카드 아트·자체 CDN 검수 완료. 마지막 102-109 에너지 8개는 094-101과 중복된 이미지와 No. 명칭이므로 한국판 인쇄 구분 증거 보류. 수집키·기존 데이터 보존."};
status.execution.currentSet="s10b";status.execution.currentEra="S";
status.execution.lastSafeCheckpoint="s10b canonical 001-101 (101/109); 102-109 exact Korean energy-print evidence pending";
status.execution.nextStart="s10b canonical 102 evidence";status.execution.updatedAt="2026-10-14";
status.execution.deferredEvidence??=[];
if(!status.execution.deferredEvidence.some(h=>h.set==="s10b"&&h.audit===A+"theme-s10b-091-109-Korean-art-review-20261014.json"))
 status.execution.deferredEvidence.push({set:"s10b",range:"canonical 102-109",pendingCount:8,audit:A+"theme-s10b-091-109-Korean-art-review-20261014.json",lastArtSafeCheckpoint:"s10b canonical 101 verified; print provenance and No. duplicate variants held"});
images.batches.push({task:6,set:"s10b",range:"canonical 091-101 Korean Pokémon GO; 102-109 variant print evidence holds",
 canonicalCardCount:11,artworkVisuallyVerifiedCount:11,artworkPendingCount:8,
 selfHostedReferenceCountAfter:11,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"11_modern_Korean_owned_CDN_images_verified_8_legacy_duplicate_variants_held",
 verifiedImageCount:11,unverifiedImageCount:8,brokenReferenceCount:0,modernArchiveImages:11,legacyArchiveImages:0,
 priorThemeSlotsPreserved:0,themeAdditions:{color:1},nextStart:"s10b canonical 102 evidence",
 note:"All nineteen candidate archives decoded, but only eleven independent Korean print identities verified. Eight legacy copy images require evidence."});
images.nextStart="s10b canonical 102 evidence";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s10b",status:"in_progress",totalMasterCards:109,
 reviewedCanonicalCards:101,remainingUnreviewed:8,KoreanArtVerified:101,ownedCDNImagesVerified:101,
 decodedOwnedCandidateImages:109,heldForPrintEvidence:8,byTheme:{color:1},newlyAddedThisBatch:1,
 modernArchiveImages:11,legacyArchiveImages:0,originalSourceRequests:0,ownershipStateChanges:0,
 proof:A+"theme-visual-evidence/s10b/091-109/visual-index.json",
 visualReviewEvidence:A+"theme-s10b-091-109-Korean-art-review-20261014.json",
 evidenceHeldCardKeys:holds.map(h=>h.cardKey),nextSafeStart:"s10b canonical 102 evidence"};
await Promise.all([save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s10b-091-109-progress-20261014.json",progress)]);
console.log(JSON.stringify({set:"s10b",reviewed:101,total:109,held:8,added:count,next:images.nextStart}));
