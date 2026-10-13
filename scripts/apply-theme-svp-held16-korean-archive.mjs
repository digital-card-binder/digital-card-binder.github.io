import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const ePath="data/audits/theme-svp-final-16-artworks-energy8-held-20261013.json";
const auditPath="data/audits/theme-nine-sets-owned-image-20261013/SV-P/visual-index.json";
const statePath="data/audits/theme-series-review-status.json";
const themePath="data/art-themes.json",imagePath="data/audits/theme-image-selfhost-audit.json";
const tags=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [e,audit,series,legacy,themes,state,images]=await Promise.all([
 read(ePath),read(auditPath),read("data/series.json"),read("data/series-legacy.json"),
 read(themePath),read(statePath),read(imagePath)
]);
const set=[...series,...legacy].filter(s=>String(s.code||"").toUpperCase()==="SV-P");
if(set.length!==1||set[0].cards.length!==248)throw Error("One canonical Korean SV-P master with 248 entries expected");
const master=set[0],old=state.reviews?.[master.code];
if(old?.status==="complete"&&old.reviewedCardCount===248){
 console.log("SV-P already complete; do not overwrite");process.exit(0);
}
if(old?.status!=="in_progress"||old.reviewedCardCount!==224||
 !Array.isArray(old.heldCards)||old.heldCards.length!==24||
 audit.set!=="SV-P"||audit.expectedCanonicalCards!==248||
 audit.ownedCdnBinaryDecoded!==248||audit.ownedCdnBinaryUnavailable!==0||
 audit.cards?.length!==248||audit.missingKoreanMasterNames!==0||
 e.set!=="SV-P"||e.reviewedExistingBefore!==224||
 e.heldBefore!==24||e.newlyArtworkReviewed!==16||e.stillHeld!==8||
 e.verifiedRows?.length!==16||e.remainingPrintIdentityHolds?.length!==8)
 throw Error("SV-P 224+24 Korean artwork protected checkpoint moved");
const expectedHeld=new Set(old.heldCards.map(k=>String(k).toUpperCase()));
const rows=new Map(e.verifiedRows.map(x=>[x.cardKey.toUpperCase(),x]));
const energy=new Set(e.remainingPrintIdentityHolds.map(x=>x.cardKey.toUpperCase()));
if(rows.size!==16||energy.size!==8||[...rows.keys(),...energy].some(k=>!expectedHeld.has(k))||
 [...expectedHeld].some(k=>!rows.has(k)&&!energy.has(k)))
 throw Error("SV-P held 24 key integrity mismatch");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of tags)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing theme "+t);
