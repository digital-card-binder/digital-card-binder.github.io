import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const ePath="data/audits/theme-svp-final-16-artworks-energy8-held-20261013.json";
const kPath="data/audits/theme-svp-eight-unnumbered-energy-korean-proof-20261013.json";
const auditPath="data/audits/theme-nine-sets-owned-image-20261013/SV-P/visual-index.json";
const statePath="data/audits/theme-series-review-status.json";
const themePath="data/art-themes.json",imagePath="data/audits/theme-image-selfhost-audit.json";
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [e,k,audit,series,legacy,themes,state,images,official]=await Promise.all([
 read(ePath),read(kPath),read(auditPath),read("data/series.json"),read("data/series-legacy.json"),
 read(themePath),read(statePath),read(imagePath),read("data/audits/sv-p-official-detail-audit.json")
]);
const matches=[...series,...legacy].filter(s=>String(s.code||"").toUpperCase()==="SV-P");
if(matches.length!==1||matches[0].cards?.length!==248)throw Error("Exactly 248 Korean promo master cards required");
const master=matches[0],priorReview=state.reviews?.[master.code];
if(priorReview?.status==="complete"&&priorReview.reviewedCardCount===248){
 console.log("Already 248 Korean SV-P cards completed; do not reapply");process.exit(0);
}
if(priorReview?.status!=="in_progress"||priorReview.reviewedCardCount!==224||
 priorReview.heldCards?.length!==24||
 e.set!=="SV-P"||e.reviewedExistingBefore!==224||e.newlyArtworkReviewed!==16||
 e.verifiedRows?.length!==16||e.remainingPrintIdentityHolds?.length!==8||
 k.set!=="SV-P"||k.cards?.length!==8||k.region!=="KOR"||
 !k.firstPartySource?.startsWith("https://www.pokemonkorea.co.kr/koreanleague2023/")||
 k.externalImageDownloads!==0||
 k.status!=="Korean_event_unnumbered_variants_confirmed_internal_catalog_keys_preserved"||
 audit.set!=="SV-P"||audit.expectedCanonicalCards!==248||
 audit.ownedCdnBinaryDecoded!==248||audit.ownedCdnBinaryUnavailable!==0||
 audit.cards?.length!==248||audit.missingKoreanMasterNames!==0||
 official.summary?.expectedSlotCount!==248||official.summary?.verifiedSlotCount!==198)
 throw Error("SV-P protected partial review / Korean physical evidence checkpoint has changed");
const priorHolds=new Set(priorReview.heldCards.map(s=>String(s).toUpperCase()));
const scene=new Map(e.verifiedRows.map(x=>[x.cardKey.toUpperCase(),x]));
const energy=new Map(k.cards.map(x=>[x.catalogId.toUpperCase(),x]));
if(scene.size!==16||energy.size!==8||
 [...scene.keys(),...energy.keys()].some(x=>!priorHolds.has(x))||
 [...priorHolds].some(x=>!scene.has(x)&&!energy.has(x)))
 throw Error("24 held Korean card keys do not exactly match 16 full-card and 8 unnumbered energy evidence");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing 12-theme collection "+t);
