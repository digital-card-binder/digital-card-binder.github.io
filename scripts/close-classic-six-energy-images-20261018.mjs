#!/usr/bin/env node
/*
 * Finish six Korean Classic Energy image holds by recording that CLL, CLK
 * and CLF catalog positions 033/034 are NOT asserted as numbers printed on
 * the physical unnumbered basic energy card. Only image correctness is closed.
 *
 * Precondition: previous app card-level image + own-CDN pixel audit passed.
 * Do not rename / merge cards; all canonical owner IDs and theme slots stay.
 */
import fs from "node:fs";
const P="data/audits/korean-recovery-active-queue-20261018.json";
const F="data/audits/classic-six-unnumbered-energy-image-and-catalog-resolution-20261018.json";
const old=JSON.parse(fs.readFileSync(P,"utf8"));
const ids=[35,36,57,58,84,85];
const expected=["CLL_033","CLL_034","CLK_033","CLK_034","CLF_033","CLF_034"];
if(old.counts.initial!==191||old.counts.totalClosed!==175||
 old.counts.stillUnresolved!==16||old.completedDoNotReaudit.length!==175||
 old.unresolved.length!==16)throw Error("Historic queue changed; abort");
const verified = ids.map((id,i)=>{
 const x=old.unresolved.find(y=>y.workId===id);
 if(!x||x.era!=="SV"||x.slot!==expected[i]||
 x.issue!=="unnumbered_Korean_energy_print_identity_not_yet_finalized"||
 x.imageComplete!==true||x.imageSourceVerified!==true||x.imageLanguageVerified!=="ko"||
 x.imagePublicVerifiedAt!=="2026-10-18"||
 !x.imageCardSourcePage?.startsWith("https://www.dogam.app/sets/")||
 !x.ownedImageUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/")||
 !x.sourceImageUrl?.startsWith("https://static.tcgexchange.kr/")||
 !x.imageVerificationRun?.includes("/39089932806"))
 throw Error("No previously verified exact Korean energy app + own CDN evidence for "+expected[i]);
 return {workId:id,slot:x.slot,series:x.series,koreanName:x.cardName,
    printedPhysicalCardNumber:null,printedNumberClaimed:false,
    catalogOrdinal:Number(x.slot.slice(-3)),
    sourceAppCard:x.imageCardSourcePage,sourceArtwork:x.sourceImageUrl,
    ownCdn:x.ownedImageUrl,
    priorSourcePixelVerification:x.imageVerificationRun};
});
const expectedNames={
 CLL_033:"기본 불꽃 에너지",CLL_034:"기본 번개 에너지",
 CLK_033:"기본 물 에너지",CLK_034:"기본 초 에너지",
 CLF_033:"기본 풀 에너지",CLF_034:"기본 격투 에너지"
};
for(const x of verified)if(expectedNames[x.slot]!==x.koreanName)throw Error("Korean energy name changed "+x.slot);
for(const x of verified)old.completedDoNotReaudit.push({
 workId:x.workId,slot:x.slot,series:x.series,name:x.koreanName,
 status:"Korean_energy_image_verified_catalog_order_not_physical_printed_number",
 imageComplete:true,
 catalogSlot:x.catalogOrdinal,physicallyPrintedIdentifier:null,
 printedNumberNotAssumed:true,
 priorPixelVerification:x.priorSourcePixelVerification,
 sourceEvidence:x.sourceAppCard,archiveImageUrl:x.ownCdn,
 verifiedAt:"2026-10-18",auditReport:F});
old.unresolved=old.unresolved.filter(x=>!ids.includes(x.workId));
old.counts.totalClosed=old.completedDoNotReaudit.length;
old.counts.stillUnresolved=old.unresolved.length;
for(const field of ["byEra","bySeries","byIssue"]){
 const k={byEra:"era",bySeries:"series",byIssue:"issue"}[field],d={};
 for(const y of old.unresolved)d[y[k]]=(d[y[k]]||0)+1;
 old.counts[field]=d;
}
old.counts.classicSixUnnumberedEnergyImageClosures=6;
old.status="181_completed_10_outstanding_one_wrong_photo_nine_nonnumeric_or_release_status_holds";
old.imageCompletionSnapshot.totalImageClosures=181;
old.imageCompletionSnapshot.remainingNonImageAndImageHolds=10;
old.imageCompletionSnapshot.classicSixUnnumberedEnergyImageClosures=6;
old.imageCompletionSnapshot.remainingVerifiedKoreanImageIdentityHolds=9;
old.imageCompletionSnapshot.stillMissingOrConflictedCardImages=1;
old.lastNewlyCompleted=verified;
old.nextPriority=[
 "S6K 094 needs an authenticated Korean printed correct card, conflicting app-number/photo data cannot be used blindly.",
 "MEGA M-P six catalog-only promos 500-502 and Energies 058-060: Korean image complete, prove official catalog ordering vs nonprinted identifiers.",
 "SN 025 and 026 virtual Lightning Energy duplicate: don't collapse distinct owner IDs before documented data migration.",
 "S-P 022 genuine Korean artwork preview, physically never-distributed according independent collectors; keep as nonstandard promo, not a confirmed released card.",
 "Korean Classic CLL/CLK/CLF energy six now image-verified and closed as catalog-only ordinal; no physical serial number asserted."
];
if(old.completedDoNotReaudit.length!==181||old.unresolved.length!==10||
 new Set(old.completedDoNotReaudit.map(x=>x.workId)).size!==181||
 new Set(old.unresolved.map(x=>x.workId)).size!==10||
 old.completedDoNotReaudit.some(x=>old.unresolved.some(y=>x.workId===y.workId)))
 throw Error("191 audit integrity conflict");
const rep={schemaVersion:1,date:"2026-10-18",
 operation:"close verified Korean Classic six energy photos, catalog positions only",
 completedBefore:175,completedAfter:181,newlyClosed:6,stillUnresolved:10,
 firstPartyProduct:"https://pokemoncard.co.kr/card/590",
 sourcePixelAudit:"https://github.com/digital-card-binder/digital-card-binder.github.io/actions/runs/39089932806",
 cardPhysicalSerialNumberEstablished:false,
 note:"Catalog 033/034 are logical app ordinal slots, NOT asserted to be physically printed serial numbers. This closes six Korean image/ordinal identity audit holds under owner's accepted Korean-card app matching policy, not a first-party physical print-number claim.",
 preservedAlreadyClosedCards:175,masterCardRecordsChanged:0,ownershipChanges:0,themeMembershipChanges:0,
 details:verified};
fs.writeFileSync(P,JSON.stringify(old,null,2)+"\n");
fs.writeFileSync(F,JSON.stringify(rep,null,2)+"\n");
console.log("CLASSIC_SIX_UNNUMBERED_KOREAN_IMAGES_COMPLETE",JSON.stringify({closedNow:6,complete:181,remaining:10}));
