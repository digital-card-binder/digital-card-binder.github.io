import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,proof,modern,legacy,art,status,images,overrides]=await Promise.all([
 read(A+"theme-s12a-241-262-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/s12a/241-262/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s12a");
if(sets.length!==1||sets[0].cards?.length!==262)throw Error("Korean s12a master must contain 262 cards");
const master=sets[0],prev=status.reviews?.[master.code],originalCodes=master.cards.map(x=>x.code);
if(prev?.status==="complete"&&prev.reviewedCardCount===262&&prev.reviewedRanges?.includes("241-262")){
 console.log("All s12a 262 Korean cards already complete");process.exit(0);
}
if(prev?.status!=="in_progress"||prev.reviewedCardCount!==240||
 prev.reviewedRanges?.at(-1)!=="211-240"||prev.nextStart!=="s12a canonical 241"||
 prev.verifiedSelfHostedImageCount!==240||
 status.execution?.nextStart!=="s12a canonical 241"||
 images.nextStart!=="s12a canonical 241"||
 ev.set!=="s12a"||ev.expectedCanonicalCards!==262||
 ev.range!=="canonical-order 241-262"||
 ev.visuallyReviewedKoreanCards!==22||ev.verifiedOwnedCDNImages!==22||
 ev.originImageRequests!==0||!ev.all12ThemesInspected||ev.items?.length!==22||
 ev.newThemeSlotsThisBatch?.color!==4||ev.newThemeSlotsThisBatch?.season!==1||
 ev.existingThemeSlotsPreserved!==0||
 proof.set!=="s12a"||proof.cardCount!==22||proof.masterSetCardCount!==262||
 proof.canonicalRange!=="241-262"||proof.cards?.length!==22||
 proof.verificationCounts?.verified!==22||proof.verificationCounts?.missing!==0||
 proof.masterMissingKoreanNames!==0||proof.sheets?.length!==2||
 proof.sheets[0].file!=="s12a-241-262-01.webp.b64"||
 proof.sheets[1].file!=="s12a-241-262-02.webp.b64")
 throw Error("Unsafe 240/262 Korean review checkpoint or final image proof mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const name of THEMES)if(!Array.isArray(groups.get(name)?.cards))throw Error("Missing target theme "+name);
let previousSlots=0;
for(const group of art.groups)for(const c of group.cards||[]){
 const match=/^S12A_(\d{3})$/i.exec(String(c.code||""));
 if(!match)continue;
 previousSlots++;
 if(Number(match[1])>=241&&Number(match[1])<=262)
  throw Error("Unexpected pre-existing Korean s12a 241-262 theme "+c.code+"/"+group.code);
}
if(previousSlots<341)throw Error("Earlier 240-card Korean thematic classifications missing");
overrides.sets??={};overrides.sets.s12a??={};
const additions={};let newSlots=0,trainer=0,energy=0,pokemon=0,modernCount=0;
for(let i=0;i<22;i++){
 const n=241+i,number=String(n).padStart(3,"0"),p=proof.cards[i],row=ev.items[i],card=master.cards[n-1];
 const type=n<=250?"trainer":n<=258?"energy":"pokemon";
 const themes=n===260?["season","color"]:n>=259?["color"]:[];
 if(!card||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
  card.code?.toLowerCase()!=="s12a_"+number+"/172"||
  p.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.cardKey!=="S12A_"+number||row.printedNumber!==number+"/172"||
  p.name!==card.name||row.koreanName!==card.name||!card.name?.trim()||
  row.illustrationType!==type||
  row.preExistingThemes?.length!==0||p.existingThemes?.length!==0||
  row.newlyMatchedThemes?.join(",")!==themes.join(",")||
  row.matchedThemes?.join(",")!==themes.join(",")||
  !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
  row.originalSourceRequests!==0||row.ownedCDNUrl!==p.cdnUrl||
  row.proofImage!==A+"theme-visual-evidence/s12a/241-262/s12a-241-262-"+String(Math.ceil((n-240)/15)).padStart(2,"0")+".webp.b64"||
  row.decodedProof?.status!=="decoded"||p.imageCheck?.status!=="decoded"||
  p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
  p.imageCheck?.dimensions?.join(",")!=="420,586"||
  !p.cdnUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/"))
   throw Error("Korean final artwork or print identity mismatch "+n);
 if(type==="trainer")trainer++;else if(type==="energy")energy++;else pokemon++;
 modernCount++;
 if(card.image!==p.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=p.cdnUrl;}
 overrides.sets.s12a[card.code.toLowerCase()]=p.cdnUrl;
 for(const theme of themes){
  if(type!=="pokemon")throw Error("Non-Pokemon themed as pokemon "+n);
  const category=theme==="season"?row.seasonCategory:row.colorCategory;
  if(!category)throw Error("Final printed rarity artwork category missing "+n+"/"+theme);
  groups.get(theme).cards.push({
   code:row.cardKey,name:card.name,series:"S",set:master.code,
   setName:master.displayName||master.name,cardNumber:number+"/172",
   rarity:card.rarity||"",category,image:p.cdnUrl,
   evidence:"한국판 s12a "+number+"/172 시크릿 일러스트 검수: "+
     row.artObservation+" 증빙 "+row.proofImage+"; DCB 소유 WEBP 이미지 확인."
  });
  additions[theme]=(additions[theme]||0)+1;newSlots++;
 }
}
if(master.cards.map(x=>x.code).join(",")!==originalCodes.join(",")||
 trainer!==10||energy!==8||pokemon!==4||modernCount!==22||
 newSlots!==5||additions.season!==1||additions.color!==4)
 throw Error("Final Korean 22-card batch count or master identity changed");
const expectedRanges=["001-030","031-060","061-090","091-120","121-150","151-180","181-210","211-240"];
if(expectedRanges.some(x=>!prev.reviewedRanges?.includes(x))||
 prev.reviewedRanges?.length!==expectedRanges.length)
 throw Error("Incomplete s12a Korean 001-240 contiguous checkpoints; cannot close set");
status.reviews[master.code]={...prev,status:"complete",reviewedAt:"2026-10-14",
 reviewedCardCount:262,verifiedSelfHostedImageCount:262,
 reviewedRanges:[...prev.reviewedRanges,"241-262"],reviewedThemes:THEMES,heldCards:[],
 newlyAddedThemeSlotCount:(prev.newlyAddedThemeSlotCount||0)+newSlots,
 priorThemeSlotsPreserved:previousSlots,
 partialReviewEvidence:A+"theme-s12a-241-262-Korean-art-review-20261014.json",
 finalReviewEvidence:A+"theme-s12a-241-262-Korean-art-review-20261014.json",
 archiveVerificationStatus:"s12a_001-262_all_262_Korean_DCB_owned_CDN_images_decoded",
 nextStart:"s12 canonical 001",
 note:"한국판 VSTAR 유니버스 전체 262장 모든 레어도 및 트레이너·에너지 슬롯 12테마 검수 완료. 최종 22장 이미지 검증, 골드 레어 포켓몬 4장에 5개 신규 슬롯. 기존 수집 아이디·카드 코드·이미지 원본 출처 보존. 미확인 이미지 0."};
status.execution.currentEra="S";status.execution.currentSet="s12";
status.execution.lastSafeCheckpoint="s12a canonical 001-262 (262/262) Korean artwork and DCB-owned CDN images verified; strict complete";
status.execution.nextStart="s12 canonical 001";status.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"s12a",range:"canonical 241-262 Korean VSTAR Universe FINAL",
 canonicalCardCount:22,artworkVisuallyVerifiedCount:22,artworkPendingCount:0,
 selfHostedReferenceCountAfter:22,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"22_Korean_DCB_owned_CDN_images_decoded",
 verifiedImageCount:22,unverifiedImageCount:0,brokenReferenceCount:0,
 modernArchiveImages:22,legacyArchiveImages:0,pokemonCardsReviewed:4,
 trainerCardsExcludedFromPokemonThemes:10,energyCardsExcludedFromPokemonThemes:8,
 themeAdditions:additions,nextStart:"s12 canonical 001",
 note:"Verified final Korean 22 prints; s12a complete 262/262, 12/12 themes, no external image request, existing ownership unchanged."});
images.nextStart="s12 canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"s12a",status:"complete",
 totalMasterCards:262,reviewedCanonicalCards:262,remainingUnreviewed:0,
 KoreanArtVerified:262,ownedCDNImagesVerified:262,all12ThemesInspected:true,
 newlyAddedThisBatch:newSlots,totalNewThemeSlots:status.reviews[master.code].newlyAddedThemeSlotCount,
 byTheme:additions,existingThemeSlotsPreserved:previousSlots,modernArchiveImages:22,
 legacyArchiveImages:0,trainerCardsExcluded:10,energyCardsExcluded:8,
 proof:A+"theme-visual-evidence/s12a/241-262/visual-index.json",
 visualReviewEvidence:A+"theme-s12a-241-262-Korean-art-review-20261014.json",
 originalSourceRequests:0,ownershipStateChanges:0,nextSafeStart:"s12 canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",status),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-s12a-241-262-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"s12a",completed:262,verifiedImages:262,
 newlyAddedThemeSlots:newSlots,all12ThemesVerified:true,
 totalNewThemeSlots:status.reviews[master.code].newlyAddedThemeSlotCount,
 next:images.nextStart}));
