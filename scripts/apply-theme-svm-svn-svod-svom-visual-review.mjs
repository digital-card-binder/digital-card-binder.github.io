import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => JSON.parse(await readFile(path.join(root, p), "utf8"));
const write = async (p, value) => writeFile(path.join(root, p), JSON.stringify(value, null, 2) + "\n");
const evidencePath="data/audits/theme-svm-svn-svod-svom-visual-review-20261013.json";
const evidence = await read(evidencePath);
const [series, legacy, themeData, state, imageAudit, manifest, verification] = await Promise.all([
  read("data/series.json"),
  read("data/series-legacy.json"),
  read("data/art-themes.json"),
  read("data/audits/theme-series-review-status.json"),
  read("data/audits/theme-image-selfhost-audit.json"),
  read("data/audits/theme-next-batches-master-inventory.json"),
  read("data/audits/theme-visual-evidence/image-check-report.json")
]);

const codes = ["SVM", "SVN", "SVOD", "SVOM"];
const mandatoryThemes = ["sleeping", "connected", "evolution", "night", "season", "color", "sunset",
  "reflections", "food", "street", "work", "cameo"];
const bySet = new Map([...series,...legacy].map((s)=>[String(s.code).toUpperCase(),s]));
const byTheme = new Map(themeData.groups.map((g)=>[g.code,g]));
const has = (arr,item)=>Array.isArray(arr)&&arr.includes(item);
if (JSON.stringify(evidence.themeCodes)!==JSON.stringify(mandatoryThemes) ||
    evidence.imagesExistingCDNDecoded!==156 ||
    codes.some((c)=>!bySet.has(c) || !manifest.sets[c] || !verification.sets[c]))
  throw Error("Missing canonical groups, evidence schema or expected image verification.");
if (JSON.stringify([...byTheme.keys()]) === "[]" ||
    mandatoryThemes.some((x)=>!byTheme.has(x))) throw Error("Required theme groups missing");
if (imageAudit.nextStart!=="SVM canonical 131") {
  const already = codes.every((code) =>
    state.reviews?.[code]?.status==="complete" &&
    Number(state.reviews[code].reviewedCardCount)===bySet.get(code).cards.length);
  if(already){ console.log("All four reviews already complete; idempotent no-op.");process.exit(0); }
  throw Error("Main checkpoint was modified after evidence audit; refusing unsafe update.");
}
if (state.reviews?.SVM?.reviewedCardCount !==122)
  throw Error("SVM inspected baseline is not 122.");
if (codes.slice(1).some((x)=>state.reviews?.[x]?.status==="complete"||
    Number(state.reviews?.[x]?.reviewedCardCount||0)>0))
  throw Error("SVN/SVOD/SVOM have newer review state. Do not overwrite.");

