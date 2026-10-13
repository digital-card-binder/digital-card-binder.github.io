// Revalidated after correcting 11 prior Scarlet ex theme evidence keys in 108 owned-CDN visual-index records.
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const evidencePath="data/audits/theme-sv1S-001-108-art-review.json";
const progressPath="data/audits/theme-sv1S-set-progress-20261013.json";
const indexPath="data/audits/theme-visual-evidence/sv1S/visual-index.json";
const statePath="data/audits/theme-series-review-status.json";
const imagesPath="data/audits/theme-image-selfhost-audit.json";
const themesPath="data/art-themes.json";
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [e,index,modern,legacy,themes,state,images,progress]=await Promise.all([
 read(evidencePath),read(indexPath),read("data/series.json"),read("data/series-legacy.json"),
 read(themesPath),read(statePath),read(imagesPath),read(progressPath)
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()==="sv1s");
if(matches.length!==1||!modern.includes(matches[0]))
 throw Error("Expected exactly one Korean Scarlet ex modern master");
const master=matches[0],code=master.code,priorReview=state.reviews?.[code];
if(priorReview?.status==="complete"&&priorReview.reviewedCardCount===108){
 console.log("Already completed 108 Korean Scarlet ex canonical cards");process.exit(0);
}
if(priorReview?.status==="complete"||priorReview?.reviewedCardCount>0||
 progress.appliedReviewThrough!==0||images.nextStart!=="sv1S canonical 001")
 throw Error("Scarlet ex safe checkpoint moved: do not overwrite prior work");
if(e.schemaVersion!==1||e.set!=="sv1S"||e.officialKoreanSetName!=="스칼렛 ex"||
 e.masterCanonicalCount!==108||e.cardsReviewed!==108||e.cards?.length!==108||
 e.existingOwnedCdnImagesVerified!==108||e.originImageRequests!==0||
 e.priorThemePlacementsToPreserve!==11||e.koreanMasterNamesMissingBefore!==90||
 JSON.stringify(e.all12ThemesConsidered)!==JSON.stringify(themes12)||
 index.set!=="sv1S"||index.cardCount!==108||index.cards?.length!==108||
 index.verificationCounts?.verified!==108||index.verificationCounts?.missing!==0||
 master.cards?.length!==108||progress.canonicalCardSlots!==108||
 progress.verifiedOwnedCDNImages!==108||progress.missingOwnedCDNImages!==0||
 progress.unresolvedKoreanMasterNames!==90||progress.koreanMasterNamesAlreadyPresent!==18||
 progress.preexistingThemeSlotsToPreserve!==11)
 throw Error("108 Korean Scarlet ex printed proof / master name checkpoint mismatch");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!Array.isArray(groups.get(t)?.cards))
 throw Error("Missing independent theme "+t);
