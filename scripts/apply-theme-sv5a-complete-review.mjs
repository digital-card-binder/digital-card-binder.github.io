import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async(p)=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,val)=>writeFile(path.join(root,p),JSON.stringify(val,null,2)+"\n");
const evidencePath="data/audits/theme-sv5a-001-096-art-review.json";
const indexPath="data/audits/theme-visual-evidence/sv5a/visual-index.json";
const [e,index,series,legacy,themes,state,images]=await Promise.all([
  read(evidencePath),read(indexPath),read("data/series.json"),
  read("data/series-legacy.json"),read("data/art-themes.json"),
  read("data/audits/theme-series-review-status.json"),
  read("data/audits/theme-image-selfhost-audit.json")
]);
const masterMatches=[...series,...legacy].filter(s=>String(s.code).toLowerCase()==="sv5a");
if(masterMatches.length!==1)throw Error("Expected exactly one canonical Korean SV5A set.");
const set=masterMatches[0],code=set.code;
const expectedThemes=["sleeping","connected","evolution","night","season","color","sunset",
  "reflections","food","street","work","cameo"];
const grouped=new Map(themes.groups.map(g=>[g.code,g]));
const preexisting=new Map();
for(const theme of themes.groups){
  for(const item of theme.cards||[]){
    if(String(item.set||"").toLowerCase()==="sv5a" ||
      /^SV5A_\d{3}$/.test(String(item.code||"").toUpperCase())){
      const arr=preexisting.get(String(item.code).toUpperCase())||[];
      arr.push(theme.code);preexisting.set(String(item.code).toUpperCase(),arr);
    }
  }
}
const prev=state.reviews?.[code];
if(prev?.status==="complete"&&prev.reviewedCardCount===96){
  console.log("Korean Crimson Haze already marked complete; no duplicate edits.");process.exit(0);
}
if(prev && prev.reviewedCardCount>0)throw Error("Unexpected pre-reviewed sv5a; do not overwrite.");
if(!String(images.nextStart||"").toLowerCase().includes("sv5a canonical 001"))
  throw Error("Image review checkpoint moved, not safe to reapply.");

if(e.set!=="sv5a"||e.masterCanonicalCount!==96||e.cardsReviewed!==96||
  e.cards?.length!==96||set.cards?.length!==96||index.cardCount!==96||
  index.verificationCounts.verified!==96||index.verificationCounts.missing!==0||
  e.verifiedAlreadyArchivedImages!==96||
  e.masterNamesRequiringRepair!==74||
  index.cards.length!==96||
  e.requiredAllTwelveChecked!==true||
  e.priorThemePlacementsRetained!==4||
  e.officialKoreanSetName!=="크림슨헤이즈")
  throw Error("Korean full-set evidence count, metadata, or coverage invalid.");

const currentExisting=[...preexisting.entries()].map(([n,t])=>({n,t})).sort((a,b)=>a.n.localeCompare(b.n));
if(currentExisting.length!==4||
    currentExisting.some(p=>p.t.some(t=>!expectedThemes.includes(t))))
  throw Error("Preexisting nine retained theme placements diverge from reviewed baseline.");

