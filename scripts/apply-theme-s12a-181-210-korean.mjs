import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const EXPECTED={season:18,color:27,cameo:1,street:2};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s12a-181-210-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s12a/181-210/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s12a");
if(sets.length!==1||sets[0].cards?.length!==262)throw Error("Missing 262-card Korean master");
const master=sets[0],prev=status.reviews?.[master.code],codesBefore=master.cards.map(c=>c.code);
if(prev?.reviewedCardCount>=210&&prev.reviewedRanges?.includes("181-210")){console.log("Already reviewed 181-210");process.exit(0);}
if(prev?.status!=="in_progress"||prev.reviewedCardCount!==180||
 prev.reviewedRanges?.at(-1)!=="151-180"||prev.nextStart!=="s12a canonical 181"||
 prev.verifiedSelfHostedImageCount!==180||
 status.execution?.nextStart!=="s12a canonical 181"||images.nextStart!=="s12a canonical 181"||
 ev.set!=="s12a"||ev.expectedCanonicalCards!==262||ev.range!=="canonical-order 181-210"||
 ev.visuallyReviewedKoreanCards!==30||ev.verifiedOwnedCDNImages!==30||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==30||
 JSON.stringify(ev.newThemeSlotsThisBatch)!==JSON.stringify({color:27,season:18,cameo:1,street:2})||
 ev.existingThemeSlotsPreserved!==25||
 proof.set!=="s12a"||proof.cardCount!==30||proof.masterSetCardCount!==262||
 proof.canonicalRange!=="181-210"||proof.cards?.length!==30||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s12a-181-210-01.webp.b64"||
 proof.sheets[1].file!=="s12a-181-210-02.webp.b64")
 throw Error("Cannot advance: 180-card checkpoint / Korean proof mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const theme of THEMES)if(!Array.isArray(groups.get(theme)?.cards))throw Error("Missing theme "+theme);
const current=new Map();let previousSlots=0;
for(const group of art.groups)for(const entry of group.cards||[]){
 const match=/^S12A_(\d{3})$/i.exec(String(entry.code||""));
 if(!match)continue;previousSlots++;
 const n=Number(match[1]);
 if(n>=181&&n<=210){const list=current.get(n)||[];list.push(group.code);current.set(n,list);}
}
if(previousSlots<254)throw Error("Prior s12a thematic placements missing");
overrides.sets??={};overrides.sets.s12a??={};
const additions={};let addedCount=0,preservedCount=0,legacyImages=0,modernImages=0;
for(let i=0;i<30;i++){
 const n=i+181,num=String(n).padStart(3,"0"),
  c=master.cards[n-1],p=proof.cards[i],row=ev.items[i];
 const prior=(current.get(n)||[]).slice().sort(),verified=(p.existingThemes||[]).slice().sort();
 const extra=row?.newlyMatchedThemes??[],all=[...new Set([...verified,...extra])].sort();
 const host=p?.cdnUrl?.split("/")[2];
 if(!c||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  c.code?.toLowerCase()!=="s12a_"+num+"/172"||
  p.masterCode?.toLowerCase()!==c.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==c.code.toLowerCase()||
  row.cardKey!=="S12A_"+num||row.printedNumber!==num+"/172"||
  p.name!==c.name||row.koreanName!==c.name||!c.name?.trim()||
  row.illustrationType!=="pokemon"||
  row.preExistingThemes?.slice().sort().join(",")!==verified.join(",")||
  prior.join(",")!==verified.join(",")||
  row.matchedThemes?.slice().sort().join(",")!==all.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||
  !row.artObservation?.trim()||row.originalSourceRequests!==0||
  row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s12a/181-210/s12a-181-210-"+String(Math.ceil((n-180)/15)).padStart(2,"0")+".webp.b64"||
  row.decodedProof?.status!=="decoded"||
  p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
  p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !["dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"].includes(host))
 throw Error("Korean art identity / prior theme proof mismatch "+n);
 if(host==="dcb-card-images-modern-2026.pages.dev")modernImages++;else legacyImages++;
 preservedCount+=verified.length;
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage)c.sourceImage=c.image;c.image=p.cdnUrl;}
 overrides.sets.s12a[c.code.toLowerCase()]=p.cdnUrl;
 for(const theme of extra){
  if(!THEMES.includes(theme)||verified.includes(theme))throw Error("Unexpected or duplicate theme "+n+"/"+theme);
  const category=theme==="color"?row.colorCategory:theme==="season"?row.seasonCategory:theme==="street"?row.streetCategory:theme==="cameo"?row.cameoCategory:null;
  if(!category)throw Error("Missing required artwork category "+n+"/"+theme);
  groups.get(theme).cards.push({
   code:row.cardKey,name:c.name,series:"S",set:master.code,
   setName:master.displayName||master.name,cardNumber:num+"/172",rarity:c.rarity||"",
   category,image:p.cdnUrl,
   evidence:"한국판 s12a "+num+"/172 실제 이미지 검수: "+row.artObservation+
     " 기존 테마 보존; "+row.proofImage+"; DCB 소유 CDN WEBP 검증."
  });
  additions[theme]=(additions[theme]||0)+1;addedCount++;
 }
}
for(const theme of Object.keys(EXPECTED))if(additions[theme]!==EXPECTED[theme])throw Error("Bad theme count "+theme);
if(master.cards.map(c=>c.code).join(",")!==codesBefore.join(",")||
 preservedCount!==25||modernImages!==28||legacyImages!==2||
 addedCount!==48)throw Error("s12a 181-210 integrity error");
