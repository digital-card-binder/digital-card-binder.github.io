import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const EXPECTED={color:30,season:20,night:1,street:1};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s11-061-090-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s11/061-090/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s11");
if(sets.length!==1||sets[0].cards?.length!==127)throw Error("Missing Korean s11 127-slot master");
const master=sets[0],prior=status.reviews?.[master.code],codeSequence=master.cards.map(c=>c.code);
if(prior?.reviewedRanges?.includes("061-090")&&prior.reviewedCardCount>=90){console.log("Already applied 061-090");process.exit(0);}
if(prior?.reviewedCardCount!==60||!prior?.reviewedRanges?.includes("001-030")||!prior?.reviewedRanges?.includes("031-060")||
 status.execution?.nextStart!=="s11 canonical 061"||
 images.nextStart!=="s11 canonical 061"||
 ev.set!=="s11"||ev.expectedCanonicalCards!==127||
 ev.range!=="canonical-order 061-090"||
 ev.visuallyReviewedKoreanCards!==30||ev.verifiedOwnedCDNImages!==30||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==30||
 JSON.stringify(ev.newThemeSlotsThisBatch)!==JSON.stringify(EXPECTED)||
 ev.existingThemeSlotsPreserved!==0||
 ev.nameCorrections?.length!==1||ev.nameCorrections[0]?.cardCode!=="s11_067/100"||
 ev.nameCorrections[0]?.after!=="드래피온 VSTAR"||
 proof.set!=="s11"||proof.cardCount!==30||proof.masterSetCardCount!==127||
 proof.canonicalRange!=="061-090"||proof.cards?.length!==30||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s11-061-090-01.webp.b64"||
 proof.sheets[1].file!=="s11-061-090-02.webp.b64")
 throw Error("s11 Korean 061-090 batch does not match previous 060 checkpoint or owned image proof");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Unknown theme "+t);
const current=new Map();let previousSlots=0;
for(const group of art.groups)for(const card of group.cards||[]){
 const m=/^S11_(\d{3})$/i.exec(String(card.code||""));
 if(!m)continue;previousSlots++;
 const n=Number(m[1]);
 if(n>=61&&n<=90){const list=current.get(n)||[];list.push(group.code);current.set(n,list);}
}
overrides.sets??={};overrides.sets.s11??={};
const additions={};let added=0,preserved=0,modernCount=0,legacyCount=0;
for(let i=0;i<30;i++){
 const n=i+61,num=String(n).padStart(3,"0"),p=proof.cards[i],row=ev.items[i],card=master.cards[60+i];
 if(n===67){
  if(card?.name!=="드래피 VSTAR"||p?.name!=="드래피 VSTAR"||row?.koreanName!=="드래피온 VSTAR"||
     row?.catalogNameBeforeCorrection!=="드래피 VSTAR"||card?.code!=="s11_067/100")
     throw Error("S11_067 printed Korean card name correction gate failed");
  card.name="드래피온 VSTAR";
 }
 const priorThemes=(current.get(n)||[]).slice().sort(),existing=(p.existingThemes||[]).slice().sort();
 const newThemes=row?.newlyMatchedThemes||[],full=[...new Set([...existing,...newThemes])].sort();
 const host=p?.cdnUrl?.split("/")[2];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=="s11_"+num+"/100"||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=="S11_"+num||row.printedNumber!==num+"/100"||
  row.koreanName!==card.name||(n!==67&&p.name!==card.name)||!card.name?.trim()||
  row.illustrationType!=="pokemon"||
  row.preExistingThemes?.slice().sort().join(",")!==existing.join(",")||
  priorThemes.join(",")!==existing.join(",")||
  row.matchedThemes?.slice().sort().join(",")!==full.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s11/061-090/s11-061-090-"+String(Math.ceil((n-60)/15)).padStart(2,"0")+".webp.b64"||
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
 preserved!==0||modernCount!==29||legacyCount!==1||added!==52)
 throw Error("Korean s11 061-090 audit integrity failed");
status.reviews[master.code]={...(prior||{}),status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:90,verifiedSelfHostedImageCount:90,
 reviewedRanges:[...(prior?.reviewedRanges||[]),"061-090"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prior?.newlyAddedThemeSlotCount||0)+added,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s11-061-090-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s11_061-090_30_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s11 canonical 091",
 note:"로스트어비스 한국판 061-090 추가 30장 일러스트·자체 CDN 검수. 누적 90/127장 및 신규 테마 52건 반영. S11 067 드래피온 VSTAR 인쇄명 교정; 이전 001-060 검수와 수집정보는 보존."};
status.execution.currentEra="S";status.execution.currentSet="s11";
status.execution.lastSafeCheckpoint="s11 canonical 001-090 (90/127) Korean artwork and DCB-owned CDN images verified";
status.execution.nextStart="s11 canonical 091";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s11",range:"canonical 061-090 Korean Lost Abyss",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_DCB_owned_CDN_images_decoded",verifiedImageCount:30,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:29,
 legacyArchiveImages:1,priorThemeSlotsPreserved:0,themeAdditions:additions,
 nextStart:"s11 canonical 091",
 note:"All 30 Korean printed images decoded from own CDN; no third-party origin downloads."});
images.nextStart="s11 canonical 091";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s11",status:"in_progress",
 totalMasterCards:127,reviewedCanonicalCards:90,remainingUnreviewed:37,
 KoreanArtVerified:90,ownedCDNImagesVerified:90,newlyAddedThisBatch:added,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
 proof:A+"theme-visual-evidence/s11/061-090/visual-index.json",
 visualReviewEvidence:A+"theme-s11-061-090-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s11 canonical 091"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s11-061-090-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s11",reviewed:90,total:127,additions,prevHeld:preserved,next:images.nextStart}));
