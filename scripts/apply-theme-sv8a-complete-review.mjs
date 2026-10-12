import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async(p)=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,val)=>writeFile(path.join(root,p),JSON.stringify(val,null,2)+"\n");
const evidencePath="data/audits/theme-sv8a-001-237-art-review.json";
const indexPath="data/audits/theme-visual-evidence/sv8a/visual-index.json";
const [e,index,series,legacy,themes,state,images]=await Promise.all([
  read(evidencePath),read(indexPath),read("data/series.json"),
  read("data/series-legacy.json"),read("data/art-themes.json"),
  read("data/audits/theme-series-review-status.json"),
  read("data/audits/theme-image-selfhost-audit.json")
]);
const masterMatches=[...series,...legacy].filter(s=>String(s.code).toLowerCase()==="sv8a");
if(masterMatches.length!==1)throw Error("Expected exactly one canonical Korean SV8A set.");
const set=masterMatches[0],code=set.code;
const expectedThemes=["sleeping","connected","evolution","night","season","color","sunset",
  "reflections","food","street","work","cameo"];
const grouped=new Map(themes.groups.map(g=>[g.code,g]));
const preexisting=new Map();
for(const theme of themes.groups){
  for(const item of theme.cards||[]){
    if(String(item.set||"").toLowerCase()==="sv8a" ||
      /^SV8A_\d{3}$/.test(String(item.code||"").toUpperCase())){
      const arr=preexisting.get(String(item.code).toUpperCase())||[];
      arr.push(theme.code);preexisting.set(String(item.code).toUpperCase(),arr);
    }
  }
}
const prev=state.reviews?.[code];
if(prev?.status==="complete"&&prev.reviewedCardCount===237){
  console.log("Korean Terastal Festival ex already marked complete; no duplicate edits.");process.exit(0);
}
if(prev && prev.reviewedCardCount>0)throw Error("Unexpected pre-reviewed sv8a; do not overwrite.");
if(!String(images.nextStart||"").toLowerCase().includes("sv8a canonical 001"))
  throw Error("Image review checkpoint moved, not safe to reapply.");

if(e.set!=="sv8a"||e.masterCanonicalCount!==237||e.cardsReviewed!==237||
  e.cards?.length!==237||set.cards?.length!==237||index.cardCount!==237||
  index.verificationCounts.verified!==237||index.verificationCounts.missing!==0||
  e.verifiedAlreadyArchivedImages!==237||
  e.masterNamesRequiringRepair!==168||
  index.cards.length!==237||
  e.requiredAllTwelveChecked!==true||
  e.priorThemePlacementsRetained!==1||
  e.officialKoreanSetName!=="테라스탈 페스타 ex")
  throw Error("Korean full-set evidence count, metadata, or coverage invalid.");

const currentExisting=[...preexisting.entries()].map(([n,t])=>({n,t})).sort((a,b)=>a.n.localeCompare(b.n));
if(currentExisting.length!==1||
    currentExisting.some(p=>p.t.length!==1||p.t[0]!=="evolution"))
  throw Error("Preexisting one evolution placement diverge from reviewed baseline.");

