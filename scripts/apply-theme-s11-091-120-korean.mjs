import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const EXPECTED={street:1,color:16,season:1};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s11-091-120-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s11/091-120/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s11");
if(sets.length!==1||sets[0].cards?.length!==127)throw Error("Missing Korean s11 127-slot master");
const master=sets[0],prior=status.reviews?.[master.code],codeSequence=master.cards.map(c=>c.code);
if(prior?.reviewedRanges?.includes("091-120")&&prior.reviewedCardCount>=120){console.log("Already applied 091-120");process.exit(0);}
if(prior?.reviewedCardCount!==90||!prior?.reviewedRanges?.includes("001-030")||!prior?.reviewedRanges?.includes("031-060")||!prior?.reviewedRanges?.includes("061-090")||
 status.execution?.nextStart!=="s11 canonical 091"||
 images.nextStart!=="s11 canonical 091"||
 ev.set!=="s11"||ev.expectedCanonicalCards!==127||
 ev.range!=="canonical-order 091-120"||
 ev.visuallyReviewedKoreanCards!==30||ev.verifiedOwnedCDNImages!==30||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==30||
 JSON.stringify(ev.newThemeSlotsThisBatch)!==JSON.stringify(EXPECTED)||
 ev.existingThemeSlotsPreserved!==0||
 ev.illustrationTypeCounts?.pokemon!==16||ev.illustrationTypeCounts?.stadium!==1||
 proof.set!=="s11"||proof.cardCount!==30||proof.masterSetCardCount!==127||
 proof.canonicalRange!=="091-120"||proof.cards?.length!==30||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s11-091-120-01.webp.b64"||
 proof.sheets[1].file!=="s11-091-120-02.webp.b64")
 throw Error("S11 091-120 checkpoint or Korean printed card visual evidence mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Unknown theme "+t);
const current=new Map();let previousSlots=0;
for(const group of art.groups)for(const card of group.cards||[]){
 const m=/^S11_(\d{3})$/i.exec(String(card.code||""));
 if(!m)continue;previousSlots++;
 const n=Number(m[1]);
 if(n>=91&&n<=120){const list=current.get(n)||[];list.push(group.code);current.set(n,list);}
}
overrides.sets??={};overrides.sets.s11??={};
const additions={};let added=0,preserved=0,modernCount=0,legacyCount=0;
for(let i=0;i<30;i++){
 const n=i+91,num=String(n).padStart(3,"0"),p=proof.cards[i],row=ev.items[i],card=master.cards[90+i];
 const priorThemes=(current.get(n)||[]).slice().sort(),existing=(p.existingThemes||[]).slice().sort();
 const newThemes=row?.newlyMatchedThemes||[],full=[...new Set([...existing,...newThemes])].sort();
 const host=p?.cdnUrl?.split("/")[2];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=="s11_"+num+"/100"||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=="S11_"+num||row.printedNumber!==num+"/100"||
  row.koreanName!==card.name||p.name!==card.name||!card.name?.trim()||
  row.illustrationType!==(n>=101&&n<=112||n>=117&&n<=120?"pokemon":n===99?"stadium":n===100?"energy":(n>=95&&n<=98)||(n>=113&&n<=116)?"supporter":"item")||
  row.preExistingThemes?.slice().sort().join(",")!==existing.join(",")||
  priorThemes.join(",")!==existing.join(",")||
  row.matchedThemes?.slice().sort().join(",")!==full.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s11/091-120/s11-091-120-"+String(Math.ceil((n-90)/15)).padStart(2,"0")+".webp.b64"||
  row.decodedProof?.status!=="decoded"||p.imageCheck?.status!=="decoded"||
  p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
  p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !["dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"].includes(host))
 throw Error("Korean s11 printed card identity or previous theme mismatch "+n);
 preserved+=existing.length;
 if(host==="dcb-card-images-modern-2026.pages.dev")modernCount++;else legacyCount++;
 if(card.image!==p.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=p.cdnUrl;}
 overrides.sets.s11[card.code.toLowerCase()]=p.cdnUrl;
 for(const t of newThemes){
  if(!THEMES.includes(t)||existing.includes(t))throw Error("Unexpected or duplicate theme "+n+"/"+t);
  const category=t==="season"?row.seasonCategory:t==="color"?row.colorCategory:t==="night"?row.nightCategory:t==="street"?row.streetCategory:t==="sunset"?row.sunsetCategory:t==="cameo"?row.cameoCategory:t==="sleeping"?row.sleepingCategory:null;
  if(!category)throw Error("Missing artwork scene category "+n+"/"+t);
  groups.get(t).cards.push({
   code:row.cardKey,name:card.name,series:"S",set:master.code,
   setName:master.displayName||master.name,cardNumber:num+"/100",rarity:card.rarity||"",
   category,image:p.cdnUrl,
   evidence:"한국판 로스트어비스 s11 "+num+"/100 원본 그림 검수: "+row.artObservation+
    " 기존 수집 데이터 보존; 증빙 "+row.proofImage+"; DCB 보관 이미지 디코딩."
  });
  additions[t]=(additions[t]||0)+1;added++;
 }
}
for(const t of Object.keys(EXPECTED))if(additions[t]!==EXPECTED[t])throw Error("Incorrect 12-theme classification count "+t);
if(master.cards.map(c=>c.code).join(",")!==codeSequence.join(",")||
 preserved!==0||modernCount!==29||legacyCount!==1||added!==18)
 throw Error("Korean s11 091-120 audit integrity failed");
status.reviews[master.code]={...(prior||{}),status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:120,verifiedSelfHostedImageCount:120,
 reviewedRanges:[...(prior?.reviewedRanges||[]),"091-120"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prior?.newlyAddedThemeSlotCount||0)+added,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s11-091-120-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s11_091-120_30_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s11 canonical 121",
 note:"로스트어비스 한국판 091-120 추가 30장 검수. 누적 120/127장, 컬러 16·풍경 1·도시 1 슬롯 추가. 아이템·서포트·스타디움·에너지 14장의 테마 적합성도 점검, 기존 001-090 검수와 수집정보 보존."};
status.execution.currentEra="S";status.execution.currentSet="s11";
status.execution.lastSafeCheckpoint="s11 canonical 001-120 (120/127) Korean artwork and DCB-owned CDN images verified";
status.execution.nextStart="s11 canonical 121";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s11",range:"canonical 091-120 Korean Lost Abyss",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_DCB_owned_CDN_images_decoded",verifiedImageCount:30,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:29,
 legacyArchiveImages:1,priorThemeSlotsPreserved:0,themeAdditions:additions,
 nextStart:"s11 canonical 121",
 note:"All 30 Korean printed images decoded from own CDN; no third-party origin downloads."});
images.nextStart="s11 canonical 121";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s11",status:"in_progress",
 totalMasterCards:127,reviewedCanonicalCards:120,remainingUnreviewed:7,
 KoreanArtVerified:120,ownedCDNImagesVerified:120,newlyAddedThisBatch:added,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
 proof:A+"theme-visual-evidence/s11/091-120/visual-index.json",
 visualReviewEvidence:A+"theme-s11-091-120-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s11 canonical 121"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s11-091-120-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s11",reviewed:120,total:127,additions,prevHeld:preserved,next:images.nextStart}));
