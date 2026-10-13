import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,data)=>writeFile(path.join(root,p),JSON.stringify(data,null,2)+"\n");
const evidencePath="data/audits/theme-sv4a-181-360-art-review.json";
const progressPath="data/audits/theme-sv4a-set-progress-20261013.json";
const [e,index,series,legacy,themes,state,progress,images]=await Promise.all([
read(evidencePath),read("data/audits/theme-visual-evidence/sv4a/visual-index.json"),
read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
read("data/audits/theme-series-review-status.json"),read(progressPath),
read("data/audits/theme-image-selfhost-audit.json")
]);
const candidates=[...series,...legacy].filter(s=>String(s.code).toLowerCase()==="sv4a");
if(candidates.length!==1)throw Error("Expected unique Korean SV4a canonical set");
const master=candidates[0],prev=state.reviews?.[master.code];
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
if(prev?.status==="complete"&&prev.reviewedCardCount===360){
 console.log("Full Korean sv4a set already complete, refuse duplicate modifications");process.exit(0);
}
if(!prev||prev.status!=="in_progress"||prev.reviewedCardCount!==180||
 progress.appliedReviewThrough!==180||progress.reviewedKoreanNames!==155||
 progress.koreanMasterNamesRequiringReview!==0||
 !progress.batchEvidence?.includes("data/audits/theme-sv4a-121-180-art-review.json")||
 master.cards?.length!==360||index.cardCount!==360||
 index.verificationCounts.verified!==360||index.verificationCounts.missing!==0||
 e.set!=="sv4a"||e.start!==181||e.end!==360||e.cards?.length!==180||
 !e.requiredAllTwelveChecked||e.priorThemePlacementsPreserved?.length!==2)
 throw Error("Master, archive or sequential review checkpoint changed");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(themes12.some(t=>!groups.has(t)||!Array.isArray(groups.get(t).cards)))
 throw Error("Missing one of 12 theme decks");
