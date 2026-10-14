import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const EXPECTED={season:13,color:24,night:1,street:1};
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s12a-211-240-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s12a/211-240/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s12a");
if(sets.length!==1||sets[0].cards?.length!==262)throw Error("Missing the Korean 262-card s12a master");
const master=sets[0],prev=status.reviews?.[master.code],oldCodes=master.cards.map(x=>x.code);
if(prev?.reviewedCardCount>=240&&prev.reviewedRanges?.includes("211-240")){console.log("Already reviewed s12a 211-240");process.exit(0);}
if(prev?.status!=="in_progress"||prev.reviewedCardCount!==210||
 prev.reviewedRanges?.at(-1)!=="181-210"||prev.nextStart!=="s12a canonical 211"||
 prev.verifiedSelfHostedImageCount!==210||
 status.execution?.nextStart!=="s12a canonical 211"||images.nextStart!=="s12a canonical 211"||
 ev.set!=="s12a"||ev.expectedCanonicalCards!==262||ev.range!=="canonical-order 211-240"||
 ev.visuallyReviewedKoreanCards!==30||ev.verifiedOwnedCDNImages!==30||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==30||
 JSON.stringify(ev.newThemeSlotsThisBatch)!==JSON.stringify({season:13,color:24,night:1,street:1})||
 ev.existingThemeSlotsPreserved!==5||
 proof.set!=="s12a"||proof.cardCount!==30||proof.masterSetCardCount!==262||
 proof.canonicalRange!=="211-240"||proof.cards?.length!==30||
 proof.verificationCounts?.verified!==30||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s12a-211-240-01.webp.b64"||
 proof.sheets[1].file!=="s12a-211-240-02.webp.b64")
 throw Error("Unsafe 210/262 resume state or Korean proof mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const name of THEMES)if(!Array.isArray(groups.get(name)?.cards))throw Error("Missing theme "+name);
const current=new Map();let previousSlots=0;
for(const group of art.groups)for(const card of group.cards||[]){
 const m=/^S12A_(\d{3})$/i.exec(String(card.code||""));
 if(!m)continue;previousSlots++;
 const n=Number(m[1]);
 if(n>=211&&n<=240){const list=current.get(n)||[];list.push(group.code);current.set(n,list);}
}
if(previousSlots<302)throw Error("Prior s12a classifications lost");
overrides.sets??={};overrides.sets.s12a??={};
const additions={};let pokemonCount=0,trainerCount=0,modernCount=0,legacyCount=0,oldSlots=0,newSlots=0;
for(let i=0;i<30;i++){
 const n=i+211,number=String(n).padStart(3,"0"),pokemon=n<=234;
 const card=master.cards[n-1],p=proof.cards[i],row=ev.items[i];
 const currentThemes=(current.get(n)||[]).slice().sort(),prior=(p.existingThemes||[]).slice().sort();
 const extra=row?.newlyMatchedThemes||[],combined=[...new Set([...prior,...extra])].sort();
 const host=p?.cdnUrl?.split("/")[2];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=="s12a_"+number+"/172"||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=="S12A_"+number||row.printedNumber!==number+"/172"||
  p.name!==card.name||row.koreanName!==card.name||!card.name?.trim()||
  row.illustrationType!==(pokemon?"pokemon":"trainer")||
  row.preExistingThemes?.slice().sort().join(",")!==prior.join(",")||
  currentThemes.join(",")!==prior.join(",")||
  row.matchedThemes?.slice().sort().join(",")!==combined.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s12a/211-240/s12a-211-240-"+String(Math.ceil((n-210)/15)).padStart(2,"0")+".webp.b64"||
  row.decodedProof?.status!=="decoded"||
  p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||
  p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !["dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"].includes(host))
 throw Error("Korean printed identity or preserved theme mismatch "+n);
 if(pokemon)pokemonCount++;else trainerCount++;
 if(host==="dcb-card-images-modern-2026.pages.dev")modernCount++;else legacyCount++;
 oldSlots+=prior.length;
 if(card.image!==p.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=p.cdnUrl;}
 overrides.sets.s12a[card.code.toLowerCase()]=p.cdnUrl;
 for(const theme of extra){
  if(!pokemon||!THEMES.includes(theme)||prior.includes(theme))throw Error("Duplicate/nonpokemon theme "+n+"/"+theme);
  const category=theme==="color"?row.colorCategory:theme==="season"?row.seasonCategory:theme==="night"?row.nightCategory:theme==="street"?row.streetCategory:null;
  if(!category)throw Error("Theme category missing "+n+"/"+theme);
  groups.get(theme).cards.push({
   code:row.cardKey,name:card.name,series:"S",set:master.code,setName:master.displayName||master.name,
   cardNumber:number+"/172",rarity:card.rarity||"",category,image:p.cdnUrl,
   evidence:"한국판 s12a "+number+"/172 실물 일러스트 검수: "+row.artObservation+
     " 기존 테마 보존, 이미지 "+row.proofImage+"; DCB 자체 WEBP 확인."
  });
  additions[theme]=(additions[theme]||0)+1;newSlots++;
 }
}
for(const t of Object.keys(EXPECTED))if(additions[t]!==EXPECTED[t])throw Error("Unexpected theme count "+t);
if(master.cards.map(x=>x.code).join(",")!==oldCodes.join(",")||
 pokemonCount!==24||trainerCount!==6||oldSlots!==5||
 modernCount!==29||legacyCount!==1||newSlots!==39)
 throw Error("s12a 211-240 audit counts do not match actual Korean print evidence");