const previous=new Map();
for(const g of themes.groups)for(const x of g.cards||[]){
 if(String(x.set||"").toUpperCase()!=="SV-P"&&
    !String(x.code||"").toUpperCase().startsWith("SV-P_"))continue;
 const key=String(x.code||"").toUpperCase(),arr=previous.get(key)||[];
 if(arr.includes(g.code))throw Error("Duplicate previous theme card "+key+"/"+g.code);
 arr.push(g.code);previous.set(key,arr);
}
const previousTotal=[...previous.values()].reduce((sum,x)=>sum+x.length,0);
if(previousTotal!==359)throw Error("Expected 359 existing SV-P independent art-theme slots, found "+previousTotal);
let added=0,repointed=0;const themeAdditions={},reviewed=new Set(),unnumberedIds=[];
for(let i=0;i<248;i++){
 const c=master.cards[i],a=audit.cards[i],id=String(c?.code||"").match(/^sv-p_([^/ ]+)/i)?.[1];
 if(!c||!a||!id||String(c.code).toLowerCase()!==String(a.masterCode).toLowerCase()||
  a.canonicalOrder!==i+1||String(c.name||"").trim()!==String(a.koreanMasterName||"").trim()||
  !String(c.name||"").trim()||a.imageCheck?.status!=="decoded"||a.imageCheck?.http!==200||
  a.imageCheck?.format!=="WEBP"||a.imageCheck?.dimensions?.[0]<380||
  a.imageCheck?.dimensions?.[1]<530||
  !/^https:\/\/dcb-card-images-(?:modern|legacy)-2026\.pages\.dev\//.test(a.ownedCdnUrl))
  throw Error("Invalid canonical Korean SV-P card and owned image archive at order "+(i+1));
 const key=("SV-P_"+id).toUpperCase(),row=scene.get(key),un=energy.get(key);
 if(row&&un)throw Error("Cannot be numbered 16-slot and unnumbered 8-energy simultaneously");
 const requiredSheet="data/audits/theme-nine-sets-owned-image-20261013/SV-P/SV-P-"+
  String(Math.ceil((i+1)/15)).padStart(2,"0")+".webp.b64";
 if(row){
  if(row.canonicalOrder!==i+1||row.cardCode!==c.code||
   row.koreanName!==c.name||!row.all12ThemesChecked||
   row.proofSheet!==requiredSheet||row.ownedCDN!==a.ownedCdnUrl||
   !String(row.visualObservation||"").trim()||
   !Array.isArray(row.themesMatched)||new Set(row.themesMatched).size!==row.themesMatched.length||
   row.themesMatched.some(x=>!themes12.includes(x)))
   throw Error("Unverified original Korean promo artwork "+key);
 }
 if(un){
  if(un.canonicalOrder!==i+1||un.masterCode!==c.code||
   un.koreanCardName!==c.name||!un.all12ThemesChecked||
   un.visiblePrintedNumber!==null||un.physicalCardHasCollectionNumber!==false||
   un.physicalSeriesMark!=="PROMO"||
   un.eventStamp!=="POKÉMON KOREAN LEAGUE 2023"||
   un.ownedCDN!==a.ownedCdnUrl||
   un.evidenceFile!=="data/audits/theme-svp-energy-print-identity-20261013/korean-energy-number-crops.webp.b64"||
   JSON.stringify(un.independentThemeMatch)!==JSON.stringify(["color"]))
   throw Error("Unnumbered Korean energy physical identity not verified "+key);
  unnumberedIds.push(key);
 }
 if(row||un){
  reviewed.add(key);
  const tList=row?row.themesMatched:un.independentThemeMatch;
  for(const t of tList){
   if((previous.get(key)||[]).includes(t))continue;
   const g=groups.get(t);
   g.cards.push({
    code:key,name:c.name,series:"SV",set:master.code,setName:master.name,
    cardNumber:un?"":String(c.code).split("_")[1]||"",
    rarity:c.rarity||"",category:g.cards[0]?.category||g.name,
    printedNumberStatus:un?"unnumbered_PROMO_internal_catalog_identifier":undefined,
    evidence:un?"한국판 2023 코리안리그 파이널 홀로 에너지 8종, 실물 번호 없이 PROMO 표기. "+
     "포켓몬코리아 공식 "+k.firstPartySource+
     "; 자가 CDN 확대 인쇄 증거 "+un.evidenceFile+". 번호 "+id+"은 내부 식별자.":
     "한국판 일러스트 12테마 자가 CDN 시각 검수: "+row.visualObservation+" ("+row.proofSheet+").",
    image:a.ownedCdnUrl
   });
   themeAdditions[t]=(themeAdditions[t]||0)+1;added++;
  }
 }
 // Previously reviewed cards retain their theme memberships. Repair only the displayed image.
 for(const g of themes.groups){
  const matching=g.cards.filter(x=>String(x.code||"").toUpperCase()===key);
  for(const tr of matching){
   if(tr.image===a.ownedCdnUrl)continue;
   if(tr.image&&!tr.sourceImage)tr.sourceImage=tr.image;
   tr.image=a.ownedCdnUrl;repointed++;
  }
 }
}
if(reviewed.size!==24||unnumberedIds.length!==8)
 throw Error("SV-P 24 previously held artworks including 8 unnumbered print variations not complete");
if(new Set(unnumberedIds).size!==8)throw Error("Repeated 2023 Korean League energy");
state.reviews[master.code]={
 ...priorReview,status:"complete",reviewedAt:"2026-10-13",reviewedCardCount:248,
 reviewedThemes:themes12,heldCards:[],
 newKoreanArtworkReviews:24,previousKoreanArtworkReviewsPreserved:224,
 newlyAddedThemeSlotCount:(priorReview.newlyAddedThemeSlotCount||0)+added,
 newlyAddedCards:[...new Set([...(priorReview.newlyAddedCards||[]),...reviewed])],
 verifiedSelfHostedImageCount:248,
 archiveVerificationStatus:"248_owned_CDN_Korean_promo_print_artworks_decoded_8_unnumbered_energy_identified",
 fullSetEvidence:ePath,unnumberedEnergyEvidence:kPath,
 KoreanUnnumberedEnergyMasterKeys:unnumberedIds,
 note:"한국판 SV-P 248장 12테마 시각 전수검수 완료. 기존 224장 보존, 카드 16장 + 한국 코리안리그 무번호 에너지 8장 확인. 204~211은 인쇄번호가 아닌 내부 카탈로그 키. 기존 소유권/체크 상태 불변. 공식 상세 페이지 미공개 프로모 50건의 후속 메타 증빙은 별도."
};
images.batches.push({
 task:6,set:master.code,range:"canonical 001-248 complete Korean promo card prints and owned CDN audit; 16 former art holds plus 8 unnumbered official energy promos",
 canonicalCardCount:248,artworkVisuallyVerifiedCount:248,artworkPendingCount:0,
 externalImageReferenceCountBefore:0,newlyInternalizedReferenceCount:0,
 selfHostedReferenceCountAfter:248,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_owned_CDN_Korean_promo_card_images_and_event_8_unnumbered_energies",
 verifiedImageCount:248,unverifiedImageCount:0,brokenReferenceCount:0,
 previousKoreanArtworkReviewsPreserved:224,formerlyHeldKoreanArtCompleted:24,
 previousThemeSlotsPreserved:previousTotal,themeAdditions,
 existingThemeImagesRepointedToOwnCDN:repointed,
 unnumberedKoreanLeagueEnergyCards:unnumberedIds,
 note:"All 248 owned Cloudflare binary images verified and Korean card artwork matched. 8 energy physical cards unnumbered (PROMO) 2023 Korean League official 8-card award. No third-party image requests, no ownership changes."
});
images.updatedAt="2026-10-13";
const report={
 schemaVersion:1,recordedAt:"2026-10-13",set:master.code,status:"complete",
 canonicalCards:248,originalKoreanArtReviewsPreserved:224,formerlyHeldArtReviewed:16,
 unnumberedKorean2023LeagueEnergyPrintsVerified:8,
 ownedCDNImagesDecoded:248,foreignOriginImageRequests:0,
 existingIndependentThemeSlotsPreserved:previousTotal,
 newlyAddedThemeSlots:added,themeAdditions,previousThemeImageLinksRepointedToOwnCDN:repointed,
 officialCardDetailMetadataStillPendingOutsideThemeReview:official.summary.pendingOfficialEvidenceCount,
 syntheticMasterKeysNotPhysicalNumbers:unnumberedIds,
 evidence:[ePath,kPath,auditPath],
 userOwnershipEdited:false,
 note:"Official Korean website confirms 8 energy awards; exact master key 204-211 is synthetic and is never reported as physically printed ID."
};
await Promise.all([
 write(themePath,themes),write(statePath,state),write(imagePath,images),
 write("data/audits/theme-svp-strict-completion-20261013.json",report)
]);
console.log(JSON.stringify(report,null,2));
