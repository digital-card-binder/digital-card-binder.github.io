import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const path="data/series.json";
const evidence="data/audits/theme-s3a-042-printed-name-correction-20261017.json";
const input=await readFile(path,"utf8");
const catalog=JSON.parse(input);
const matching=catalog.filter(x=>String(x.code||"").toLowerCase()==="s3a");
assert.equal(matching.length,1,"S3a must remain one canonical set");
const set=matching[0];
assert.equal(set.cards.length,94,"S3a 94-card canonical set must remain unchanged");
const card=set.cards[41];
assert.equal(String(card.code).toLowerCase(),"s3a_042/076");
assert.equal(card.order,42);
assert.equal(card.image,"https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S3a/S3a_042.png");
assert.equal(card.source,"https://pokemoncard.co.kr/cards/detail/BS2020012042");
assert.ok(["석탄산","석탄산 V"].includes(card.name),"Unexpected original Korean name");
const beforeCardKeys=JSON.stringify(set.cards.map(x=>x.code));
const beforeOwnership=JSON.stringify(set.cards.map(x=>[x.owned,x.status]));
const changed=card.name==="석탄산";
if(changed){
  card.name="석탄산 V";
  const updated=JSON.stringify(catalog,null,2)+"\n";
  // Avoid rewriting unrelated data during the source-name correction.
  const beforeFragment='"name": "석탄산"';
  const afterFragment='"name": "석탄산 V"';
  const idx=input.indexOf('"code": "s3a_042/076"');
  assert.ok(idx>=0,"Canonical source marker not found");
  const nextRecord=input.indexOf('"code": "s3a_043/076"',idx);
  assert.ok(nextRecord>idx,"Following canonical card missing");
  const span=input.slice(idx,nextRecord);
  assert.equal(span.split(beforeFragment).length-1,1,"Expected printed-name mismatch must be unique to 042");
  const textPatched=input.slice(0,idx)+span.replace(beforeFragment,afterFragment)+input.slice(nextRecord);
  assert.equal(updated,textPatched,"Serialization must only change the verified card name");
  assert.equal(JSON.stringify(set.cards.map(x=>x.code)),beforeCardKeys);
  assert.equal(JSON.stringify(set.cards.map(x=>[x.owned,x.status])),beforeOwnership);
  await writeFile(path,textPatched,"utf8");
}
const audit={
  schemaVersion:1,recordedAt:"2026-10-17",set:"s3a",
  canonicalCode:"s3a_042/076",canonicalOrder:42,
  previousKoreanName:"석탄산",correctKoreanPrintedName:"석탄산 V",
  observedPrintedName:"석탄산 V",
  evidenceImage:"https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S3a/S3a_042.webp",
  originalSource:"https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S3a/S3a_042.png",
  supportingKoreanPrintReference:"https://collectory.cc/cards/50f97785-638e-466a-b2f6-85ea9ec66d10",
  reviewedSheet:"data/audits/theme-visual-evidence/s3a/031-060/s3a-031-060-01.webp.b64",
  rules:"Verified Korean printed 042/076 card shows 석탄산 V, not 석탄산. Correct display name only. Preserve set order, canonical code, image source, ownership status, collections and independent themes.",
  cardKeysUnchanged:true,ownershipUnchanged:true,otherCardRecordsUnchanged:true,
  status:"corrected"
};
await writeFile(evidence,JSON.stringify(audit,null,2)+"\n","utf8");
console.log(JSON.stringify({set:"s3a",card:"042/076",printedName:card.name,changed,cardKeysUnchanged:true,ownershipUnchanged:true}));