const totalExpected=codes.reduce((s,c)=>s+evidence.sets[c].cards.length,0);
if(totalExpected!==156)throw Error("Expected exactly 156 reviewed Korean card images.");
const checkpoints=[];
let placed=0;
for (const code of codes) {
  const set=bySet.get(code), rows=evidence.sets[code].cards;
  const inventory=manifest.sets[code].cards;
  const images=verification.sets[code].cards;
  const imagesMap=new Map(images.map((item)=>[item.order,item]));
  const inventoryMap=new Map(inventory.map((item)=>[item.canonicalOrder,item]));
  const seenCodes=new Set();
  const previous=state.reviews[code]||null;
  const added={};
  for(const item of rows) {
    const order=item.canonicalOrder, master=set.cards[order-1];
    const reference=inventoryMap.get(order), verified=imagesMap.get(order);
    if(!master||!reference||!verified||
       !Number.isInteger(order)||order<1||order>set.cards.length||
       seenCodes.has(order))throw Error("Invalid or duplicated order "+code+" "+order);
    seenCodes.add(order);
    const codeFromMaster = String(master.code || "").toLowerCase();
    if(codeFromMaster!==item.canonicalMasterCode.toLowerCase() ||
       String(master.name||"")!==item.koreanName ||
       item.code!==code+"_"+String(order).padStart(3,"0") ||
       reference.code.toLowerCase()!==codeFromMaster ||
       item.cdnUrl !== reference.existingCdnUrl ||
       verified.url !== item.cdnUrl || verified.status!=="decoded" ||
       item.verifiedImageBinary!==true || item.artworkReviewed!==true ||
       item.all12ThemesChecked!==true || item.sourceRegion!=="KR" ||
       !Array.isArray(verified.dimensions) ||verified.dimensions.length!==2 ||
       !item.imageAuditSheet.startsWith("data/audits/theme-visual-evidence/") ||
       !item.visualObservation || typeof item.visualObservation!=="string")
      throw Error("Korean image/catalog proof mismatch: "+code+" "+order);
    const imageSource=String(master.sourceImage || master.image || "");
    if(!imageSource.startsWith("https://"))throw Error("Missing image provenance: "+code+" "+order);
    if(!Array.isArray(item.themesMatched) ||
       new Set(item.themesMatched).size!==item.themesMatched.length)
      throw Error("Invalid themes for "+item.code);
    for(const theme of item.themesMatched){
      const group=byTheme.get(theme);
      if(!group||!mandatoryThemes.includes(theme)||!Array.isArray(group.cards))
        throw Error("Unknown theme "+item.code+" "+theme);
      if(group.cards.some((card)=>String(card.code).toUpperCase()===item.code))
        throw Error("Theme already contains Korean slot; requires manual reconciliation: "+theme+" "+item.code);
      group.cards.push({
        code:item.code,name:item.koreanName,series:"SV",set:code,setName:evidence.sets[code].name,
        cardNumber:item.koreanPrintIdentifier,rarity:master.rarity||"",
        category:group.cards[0]?.category||group.name,
        evidence:"한국어 인쇄 카드 원본("+item.imageAuditSheet+")과 자체 CDN 이미지 원본 "+
          item.cdnUrl+" 시각 교차검수: "+item.visualObservation+
          " 테마 정의를 직접 확인. 기존 자체 저장 파일 재사용, 외부 원본 재다운로드 없음.",
        image:imageSource
      });
      added[theme]=(added[theme]||0)+1;placed++;
    }
  }
  if(seenCodes.size!==rows.length ||
     JSON.stringify([...seenCodes].sort((a,b)=>a-b))!==JSON.stringify([...inventoryMap.keys()].sort((a,b)=>a-b)) ||
     Number(evidence.sets[code].masterCanonicalCount)!==set.cards.length)
    throw Error("Some Korean card slots are not accounted for in "+code);
  for(const t of new Set([...Object.keys(added),...Object.keys(evidence.sets[code].themeAdditions)])){
    if(Number(added[t]||0)!==Number(evidence.sets[code].themeAdditions[t]||0))
      throw Error("Expected and actual theme hit counts differ for "+code+" "+t);
  }
  const initial=code==="SVM"?122:0;
  const finish=initial+rows.length;
  if(finish!==set.cards.length)throw Error("Cannot strictly complete "+code+" "+finish+"/"+set.cards.length);
  const prevCodes=code==="SVM"?(previous.newlyAddedCards||[]):[];
  if(rows.some((card)=>prevCodes.includes(card.code)))
    throw Error("Attempted to re-review already completed "+code);
  const previousHolds=code==="SVM"?(previous.heldCards||[]):[];
  if(code==="SVM" &&
      previousHolds.some((hold)=>!evidence.sets[code].priorHeldResolved.includes(hold)))
    throw Error("Unresolved prior Korean card holds left in "+code);
  if(code==="SVM"){
    Object.assign(previous,{
      status:"complete",reviewedAt:evidence.recordedAt,
      reviewedCardCount:set.cards.length,reviewedThemes:mandatoryThemes,
      note:"All 183 Korean SVM canonical slots visually reviewed, including eight previously held Korean-print images now resolved using decoded self-hosted print evidence. Basic energy prints are unnumbered. Image archive verified from existing CDN; no new origin downloads.",
      heldCards:[],
      newlyAddedCards:[...prevCodes,...rows.map((c)=>c.code)],
      newlyAddedThemeSlotCount:Number(previous.newlyAddedThemeSlotCount||0)+
        Object.values(added).reduce((a,b)=>a+b,0),
      heldCardsResolved: [...new Set([...(previous.heldCardsResolved||[]),...previousHolds])],
      fullSetEvidence:evidencePath,
      archiveVerificationStatus:"existing_self_host_binary_decoded_all_remaining_61"
    });
  } else {
    state.reviews[code]={
      status:"complete",reviewedAt:evidence.recordedAt,
      reviewedCardCount:set.cards.length,reviewedThemes:mandatoryThemes,
      note:"Korean-language printed card images visually checked for every canonical slot including unnumbered basic energies. Existing self-host CDN binary decoded; no new origin downloads.",
      heldCards:[],newlyAddedCards:rows.map((c)=>c.code),
      newlyAddedThemeSlotCount:Object.values(added).reduce((a,b)=>a+b,0),
      fullSetEvidence:evidencePath,
      archiveVerificationStatus:"existing_self_host_binary_decoded_all"
    };
  }
  checkpoints.push({code,cardCount:rows.length,after:finish,themeAdditions:added,archivedImagesDecoded:rows.length});
  imageAudit.batches.push({
    task:6,set:code,range:code==="SVM"?"canonical 131-183 plus held 079,122,123,126-130":"canonical 001-"+String(set.cards.length).padStart(3,"0"),
    canonicalCardCount:rows.length,artworkVisuallyVerifiedCount:rows.length,
    artworkPendingCount:0,
    externalImageReferenceCountBefore:rows.length,
    newlyInternalizedReferenceCount:0,
    selfHostedReferenceCountAfter:rows.length,
    externalImageReferenceCountAfter:0,
    archiveVerificationStatus:"verified_existing_CDN_binary_decoded",
    verifiedImageCount:rows.length,unverifiedImageCount:0,brokenReferenceCount:0,
    themeAdditions:added,fullEvidence:evidencePath,
    note:"Existing self-hosted Cloudflare CDN Korean-print files decoded and visually inspected. External image source is catalog provenance only; no new image downloaded or hotlinked."
  });
}
const findProgress=(node)=>{
  if(!node||typeof node!=="object")return false;
  if(typeof node.lastSafeCheckpoint==="string"&&node.lastSafeCheckpoint.includes("SVM")){
    node.currentTaskScope="SVM, SVN, SVOD, SVOM strict complete. Earlier separate holds outside these four sets remain.";
    node.lastSafeCheckpoint="SVM 183/183; SVN 53/53; SVOD 21/21; SVOM 21/21. All pictured Korean-print images verified against existing CDN, with SVM eight old holds resolved. SVLS six evidence holds remain separate.";
    node.nextStart="SVLS six older evidence holds; then sv11W canonical 001";
    return true;
  }
  for(const x of Object.values(node))if(!Array.isArray(x)&&findProgress(x))return true;
  return false;
};
if(!findProgress(state))throw Error("Existing stage progress checkpoint missing");
if(state.lastEvidenceAuditCheckpoint?.set!=="SVM")
  throw Error("Unexpected existing evidence-audit checkpoint");
Object.assign(state.lastEvidenceAuditCheckpoint,{
  set:"SVOM",range:"canonical 001-021",reviewedCardCount:21,
  artworkEvidenceHolds:0,archiveVerificationStatus:"existing_CDN_print_verified",
  evidenceFile:evidencePath
});
imageAudit.nextStart="SVLS six outstanding older evidence holds; then sv11W canonical 001";
imageAudit.updatedAt=evidence.recordedAt;
await Promise.all([
  write("data/art-themes.json",themeData),
  write("data/audits/theme-series-review-status.json",state),
  write("data/audits/theme-image-selfhost-audit.json",imageAudit)
]);
console.log(JSON.stringify({cardReviews:totalExpected,newThemePlacements:placed,
  imagesVerified:totalExpected,checkpoints,nextStart:imageAudit.nextStart},null,2));
