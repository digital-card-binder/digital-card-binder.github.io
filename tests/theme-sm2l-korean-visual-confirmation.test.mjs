import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("SM2L source scans and actual Korean-print preview have consistent checkpoints", () => {
 const source=JSON.parse(fs.readFileSync("data/audits/theme-sm2l-canonical-image-http-and-decoding-20261019.json","utf8"));
 const current=JSON.parse(fs.readFileSync("data/audits/theme-sm2l-korean-visual-confirmation-batch01-20261019.json","utf8"));
 const prior=JSON.parse(fs.readFileSync("data/audits/theme-sm2l-047-048-korean-number-resolution-20261019.json","utf8"));
 assert.equal(source.sourceRecords.length,62);
 assert.equal(source.allImagesDownloadedAndDecoded,62);
 assert.equal(source.httpOrDecodeFailures.length,0);
 assert.ok(source.sourceRecords.every(x=>x.imageDecoded&&x.httpStatus===200&&x.sha256?.length===64));
 assert.equal(current.previousDirectKoreanCardPhotosConfirmed,7);
 assert.equal(current.newDirectKoreanCardPhotosConfirmed,12);
 assert.equal(current.cumulativeDirectKoreanCardPhotosConfirmed,19);
 assert.equal(current.remainingDirectKoreanCardPhotoVerification,43);
 assert.equal(current.allSetCards,62);
 assert.equal(current.confirmedCodes.length,19);
 assert.equal(current.verifiedInThisPass.length,12);
 assert.equal(current.needsFurtherInspection.length,43);
 assert.deepEqual(new Set([...current.confirmedCodes,...current.needsFurtherInspection.map(x=>x.code)]).size,62);
 assert.ok(current.verifiedInThisPass.every(x=>x.actualKoreanCardFaceVisuallyInspected&&
   x.actualKoreanFooterNumberVisuallyInspected));
 for(const x of current.verifiedInThisPass){
  const image=source.sourceRecords.find(z=>z.code===x.code);
  assert.ok(image);
  assert.equal(image.sha256,x.sha256);
  assert.equal(image.name,x.printedKoreanName);
 }
 const previous=prior.imageSourceInventory.cards.filter(x=>x.verifiedKoreanPhysicalPrintInPriorAudit).map(x=>x.code);
 assert.equal(previous.length,7);
 assert.ok(previous.every(x=>current.confirmedCodes.includes(x)));
 assert.equal(current.existingThemesUnchanged,18011);
 assert.equal(current.seriesStrictComplete,false);
});
