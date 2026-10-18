#!/usr/bin/env node
/* Continue ONLY 191-record image/identity recovery from latest checkpoint.
   Close the eight MEGA Korean source card photos with their visible identifiers,
   which passed prior CDN pixel checks and the owner's accepted app criteria.
   Retain missing first-party provenance as a SEPARATE pending source audit.
   No card, ownership, theme, image, numbering or UI data is touched. */
import fs from "node:fs";
const Q="data/audits/korean-recovery-active-queue-20261018.json";
const M="data/audits/mega-fourteen-live-korean-image-reconciliation-20261018.json";
const R="data/audits/mega-eight-exact-korean-print-photo-closure-20261018.json";
const P="data/audits/mega-firstparty-evidence-pending-after-image-closure-20261018.json";
const q=JSON.parse(fs.readFileSync(Q,"utf8"));
const audit=JSON.parse(fs.readFileSync(M,"utf8"));
const expectedIds=[1,2,3,4,5,6,13,14];
const expectedMark={1:"B/RGB",2:"G/RGB",3:"R/RGB",4:"766/742",5:"016/M-P",6:"040/M-P",13:"085/M-P",14:"086/M-P"};
if(q.counts.initial!==191||q.counts.totalClosed!==167||q.counts.stillUnresolved!==24||
 q.unresolved.length!==24||q.completedDoNotReaudit.length!==167)
 throw Error("Saved queue changed; no identity re-audit or mutation allowed");