status.reviews[master.code]={...prev,status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:240,verifiedSelfHostedImageCount:240,
 reviewedRanges:[...prev.reviewedRanges,"211-240"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prev.newlyAddedThemeSlotCount||0)+newSlots,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s12a-211-240-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s12a_001-240_240_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s12a canonical 241",
 note:"VSTAR 유니버스 262 중 한국판 240장 12테마 검수. 이번 24 포켓몬 SAR 그림 분류 39개 추가, 기존 연결·잠자는 5건 보존, 서포트 6장은 제외. 자체 CDN 검증, 수집 정보 보존."};
status.execution.currentEra="S";status.execution.currentSet="s12a";
status.execution.lastSafeCheckpoint="s12a canonical 001-240 (240/262) Korean artwork and 240 DCB-owned CDN images verified";
status.execution.nextStart="s12a canonical 241";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s12a",range:"canonical 211-240 Korean VSTAR Universe",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_DCB_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:29,legacyArchiveImages:1,
 pokemonCardsReviewed:24,trainerCardsExcludedFromPokemonThemes:6,
 priorThemeSlotsPreserved:oldSlots,themeAdditions:additions,
 nextStart:"s12a canonical 241",note:"30 actual Korean card images inspected from DCB-owned Cloudflare; no origin request or ownership change."});
images.nextStart="s12a canonical 241";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s12a",status:"in_progress",
 totalMasterCards:262,reviewedCanonicalCards:240,remainingUnreviewed:22,
 KoreanArtVerified:240,ownedCDNImagesVerified:240,newlyAddedThisBatch:newSlots,
 totalNewThemeSlots:status.reviews[master.code].newlyAddedThemeSlotCount,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,
 modernArchiveImages:modernCount,legacyArchiveImages:legacyCount,
 priorBatchThemeSlotsKept:oldSlots,trainerCardsExcluded:6,
 proof:A+"theme-visual-evidence/s12a/211-240/visual-index.json",
 visualReviewEvidence:A+"theme-s12a-211-240-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s12a canonical 241"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s12a-211-240-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s12a",reviewed:240,verifiedImages:240,newThemeSlots:newSlots,
 themes:additions,next:images.nextStart}));
