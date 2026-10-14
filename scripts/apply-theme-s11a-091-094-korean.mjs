import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const EXPECTED={color:1};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s11a-091-094-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s11a/091-094/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s11a");
if(sets.length!==1||sets[0].cards?.length!==94)throw Error("Missing Korean s11a 94-slot master");
const master=sets[0],prior=status.reviews?.[master.code],codeSequence=master.cards.map(c=>c.code);
if(prior?.reviewedRanges?.includes("091-094")&&prior.reviewedCardCount>=94){console.log("Already applied 091-094");process.exit(0);}
if(prior?.reviewedRanges?.length!==3||!["001-030","031-060","061-090"].every(x=>prior.reviewedRanges.includes(x))||prior?.status!=="in_progress"||prior?.reviewedCardCount!==90||prior?.reviewedRanges?.at(-1)!=="061-090"||prior?.nextStart!=="s11a canonical 091"||prior?.verifiedSelfHostedImageCount!==90||
 status.execution?.nextStart!=="s11a canonical 091"||
 images.nextStart!=="s11a canonical 091"||
 ev.set!=="s11a"||ev.expectedCanonicalCards!==94||
 ev.range!=="canonical-order 091-094"||
 ev.visuallyReviewedKoreanCards!==4||ev.verifiedOwnedCDNImages!==4||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==4||
 JSON.stringify(ev.newThemeSlotsThisBatch)!==JSON.stringify(EXPECTED)||
 ev.existingThemeSlotsPreserved!==0||
 proof.set!=="s11a"||proof.cardCount!==4||proof.masterSetCardCount!==94||
 proof.canonicalRange!=="091-094"||proof.cards?.length!==4||
 proof.verificationCounts?.verified!==4||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==1||
 proof.sheets[0].file!=="s11a-091-094-01.webp.b64")
 throw Error("s11a 091-094 final checkpoint and actual Korean images must match");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Unknown theme "+t);
const current=new Map();let previousSlots=0;
for(const group of art.groups)for(const card of group.cards||[]){
 const m=/^S11A_(\d{3})$/i.exec(String(card.code||""));
 if(!m)continue;previousSlots++;
 const n=Number(m[1]);
 if(n>=91&&n<=94){const list=current.get(n)||[];list.push(group.code);current.set(n,list);}
}
overrides.sets??={};overrides.sets.s11a??={};
const additions={};let added=0,preserved=0,modernCount=0,legacyCount=0;
for(let i=0;i<4;i++){
 const n=i+91,num=String(n).padStart(3,"0"),p=proof.cards[i],row=ev.items[i],card=master.cards[i+90];
 const priorThemes=(current.get(n)||[]).slice().sort(),existing=(p.existingThemes||[]).slice().sort();
 const newThemes=row?.newlyMatchedThemes||[],full=[...new Set([...existing,...newThemes])].sort();
 const host=p?.cdnUrl?.split("/")[2];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=="s11a_"+num+"/068"||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=="S11A_"+num||row.printedNumber!==num+"/068"||
  row.koreanName!==card.name||p.name!==card.name||!card.name?.trim()||
  row.illustrationType!==(n===92?"pokemon":n===94?"energy":"trainer")||
  row.preExistingThemes?.slice().sort().join(",")!==existing.join(",")||
  priorThemes.join(",")!==existing.join(",")||
  row.matchedThemes?.slice().sort().join(",")!==full.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s11a/091-094/s11a-091-094-"+String(Math.ceil((n-90)/15)).padStart(2,"0")+".webp.b64"||
  row.decodedProof?.status!=="decoded"||p.imageCheck?.status!=="decoded"||
  p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
  p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !["dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"].includes(host))
 throw Error("Korean s11a printed card identity or previous theme mismatch "+n);
 preserved+=existing.length;
 if(host==="dcb-card-images-modern-2026.pages.dev")modernCount++;else legacyCount++;
 if(card.image!==p.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=p.cdnUrl;}
 overrides.sets.s11a[card.code.toLowerCase()]=p.cdnUrl;
 for(const t of newThemes){
  if(!THEMES.includes(t)||existing.includes(t))throw Error("Unexpected or duplicate theme "+n+"/"+t);
  const category=t==="season"?row.seasonCategory:t==="color"?row.colorCategory:t==="night"?row.nightCategory:t==="street"?row.streetCategory:t==="sunset"?row.sunsetCategory:t==="cameo"?row.cameoCategory:null;
  if(!category)throw Error("Missing artwork scene category "+n+"/"+t);
  groups.get(t).cards.push({
   code:row.cardKey,name:card.name,series:"S",set:master.code,
   setName:master.displayName||master.name,cardNumber:num+"/068",rarity:card.rarity||"",
   category,image:p.cdnUrl,
   evidence:"한국판 패러다임트리거 s11a "+num+"/068 원본 그림 검수: "+row.artObservation+
    " 기존 수집 데이터 보존; 증빙 "+row.proofImage+"; DCB 보관 이미지 디코딩."
  });
  additions[t]=(additions[t]||0)+1;added++;
 }
}
for(const t of Object.keys(EXPECTED))if(additions[t]!==EXPECTED[t])throw Error("Incorrect 12-theme classification count "+t);
if(master.cards.map(c=>c.code).join(",")!==codeSequence.join(",")||
 preserved!==0||modernCount!==3||legacyCount!==1||added!==1)
 throw Error("Korean s11a 091-094 audit integrity failed");
status.reviews[master.code]={...(prior||{}),status:"complete",reviewedAt:"2026-10-14",
 reviewedCardCount:94,verifiedSelfHostedImageCount:94,
 reviewedRanges:[...prior.reviewedRanges,"091-094"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prior?.newlyAddedThemeSlotCount||0)+added,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s11a-091-094-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s11a_001-094_all_94_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s11 canonical 001",
 note:"백열의 아르카나 한국판 전체 94장 12테마 전수검수 완료. 마지막 4장 검수에서 골드 레어 샤로다 VSTAR 컬러 1건 추가, 트레이너·에너지 3장 포켓몬 테마 제외. 94장 자체 CDN 이미지 증빙과 모든 이전 슬롯 보존."};
status.execution.currentEra="S";status.execution.currentSet="s11";
status.execution.lastSafeCheckpoint="s11a canonical 001-094 (94/94) Korean artwork and DCB-owned CDN images verified";
status.execution.nextStart="s11 canonical 001";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s11a",range:"canonical 091-094 Korean Paradigm Trigger",
 canonicalCardCount:4,artworkVisuallyVerifiedCount:4,artworkPendingCount:0,
 selfHostedReferenceCountAfter:4,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"4_Korean_DCB_owned_CDN_images_decoded",verifiedImageCount:4,
 unverifiedImageCount:0,brokenReferenceCount:0,modernArchiveImages:3,
 legacyArchiveImages:1,priorThemeSlotsPreserved:0,themeAdditions:additions,
 nextStart:"s11 canonical 001",
 note:"Final 4 Korean cards decoded on owned CDN; 94/94 set fully reviewed, no origin download, ownership untouched."});
images.nextStart="s11 canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s11a",status:"complete",
 totalMasterCards:94,reviewedCanonicalCards:94,remainingUnreviewed:0,
 KoreanArtVerified:94,ownedCDNImagesVerified:94,newlyAddedThisBatch:added,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
 proof:A+"theme-visual-evidence/s11a/091-094/visual-index.json",
 visualReviewEvidence:A+"theme-s11a-091-094-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s11 canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s11a-091-094-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s11a",reviewed:94,total:94,additions,prevHeld:preserved,next:images.nextStart}));
