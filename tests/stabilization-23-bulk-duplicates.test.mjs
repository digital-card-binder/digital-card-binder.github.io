import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const get=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const js=get("custom.js"),html=get("custom.html");
test("23차: only identical queued local files are filtered, and users see skipped counts",()=>{
 const start=js.indexOf("  function photoBatchIdentity(file) {");
 const end=js.indexOf("  async function compressPhoto(file) {",start);
 assert.ok(start>0&&end>start);
 const state={photoSaving:false,photoQueue:[]};
 const statuses={"custom-photo-status":{textContent:""}};
 const created=[];
 const ctx={state,URL:{createObjectURL:file=>{created.push(file.name);return "blob:"+file.name}},
   $:id=>statuses[id],clean:s=>String(s).trim(),renderPhotoQueue:()=>{}};
 vm.runInNewContext(js.slice(start,end)+"\nglobalThis.batch=preparePhotoBatch;",ctx);
 const file={name:"pikachu.png",type:"image/png",size:1000,lastModified:1234};
 const different={...file,name:"eevee.png"};
 ctx.batch([file,file,different,{name:"junk.txt",type:"text/plain",size:100,lastModified:1}]);
 assert.equal(state.photoQueue.length,2);
 assert.deepEqual(created,["pikachu.png","eevee.png"]);
 assert.match(statuses["custom-photo-status"].textContent,/같은 파일 1장 중복 제외/);
 assert.match(statuses["custom-photo-status"].textContent,/지원하지 않는 파일/);
 ctx.batch([file]);
 assert.equal(state.photoQueue.length,2);
});
test("23차: card picker makes existing cards explicit and cannot add same key twice",()=>{
 assert.match(html,/id="card-picker-existing-count"/);
 assert.match(js,/String\(matches\.reduce\(\(count, card\) => count \+ Number\(existing\.has\(card\.key\)\), 0\)\)/);
 assert.match(js,/add\.disabled = existing\.has\(card\.key\)/);
 assert.match(js,/add\.textContent = existing\.has\(card\.key\) \? "추가됨" : "추가"/);
 assert.match(js,/!existing\.has\(key\)/);
});
test("23차: batch progress and editing lock remain accessible during upload",()=>{
 assert.match(js,/name\.disabled = state\.photoSaving/);
 assert.match(js,/Math\.round\(\(\(index \+ 1\) \/ candidates\.length\) \* 100\)/);
 assert.match(html,/id="custom-photo-status" role="status" aria-live="polite"/);
});
