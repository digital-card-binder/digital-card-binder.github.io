import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const evidencePath="data/audits/theme-sv1V-001-108-art-review.json";
const progressPath="data/audits/theme-sv1V-set-progress-20261013.json";
const indexPath="data/audits/theme-visual-evidence/sv1V/visual-index.json";
const statePath="data/audits/theme-series-review-status.json";
const imagesPath="data/audits/theme-image-selfhost-audit.json";
const themesPath="data/art-themes.json";
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];

const [e,index,modern,legacy,themes,state,images,progress]=await Promise.all([
  read(evidencePath),read(indexPath),read("data/series.json"),read("data/series-legacy.json"),
  read(themesPath),read(statePath),read(imagesPath),read(progressPath)
]);
const masterMatches=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()==="sv1v");
if(masterMatches.length!==1)throw Error("Exactly one Korean Violet ex master expected");
const master=masterMatches[0],code=master.code,priorReview=state.reviews?.[code];
if(priorReview?.status==="complete"&&priorReview.reviewedCardCount===108){
  console.log("Already safely completed 108 Korean Violet ex prints");process.exit(0);
}
if(priorReview?.status==="complete"||priorReview?.reviewedCardCount>0||
    progress.appliedReviewThrough!==0||images.nextStart!=="sv1V canonical 001")
  throw Error("Violet ex main checkpoint moved; refuse to overwrite");
if(e.schemaVersion!==1||e.set!=="sv1V"||e.officialKoreanSetName!=="바이올렛 ex"||
   e.masterCanonicalCount!==108||e.cardsReviewed!==108||e.cards?.length!==108||
   e.existingOwnedCdnImagesVerified!==108||e.originImageRequests!==0||
   e.priorThemePlacementsToPreserve!==13||
   JSON.stringify(e.all12ThemesConsidered)!==JSON.stringify(themes12)||
   index.set!=="sv1V"||index.cardCount!==108||index.cards?.length!==108||
   index.verificationCounts?.verified!==108||index.verificationCounts?.missing!==0||
   master.cards?.length!==108||progress.canonicalCardSlots!==108||
   progress.verifiedOwnedCDNImages!==108||progress.missingOwnedCDNImages!==0||
   progress.unresolvedKoreanMasterNames!==0||progress.preexistingThemeSlotsToPreserve!==13)
  throw Error("108-image Korean visual proof and checkpoint mismatch");

const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!Array.isArray(groups.get(t)?.cards))
  throw Error("Missing independent 12-theme collection "+t);
