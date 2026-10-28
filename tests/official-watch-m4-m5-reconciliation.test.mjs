import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const src=read("scripts/check-official-card-updates.mjs");
const audit=JSON.parse(read("data/series-inventory-audit.json"));
const report=JSON.parse(read("data/update-watch.json"));
const a=src.indexOf("function clean(value)"),b=src.indexOf("function decodeHtml(",a),
      c=src.indexOf("function localNames(",b),d=src.indexOf("const [reportRaw, seriesRaw",c);
assert.ok(a>=0&&b>a&&c>b&&d>c);
const ctx={Set,String,Array};
vm.runInNewContext(src.slice(a,b)+"\n"+src.slice(c,d)+"\nglobalThis.watch={normalize,localNames};",ctx);
const {normalize,localNames}=ctx.watch;
test("M4/M5 product names without the catalog card-count suffix match registered groups",()=>{
 const sets=audit.sets.filter(s=>["m4","m5"].includes(s.code.toLowerCase()));
 assert.equal(sets.length,2);
 const local=localNames(sets);
 for(const label of ["닌자스피너","어비스아이"])assert.ok(local.has(normalize(label)),label);
 assert.equal(local.has(normalize("닌자스피너 2")),false);
 assert.equal(sets.find(s=>s.code.toLowerCase()==="m4").cardCount,120);
 assert.equal(sets.find(s=>s.code.toLowerCase()==="m5").cardCount,118);
});
test("all six official products previously observed are covered, but truly new products still alert",()=>{
 const registered=localNames(audit.sets);
 for(const name of report.knownOfficialProducts)registered.add(normalize(name));
 assert.deepEqual(report.lastOfficialProducts.filter(x=>!registered.has(normalize(x))),[]);
 assert.equal(registered.has(normalize("처음보는신상품")),false);
 assert.equal(report.status,"clear");
 assert.deepEqual(report.detectedProducts,[]);
});
test("the change does not equate product registration with complete Korean card-name verification",()=>{
 const m4=audit.sets.find(s=>s.code.toLowerCase()==="m4");
 const m5=audit.sets.find(s=>s.code.toLowerCase()==="m5");
 assert.equal(m4.firstCardCode,"m4_001/083");
 assert.equal(m4.lastCardCode,"m4_120/083");
 assert.equal(m5.firstCardCode,"m5_001/081");
 assert.equal(m5.lastCardCode,"m5_118/081");
 assert.equal(m4.missing.name,96);
 for(const set of [m4,m5]){assert.equal(set.missing.code,0);assert.equal(set.missing.image,0);}
 assert.equal(audit.summary.duplicateSetCodeCount,0);
 assert.equal(audit.summary.duplicateCardIdentityCount,0);
});
test("official watch stays a single fetch and writes only the watch state",()=>{
 assert.equal((src.match(/await fetch\(/g)||[]).length,1);
 assert.match(src,/await writeFile\(reportUrl,/);
 assert.doesNotMatch(src,/writeFile\((seriesUrl|legacyUrl)/);
});
