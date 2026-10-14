import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const EXPECTED={color:1};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s12-121-125-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s12/121-125/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s12");
if(sets.length!==1||sets[0].cards?.length!==125)throw Error("Missing Korean s12 125-slot master");
const master=sets[0],prior=status.reviews?.[master.code],codeSequence=master.cards.map(c=>c.code);
if(prior?.reviewedRanges?.includes("121-125")&&prior.reviewedCardCount>=125){console.log("Already applied 121-125");process.exit(0);}
if(prior?.reviewedRanges?.length!==4||!["001-030","031-060","061-090","091-120"].every(x=>prior.reviewedRanges.includes(x))||prior?.status!=="in_progress"||prior?.reviewedCardCount!==120||prior?.reviewedRanges?.at(-1)!=="091-120"||prior?.nextStart!=="s12 canonical 121"||prior?.verifiedSelfHostedImageCount!==120||
 status.execution?.nextStart!=="s12 canonical 121"||
 images.nextStart!=="s12 canonical 121"||
 ev.set!=="s12"||ev.expectedCanonicalCards!==125||
 ev.range!=="canonical-order 121-125"||
 ev.visuallyReviewedKoreanCards!==5||ev.verifiedOwnedCDNImages!==5||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==5||
 JSON.stringify(ev.newThemeSlotsThisBatch)!==JSON.stringify(EXPECTED)||
 ev.existingThemeSlotsPreserved!==0||
 proof.set!=="s12"||proof.cardCount!==5||proof.masterSetCardCount!==125||
 proof.canonicalRange!=="121-125"||proof.cards?.length!==5||
 proof.verificationCounts?.verified!==5||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==1||
 proof.sheets[0].file!=="s12-121-125-01.webp.b64")
 throw Error("s12 121-125 requires 120-card contiguous checkpoint and final 5 actual Korean artwork proofs");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Unknown theme "+t);
const current=new Map();let previousSlots=0;
for(const group of art.groups)for(const card of group.cards||[]){
 const m=/^S12_(\d{3})$/i.exec(String(card.code||""));
 if(!m)continue;previousSlots++;
 const n=Number(m[1]);
 if(n>=121&&n<=125){const list=current.get(n)||[];list.push(group.code);current.set(n,list);}
}
overrides.sets??={};overrides.sets.s12??={};
const additions={};let added=0,preserved=0,modernCount=0,legacyCount=0;
for(let i=0;i<5;i++){
 const n=i+121,num=String(n).padStart(3,"0"),p=proof.cards[i],row=ev.items[i],card=master.cards[i+120];
 const priorThemes=(current.get(n)||[]).slice().sort(),existing=(p.existingThemes||[]).slice().sort();
 const newThemes=row?.newlyMatchedThemes||[],full=[...new Set([...existing,...newThemes])].sort();
 const host=p?.cdnUrl?.split("/")[2];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=="s12_"+num+"/098"||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=="S12_"+num||row.printedNumber!==num+"/098"||
  row.koreanName!==card.name||p.name!==card.name||!card.name?.trim()||
  row.illustrationType!==(n===123?"pokemon":n===125?"stadium":"trainer")||
  row.preExistingThemes?.slice().sort().join(",")!==existing.join(",")||
  priorThemes.join(",")!==existing.join(",")||
  row.matchedThemes?.slice().sort().join(",")!==full.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s12/121-125/s12-121-125-"+String(Math.ceil((n-120)/15)).padStart(2,"0")+".webp.b64"||
  row.decodedProof?.status!=="decoded"||p.imageCheck?.status!=="decoded"||
  p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
  p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !["dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"].includes(host))
 throw Error("Korean s12 printed card identity or previous theme mismatch "+n);
 preserved+=existing.length;
 if(host==="dcb-card-images-modern-2026.pages.dev")modernCount++;else legacyCount++;
 if(card.image!==p.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=p.cdnUrl;}
 overrides.sets.s12[card.code.toLowerCase()]=p.cdnUrl;
 for(const t of newThemes){
  if(!THEMES.includes(t)||existing.includes(t))throw Error("Unexpected or duplicate theme "+n+"/"+t);
  const category=t==="season"?row.seasonCategory:t==="color"?row.colorCategory:t==="night"?row.nightCategory:t==="street"?row.streetCategory:t==="sunset"?row.sunsetCategory:t==="cameo"?row.cameoCategory:null;
  if(!category)throw Error("Missing artwork scene category "+n+"/"+t);
  groups.get(t).cards.push({
   code:row.cardKey,name:card.name,series:"S",set:master.code,
   setName:master.displayName||master.name,cardNumber:num+"/098",rarity:card.rarity||"",
   category,image:p.cdnUrl,
   evidence:"한국판 패러다임트리거 s12 "+num+"/098 원본 그림 검수: "+row.artObservation+
    " 기존 수집 데이터 보존; 증빙 "+row.proofImage+"; DCB 보관 이미지 디코딩."
  });
  additions[t]=(additions[t]||0)+1;added++;
 }
}
for(const t of Object.keys(EXPECTED))if(additions[t]!==EXPECTED[t])throw Error("Incorrect 12-theme classification count "+t);
if(master.cards.map(c=>c.code).join(",")!==codeSequence.join(",")||
 preserved!==0||modernCount!==5||legacyCount!==0||added!==1)
 throw Error("Korean s12 final 5-card audit integrity failed");
status.reviews[master.code]={...(prior||{}),status:"complete",reviewedAt:"2026-10-14",
 reviewedCardCount:125,verifiedSelfHostedImageCount:125,
 reviewedRanges:[...prior.reviewedRanges,"121-125"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prior?.newlyAddedThemeSlotCount||0)+added,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s12-121-125-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s12_001-125_125_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s11a canonical 001",
 note:"패러다임트리거 한국판 125장 전체 12테마 전수검수 완료. 마지막 5장 중 골드 레어 루기아 VSTAR 컬러 1개 테마 추가, 비포켓몬 4장은 포켓몬 도감 미포함. 기존 도감·수집키와 보유 이미지 모두 보존, 125장 증빙 검증."};
status.execution.currentEra="S";status.execution.currentSet="s11a";
status.execution.lastSafeCheckpoint="s12 canonical 001-125 (125/125) Korean full set complete; 125 DCB-owned Korean images verified";
status.execution.nextStart="s11a canonical 001";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s12",range:"canonical 121-125 Korean Paradigm Trigger",
 canonicalCardCount:5,artworkVisuallyVerifiedCount:5,artworkPendingCount:0,
 selfHostedReferenceCountAfter:5,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"5_Korean_DCB_owned_CDN_images_decoded",verifiedImageCount:5,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:5,
 legacyArchiveImages:0,priorThemeSlotsPreserved:0,themeAdditions:additions,
 nextStart:"s11a canonical 001",
 note:"Final 5 Korean printed images decoded from own CDN; complete Korean s12 125/125, 12 themes verified; no third-party origin downloads."});
images.nextStart="s11a canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s12",status:"complete",
 totalMasterCards:125,reviewedCanonicalCards:125,remainingUnreviewed:0,
 KoreanArtVerified:125,ownedCDNImagesVerified:125,newlyAddedThisBatch:added,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
 proof:A+"theme-visual-evidence/s12/121-125/visual-index.json",
 visualReviewEvidence:A+"theme-s12-121-125-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s11a canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s12-121-125-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s12",reviewed:125,total:125,additions,prevHeld:preserved,next:images.nextStart}));
