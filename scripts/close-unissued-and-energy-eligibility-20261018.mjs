#!/usr/bin/env node
/* Close final three Korean release/duplicate review issues only when original
   191-card checkpoint, published official S-P artwork and owner alias source
   are all intact. No user-state, raw series data or card images changed. */
import fs from "node:fs";
function load(path){return JSON.parse(fs.readFileSync(path,"utf8"));}
const manifest=load("data/series-collection-exclusions.json");
const queuePath="data/audits/korean-recovery-active-queue-20261018.json";
const reportPath="data/audits/final-three-collection-eligibility-resolution-20261018.json";
const q=load(queuePath),cards=load("data/series.json");
if(q.counts.initial!==191||q.counts.totalClosed!==187||q.counts.stillUnresolved!==4||
   q.completedDoNotReaudit.length!==187||q.unresolved.length!==4)
 throw new Error("Unexpected 187 completed checkpoint");
if(manifest.expectedRawSeriesCount!==20243||manifest.expectedActiveSeriesCount!==20241||
   manifest.exclusions.length!==2)throw new Error("Unexpected Korean exclusion manifest");
const groups=cards.filter(g=>["s-p","sn"].includes(String(g.code).toLowerCase()));
if(groups.length!==2)throw new Error("Expected exact S-P and SN in raw catalog");
const sp=groups.find(g=>g.code.toLowerCase()==="s-p");
const sn=groups.find(g=>g.code.toLowerCase()==="sn");
if(sp.cards.length!==204||sn.cards.length!==26)throw new Error("Original S-P or SN historic card count changed");
const promo=sp.cards.find(x=>String(x.code).toLowerCase()==="s-p_022/s-p");
const primary=sn.cards.find(x=>String(x.code).toLowerCase()==="sn_025/024");
const duplicate=sn.cards.find(x=>String(x.code).toLowerCase()==="sn_026/024");
if(!promo||promo.name!=="나옹 VMAX"||
 !promo.image.endsWith("/assets/cards/s-p-korean-promo/022-korean.webp")||
 !primary||!duplicate||primary.name!==duplicate.name||
 primary.image!==duplicate.image||primary.name!=="기본 번개 에너지")
 throw new Error("Original Korean promo or SN duplicate photos changed");
const ids=[161,163,164],resolution=[];
for(const id of ids){
 const row=q.unresolved.find(x=>x.workId===id);
 if(!row||row.imageComplete!==true)throw new Error("Missing already-verified Korean image hold "+id);
 const info={
   workId:id,slot:row.slot,series:row.series,
   name:id===161?"나옹 VMAX":"기본 번개 에너지",
   imageComplete:true,verifiedAt:"2026-10-18",
   status:id===161?"Korean_official_preview_kept_in_archive_unissued_noncollectible":
     id===163?"Korean_unnumbered_energy_image_verified_primary_virtual_identity":
     "Korean_duplicate_virtual_energy_excluded_old_owner_alias_preserved",
   activeCollectionEligibility:id===161||id===164?"excluded":"included",
   printedPhysicalCardNumber:null,
   historicalOwnershipRecordsDeleted:false,
   sourceEvidence:id===161?"data/audits/sp022-live-Korean-image-proof-20261018.json":
      "data/audits/sn-025-026-virtual-duplicate-print-evidence-20261018.json",
   proofReport:reportPath
 };
 resolution.push(info);
 q.completedDoNotReaudit.push(info);
}
q.unresolved=q.unresolved.filter(x=>!ids.includes(x.workId));
q.counts.totalClosed=q.completedDoNotReaudit.length;
q.counts.stillUnresolved=q.unresolved.length;
for(const field of ["byEra","bySeries","byIssue"]){
 const key={byEra:"era",bySeries:"series",byIssue:"issue"}[field],value={};
 for(const row of q.unresolved)value[row[key]]=(value[row[key]]||0)+1;
 q.counts[field]=value;
}
q.counts.finalUnissuedAndVirtualDuplicateExclusions=2;
q.counts.finalThreeReleaseIdentityClosures=3;
q.status="190_Korean_image_and_release_identity_issues_resolved_one_s6k_094_conflicted_photo_remains";
q.imageCompletionSnapshot.totalImageClosures=190;
q.imageCompletionSnapshot.remainingNonImageAndImageHolds=1;
q.imageCompletionSnapshot.remainingVerifiedKoreanImageIdentityHolds=0;
q.imageCompletionSnapshot.stillMissingOrConflictedCardImages=1;
q.nextPriority=[
 "S6K 094 Korean actual Echoing Horn printed photo needed; Dogam Korean 094 is different Fog Crystal despite printed number, and Japanese 094 must not be used.",
 "MEGA 14 first-party Korean release/card-page provenance independently pending, separate from 191 Korean image-error review."
];
q.lastNewlyCompleted=resolution;
q.latestCompletion={
 operation:"190 of 191 original Korean image and card-catalog eligibility issues reconciled",
 activeCollectibleCards:20241,
 rawOriginalRecordsPreserved:20243,
 inactiveButRawSaved:["S-P_022","SN_026"],
 originalOwnerKeysPreserved:true,
 ownerKeyCompatibilityAdded:"SN_026 to SN_025 when no current explicit owner override",
 remaining:["S6K_094_Korean_print_photo"],
 firstPartyProvenanceSeparate:"data/audits/mega-firstparty-evidence-pending-after-image-closure-20261018.json"
};
if(q.completedDoNotReaudit.length!==190||q.unresolved.length!==1||
 q.unresolved[0].workId!==160||
 new Set(q.completedDoNotReaudit.map(x=>x.workId)).size!==190||
 q.completedDoNotReaudit.some(x=>x.workId===160))throw new Error("191 audit lost its identity");
const report={
 schemaVersion:1,date:"2026-10-18",
 originalScope:191,completedBefore:187,newlyResolved:3,completedNow:190,
 remainingImageIdentityIssues:1,
 excludedFromLiveCollection:[{code:"s-p_022/S-P",reason:"unissued Korean League season 2 promo"},
 {code:"sn_026/024",reason:"duplicate virtual unnumbered Lightning Energy"}],
 primaryUnnumberedEnergy:"sn_025/024",
 rawArchivedCards:20243,activeCollectibleCards:20241,
 physicalPreviewStillArchived:true,originalSeriesRecordsDeleted:0,
 FirebaseUserDocumentsModified:0,rawCardPhotosModified:0,
 priorCompletionsReaudited:0,
 identityCompatibility:"SN_026 old override resolved to SN_025 if no current override exists",
 supportingDocuments:["data/series-collection-exclusions.json",
 "data/audits/sn-025-026-virtual-duplicate-print-evidence-20261018.json",
 "data/audits/sp022-live-Korean-image-proof-20261018.json"]
};
fs.writeFileSync(queuePath,JSON.stringify(q,null,2)+"\n");
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");
console.log("LAST_THREE_ELIGIBILITY_RESOLVED",JSON.stringify({completed:190,remaining:1,raw:20243,active:20241,ids}));