const counted={};let additions=0;
for(let i=0;i<180;i++){
 const n=i+181,row=e.cards[i],p=index.cards[n-1],c=master.cards[n-1];
 const key="SV4A_"+String(n).padStart(3,"0");
 if(!p||!c||row.canonicalOrder!==n||row.code!==key||
 row.canonicalMasterCode.toLowerCase()!==p.masterCode.toLowerCase()||
 String(c.code).toLowerCase()!==p.masterCode.toLowerCase()||
 row.printedNumber!==p.masterCode.split("_")[1]||
 row.koreanName!==c.name||row.koreanName!==p.name||
 row.sourceImage!==p.rawSource||row.verifiedCdnUrl!==p.cdnUrl||
 p.imageCheck?.status!=="decoded"||row.verifiedImageBinary!==true||
 !row.all12ThemesChecked||row.sourceRegion!=="KR"||
 row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv4a/sv4a-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
 !Array.isArray(row.themesMatched)||new Set(row.themesMatched).size!==row.themesMatched.length||
 row.themesMatched.some(t=>!themes12.includes(t)))
 throw Error("Invalid Korean 181-360 proof "+key);
 const old=themes.groups.filter(g=>g.cards.some(x=>String(x.code).toUpperCase()===key)).map(g=>g.code);
 if(JSON.stringify(old.sort())!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
 throw Error("Earlier theme placements differ for "+key);
 for(const t of row.themesMatched){
  if(old.includes(t))throw Error("Would duplicate preexisting placement "+key+"/"+t);
  const group=groups.get(t);
  group.cards.push({code:key,name:row.koreanName,series:"SV",set:master.code,
    setName:master.name,cardNumber:row.printedNumber,rarity:c.rarity||"",
    category:group.cards[0]?.category||group.name,
    evidence:"자체 저장 한국어 카드 원본("+row.visualEvidenceSheet+") 시각 검수: "+row.visualObservation+
      ". 홀로스타·반짝임만 있는 카드는 테마 판정에서 제외.",
    image:c.sourceImage||c.image});
  counted[t]=(counted[t]||0)+1;additions++;
 }
}
if(JSON.stringify(Object.entries(counted).sort())!==JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("Art-theme category counts do not match inspected evidence");
// Official Korean detail card BS2024001001 explicitly prints 뚜벅쵸.
// Correct only this previously reviewed mistaken name, and no other preexisting name.
const first=master.cards[0];
if(first.name!=="뚜벅초")throw Error("Korean first print name changed; refuse unchecked correction");
first.name="뚜벅쵸";
let correctedThemeRows=0;
for(const group of themes.groups)
 for(const item of group.cards)
  if(String(item.code).toUpperCase()==="SV4A_001"){
   if(item.name!=="뚜벅초")throw Error("Review original source before first-card correction");
   item.name="뚜벅쵸";correctedThemeRows++;
  }
if(correctedThemeRows!==2)throw Error("Expected exactly two theme records for SV4A_001, found "+correctedThemeRows);
const earlier=new Set(themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set).toLowerCase()==="sv4a").map(c=>String(c.code).toUpperCase())));
if(!earlier.has("SV4A_085")||!earlier.has("SV4A_340"))throw Error("Prior confirmed connected/sleeping card missing");
state.reviews[master.code]={
 ...prev,status:"complete",reviewedAt:e.reviewedAt,reviewedCardCount:360,
 reviewedThemes:themes12,heldCards:[],
 partialBatchEvidence:evidencePath,partialReviewedRange:"canonical 001-360",
 newlyAddedThemeSlotCount:Number(prev.newlyAddedThemeSlotCount||0)+additions,
 masterKoreanNamesRepaired:155,verifiedSelfHostedImageCount:360,
 archiveVerificationStatus:"360_existing_official_Korean_card_images_decoded",
 fullSetEvidence:evidencePath,
 nameCorrection:{code:"SV4A_001",from:"뚜벅초",to:"뚜벅쵸",source:"https://pokemoncard.co.kr/cards/detail/BS2024001001"},
 note:"한국판 샤이니트레저 ex 360장 12테마 모두 확인. 무늬만 동일한 191-337 반짝이 카드의 임의 테마 수록 배제. 미수집·수집데이터 변경 없음."
};
progress.status="complete";
progress.appliedReviewThrough=360;
progress.reviewedKoreanNames=155;
progress.koreanMasterNamesRequiringReview=0;
progress.appliedThemeSlots=Number(progress.appliedThemeSlots||0)+additions;
for(const [t,v] of Object.entries(counted))progress.appliedThemeAdditions[t]=(progress.appliedThemeAdditions[t]||0)+v;
progress.batchEvidence.push(evidencePath);
progress.nextSafeStart="SV4a strict complete, next pending sv3a canonical 001; rerun latest coverage before starting";
progress.nameCorrectionOfficial={card:"SV4A_001",name:"뚜벅쵸",officialDetail:"https://pokemoncard.co.kr/cards/detail/BS2024001001",previousIncorrect:"뚜벅초"};
progress.notes="360/360 visually checked, 155 missing Korean names restored, all 360 owned-CDN images previously decoded, all 12 themes checked and ownership states preserved.";
images.nextStart="sv3a canonical 001";images.updatedAt=e.reviewedAt;
images.batches.push({
 task:6,set:master.code,range:"canonical 001-360 full Korean Shiny Treasure ex visual review",
 canonicalCardCount:360,artworkVisuallyVerifiedCount:360,artworkPendingCount:0,
 externalImageReferenceCountBefore:360,newlyInternalizedReferenceCount:0,
 selfHostedReferenceCountAfter:360,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_existing_official_Korean_CDN_binary_decoded",
 verifiedImageCount:360,unverifiedImageCount:0,brokenReferenceCount:0,
 masterKoreanNamesRepaired:155,themeAdditions:progress.appliedThemeAdditions,
 nextStart:"sv3a canonical 001",
 note:"360 official Korean card prints visually reviewed using previously self-hosted Cloudflare archives. Non-scenic shiny confetti excluded from theme decks. Official Korean name erratum SV4A_001 뚜벅쵸."
});
const masterPath=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(masterPath,masterPath==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write(progressPath,progress),
 write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:master.code,complete:true,cards:360,ownedCdnImages:360,repairedKoreanNames:155,
 correctedName:"SV4A_001 뚜벅쵸",newThemePlacements:additions,themeCounts:counted,
 nextStart:"sv3a canonical 001"},null,2));