const existing=new Map();
for(const g of themes.groups)for(const row of g.cards||[]){
 if(String(row.set||"").toLowerCase()!=="sv1s"&&
    !/^SV1S_\d{3}$/.test(String(row.code||"").toUpperCase()))continue;
 const key=String(row.code||"").toUpperCase(),arr=existing.get(key)||[];
 arr.push(g.code);existing.set(key,arr);
}
const oldSlots=[...existing.values()].reduce((n,a)=>n+a.length,0);
if(oldSlots!==11||existing.size!==8)throw Error("Existing 11 themes on 8 Scarlet ex cards changed");
let added=0,repaired=0;const addedByTheme={};
for(let i=0;i<108;i++){
 const row=e.cards[i],proof=index.cards[i],card=master.cards[i],n=i+1;
 const print=String(card?.code||"").match(/_(\d{3}\/\d{3})\b/);
 if(!row||!proof||!card||!print||row.canonicalOrder!==n||proof.canonicalOrder!==n||
    String(card.code).toLowerCase()!==String(proof.masterCode).toLowerCase()||
    !String(row.koreanName||"").trim()||
    (card.name&&String(card.name).trim()!==row.koreanName)||
    (proof.name&&String(proof.name).trim()!==row.koreanName)||
    proof.imageCheck?.status!=="decoded"||proof.imageCheck?.http!==200||
    proof.imageCheck?.format!=="WEBP"||
    proof.imageCheck?.dimensions?.join(",")!=="420,586"||
    !/^https:\/\/dcb-card-images-modern-2026\.pages\.dev\/data\/wmimages\/SV\/SV1S\/SV1S_\d{3}\.webp$/.test(proof.cdnUrl)||
    !String(proof.rawSource||"").startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV1S/")||
    !String(row.visualObservation||"").trim()||
    !Array.isArray(row.themesMatched)||
    row.themesMatched.some(t=>!themes12.includes(t))||
    new Set(row.themesMatched).size!==row.themesMatched.length)
  throw Error("Invalid Scarlet ex Korean print, visual evidence, name or selfhost image at "+n);
 const printed=print[1],key="SV1S_"+printed.slice(0,3);
 const old=(existing.get(key)||[]).sort(),proofOld=[...new Set(proof.existingThemes||[])].sort();
 if(JSON.stringify(old)!==JSON.stringify(proofOld)||
    old.some(t=>!row.themesMatched.includes(t)))
  throw Error("Previous Scarlet ex theme placement was removed or altered: "+key);
 if(!String(card.name||"").trim()){card.name=row.koreanName;repaired++;}
 for(const tag of row.themesMatched){
  if(old.includes(tag))continue;
  const group=groups.get(tag);
  group.cards.push({
   code:key,name:card.name,series:"SV",set:code,setName:"스칼렛 ex",
   cardNumber:printed,rarity:card.rarity||"",
   category:group.cards[0]?.category||group.name,
   evidence:"한국판 자가저장 원본 108장 시트 직접 판독: "+row.visualObservation+
    ". 증거 "+indexPath+" 및 "+evidencePath+"; 외부 이미지 트래픽 없음.",
   image:proof.cdnUrl
  });
  addedByTheme[tag]=(addedByTheme[tag]||0)+1;added++;
 }
}
if(repaired!==90||master.cards.some(c=>!String(c.name||"").trim()))
 throw Error("Expected exactly 90 previously blank Korean card names to be repaired");
if(!master.name||String(master.name).toLowerCase()==="sv1s 도감")
 master.name="스칼렛 ex";
else if(master.name!=="스칼렛 ex")
 throw Error("Existing Scarlet ex Korean set title changed");
state.reviews[code]={
 status:"complete",reviewedAt:"2026-10-13",reviewedCardCount:108,
 reviewedThemes:themes12,heldCards:[],
 newlyAddedThemeSlotCount:added,previouslyPreservedThemeSlotCount:11,
 masterKoreanNamesRepaired:repaired,verifiedSelfHostedImageCount:108,
 archiveVerificationStatus:"108_owned_CDN_Korean_print_images_decoded",
 fullSetEvidence:evidencePath,
 note:"스칼렛 ex 한국판 108장 인쇄 카드명과 전 레어도 12테마 전수검수. 빈 한국어 카드명 90건 복구, 기존 테마 11건 보존, 신규 외부 요청 0건."
};
images.batches.push({
 task:6,set:code,range:"canonical 001-108 full Korean Scarlet ex visual and card-name review",
 canonicalCardCount:108,artworkVisuallyVerifiedCount:108,artworkPendingCount:0,
 externalImageReferenceCountBefore:0,newlyInternalizedReferenceCount:0,
 selfHostedReferenceCountAfter:108,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_existing_Korean_CDN_binary_decoded",
 verifiedImageCount:108,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:addedByTheme,masterKoreanNamesRepaired:repaired,
 priorPreservedThemePlacements:11,nextStart:"S-P canonical 001",
 note:"108 Korean printed images inspected from owned Cloudflare only. 90 missing printed Korean master titles visually repaired, 11 earlier thematic registrations preserved."
});
images.nextStart="S-P canonical 001";images.updatedAt="2026-10-13";
Object.assign(progress,{
 status:"complete",appliedReviewThrough:108,
 newThemeSlotsAdded:added,themeAdditionsApplied:addedByTheme,
 previousThemePlacementsKept:11,namedCardsRepaired:repaired,
 unresolvedKoreanMasterNames:0,koreanMasterNamesAlreadyPresent:108,
 nextSafeStart:"sv1S strict complete; next pending S-P canonical 001",
 remaining:[],
 notes:"108 Korean Scarlet ex card images reviewed; missing 90 Korean card names repaired, 11 previous slots intact. All archived and decoded from owned CDN; no ownership-state edits."
});
await Promise.all([
 write("data/series.json",modern),write(themesPath,themes),
 write(statePath,state),write(imagesPath,images),write(progressPath,progress)
]);
console.log(JSON.stringify({set:code,complete:true,reviewed:108,repairedNames:repaired,priorSlots:11,newSlots:added,byTheme:addedByTheme,next:images.nextStart},null,2));