const counts={};
let namesRepaired=0, placed=0;
for(let i=0;i<96;i++){
  const row=e.cards[i], card=set.cards[i], proof=index.cards[i], n=i+1;
  const masterCode=String(card.code||"");
  const key="SV5A_"+String(masterCode.match(/_(\d+)\//)?.[1]||"").padStart(3,"0");
  if(row.canonicalOrder!==n||row.code!==key||
     masterCode.toLowerCase()!==row.canonicalMasterCode.toLowerCase()||
     proof.masterCode.toLowerCase()!==masterCode.toLowerCase()||
     proof.canonicalOrder!==n||
     row.printedNumber!==String(masterCode.match(/_(\d+)\//)?.[1]||"").padStart(3,"0")+"/066"||
     typeof row.koreanName!=="string"||!row.koreanName.trim()||
     row.verifiedCdnUrl!==proof.cdnUrl||
     row.sourceImage!==proof.rawSource||
     !row.verifiedImageBinary||proof.imageCheck.status!=="decoded"||
     !Array.isArray(proof.imageCheck.dimensions)||
     row.verifiedImageSize.join(",")!==proof.imageCheck.dimensions.join(",")||
     !row.visualEvidenceSheet.startsWith("data/audits/theme-visual-evidence/sv5a/")||
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
      evidence:"포켓몬코리아 한국판 확장팩 크림슨헤이즈("+"https://pokemoncard.co.kr"+
        ") 원본과 자체 저장 한국어 인쇄 카드("+
        row.visualEvidenceSheet+") 직접 대조: "+row.visualObservation+
        " 기존 자가 호스팅 이미지 사용, 원본 신규 다운로드 없음.",
      image:card.sourceImage||card.image
    });
    counts[themeCode]=(counts[themeCode]||0)+1;placed++;
  }
}
if(namesRepaired!==74)
  throw Error("Korean master names repaired differs from 74 expected blanks.");
if(JSON.stringify(Object.keys(counts).sort())!==
   JSON.stringify(Object.keys(e.themeAdditions).sort()))
  throw Error("Unexpected theme category in additions.");
for(const [code,n] of Object.entries(e.themeAdditions))
  if(counts[code]!==n)throw Error("Incorrect artwork slot count for "+code);
if(!set.name || /^sv5a 도감$/i.test(set.name))set.name=e.officialKoreanSetName;
else if(set.name!==e.officialKoreanSetName)
  throw Error("Existing Korean set name differs from official title; manual review needed.");

state.reviews[code]={
  status:"complete",reviewedAt:e.recordedAt,
  reviewedCardCount:96,reviewedThemes:expectedThemes,
  heldCards:[],newlyAddedCards:e.cards.map(r=>r.code),
  newlyAddedThemeSlotCount:placed,
  previouslyPreservedThemeSlotCount:4,
  masterKoreanNamesRepaired:namesRepaired,
  verifiedSelfHostedImageCount:96,
  archiveVerificationStatus:"96_existing_official_Korean_card_images_decoded",
  fullSetEvidence:evidencePath,
  note:"SV5A 크림슨헤이즈 한국판 공식 인쇄 이미지 96장 전수 육안 검수. 기존 기존 12테마 분류 4건 유지, 비어 있던 한국 카드명 74건만 채움. 신규 이미지 바이너리 저장/소유상태 변경 없음."
};
const updateProgress=node=>{
  if(!node||typeof node!=="object")return false;
  if(typeof node.lastSafeCheckpoint==="string"&&
     String(node.nextStart||"").toLowerCase().includes("sv5a canonical 001")){
    node.lastSafeCheckpoint="Crimson Haze sv5a 96/96 Korean cards visually reviewed and Korean names repaired; all previously complete sets preserved.";
    node.currentTaskScope="sv5a strict complete; next sv5 set";
    node.nextStart="sv5 canonical 001";
    return true;
  }
  for(const x of Object.values(node))if(!Array.isArray(x)&&updateProgress(x))return true;
  return false;
};
if(!updateProgress(state))
  throw Error("Cannot locate current safe stage-progress checkpoint.");
if(!state.lastEvidenceAuditCheckpoint||
   String(state.lastEvidenceAuditCheckpoint.set).toUpperCase()!=="SV6")
  throw Error("Evidence review checkpoint was moved from previously completed sv11B.");
Object.assign(state.lastEvidenceAuditCheckpoint,{
  set:code,range:"canonical 001-96",reviewedCardCount:96,
  artworkEvidenceHolds:0,archiveVerificationStatus:"existing_CDN_96_Korean_images_verified",
  evidenceFile:evidencePath
});
images.batches.push({
  task:6,set:code,range:"canonical 001-96 full Korean Crimson Haze artwork review",
  canonicalCardCount:96,artworkVisuallyVerifiedCount:96,artworkPendingCount:0,
  externalImageReferenceCountBefore:96,newlyInternalizedReferenceCount:0,
  selfHostedReferenceCountAfter:96,externalImageReferenceCountAfter:0,
  archiveVerificationStatus:"verified_existing_official_Korean_CDN_binary_decoded",
  verifiedImageCount:96,unverifiedImageCount:0,brokenReferenceCount:0,
  themeAdditions:counts,masterKoreanNamesRepaired:namesRepaired,
  priorThemePlacementsPreserved:4,
  nextStart:"sv5 canonical 001",
  note:"96 Korean official Pokémon Korea watermark original prints visually inspected, 74 previously blank Korean master names repaired. Existing Cloudflare archive used without origin downloads."
});
images.nextStart="sv5 canonical 001";
images.updatedAt=e.recordedAt;
const masterSourcePath=series.includes(set)?"data/series.json":"data/series-legacy.json";
await Promise.all([
  write(masterSourcePath,masterSourcePath==="data/series.json"?series:legacy),
  write("data/art-themes.json",themes),
  write("data/audits/theme-series-review-status.json",state),
  write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:code,canonicalReviewed:96,restoredKoreanNames:namesRepaired,
  keptPriorThemeSlots:4,themeSlotsAdded:placed,themeAdditions:counts,nextStart:images.nextStart},null,2));