const prior=new Map();
for(const g of themes.groups)for(const card of g.cards||[]){
 if(String(card.set||"").toUpperCase()!=="SV-P"&&!String(card.code||"").toUpperCase().startsWith("SV-P_"))continue;
 const key=String(card.code||"").toUpperCase(),arr=prior.get(key)||[];
 if(arr.includes(g.code))throw Error("Duplicate previous SV-P theme "+key+"/"+g.code);
 arr.push(g.code);prior.set(key,arr);
}
const existing=Array.from(prior.values()).reduce((n,a)=>n+a.length,0);
if(existing!==359)throw Error("359 pre-existing Korean SV-P independent placements changed: "+existing);
let newSlots=0,repointed=0;const additions={},seen=new Set();
for(let i=0;i<248;i++){
 const c=master.cards[i],a=audit.cards[i],no=String(c?.code||"").match(/^sv-p_([^/ ]+)/i)?.[1];
 if(!c||!a||!no||a.canonicalOrder!==i+1||
 String(c.code).toLowerCase()!==String(a.masterCode).toLowerCase()||
 String(c.name||"").trim()!==String(a.koreanMasterName||"").trim()||
 !String(c.name||"").trim()||a.imageCheck?.status!=="decoded"||a.imageCheck?.http!==200||
 a.imageCheck?.format!=="WEBP"||a.imageCheck?.dimensions?.[0]<380||a.imageCheck?.dimensions?.[1]<530||
 !/^https:\/\/dcb-card-images-(?:modern|legacy)-2026\.pages\.dev\//.test(a.ownedCdnUrl))
  throw Error("SV-P original Korean master / owned CDN binary proof invalid canonical "+(i+1));
 const key=("SV-P_"+no).toUpperCase(),row=rows.get(key);
 if(row){
  const sheet="data/audits/theme-nine-sets-owned-image-20261013/SV-P/SV-P-"+
   String(Math.ceil((i+1)/15)).padStart(2,"0")+".webp.b64";
  if(row.canonicalOrder!==i+1||row.cardCode!==c.code||
    row.koreanName!==c.name||!row.all12ThemesChecked||
    row.proofSheet!==sheet||row.ownedCDN!==a.ownedCdnUrl||
    !row.visualObservation?.trim()||
    !Array.isArray(row.themesMatched)||new Set(row.themesMatched).size!==row.themesMatched.length||
    row.themesMatched.some(t=>!tags.includes(t)))
    throw Error("Invalid Korean artwork proof for "+key);
  seen.add(key);
  for(const t of row.themesMatched){
   if((prior.get(key)||[]).includes(t))continue;
   const g=groups.get(t);
   g.cards.push({
    code:key,name:c.name,series:"SV",set:master.code,setName:master.name,
    cardNumber:String(c.code).split("_")[1]||"",rarity:c.rarity||"",
    category:g.cards[0]?.category||g.name,
    evidence:"한국판 12테마 일러스트 자체 저장 실물 증거 직접 검수: "+row.visualObservation+
      ". "+row.proofSheet+". 원본 서버 접속 없음.",
    image:a.ownedCdnUrl
   });
   additions[t]=(additions[t]||0)+1;newSlots++;
  }
 }
 // Preserve prior artwork assignments and user ownership, only repair display image URL
 for(const g of themes.groups){
  const r=g.cards.find(x=>String(x.code||"").toUpperCase()===key);
  if(!r||r.image===a.ownedCdnUrl)continue;
  if(r.image&&!r.sourceImage)r.sourceImage=r.image;
  r.image=a.ownedCdnUrl;repointed++;
 }
}
if(seen.size!==16)throw Error("All sixteen Korean SV-P previously held cards not reviewed");
const remaining=e.remainingPrintIdentityHolds.map(x=>x.cardKey);
state.reviews[master.code]={...old,status:"in_progress",reviewedAt:"2026-10-13",
 reviewedCardCount:240,reviewedThemes:tags,heldCards:remaining,
 newlyAddedThemeSlotCount:(old.newlyAddedThemeSlotCount||0)+newSlots,
 newlyAddedCards:[...new Set([...(old.newlyAddedCards||[]),...seen])],
 verifiedOwnCDNImageCount:248,
 archiveVerificationStatus:"all_248_owned_CDN_images_decoded__eight_print_number_mappings_held",
 fullSetEvidence:ePath,
 note:"SV-P 한국판 프로모 248장 중 일러스트 240장 12테마 판정 완료. 기존 224장 검수 유지, 새로 16장 해결. 8장 에너지 204-211 인쇄번호 교차검증 보류. 자체 CDN 248장 디코딩. 기존 소유 상태 변경 없음."
};
images.batches.push({
 task:6,set:master.code,range:"248 Korean owned-CDN images; 16 formerly held canonical artwork scenes resolved, 8 energy print IDs held",
 canonicalCardCount:248,artworkVisuallyVerifiedCount:240,artworkPendingCount:8,
 newlyInternalizedReferenceCount:0,selfHostedReferenceCountAfter:248,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_owned_CDN_binary_decoded__8_Korean_energy_slot_identities_pending",
 verifiedImageCount:248,unverifiedImageCount:0,brokenReferenceCount:0,
 previousKoreanArtworkReviewedCount:224,formerlyHeldKoreanArtReviewed:16,
 previousThemeSlotsPreserved:existing,
 themeAdditions:additions,existingThemeImagesRepointedToOwnCDN:repointed,
 nextStart:"SV-P_204..SV-P_211 Korean printed ID mapping; keep S-P original nextStart unchanged",
 note:"248 images physically served only from own CDN; Korean print identities for 8 energy candidates are not certified. Do not mark full set complete."
});
images.updatedAt="2026-10-13";
const report={schemaVersion:1,recordedAt:"2026-10-13",set:"SV-P",status:"in_progress",
 canonicalCards:248,ownedCDNDecoded:248,previousArtworkReviewed:224,newArtworkReviewed:16,
 artworkReviewedTotal:240,remainingPrintedIdentityHolds:remaining,
 previouslyExistingThemeSlotsPreserved:existing,newThemeSlotsAdded:newSlots,
 newThemeAdditions:additions,formerThemeImagesRepointedToOwnCDN:repointed,
 originalForeignImageDownloads:0,userOwnershipEdited:false,
 evidence:[ePath,auditPath],
 note:"Must not flag complete until eight energy exact Korean print ID mismatches resolved."};
await Promise.all([
 write(themePath,themes),write(statePath,state),write(imagePath,images),
 write("data/audits/theme-svp-16-artwork-archive-checkpoint-20261013.json",report)
]);
console.log(JSON.stringify(report,null,2));