const existing=new Map();
for(const g of themes.groups)for(const c of g.cards||[]){
  if(String(c.set||"").toLowerCase()!=="sv1v"&&
     !/^SV1V_\d{3}$/.test(String(c.code||"").toUpperCase()))continue;
  const key=String(c.code||"").toUpperCase();
  const tags=existing.get(key)||[];
  tags.push(g.code);existing.set(key,tags);
}
const oldSlots=[...existing.values()].reduce((n,t)=>n+t.length,0);
if(oldSlots!==13||existing.size!==8)throw Error("Previous 13 placements in 8 cards changed");
let added=0;const addedByTheme={};
for(let i=0;i<108;i++){
  const row=e.cards[i],proof=index.cards[i],card=master.cards[i],n=i+1;
  const print=String(card?.code||"").match(/_(\d{3}\/\d{3})\b/);
  if(!row||!proof||!card||!print||row.canonicalOrder!==n||proof.canonicalOrder!==n||
     String(card.code).toLowerCase()!==String(proof.masterCode).toLowerCase()||
     !String(card.name||"").trim()||card.name!==proof.name||
     proof.imageCheck?.status!=="decoded"||proof.imageCheck?.http!==200||
     proof.imageCheck?.format!=="WEBP"||
     proof.imageCheck?.dimensions?.join(",")!=="420,586"||
     !/^https:\/\/dcb-card-images-modern-2026\.pages\.dev\/data\/wmimages\/SV\/SV1V\/SV1V_\d{3}\.webp$/.test(proof.cdnUrl)||
     !String(proof.rawSource||"").startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV1V/")||
     !String(row.visualObservation||"").trim()||
     !Array.isArray(row.themesMatched)||
     row.themesMatched.some(t=>!themes12.includes(t))||
     new Set(row.themesMatched).size!==row.themesMatched.length)
    throw Error("Invalid Korean visual evidence or owned CDN image on canonical order "+n);
  const printed=print[1],key="SV1V_"+printed.slice(0,3);
  const old=(existing.get(key)||[]).sort();
  const proofOld=[...new Set(proof.existingThemes||[])].sort();
  if(JSON.stringify(old)!==JSON.stringify(proofOld)||
     old.some(t=>!row.themesMatched.includes(t)))
    throw Error("A prior theme placement was changed or dropped for "+key);
  for(const tag of row.themesMatched){
    if(old.includes(tag))continue;
    const group=groups.get(tag);
    group.cards.push({
      code:key,name:card.name,series:"SV",set:code,setName:"바이올렛 ex",
      cardNumber:printed,rarity:card.rarity||"",
      category:group.cards[0]?.category||group.name,
      evidence:"한국판 108장 자체 CDN 이미지 시트 검수: "+row.visualObservation+
        ". 증거 "+indexPath+" 및 "+evidencePath+"; 외부 원본 신규 요청 없음.",
      image:proof.cdnUrl
    });
    addedByTheme[tag]=(addedByTheme[tag]||0)+1;
    added++;
  }
}
state.reviews[code]={
  status:"complete",reviewedAt:"2026-10-13",reviewedCardCount:108,
  reviewedThemes:themes12,heldCards:[],
  newlyAddedThemeSlotCount:added,previouslyPreservedThemeSlotCount:13,
  masterKoreanNamesRepaired:0,verifiedSelfHostedImageCount:108,
  archiveVerificationStatus:"108_owned_CDN_Korean_print_images_decoded",
  fullSetEvidence:evidencePath,
  note:"바이올렛 ex 한국판 카드 108장 실물 카드 이미지 12테마 전수검수. 기존 13테마 슬롯 유지; 이미지 원본 직접 요청 0건; 소유상태 미변경."
};
images.batches.push({
  task:6,set:code,range:"canonical 001-108 full Korean Violet ex artwork visual review",
  canonicalCardCount:108,artworkVisuallyVerifiedCount:108,artworkPendingCount:0,
  externalImageReferenceCountBefore:0,newlyInternalizedReferenceCount:0,
  selfHostedReferenceCountAfter:108,externalImageReferenceCountAfter:0,
  archiveVerificationStatus:"verified_existing_Korean_CDN_binary_decoded",
  verifiedImageCount:108,unverifiedImageCount:0,brokenReferenceCount:0,
  themeAdditions:addedByTheme,priorPreservedThemePlacements:13,masterKoreanNamesRepaired:0,
  nextStart:"sv1S canonical 001",
  note:"108 Korean printed card images decoded from Digital Card Binder owned Cloudflare; 8 contact sheets manually reviewed for all 12 themes. No third-party image request."
});
images.nextStart="sv1S canonical 001";images.updatedAt="2026-10-13";
Object.assign(progress,{
  status:"complete",appliedReviewThrough:108,
  newThemeSlotsAdded:added,themeAdditionsApplied:addedByTheme,
  previousThemePlacementsKept:13,verifiedOwnedCDNImages:108,
  nextSafeStart:"sv1V strict complete; next pending sv1S canonical 001",
  remaining:[],
  notes:"108 Korean Violet ex cards visually reviewed in 8 own-CDN image sheets; 13 prior theme placements intact. No third-party image traffic or ownership mutation."
});
await Promise.all([write(themesPath,themes),write(statePath,state),write(imagesPath,images),write(progressPath,progress)]);
console.log(JSON.stringify({set:code,complete:true,reviewed:108,previouslyPreserved:13,newSlots:added,byTheme:addedByTheme,next:images.nextStart},null,2));
