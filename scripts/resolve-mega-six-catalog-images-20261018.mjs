#!/usr/bin/env node
/* Reconcile ONLY six previously pixel-verified Korean MEGA promo / Energy images.
 * Promos 500/501/502 and Energy 058/059/060 are catalogue identifiers, not
 * visibly printed serials. Keep first-party official provenance in independent
 * fourteen-card audit; never present virtual IDs as printed card numbers. */
import fs from "node:fs";
const Q="data/audits/korean-recovery-active-queue-20261018.json";
const M="data/audits/mega-fourteen-live-korean-image-reconciliation-20261018.json";
const P="data/audits/mega-firstparty-evidence-pending-after-image-closure-20261018.json";
const OUT="data/audits/mega-six-catalog-only-korean-image-closure-20261018.json";
const q=JSON.parse(fs.readFileSync(Q,"utf8"));
const mega=JSON.parse(fs.readFileSync(M,"utf8"));
const unconfirmed=JSON.parse(fs.readFileSync(P,"utf8"));
if(q.counts.initial!==191||q.counts.totalClosed!==181||
 q.counts.stillUnresolved!==10||q.completedDoNotReaudit.length!==181||
 q.unresolved.length!==10||unconfirmed.firstPartyCardPublicationProofPending!==14)
 throw Error("Unexpected current verified checkpoint");
const ids=[7,8,9,10,11,12], marks={
 7:"PROMO M-P; 2026 한국 리그 4강",
 8:"PROMO M-P; 2026 한국 리그 준우승",
 9:"PROMO M-P; 2026 한국 리그 우승",
 10:"GRA",11:"FIR",12:"WAT"
};
const details=ids.map(id=>{
 const row=q.unresolved.find(x=>x.workId===id),
 card=mega.cardEvidence.find(x=>x.workId===id);
 if(!row||!card||row.era!=="MEGA"||row.series!=="M-P"||
 row.imageComplete!==true||
 row.issue!=="first_party_official_card_identity_or_catalog_number_pending_image_verified"||
 card.language!=="ko"||card.verifiedKoreanWordsAndArt!==true||
 card.archivedImageContentNearMatch!==true||
 card.printedSerialNumberConfirmed!==false||
 card.officialFirstPartyCardDetailVerified!==false||
 card.printedIdentifierKind!=="catalog_number_not_visible_on_print"||
 card.printedMark!==marks[id]||
 !(card.approximatePixelDifference<18)||
 !card.selfHostedUrl.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
 throw Error("MEGA six missing prior exact Korean image / nonprinted number proof id="+id);
 return {workId:id,slot:row.slot,series:row.series,code:card.code,name:card.name,
   printedMarkOrType:card.printedMark,physicalSerialNumberPrinted:false,
   catalogNumberIsNotPhysicalPrintNumber:true,
   appCardPage:row.referenceUrl||null,
   appImageSource:card.sourceUrl,
   ownCdn:card.selfHostedUrl,
   pixelDifference:card.approximatePixelDifference,
   priorProof:M,officialProvenanceFollowUp:P};
});
for(const x of details)q.completedDoNotReaudit.push({
 workId:x.workId,slot:x.slot,series:x.series,name:x.name,
 status:"Korean_special_promo_or_energy_photo_verified_catalog_only_identifier",
 imageComplete:true,physicalPrintedNumber:null,catalogNumberOnly:true,
 knownPrintedMark:x.printedMarkOrType,sourceEvidence:x.appCardPage,
 imageSource:x.appImageSource,archiveImageUrl:x.ownCdn,
 priorPixelDifference:x.pixelDifference,verifiedAt:"2026-10-18",
 sourceAudit:M,firstPartyProvenanceFollowUp:P,auditReport:OUT
});
q.unresolved=q.unresolved.filter(x=>!ids.includes(x.workId));
q.counts.totalClosed=q.completedDoNotReaudit.length;
q.counts.stillUnresolved=q.unresolved.length;
for(const key of ["byEra","bySeries","byIssue"]){
 const source={byEra:"era",bySeries:"series",byIssue:"issue"}[key],r={};
 for(const x of q.unresolved)r[x[source]]=(r[x[source]]||0)+1;
 q.counts[key]=r;
}
q.counts.megaOfficialIdentityHolds=0;
q.counts.megaSixSpecialCatalogImageClosures=6;
q.counts.megaFirstPartyProofFollowUpsSeparateFrom191=14;
q.status="187_191_Korean_image_identity_work_items_complete_four_special_holds_remain";
q.imageCompletionSnapshot.totalImageClosures=187;
q.imageCompletionSnapshot.remainingNonImageAndImageHolds=4;
q.imageCompletionSnapshot.megaSixSpecialCatalogImageClosures=6;
q.imageCompletionSnapshot.remainingVerifiedKoreanImageIdentityHolds=3;
q.imageCompletionSnapshot.stillMissingOrConflictedCardImages=1;
q.imageCompletionSnapshot.megaFirstPartyProvenanceOpenInIndependentAudit=14;
q.nextPriority=[
 "S6K 094: exact card image conflict. App has Korean 094 안개의 수정, but existing canonical 094 메아리호른, Korean 093 SSG photo also appears 안개의 수정. Do not overwrite without resolving print editions.",
 "SN 025 & 026: same unnumbered Korean Energy artwork under two legacy synthetic ID slots, separate physical variants not established; preserve existing ownership pending safe migration.",
 "S-P 022: Korean official preview image correctly displayed, but promised 2020 Korean League event postponed and collector records say promo was never issued; maintain unreleased special-catalog status, do not misrepresent physical availability.",
 "MEGA first-party Korean card release evidence remains separately outstanding in mega-firstparty-evidence-pending-after-image-closure-20261018.json (14 photos already pixel verified)."
];
q.lastNewlyCompleted=details;
if(q.completedDoNotReaudit.length!==187||q.unresolved.length!==4||
 new Set(q.completedDoNotReaudit.map(x=>x.workId)).size!==187||
 new Set(q.unresolved.map(x=>x.workId)).size!==4||
 q.completedDoNotReaudit.some(x=>q.unresolved.some(y=>x.workId===y.workId)))
 throw Error("History corruption risk: 191 card items not conserved");
const report={schemaVersion:1,date:"2026-10-18",
 title:"Six verified Korean MEGA image records with deliberately nonprinted catalog identifiers",
 completedBefore:181,newClosures:6,completedAfter:187,remaining:4,
 printedPhysicalCardNumbersAssumed:0,
 firstPartyKoreanDistributionNotProven:true,firstPartyFutureAudit:P,
 reusedPriorOwnedCDNPixelEvidence:true,noNewImageReplacementsNeeded:true,
 preserved181PriorCompletions:true,masterCardMutations:0,ownedStateMutations:0,
 entries:details};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+"\n");
fs.writeFileSync(Q,JSON.stringify(q,null,2)+"\n");
console.log("MEGA_CATALOG_ONLY_SIX_KOREAN_IMAGES_COMPLETE",JSON.stringify({total:191,done:187,left:4,ids}));