status.reviews[master.code]={...prev,status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:210,verifiedSelfHostedImageCount:210,
 reviewedRanges:[...prev.reviewedRanges,"181-210"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prev.newlyAddedThemeSlotCount||0)+addedCount,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s12a-181-210-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s12a_001-210_210_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s12a canonical 211",
 note:"한국어 VSTAR 유니버스 262장 중 001-210 실제 일러스트 전수검수. 이번 30장 포켓몬 그림 재검토, 기존 연결 파노라마 등 25개 배치 테마를 보존하고 근거 있는 48개 도감 슬롯만 추가. 보유 CDN 모던 28, 레거시 2, 수집 정보 변경 없음."};
status.execution.currentEra="S";status.execution.currentSet="s12a";
status.execution.lastSafeCheckpoint="s12a canonical 001-210 (210/262) Korean artwork and 210 DCB-owned CDN images verified";
status.execution.nextStart="s12a canonical 211";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s12a",range:"canonical 181-210 Korean VSTAR Universe",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_DCB_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:28,legacyArchiveImages:2,priorThemeSlotsPreserved:25,
 themeAdditions:additions,nextStart:"s12a canonical 211",
 note:"30 owned-CDN Korean prints decoded and pictured artwork reviewed. Pre-existing 25 theme placements kept, 48 verified new placements, zero third-party image origin requests."});
images.nextStart="s12a canonical 211";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s12a",status:"in_progress",
 totalMasterCards:262,reviewedCanonicalCards:210,remainingUnreviewed:52,
 KoreanArtVerified:210,ownedCDNImagesVerified:210,newlyAddedThisBatch:addedCount,
 totalNewThemeSlots:status.reviews[master.code].newlyAddedThemeSlotCount,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:modernImages,legacyArchiveImages:legacyImages,
 priorBatchThemeSlotsKept:preservedCount,
 proof:A+"theme-visual-evidence/s12a/181-210/visual-index.json",
 visualReviewEvidence:A+"theme-s12a-181-210-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s12a canonical 211"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s12a-181-210-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s12a",reviewed:210,verifiedImages:210,
 oldThemesPreserved:preservedCount,newThemes:addedCount,additions,
 nextStart:images.nextStart}));
