import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=name=>readFileSync(new URL("../"+name, import.meta.url),"utf8");
const js=read("card-scanner.js"),css=read("card-scanner.css");
const start=js.indexOf("  async function onPhotoSelected(event) {");
const end=js.indexOf("  async function analyzeFile(file,",start);
assert.ok(start>0&&end>start);
test("21차: Android can re-select the same album photo without losing captured File",async()=>{
 const camera={value:"",files:[]}, album={value:"/fake/card.jpg",files:[{name:"card.jpg"}]};
 const seen=[],state={busy:false,lastInputMode:"camera"};
 const ctx={state,els:{fileInput:album,cameraInput:camera},analyzeFile:async(file,options)=>seen.push({file,options})};
 vm.runInNewContext(js.slice(start,end)+"\nglobalThis.onPhotoSelected=onPhotoSelected;",ctx);
 await ctx.onPhotoSelected({currentTarget:album});
 assert.equal(album.value,"");
 assert.equal(state.lastInputMode,"album");
 assert.equal(seen.length,1);
 assert.equal(seen[0].file.name,"card.jpg");
 assert.equal(seen[0].options.preferWholeIfCardRatio,true);
 album.value="/fake/card.jpg";
 await ctx.onPhotoSelected({currentTarget:album});
 assert.equal(seen.length,2);
 state.busy=true;
 await ctx.onPhotoSelected({currentTarget:album});
 assert.equal(seen.length,2);
});
test("21차: next scan continues previous source; camera does not force album",()=>{
 assert.match(js,/const nextInput = state\.lastInputMode === "album" \? els\.fileInput : els\.cameraInput/);
 assert.match(js,/window\.setTimeout\(\(\) => nextInput\.click\(\), 60\)/);
});
test("21차: mobile scanner uses reachable close and input targets",()=>{
 assert.match(css,/\.card-scan-close, \.card-scan-live-close\s*\{/);
 assert.match(css,/min-width:44px;min-height:44px/);
 assert.match(css,/\.card-scan-manual input\s*\{\s*font-size:16px/);
});
