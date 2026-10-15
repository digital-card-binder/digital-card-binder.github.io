import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n");
const SET="s6H",DATE="2026-10-15",GLOBAL_HOLD="s6K Korean print source pending: 089,090,092,094";
const AUDIT="data/audits/theme-s6H-001-095-Korean-print-review-20261015.json";
const files=[
"data/audits/theme-visual-evidence/s6H/001-030/visual-index.json",
"data/audits/theme-visual-evidence/s6H/031-060/visual-index.json",
"data/audits/theme-visual-evidence/s6H/061-095/visual-index.json"];
const [source,p1,p2,p3,status,hosting,coverage,modern,legacy]=await Promise.all([
read(AUDIT),...files.map(read),read("data/audits/theme-series-review-status.json"),
read("data/audits/theme-image-selfhost-audit.json"),
read("data/audits/theme-series-coverage.json"),
read("data/series.json"),read("data/series-legacy.json")]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()==="s6h");
if(sets.length!==1||sets[0].cards.length!==95||source.set!==SET||
source.canonicalNumberNameChecked!==95||source.ownedImageDecoded!==95||
source.visuallyReviewedKoreanPrintCount!==83||source.foreignPrintImagePlaceholderCount!==12)
throw Error("S6H audit or master mismatch");
const master=sets[0],proof=[p1,p2,p3],cards=proof.flatMap(x=>x.cards);
if(proof.some((x,i)=>x.set!=="s6h"||x.canonicalCardsChecked!==[30,30,35][i]||
x.verifiedOwnedCdnImageCount!==[30,30,35][i]||
x.unavailableOwnedCdnImageCount!==0||x.koreanNameNonemptyCount!==[30,30,35][i]||
x.printedNumberMatchCount!==[30,30,35][i]||x.artworkThemeReviewComplete!==false)||
cards.length!==95||source.cards.length!==95)
throw Error("Three 95-card proof blocks incomplete");
for(let i=0;i<95;i++){
const card=cards[i],orig=master.cards[i],row=source.cards[i],num=String(i+1).padStart(3,"0");
if(card.canonicalOrder!==i+1||card.masterCode.toLowerCase()!=="s6h_"+num+"/070"||
orig.code.toLowerCase()!==card.masterCode.toLowerCase()||orig.name!==card.name||
row.code!==card.masterCode||row.name!==card.name||!card.printedNumberMatches||
card.imageCheck.status!=="decoded"||card.imageCheck.http!==200||card.imageCheck.format!=="WEBP"||
row.printLanguage!==(i<83?"Korean":"Japanese")||
(i<83?!card.rawSource.startsWith("https://cards.image.pokemonkorea.co.kr/"):
 !card.rawSource.startsWith("https://static.tcgexchange.kr/")))
throw Error("Unsafe S6H canonical or Korean-photo audit row "+(i+1));
}
if(source.heldNumbers.length!==12||source.heldNumbers.some((v,i)=>v.number!==i+84||v.printLanguage!=="Japanese"))throw Error("S6H foreign-print hold not complete");
if(status.execution?.nextStart!==GLOBAL_HOLD||hosting.nextStart!==GLOBAL_HOLD)
throw Error("Global S6K image checkpoint moved; do not mutate");
status.reviews??={};
const k=Object.keys(status.reviews).find(x=>x.toLowerCase()==="s6h")||master.code;
const old=status.reviews[k]||{};
if(old.status==="in_progress"&&old.imagePreflightComplete===true&&old.verifiedKoreanPrintImageCount===83){
console.log("S6H image-only audit already recorded; exit idempotently");process.exit(0)}
if(old.status&&old.status!=="pending"&&old.status!=="not_started"&&old.status!=="in_progress")
throw Error("Unexpected existing S6H status "+old.status);
if((old.reviewedCardCount||0)!==0||(old.artworkReviewedCardCount||0)!==0||old.status==="complete")
throw Error("Existing S6H art review must never be overwritten");
const cover=coverage.sets.find(x=>x.code.toLowerCase()==="s6h");
if(!cover||cover.status!=="pending")throw Error("Coverage S6H pending expected, do not overwrite reviewed catalog");
status.reviews[k]={...old,status:"in_progress",reviewedAt:DATE,imagePreflightComplete:true,
masterSetCardCount:95,reviewedCardCount:0,artworkReviewedCardCount:0,
verifiedKoreanPrintImageCount:83,verifiedSelfHostedImageCount:95,
koreanPrintedImageConfirmed:83,koreanPrintImageHoldCount:12,
heldCards:source.heldNumbers.map(x=>x.code),
unresolvedImageIssues:source.heldNumbers.map(x=>({code:x.code,issue:"Japanese printed high rare placeholder; actual Korean image not verified"})),
reviewedRanges:[],reviewedThemes:[],complete:false,
imagePreflightEvidence:AUDIT,archiveVerificationStatus:"S6H_95_owned_83_Korean_print_12_Japanese_hold_no_theme_completion",
nextStart:"s6H 001-030 12-theme artwork review; Korean 084-095 high rare images pending",
note:"001-095 printed numbers and owned images pass. 001-083 Korean official photos; 084-095 Japanese placeholder images. Full 12-theme illustration classification is not yet signed off. S6K 4-image global checkpoint stays unchanged."
};
status.updatedAt=DATE;
hosting.batches??=[];
hosting.batches.push({task:17,set:master.code,range:"canonical 001-095 Korean S6H image and number preflight",
 canonicalCardCount:95,verifiedImageCount:95,verifiedKoreanPrintImageCount:83,
 koreanPrintImagesPending:12,brokenReferenceCount:0,
 archiveVerificationStatus:"S6H_95_owned_83_Korean_12_foreign_held",
 archivedProof:AUDIT,nextStart:GLOBAL_HOLD,
 note:"Independent second set preparation while four S6K Korean image holds are still unresolved. No user ownership or theme data mutation."});
hosting.updatedAt=DATE;
await Promise.all([save("data/audits/theme-series-review-status.json",status),
save("data/audits/theme-image-selfhost-audit.json",hosting)]);
console.log(JSON.stringify({set:SET,imagesChecked:95,koreanPrinted:83,foreignHolds:12,artworksReviewed:0,globalCheckpoint:GLOBAL_HOLD}));
