import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const EXPECTED={color:1,season:1};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s11-121-127-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s11/121-127/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s11");
if(sets.length!==1||sets[0].cards?.length!==127)throw Error("Missing Korean s11 127-slot master");
const master=sets[0],prior=status.reviews?.[master.code],codeSequence=master.cards.map(c=>c.code);
if(prior?.reviewedRanges?.includes("121-127")&&prior.reviewedCardCount>=127){console.log("Already applied 121-127");process.exit(0);}
if(prior?.reviewedCardCount!==120||!prior?.reviewedRanges?.includes("001-030")||!prior?.reviewedRanges?.includes("031-060")||!prior?.reviewedRanges?.includes("061-090")||!prior?.reviewedRanges?.includes("091-120")||
 status.execution?.nextStart!=="s11 canonical 121"||
 images.nextStart!=="s11 canonical 121"||
 ev.set!=="s11"||ev.expectedCanonicalCards!==127||
 ev.range!=="canonical-order 121-127"||
 ev.visuallyReviewedKoreanCards!==7||ev.verifiedOwnedCDNImages!==7||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==7||
 JSON.stringify(ev.newThemeSlotsThisBatch)!==JSON.stringify(EXPECTED)||
 ev.existingThemeSlotsPreserved!==0||
 ev.illustrationTypeCounts?.pokemon!==1||ev.illustrationTypeCounts?.stadium!==1||
 proof.set!=="s11"||proof.cardCount!==7||proof.masterSetCardCount!==127||
 proof.canonicalRange!=="121-127"||proof.cards?.length!==7||
 proof.verificationCounts?.verified!==7||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==1||
 proof.sheets[0].file!=="s11-121-127-01.webp.b64")
 throw Error("S11 final seven card proof or previous 120 checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Unknown theme "+t);
const current=new Map();let previousSlots=0;
for(const group of art.groups)for(const card of group.cards||[]){
 const m=/^S11_(\d{3})$/i.exec(String(card.code||""));
 if(!m)continue;previousSlots++;
 const n=Number(m[1]);
 if(n>=121&&n<=127){const list=current.get(n)||[];list.push(group.code);current.set(n,list);}
}
overrides.sets??={};overrides.sets.s11??={};
const additions={};let added=0,preserved=0,modernCount=0,legacyCount=0;
for(let i=0;i<7;i++){
 const n=i+121,num=String(n).padStart(3,"0"),p=proof.cards[i],row=ev.items[i],card=master.cards[120+i];
 const priorThemes=(current.get(n)||[]).slice().sort(),existing=(p.existingThemes||[]).slice().sort();
 const newThemes=row?.newlyMatchedThemes||[],full=[...new Set([...existing,...newThemes])].sort();
 const host=p?.cdnUrl?.split("/")[2];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=="s11_"+num+"/100"||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=="S11_"+num||row.printedNumber!==num+"/100"||
  row.koreanName!==card.name||p.name!==card.name||!card.name?.trim()||
  row.illustrationType!==(n>=121&&n<=124?"supporter":n===125?"pokemon":n===126?"item":"stadium")||
  row.preExistingThemes?.slice().sort().join(",")!==existing.join(",")||
  priorThemes.join(",")!==existing.join(",")||
  row.matchedThemes?.slice().sort().join(",")!==full.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s11/121-127/s11-121-127-"+String(Math.ceil((n-120)/15)).padStart(2,"0")+".webp.b64"||
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
 preserved!==0||modernCount!==7||legacyCount!==0||added!==2)
 throw Error("Korean s11 121-127 audit integrity failed");
status.reviews[master.code]={...(prior||{}),status:"complete",reviewedAt:"2026-10-14",
 reviewedCardCount:127,verifiedSelfHostedImageCount:127,
 reviewedRanges:[...(prior?.reviewedRanges||[]),"121-127"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prior?.newlyAddedThemeSlotCount||0)+added,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s11-121-127-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s11_001-127_all_127_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s10b canonical 001",
 note:"로스트어비스 한국판 127장 전체 12개 테마 전수검수 완료. 마지막 금색 특별 레어도 7장 중 컬러 1·유적 풍경 1 추가. 전 카드 한국판 이미지 127장 자체 CDN 확인, 보유 수집키와 001-120 체크포인트 보존."};
status.execution.currentEra="S";status.execution.currentSet="s10b";
status.execution.lastSafeCheckpoint="s11 canonical 001-127 (127/127) Korean full set complete; all owned Korean images verified";
status.execution.nextStart="s10b canonical 001";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s11",range:"canonical 121-127 Korean Lost Abyss",
 canonicalCardCount:7,artworkVisuallyVerifiedCount:7,artworkPendingCount:0,
 selfHostedReferenceCountAfter:7,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"7_Korean_DCB_owned_CDN_images_decoded",verifiedImageCount:7,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:7,
 legacyArchiveImages:0,priorThemeSlotsPreserved:0,themeAdditions:additions,
 nextStart:"s10b canonical 001",
 note:"All final seven Korean printed images decoded from own CDN; full 127/127 strict set completed without origin downloads."});
images.nextStart="s10b canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s11",status:"complete",
 totalMasterCards:127,reviewedCanonicalCards:127,remainingUnreviewed:0,
 KoreanArtVerified:127,ownedCDNImagesVerified:127,newlyAddedThisBatch:added,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
 proof:A+"theme-visual-evidence/s11/121-127/visual-index.json",
 visualReviewEvidence:A+"theme-s11-121-127-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s10b canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s11-121-127-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s11",reviewed:127,total:127,additions,prevHeld:preserved,next:images.nextStart}));