const counts={};
let namesRepaired=0, placed=0;
for(let i=0;i<237;i++){
  const row=e.cards[i], card=set.cards[i], proof=index.cards[i], n=i+1;
  const key="SV8A_"+String(n).padStart(3,"0");
  const masterCode=String(card.code||"");
  if(row.canonicalOrder!==n||row.code!==key||
     new URL(row.verifiedCdnUrl).hostname!=="dcb-card-images-modern-2026.pages.dev"||
     masterCode.toLowerCase()!==row.canonicalMasterCode.toLowerCase()||
     proof.masterCode.toLowerCase()!==masterCode.toLowerCase()||
     proof.canonicalOrder!==n||
     row.printedNumber!==String(n).padStart(3,"0")+"/187"||
     typeof row.koreanName!=="string"||!row.koreanName.trim()||
     row.verifiedCdnUrl!==proof.cdnUrl||
     row.sourceImage!==proof.rawSource||
     !row.verifiedImageBinary||proof.imageCheck.status!=="decoded"||
     !Array.isArray(proof.imageCheck.dimensions)||
     row.verifiedImageSize.join(",")!==proof.imageCheck.dimensions.join(",")||
     !row.visualEvidenceSheet.startsWith("data/audits/theme-visual-evidence/sv8a/")||
     row.all12ThemesChecked!==true||row.sourceRegion!=="KR")
   throw Error("Canonical Korean print, archive or visual evidence mismatch: "+key);

  if(card.name&&card.name!==row.koreanName)
    throw Error("Existing master Korean card name must never be overwritten: "+key);
  if(!card.name){
    card.name=row.koreanName;
    namesRepaired++;
  }
  const current=preexisting.get(key)||[];
  if(JSON.stringify([...current].sort())!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
    throw Error("Earlier sleeping data differs from evidence: "+key);
  if(!Array.isArray(row.themesMatched) ||
     new Set(row.themesMatched).size!==row.themesMatched.length ||
     row.themesMatched.some(t=>row.wasAlreadyInThemes.includes(t)))
    throw Error("Duplicate or invalid artwork assignment: "+key);

  for(const themeCode of row.themesMatched){
    const group=grouped.get(themeCode);
    if(!expectedThemes.includes(themeCode)||!group||!Array.isArray(group.cards))
      throw Error("Unknown art theme: "+key+"/"+themeCode);
    if(group.cards.some(x=>String(x.code).toUpperCase()===key))
      throw Error("Would duplicate art-theme existing placement: "+key+"/"+themeCode);
    group.cards.push({
      code:key,name:row.koreanName,series:"SV",set:code,setName:e.officialKoreanSetName,
      cardNumber:row.printedNumber,rarity:card.rarity||"",
      category:group.cards[0]?.category||group.name,
      evidence:"포켓몬코리아 한국판 확장팩 테라스탈 페스타 ex("+e.officialProductUrl+
        ") 원본과 자체 저장 한국어 인쇄 카드("+
        row.visualEvidenceSheet+") 직접 대조: "+row.visualObservation+
        " 기존 자가 호스팅 이미지 사용, 원본 신규 다운로드 없음.",
      image:card.sourceImage||card.image
    });
    counts[themeCode]=(counts[themeCode]||0)+1;placed++;
  }
}
if(namesRepaired!==168)
  throw Error("Korean master names repaired differs from 168 expected blanks.");
if(JSON.stringify(Object.keys(counts).sort())!==
   JSON.stringify(Object.keys(e.themeAdditions).sort()))
  throw Error("Unexpected theme category in additions.");
for(const [code,n] of Object.entries(e.themeAdditions))
  if(counts[code]!==n)throw Error("Incorrect artwork slot count for "+code);
if(!set.name || /^sv8a 도감$/i.test(set.name))set.name=e.officialKoreanSetName;
else if(set.name!==e.officialKoreanSetName)
  throw Error("Existing Korean set name differs from official title; manual review needed.");

state.reviews[code]={
  status:"complete",reviewedAt:e.recordedAt,
  reviewedCardCount:237,reviewedThemes:expectedThemes,
  heldCards:[],newlyAddedCards:e.cards.map(r=>r.code),
  newlyAddedThemeSlotCount:placed,
  previouslyPreservedThemeSlotCount:1,
  masterKoreanNamesRepaired:namesRepaired,
  verifiedSelfHostedImageCount:237,
  archiveVerificationStatus:"237_existing_official_Korean_card_images_decoded",
  fullSetEvidence:evidencePath,
  note:"SV8A 테라스탈 페스타 ex 한국판 공식 인쇄 이미지 237장 전수 육안 검수. 기존 evolution 1건 유지, 비어 있던 한국 카드명 168건만 채움. 신규 이미지 바이너리 저장/소유상태 변경 없음."
};
const updateProgress=node=>{
  if(!node||typeof node!=="object")return false;
  if(typeof node.lastSafeCheckpoint==="string"&&
     node.lastSafeCheckpoint.includes("sv9")){
    node.lastSafeCheckpoint="Terastal Festival ex sv8a 237/237 Korean cards visually reviewed and Korean names repaired; prior seven completed SV sets preserved.";
    node.currentTaskScope="sv8a strict complete; next sv8 set";
    node.nextStart="sv8 canonical 001";
    return true;
  }
  for(const x of Object.values(node))if(!Array.isArray(x)&&updateProgress(x))return true;
  return false;
};
if(!updateProgress(state))
  throw Error("Cannot locate current safe stage-progress checkpoint.");
if(!state.lastEvidenceAuditCheckpoint||
   String(state.lastEvidenceAuditCheckpoint.set).toUpperCase()!=="SV9")
  throw Error("Evidence review checkpoint was moved from previously completed sv11B.");
Object.assign(state.lastEvidenceAuditCheckpoint,{
  set:code,range:"canonical 001-237",reviewedCardCount:237,
  artworkEvidenceHolds:0,archiveVerificationStatus:"existing_CDN_237_Korean_images_verified",
  evidenceFile:evidencePath
});
images.batches.push({
  task:6,set:code,range:"canonical 001-237 full Korean Terastal Festival ex artwork review",
  canonicalCardCount:237,artworkVisuallyVerifiedCount:237,artworkPendingCount:0,
  externalImageReferenceCountBefore:237,newlyInternalizedReferenceCount:0,
  selfHostedReferenceCountAfter:237,externalImageReferenceCountAfter:0,
  archiveVerificationStatus:"verified_existing_official_Korean_CDN_binary_decoded",
  verifiedImageCount:237,unverifiedImageCount:0,brokenReferenceCount:0,
  themeAdditions:counts,masterKoreanNamesRepaired:namesRepaired,
  priorEvolutionPlacementsPreserved:1,
  nextStart:"sv8 canonical 001",
  note:"237 Korean official Pokémon Korea watermark original prints visually inspected, 168 previously blank Korean master names repaired. Existing Cloudflare archive used without origin downloads."
});
images.nextStart="sv8 canonical 001";
images.updatedAt=e.recordedAt;
const masterSourcePath=series.includes(set)?"data/series.json":"data/series-legacy.json";
await Promise.all([
  write(masterSourcePath,masterSourcePath==="data/series.json"?series:legacy),
  write("data/art-themes.json",themes),
  write("data/audits/theme-series-review-status.json",state),
  write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:code,canonicalReviewed:237,restoredKoreanNames:namesRepaired,
  keptPriorEvolution:1,themeSlotsAdded:placed,themeAdditions:counts,nextStart:images.nextStart},null,2));