const c = expectedIds.map(id=>{
 const v=q.unresolved.find(x=>x.workId===id),p=audit.cardEvidence.find(x=>x.workId===id);
 if(!v||!p||v.era!=="MEGA"||v.imageComplete!==true||
 v.issue!=="first_party_official_card_identity_or_catalog_number_pending_image_verified"||
 p.verifiedKoreanWordsAndArt!==true||p.language!=="ko"||
 p.archivedImageContentNearMatch!==true||p.printedSerialNumberConfirmed!==true||
 p.printedMark!==expectedMark[id]||p.officialFirstPartyCardDetailVerified!==false||
 typeof p.approximatePixelDifference!=="number"||p.approximatePixelDifference>=18||
 !p.selfHostedUrl.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
  throw Error("Insufficient already-reviewed Korean printed + owned CDN proof id="+id);
 return {workId:id,slot:v.slot,series:v.series,name:p.name,code:p.code,
  cardPrintedIdentifier:p.printedMark,source:p.sourceUrl,owned:p.selfHostedUrl,
  archivePixelMeanDifference:p.approximatePixelDifference,
  sourceAudit:M,appCardUrl:v.referenceUrl||null,verifiedAt:"2026-10-18",
  officialFirstPartyCardLevelPublicationStatus:"pending_separate_provenance_only"};
});
const deferred=audit.cardEvidence.filter(x=>x.officialFirstPartyCardDetailVerified===false);
if(audit.summary.verifiedKoreanLanguageImagesSelfHosted!==14||
 deferred.length!==14||c.length!==8)throw Error("MEGA proof cardinality changed");
for(const card of c){
 q.completedDoNotReaudit.push({workId:card.workId,slot:card.slot,series:card.series,name:card.name,
  status:"Korean_app_and_visible_exact_print_mark_image_verified_own_CDN",
  imageComplete:true,visiblePrintedNumber:card.cardPrintedIdentifier,
  sourceEvidence:card.appCardUrl,imageSource:card.source,
  archiveImageUrl:card.owned,archivePixelsMeanDifference:card.archivePixelMeanDifference,
  verifiedAt:card.verifiedAt,auditReport:R,
  officialProvenanceFollowUp:P});
}
q.unresolved=q.unresolved.filter(x=>!expectedIds.includes(x.workId));
q.counts.totalClosed=q.completedDoNotReaudit.length;
q.counts.stillUnresolved=q.unresolved.length;
for(const field of ["byEra","bySeries","byIssue"]){
 const key={byEra:"era",bySeries:"series",byIssue:"issue"}[field],totals={};
 for(const v of q.unresolved) totals[v[key]]=(totals[v[key]]||0)+1;
 q.counts[field]=totals;
}
q.counts.megaOfficialIdentityHolds=6;
q.counts.megaPrintedImageIdentifierClosures=8;
q.counts.megaFirstPartyProofFollowUpsSeparateFrom191=14;
q.status="175_completed_16_remaining_mega_8_numbered_ko_images_closed_firstparty_release_provenance_separate";
q.imageCompletionSnapshot.totalImageClosures=175;
q.imageCompletionSnapshot.remainingNonImageAndImageHolds=16;
q.imageCompletionSnapshot.megaExactVisiblePrintImageClosures=8;
q.imageCompletionSnapshot.megaFirstPartyProvenanceOpenInIndependentAudit=14;
q.imageCompletionSnapshot.remainingVerifiedKoreanImageIdentityHolds=15;
q.imageCompletionSnapshot.stillMissingOrConflictedCardImages=1;
q.nextPriority=[
 "S6K 094 exact Korean photo: source numbers inconsistent, one app 094 Korean Fog Crystal image, own catalog 094 Echoing Horn; no blind substitution.",
 "MEGA six catalog-only / nonnumeric printed marks: preserve physical-number unknown and verify separate official release/provenance.",
 "Classic six unnumbered Energy slots: catalog ordering is not physical printed number; reconcile app images as catalog-only.",
 "SN 025 and 026: same physical Korean unnumbered Lightning Energy, virtual duplicate and ownership migration still pending.",
 "S-P 022: actual official Korean preview restored, but tournament postponed and promo apparently not normally distributed; retain issue-status audit."
];
q.lastNewlyCompleted=c;
if(q.completedDoNotReaudit.length!==175||q.unresolved.length!==16||
 new Set(q.completedDoNotReaudit.map(x=>x.workId)).size!==175||
 new Set(q.unresolved.map(x=>x.workId)).size!==16||
 q.completedDoNotReaudit.some(x=>q.unresolved.some(y=>y.workId===x.workId)))
 throw Error("Original 191 checkpoint integrity violation");
const report={
 schemaVersion:1,date:"2026-10-18",operation:"close_numbered_Mega_app_verified_image_identifiers_only",
 completedBefore:167,newImageIdentityClosures:8,completedAfter:175,stillUnresolved:16,
 noReauditOfPreviouslyCompleted:167,
 firstPartyPublicationProofNotClaimed:true,firstPartyEvidenceFollowUp:P,
 changesToCanonicalCards:0,changesToOwnedStates:0,changesToThemeMembership:0,
 proofRecords:c};
const provenance={
 schemaVersion:1,date:"2026-10-18",
 context:"The user's accepted exact Korean app + actual printed identity policy means 8 photos are complete, not that official Korea card-level publication or image redistribution rights are evidenced.",
 whySeparate:"Avoid inflating 191 image-error queue with already-correct Korean photos while keeping incomplete official-release evidence transparently open.",
 firstPartyCardPublicationProofPending:deferred.length,
 sixRemainIn191BecausePhysicalPrintedNumberUnverified:deferred.filter(x=>!x.printedSerialNumberConfirmed).map(x=>({id:x.workId,code:x.code,mark:x.printedMark})),
 eightPhotoClosedButOfficialProvenanceUnconfirmed:c.map(x=>({id:x.workId,code:x.code,printed:x.cardPrintedIdentifier,cardApp:x.appCardUrl})),
 allFourteenStillRequireFirstPartyProvenance:deferred.map(x=>({id:x.workId,code:x.code,printedMark:x.printedMark,photoComplete:true,firstPartyCardPageFound:false}))
};
for(const [file,v] of [[Q,q],[R,report],[P,provenance]])
 fs.writeFileSync(file,JSON.stringify(v,null,2)+"\n");
console.log("MEGA_8_NUMBERED_KOREAN_PHOTOS_CLOSED",JSON.stringify({completed:175,remaining:16,officialProvenanceSeparate:14,ids:expectedIds}));
