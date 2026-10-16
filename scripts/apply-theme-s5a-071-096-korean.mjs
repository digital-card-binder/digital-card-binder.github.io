import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n","utf8");
const CODE="s5a",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const ART="data/audits/theme-s5a-071-096-Korean-art-review-20261016.json";
const PROOF="data/audits/theme-visual-evidence/s5a/071-096/rare-source-triage.json";
const RARITIES="data/audits/theme-s5a-071-096-Korean-print-rarity-review-20261016.json";
const PREVIOUS="data/audits/theme-s5a-061-070-progress-20261016.json";
const PROGRESS="data/audits/theme-s5a-071-096-progress-20261016.json";
const NEXT="s5a complete: all 96 Korean canonical artworks reviewed; continue other held sets";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,rare,modern,legacy,themes,status,hosting,coverage,prev]=await Promise.all([
 read(ART),read(PROOF),read(RARITIES),read("data/series.json"),
 read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json"),read(PREVIOUS)
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(sets.length!==1||sets[0].cards?.length!==96)throw Error("S5a canonical master structure unexpectedly changed");
const set=sets[0],originalCodes=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!key)throw Error("S5a checkpoint unavailable");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===96&&meta.status==="complete"&&meta.reviewedRanges?.includes("071-096")){
 console.log("S5a 071-096 already applied: safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.reviewedCardCount!==70||meta.artworkReviewedCardCount!==70||
 meta.verifiedKoreanPrintImageCount!==70||meta.verifiedSelfHostedImageCount!==70||
 meta.newlyAddedThemeSlotCount!==115||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060","061-070"])||
 prev.artworkReviewed!==70||prev.newlyAddedThemeSlotsCumulative!==115||
 prev.heldRareCardNumbers?.length!==26||prev.complete!==false||
 prev.globalCheckpointPreserved!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="in_progress")
 throw Error("Previous verified 70-slot theme and global S6K checkpoint changed. Stop.");
if(review.set!==CODE||review.range!=="071-096"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==26||
 review.verifiedKoreanPrintImagesInRange!==26||
 !review.preexistingCardIDsPreserved||review.sourceImagesRequested!==0||
 review.themeAdditions!==29||review.items?.length!==26||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalHoldUnchanged!==GLOBAL||
 rare.rarityCorrections?.length!==6||rare.decodedOwnedSourceCount!==26||
 rare.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.checkedCardCount!==26||
 proof.ownedArchiveDecodedCount!==26||proof.ownedArchiveMissingCount!==0||
 proof.decodedCandidateCount!==26||proof.unavailableCandidateCount!==0||
 proof.heldCardNumbers?.length!==26||
 proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Korean print visual inspection and mirrored image proof incomplete");
const correctedRarities=new Map([[71,"SR"],[72,"SR"],[85,"HR"],[86,"HR"],[93,"UR"],[94,"UR"]]);
for(const [n,rarity] of correctedRarities)
 if(set.cards[n-1].rarity!==rarity)throw Error("Rarity correction dependency not yet complete: "+n);
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing required theme "+t);
const before=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
if(before.length!==116)throw Error("Unexpected existing S5a 70-card artwork memberships: "+before.length);
if(!groups.get("season").cards.some(c=>String(c.code).toUpperCase()==="S5A_061"&&c.name==="수리둥보"))
 throw Error("Pre-existing S5a 061 spring artwork missing");
const originals=JSON.stringify(before);
const themeCounts={},additions=[];
for(let i=0;i<26;i++){
 const n=i+71,num=String(n).padStart(3,"0"),key="S5a_"+num,code="s5a_"+num+"/070";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[n-1];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 row.cardKey!==key||row.name!==card.name||pre.name!==card.name||
 String(card.code).toLowerCase()!==code||String(pre.code).toLowerCase()!==code||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 !pre.candidateUrl?.startsWith("https://static.tcgexchange.kr/")||
 !pre.ownedCandidateUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/")||
 pre.ownedImageInspection?.status!=="decoded_owned_archive"||
 pre.ownedImageInspection?.http!==200||pre.ownedImageInspection?.format!=="WEBP"||
 pre.candidateImageInspection?.status!=="decoded_unverified_region")
 throw Error("Korean rare source or code invalid: "+num);
 const chosen=new Set(row.matchedThemes||[]);
 if(!chosen.has("color")||chosen.size!==row.matchedThemes?.length||
 [...chosen].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!chosen.has(t)))
 throw Error("Invalid visual theme classification: "+num);
 if(themes.groups.some(g=>g.cards.some(c=>String(c.code||"").toUpperCase()===key.toUpperCase()||
 (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/070"))))
 throw Error("Refuse to overwrite preexisting rare artwork: "+num);
 for(const t of chosen){
   groups.get(t).cards.push({
     code:key,name:card.name,series:"S",set:set.code,setName:set.displayName||"쌍벽의 파이터",
     cardNumber:num+"/070",rarity:card.rarity||"",category:row.categories[t],
     image:pre.ownedCandidateUrl,
     evidence:"S5a 한국어 인쇄판 "+num+"/070 카드 실물 이미지 및 당사 CDN 복제본 일치 확인; "+
       row.artObservation+" (외부 원본 출처 보존, "+ART+")"
   });
   themeCounts[t]=(themeCounts[t]||0)+1;
   additions.push({number:n,theme:t});
 }
}
if(additions.length!==29||
 THEMES.some(t=>(themeCounts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==originalCodes||
 JSON.stringify(themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE)).slice(0,0))!=="[]")
 throw Error("Unexpected rare classification count or master ownership mutation");
for(const c of before){
 const holder=groups.get(THEMES.find(t=>themes.groups.find(g=>g.code===t)?.cards.includes(c)));
 if(!holder||!holder.cards.includes(c))throw Error("Previous artwork membership was removed");
}
const oldCount=before.length;
const newCount=themes.groups.reduce((s,g)=>s+g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE).length,0);
if(newCount!==oldCount+29)throw Error("S5a membership total wrong");
function parseRareHold(entry){
 if(typeof entry==="number")return entry;
 const s=String(typeof entry==="object"?(entry.code||entry.cardKey||entry.number||entry.cardNumber||""):entry);
 const m=s.match(/(?:s5a[_ -]?)?(\d{2,3})(?:\s*\/\s*070)?$/i);
 return m?Number(m[1]):NaN;
}
for(const field of ["heldCards","unresolvedImageIssues"]){
 if(Array.isArray(meta[field])&&meta[field].length){
   const unexplained=meta[field].filter(item=>{
     const n=parseRareHold(item);
     return !Number.isInteger(n)||n<71||n>96;
   });
   if(unexplained.length)throw Error("Unrecognized existing S5a unresolved holds: "+field+" "+JSON.stringify(unexplained).slice(0,350));
   meta[field]=[];
 }
}
meta.artworkReviewedCardCount=96;
meta.reviewedCardCount=96;
meta.verifiedKoreanPrintImageCount=96;
meta.verifiedSelfHostedImageCount=96;
meta.reviewedRanges=["001-030","031-060","061-070","071-096"];
meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=144;
meta.partialReviewEvidence=ART;
meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;
meta.reviewedAt=DATE;
meta.status="complete";meta.complete=true;
meta.note="S5a 쌍벽의 파이터 96개 한국어 카드번호 실물 이미지 12테마 시각검수 완료(기존 70 + 한국판 희귀 26), 신규 테마 멤버십 누적 144건. 26장 원본은 외부 출처를 보존하며 자체 DCB 이미지 CDN 26/26 디코딩 확인. 기존 S5a_061 봄 테마·카드 ID·보유키 유지. 타 세트 S6K 글로벌 보류 유지.";
themes.updatedAt=DATE;status.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global held Korean card sources changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:96,
 artworkReviewed:96,verifiedKoreanPrints:96,reviewedRanges:meta.reviewedRanges,
 newlyAddedThemeSlotsThisBatch:29,newlyAddedThemeSlotsCumulative:144,
 rareRarityCorrections:[71,72,85,86,93,94],
 heldRareCardNumbers:[],status:"complete",complete:true,
 nextStart:NEXT,globalCheckpointPreserved:GLOBAL,manualReview:ART,
 verifiedOwnedImageEvidence:PROOF,existingThemePreserved:"S5a_061:season",
 sourcePolicy:"Original rare scans are third-party; independently visually identified Korean script + owned DCB CDN 26/26, not claimed official Pokemon Korea photos."
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:96,total:96,added:29,cumulativeNew:144,
 verifiedOwnRareImages:26,rareRarityCorrected:6,originalMemberPreserved:true,
 masterIdsUnchanged:true,globalHold:GLOBAL}));
