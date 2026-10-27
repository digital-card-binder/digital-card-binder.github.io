import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const js=read("card-scanner.js");
test("24차: scanner uses generation tokens to prevent stale cancelled scan results",()=>{
 assert.match(js,/analysisToken: 0/);
 assert.match(js,/const token = \+\+state\.analysisToken/);
 assert.match(js,/function resetScanner\(\) \{\s*state\.analysisToken \+= 1/);
 assert.match(js,/function closeScanner\(\) \{\s*state\.analysisToken \+= 1/);
 assert.match(js,/addEventListener\("close", \(\) => \{\s*state\.analysisToken \+= 1/);
 assert.match(js,/if \(token !== state\.analysisToken\) return;/);
 assert.match(js,/if \(token === state\.analysisToken\) \{\s*setBusy\(false\)/);
});
test("24차: in-progress OCR checks cancellation after awaited worker operations",()=>{
 const x=js.slice(js.indexOf("  async function analyzeFile(file,"),js.indexOf("  function compactOcr("));
 assert.match(x,/await loadSearchCards\(\);\s*if \(token !== state\.analysisToken\) return/);
 assert.match(x,/await worker\.recognize\(region\.canvas\);\s*if \(token !== state\.analysisToken\) return/);
 assert.match(x,/await selectCard\(auto\.card\);\s*if \(token !== state\.analysisToken\) return/);
});
test("24차: progress is accessible and clamps invalid percentages",()=>{
 const start=js.indexOf("  function setProgress(value) {");
 const end=js.indexOf("  function setBusy(busy) {",start);
 assert.ok(start>0&&end>start);
 const props={};
 const ctx={els:{progress:{style:{},parentElement:{setAttribute:(k,v)=>props[k]=v}}},Math,Number,String};
 vm.runInNewContext(js.slice(start,end)+"\nglobalThis.progress=setProgress;",ctx);
 ctx.progress(150);assert.equal(props["aria-valuenow"],"100");assert.equal(ctx.els.progress.style.width,"100%");
 ctx.progress(-4);assert.equal(props["aria-valuenow"],"0");
 assert.match(js,/role="progressbar" aria-label="카드 인식 진행률"/);
 assert.match(js,/image\.loading = "lazy"/);
 assert.match(js,/image\.decoding = "async"/);
});
