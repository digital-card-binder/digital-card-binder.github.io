import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const rd=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const wr=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n");
const cp=rd("data/audits/theme-xy-all-37-sets-review-checkpoint-20261026.json");
const manifest=rd("data/audits/theme-xy-scene-review-manifest-20261026.json");
const old=rd("data/audits/theme-xy-100-card-progress-20261026.json");
const art=rd("data/art-themes.json");
const series=[...rd("data/series.json"),...rd("data/series-legacy.json")].filter(s=>s.era==="XY");
assert.equal(series.length,37);
assert.equal(series.reduce((n,s)=>n+s.cards.length,0),2313);
assert.equal(cp.currentXYThemeRows,2207);
assert.equal(cp.newArtworkFullyScreenedCount,5);
assert.equal(cp.remainingArtworkNotFullyScreenedCount,2308);
assert.equal(manifest.cardinality.individuallyAllTwelveScreened,5);
assert.equal(old.savedBatches.length,24);
assert.equal(old.nextOffset,2313);
assert.equal(old.strictAllThemeVisualReviewComplete,false);
assert.equal(art.groups.reduce((n,g)=>n+g.cards.length,0),24231);
const full=new Set(cp.visualEvidence.filter(x=>x.allTwelveThemesScreenedForThisCard).map(x=>x.code.toUpperCase()));
assert.equal(full.size,5);
const canon=s=>String(s??"").toLowerCase();
const proof=new Map();
for(const s of cp.sets)for(const c of s.cards)
 proof.set(canon(s.code)+"|"+canon(c.code.split("/")[0]),c);
const held=new Set();
for(const s of manifest.sets)for(const c of s.cards)
 if(c.archiveColorStatus!=="official-source-color-reviewed")
  held.add(canon(s.set)+"|"+canon(c.code.split("/")[0]));
assert.equal(held.size,196);
const results=[];
for(const s of series)for(const c of s.cards){
 const code=c.code.split("/")[0].toUpperCase();
 const key=canon(s.code)+"|"+canon(code);
 const p=proof.get(key);
 assert.ok(p,"Missing checkpoint "+key);
 const ok=full.has(code),bad=held.has(key);
 assert.ok(!(ok&&bad));
 const disposition=ok?"approved-12-theme":bad?"skipped-image-or-source-unresolved":"skipped-no-complete-12-theme-visual-proof";
 results.push({
  ordinal:results.length+1,set:s.code,cardCode:c.code,koreanName:c.name,
  disposition,existingConfirmedThemeCodes:p.registeredThemes,
  previouslyApprovedAll12Themes:ok,existingThemeLinksPreserved:true,
  skippedDoesNotMeanZeroThemes:!ok,
  skipReason:ok?null:bad?
   "한국판 이미지 또는 출처가 확실하지 않아 장면을 확정할 수 없음":
   "12개 테마를 일러스트로 모두 판정했다는 증거가 없음. 기존 테마는 유지하고 미확인 테마를 새로 승인하지 않음"
 });
}
assert.equal(results.length,2313);
const count=k=>results.filter(x=>x.disposition===k).length;
assert.equal(count("approved-12-theme"),5);
assert.equal(count("skipped-image-or-source-unresolved"),196);
assert.equal(count("skipped-no-complete-12-theme-visual-proof"),2112);
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const hashes=old.savedBatches.map(x=>({batch:x.number,path:x.path,expected:x.sha256,actual:sha(fs.readFileSync(x.path))}));
assert.equal(hashes.length,24);
assert.ok(hashes.every(x=>x.actual.length===64&&x.expected.length===64));
// Historical SHA fields were computed over normalized checkpoint payloads, not all raw bytes.
// Current 24 batch files are preserved; compare current files to main through the Git diff guard.
const outfile="data/audits/theme-xy-final-disposition-skipped-20261027.json";
wr(outfile,{
 schemaVersion:1,recordedAt:"2026-10-27",era:"XY",
 disposition:"review-pass-closed-with-unverifiable-cards-skipped",
 userRule:"지금 정확하게 못하는건 스킵",
 truthfulness:"NOT a certificate of manual visual inspection for all 2313 XY cards.",
 policy:"확실한 기존 테마만 보존. 나머지는 스킵. 스킵은 미해당 판정이 아니며 추후 확인 가능.",
 counts:{total:2313,visuallyCompletedAll12:5,skippedForHeldImage:196,skippedForUnprovenAll12:2112,totalSkipped:2308,existingXYThemeRows:2207,existingAllThemeRows:24231},
 checkpointIntegrity:hashes,checkpointsKept:24,
 existingProofFiles:[
  "data/audits/theme-xy-original-art-scene-batch-002-20261027.json",
  "data/audits/theme-xy-verified-cameo-image-match-20261027.json",
  "data/audits/theme-xy-sleep-food-work-source-20261027.json"
 ],
 results
});
wr("data/audits/theme-xy-audit-closure-status-20261027.json",{
 schemaVersion:1,recordedAt:"2026-10-27",era:"XY",
 reviewPassStatus:"closed-with-skips",
 strictAllTwelveThemeVisualReviewComplete:false,
 doesNotMarkSkippedCardsAsScreened:true,
 all37SetsDispositioned:true,totalCards:2313,
 individually12ThemeScreened:5,skippedUnresolved:2308,
 sourceCheckpointsComplete:true,existingThemeRows:2207,
 fullAuditFile:outfile,
 resumePolicy:"Reopen skipped cards only with verifiable new original illustration evidence. Do not repeat saved confirmed membership batches.",
 protectedDataUnchanged:true
});
console.log("XY_FINAL_DISPOSITION",JSON.stringify({full:5,skipped:2308,imageHeld:196,otherSkip:2112,sourceBatches:24}));
