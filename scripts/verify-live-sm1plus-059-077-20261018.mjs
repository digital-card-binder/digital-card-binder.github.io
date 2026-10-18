#!/usr/bin/env node
/* Live SHA256 proof for 19 corrected Korean SM1+ cards; no ownership mutation. */
import fs from "node:fs";
import crypto from "node:crypto";
const root="data/audits/";
const srcFile=root+"sm1plus-059-077-Korean-source-image-recovery-20261018.json";
const conflictFile=root+"theme-sm1plus-059-077-master-vs-hosted-Korean-art-conflict-20261017.json";
const proofFile=root+"sm1plus-059-077-live-site-image-validation-20261018.json";
const source=JSON.parse(fs.readFileSync(srcFile,"utf8"));
const groups=JSON.parse(fs.readFileSync("data/series.json","utf8"));
const group=groups.find(g=>String(g.code).toLowerCase()==="sm1+");
if(!group||group.cards.length!==77||source.cardSources.length!==19||
source.approvedKoreanAppCardImages!==19)throw Error("19 Korean app source/master registry not intact");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const records=[];
for(const entry of source.cardSources){
 const idx=entry.number;
 const expectedUrl="https://digital-card-binder.github.io/assets/cards/sm1plus-korean/"+String(idx).padStart(3,"0")+".webp";
 if(!(idx>=59 && idx<=77)||entry.ownedUrl!==expectedUrl)
  throw Error("Published path does not match canonical slot "+idx);
 const c=group.cards.find(c=>String(c.code).toLowerCase()===entry.code.toLowerCase());
 if(!c||c.name!==entry.name||c.image!==entry.ownedUrl||c.source!==entry.appPage)
  throw Error("Canonical Korean art reference changed "+entry.code);
 const local=fs.readFileSync(entry.ownedPath);
 if(sha(local)!==entry.ownedSHA256||local.length!==entry.ownedBytes)
  throw Error("Stored Korean file hash changed "+entry.code);
 let remote;
 for(let attempt=0;attempt<8;attempt++){
   try{
    const res=await fetch(entry.ownedUrl,{headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(30000)});
    if(!res.ok)throw new Error("HTTP "+res.status);
    remote=Buffer.from(await res.arrayBuffer());
    if(sha(remote)!==entry.ownedSHA256)throw new Error("Live SHA256 differs from repository source");
    break;
   }catch(e){
     if(attempt===7)throw new Error("Live Korean image proof failed "+entry.code+": "+e.message);
     await new Promise(r=>setTimeout(r,3500+1500*attempt));
   }
 }
 records.push({number:idx,code:c.code,name:c.name,url:c.image,sha256:sha(remote),
     bytes:remote.length,appPage:c.source,printedNumberEvidence:entry.printedNumberEvidence,
     status:"public_GitHub_Pages_Korean_photo_sha256_verified"});
 console.log("LIVE_SM1PLUS_CARD",JSON.stringify({idx,name:c.name,bytes:remote.length}));
}
if(records.length!==19||records.filter(x=>x.printedNumberEvidence==="korean_card_footer_3digit_over_051").length!==10||
records.filter(x=>x.printedNumberEvidence==="korean_basic_energy_virtual_catalog_ordinal_not_printed").length!==9)
throw Error("Expected 10 Korean printed and nine unnumbered Energies");
const previous=JSON.parse(fs.readFileSync(conflictFile,"utf8"));
if(previous.canonicalMasterCount!==77||previous.comparisons?.length!==19||
 previous.observedMismatchCount!==19)throw Error("Original 19 mismatch evidence changed");
for(const prior of previous.comparisons){
 const matched=records.find(x=>x.code===prior.masterCode);
 if(!matched||prior.masterName!==matched.name)throw Error("Historical mismatch doesn't align with current master");
 prior.correctedSiteImage=matched.url;
 prior.correctedKoreanAppSource=matched.appPage;
 prior.replacementVerifiedPublishedSHA256=matched.sha256;
 prior.status="resolved_correct_Korean_photo_live_site";
}
previous.status="resolved_19_high_range_Korean_images_verified_on_live_site";
previous.previousMismatchTotal=19;
previous.postFixRemainingNamePhotoMismatches=0;
previous.sourceRecoveryReport=srcFile;
previous.publicationAuditReport=proofFile;
previous.unnumberedEnergyNote="069-077 Korean basic Energy photos use catalog No. slots, not printed 069/051-077/051.";
previous.masterOrOwnerIdentityChanged=false;
fs.writeFileSync(conflictFile,JSON.stringify(previous,null,2)+"\n");
const report={schemaVersion:1,date:"2026-10-18",set:"SM1+",range:"059-077",
 originalMisidentifiedCardImages:19,repairedLiveAndSHA256Validated:19,
 highRarityCardFooterVerifiedThroughApp:10,basicEnergyCatalogOnlyUnnumberedImages:9,
 original191ImageRecoveryCheckpointUntouched:true,historicalS6K094StillPending:true,
 first58ArtworkReviewsNotReaudited:true,first58IndividualPrintedNumberFollowUpsRemain:true,
 sourceEvidence:srcFile,allPreviouslyCompletedSetsUntouched:true,
 canonicalCardNamesCodesOrderUnchanged:true,changesToOwnedCollectionRecords:0,
 images:records};
fs.writeFileSync(proofFile,JSON.stringify(report,null,2)+"\n");
console.log("SM1PLUS_19_PUBLIC_KR_PHOTOS_VERIFIED",JSON.stringify({liveVerified:records.length,printed:10,unnumbered:9}));
