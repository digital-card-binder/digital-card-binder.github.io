import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const EXPECTED={color:30,season:15,street:6,night:6};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s10a-001-030-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s10a/001-030/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s10a");
if(sets.length!==1||sets[0].cards?.length!==99)throw Error("Missing Korean s10a 99-slot master");
const master=sets[0],prior=status.reviews?.[master.code],codeSequence=master.cards.map(c=>c.code);
if(prior?.reviewedRanges?.includes("001-030")&&prior.reviewedCardCount>=30){console.log("Already applied 001-030");process.exit(0);}
if(prior?.reviewedCardCount>0||
 status.execution?.nextStart!=="s10b canonical 102 evidence"||status.reviews?.s10b?.heldCards?.length!==8||
 images.nextStart!=="s10b canonical 102 evidence"||
 ev.set!=="s10a"||ev.expectedCanonicalCards!==99||
 ev.range!=="canonical-order 001-030"||
 ev.visuallyReviewedKoreanCards!==30||ev.verifiedOwnedCDNImages!==30||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==30||
 JSON.stringify(ev.newThemeSlotsThisBatch)!==JSON.stringify(EXPECTED)||
 ev.existingThemeSlotsPreserved!==0||ev.priorSetEvidenceHoldsRetained?.count!==8||
 ev.priorSetEvidenceHoldsRetained?.audit!==A+"theme-s10b-091-109-Korean-art-review-20261014.json"||
 proof.set!=="s10a"||proof.cardCount!==30||proof.masterSetCardCount!==99||
 proof.canonicalRange!=="001-030"||proof.cards?.length!==30||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s10a-001-030-01.webp.b64"||
 proof.sheets[1].file!=="s10a-001-030-02.webp.b64")
 throw Error("S10a 001-030 proof or previous S10b eight energy evidence holds mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Unknown theme "+t);
const current=new Map();let previousSlots=0;
for(const group of art.groups)for(const card of group.cards||[]){
 const m=/^S10A_(\d{3})$/i.exec(String(card.code||""));
 if(!m)continue;previousSlots++;
 const n=Number(m[1]);
 if(n<=30){const list=current.get(n)||[];list.push(group.code);current.set(n,list);}
}
overrides.sets??={};overrides.sets.s10a??={};
const additions={};let added=0,preserved=0,modernCount=0,legacyCount=0;
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),p=proof.cards[i],row=ev.items[i],card=master.cards[i];
 const priorThemes=(current.get(n)||[]).slice().sort(),existing=(p.existingThemes||[]).slice().sort();
 const newThemes=row?.newlyMatchedThemes||[],full=[...new Set([...existing,...newThemes])].sort();
 const host=p?.cdnUrl?.split("/")[2];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=="s10a_"+num+"/071"||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=="S10A_"+num||row.printedNumber!==num+"/071"||
  row.koreanName!==card.name||p.name!==card.name||!card.name?.trim()||
  row.illustrationType!=="pokemon"||
  row.preExistingThemes?.slice().sort().join(",")!==existing.join(",")||
  priorThemes.join(",")!==existing.join(",")||
  row.matchedThemes?.slice().sort().join(",")!==full.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s10a/001-030/s10a-001-030-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  row.decodedProof?.status!=="decoded"||p.imageCheck?.status!=="decoded"||
  p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
  p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !["dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"].includes(host))
 throw Error("Korean s10a printed card identity or previous theme mismatch "+n);
 preserved+=existing.length;
 if(host==="dcb-card-images-modern-2026.pages.dev")modernCount++;else legacyCount++;
 if(card.image!==p.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=p.cdnUrl;}
 overrides.sets.s10a[card.code.toLowerCase()]=p.cdnUrl;
 for(const t of newThemes){
  if(!THEMES.includes(t)||existing.includes(t))throw Error("Unexpected or duplicate theme "+n+"/"+t);
  const category=t==="season"?row.seasonCategory:t==="color"?row.colorCategory:t==="night"?row.nightCategory:t==="street"?row.streetCategory:t==="reflections"?row.reflectionsCategory:t==="sunset"?row.sunsetCategory:t==="cameo"?row.cameoCategory:null;
  if(!category)throw Error("Missing artwork scene category "+n+"/"+t);
  groups.get(t).cards.push({
   code:row.cardKey,name:card.name,series:"S",set:master.code,
   setName:master.displayName||master.name,cardNumber:num+"/071",rarity:card.rarity||"",
   category,image:p.cdnUrl,
   evidence:"한국판 다크판타스마 s10a "+num+"/071 원본 그림 검수: "+row.artObservation+
    " 기존 수집 데이터 보존; 증빙 "+row.proofImage+"; DCB 보관 이미지 디코딩."
  });
  additions[t]=(additions[t]||0)+1;added++;
 }
}
for(const t of Object.keys(EXPECTED))if(additions[t]!==EXPECTED[t])throw Error("Incorrect 12-theme classification count "+t);
if(master.cards.map(c=>c.code).join(",")!==codeSequence.join(",")||
 preserved!==0||modernCount!==29||legacyCount!==1||added!==57)
 throw Error("Korean s10a 001-030 audit integrity failed");
status.reviews[master.code]={...(prior||{}),status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:30,verifiedSelfHostedImageCount:30,
 reviewedRanges:["001-030"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prior?.newlyAddedThemeSlotCount||0)+added,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s10a-001-030-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s10a_001-030_30_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s10a canonical 031",
 note:"다크판타스마 한국판 001-030 30장 실제 일러스트와 12테마 검수. 신규 57건, 자체 CDN 29+1장. 이전 S10b 에너지 인쇄 증거 보류 8건과 기존 사용자 수집정보 보존."};
status.execution.currentEra="S";status.execution.currentSet="s10a";
status.execution.lastSafeCheckpoint="s10a canonical 001-030 (30/99) Korean artwork and DCB-owned CDN images verified";
status.execution.nextStart="s10a canonical 031";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s10a",range:"canonical 001-030 Korean Dark Phantasma",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_DCB_owned_CDN_images_decoded",verifiedImageCount:30,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:29,
 legacyArchiveImages:1,priorThemeSlotsPreserved:0,themeAdditions:additions,
 nextStart:"s10a canonical 031",
 note:"All 30 Korean printed images decoded from own CDN; no third-party origin downloads."});
images.nextStart="s10a canonical 031";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s10a",status:"in_progress",
 totalMasterCards:99,reviewedCanonicalCards:30,remainingUnreviewed:69,
 KoreanArtVerified:30,ownedCDNImagesVerified:30,newlyAddedThisBatch:added,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
 proof:A+"theme-visual-evidence/s10a/001-030/visual-index.json",
 visualReviewEvidence:A+"theme-s10a-001-030-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s10a canonical 031"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s10a-001-030-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s10a",reviewed:30,total:99,additions,prevHeld:preserved,next:images.nextStart}));
