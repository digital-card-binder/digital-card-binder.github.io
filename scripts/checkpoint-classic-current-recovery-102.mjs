import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,j)=>writeFile(path.join(root,p),JSON.stringify(j,null,2)+"\n");
const base="data/audits/";
const [old,after,modern,legacy,overrides,theme,st,coverage]=await Promise.all([
 read(base+"theme-classic-three-102-card-regional-print-checkpoint-20261013.json"),
 read(base+"theme-classic-15-firstparty-korean-display-recovery-20261013.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/series-image-overrides.json"),
 read("data/art-themes.json"),read(base+"theme-series-review-status.json"),read(base+"theme-series-coverage.json")
]);
const states=["verified_existing_Korean","verified_new_Korean_from_official_product_lowres","wrong_language_Japanese_image","energy_exact_region_print_id_pending"];
const report={schemaVersion:1,recordedAt:"2026-10-13",branch:"main",
 purpose:"Exact next-session restart after recovering 15 Korean first-party Classic originals; do not re-review/overwrite prior proofs",
 orderedSets:["CLL","CLK","CLF"],completeSetCount:coverage.summary.strictCompleteSetCount,
 summary:{expected:102,verifiedExisting:0,verifiedNew:0,JapaneseReplacementPending:0,neutralEnergyHeld:0},
 status:{},nextSafeStart:"CLL_004",remainingOriginalKoreanImageQueue:[],qualityUpgradeQueue:[],
 historicAudit:"data/audits/theme-classic-three-102-card-regional-print-checkpoint-20261013.json",
 currentOfficialKoreanImageAssets:"data/audits/theme-classic-15-firstparty-korean-display-recovery-20261013.json",
 inputOfficialProductArtwork:"https://pokemoncard.co.kr/card/590",
 nonNegotables:["Korean physical print only; never classify Japanese card art as Korean evidence",
  "all displayed images must load locally from DCB-owned URLs and never hotlink external source hosts",
  "never overwrite canonical card identities, collection/ownership data, old independent theme checkmarks",
  "existing 15 new Korean image crops are low-res temporary until a higher-resolution Korean print is available",
  "do not mark complete before all 102 Korean print identities are proven and all 12 theme groups inspected"]};
const localCodes=new Set(after.bySet?Object.values(overrides.sets).flatMap(v=>Object.keys(v).filter(k=>/^(cll|clk|clf)_/.test(k))):[]);
for(const code of report.orderedSets){
 const oldProof=old.sets[code],group=[...modern,...legacy].find(g=>String(g.code||"").toUpperCase()===code);
 if(!group||group.cards?.length!==34||st.reviews?.[code]?.status!=="in_progress")
  throw Error("Unexpected completed or changed Korean Classic set "+code);
 const entries=[];
 const counts=Object.fromEntries(states.map(s=>[s,0]));
 for(let i=0;i<34;i++){
  const card=group.cards[i],proof=oldProof.cards[i],key=proof.cardKey,display=String(card.image||"");
  if(String(card.code).toUpperCase()!==key+"/032")throw Error("Legacy canonical code drift "+key);
  let status;
  if(proof.visualPrintLanguageStatus==="Korean_language_print_visually_verified"){
   status="verified_existing_Korean";
   if(!/^https:\/\/(dcb-card-images-modern|dcb-card-images-legacy)-2026\.pages\.dev\//.test(
      String(proof.ownedCdnUrl)))throw Error("Preexisting Korean original not routed to DCB "+key);
  }else if(proof.visualPrintLanguageStatus==="language_neutral_energy_physical_Korean_print_evidence_pending"){
   status="energy_exact_region_print_id_pending";
  }else if(/^\/assets\/cards\/classic-korean-official-2023\/(?:CLL|CLK|CLF)_\d{3}\.webp$/.test(display)){
   status="verified_new_Korean_from_official_product_lowres";
   if(!localCodes.has(card.code.toLowerCase())||
     overrides.sets[code.toLowerCase()]?.[card.code.toLowerCase()]!==display)
    throw Error("Official first-party recovered Korean local image missing from series override "+key);
  }else{
   status="wrong_language_Japanese_image";
   if(proof.visualPrintLanguageStatus!=="Japanese_language_image_wrong_for_Korean_master")
    throw Error("Miscounted image region "+key);
  }
  counts[status]++;
  const row={canonicalOrder:i+1,cardKey:key,koreanName:card.name,status};
  if(status==="verified_new_Korean_from_official_product_lowres"){
   row.currentDisplayedImage=display;row.next="Wait higher resolution original Korean individual scan";
   report.qualityUpgradeQueue.push(row);
  }
  if(status==="wrong_language_Japanese_image"){
   row.next="Find identical Korean physical printed card, locally archive source and validate region/ID and 12 themes";
   report.remainingOriginalKoreanImageQueue.push(row);
  }
  if(status==="energy_exact_region_print_id_pending"){
   row.next="Match original Korean physical energy print identifier against verified Korean edition, then classify";
   report.remainingOriginalKoreanImageQueue.push(row);
  }
  entries.push(row);
 }
 if(counts.verified_existing_Korean!==oldProof.verifiedKoreanPrintedCount||
 counts.verified_new_Korean_from_official_product_lowres!==after.bySet[code].updated||
 counts.wrong_language_Japanese_image!==after.bySet[code].remainingJapaneseWrong||
 counts.energy_exact_region_print_id_pending!==2)
  throw Error("Restart count drift "+code+" "+JSON.stringify(counts));
 report.status[code]={state:"in_progress",counts,masterCardCount:34,latestReviewedSourceRef:after.archiveRef||"data/audits/theme-classic-15-interim-official-asset-preparation-20261013.json",
  verifiedNewKoreanSourceKeys:entries.filter(x=>x.status==="verified_new_Korean_from_official_product_lowres").map(x=>x.cardKey),
  queueNext:entries.find(x=>x.status==="wrong_language_Japanese_image")?.cardKey,
  cards:entries};
 report.summary.verifiedExisting+=counts.verified_existing_Korean;
 report.summary.verifiedNew+=counts.verified_new_Korean_from_official_product_lowres;
 report.summary.JapaneseReplacementPending+=counts.wrong_language_Japanese_image;
 report.summary.neutralEnergyHeld+=counts.energy_exact_region_print_id_pending;
}
if(JSON.stringify(report.summary)!==JSON.stringify({expected:102,verifiedExisting:16,verifiedNew:15,JapaneseReplacementPending:65,neutralEnergyHeld:6}))
 throw Error("Classic exact verified 102 state mismatch");
if(report.remainingOriginalKoreanImageQueue.length!==71||report.qualityUpgradeQueue.length!==15)
 throw Error("71 priority + 15 quality upgrades expected");
await write(base+"theme-classic-latest-safe-restart-20261013.json",report);
console.log(JSON.stringify({summary:report.summary,queueNext:report.nextSafeStart,queueCount:report.remainingOriginalKoreanImageQueue.length,qualityUpgrades:15,strictCompleteSetCount:coverage.summary.strictCompleteSetCount},null,2));
