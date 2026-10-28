import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const custom=read("custom.js"),search=read("pokemon-search.js"),scanner=read("card-scanner.js");
test("32차: personal dex guest/login/error state cannot write to collections",()=>{
 const start=custom.indexOf("  function updateAuthUi(error = null) {");
 const end=custom.indexOf("  async function signIn()",start);
 assert.ok(start>=0&&end>start);
 const elements=Object.fromEntries(["custom-auth-status","custom-login","custom-logout","new-dex-button"].map(id=>[id,{textContent:"",hidden:false,disabled:false}]));
 const state={user:null};
 const ctx={state,$:id=>elements[id],configured:()=>true};
 vm.runInNewContext(custom.slice(start,end)+"\nglobalThis.drawAuth=updateAuthUi;",ctx);
 ctx.drawAuth();
 assert.equal(elements["custom-login"].hidden,false);
 assert.equal(elements["custom-logout"].hidden,true);
 assert.equal(elements["new-dex-button"].disabled,true);
 state.user={uid:"u",displayName:"Collector"};
 ctx.drawAuth();
 assert.equal(elements["custom-login"].hidden,true);
 assert.equal(elements["custom-logout"].hidden,false);
 assert.equal(elements["new-dex-button"].disabled,false);
 ctx.drawAuth(new Error("network"));
 assert.equal(elements["new-dex-button"].disabled,true);
});
async function photoFixture(shouldReject){
 const begin=custom.indexOf("  async function importPhotoBatch() {");
 const end=custom.indexOf("  function bindEvents()",begin);
 assert.ok(begin>0&&end>begin);
 const prior={key:"kept",owned:true};
 const dex={id:"dex-1",cards:[prior]};
 const item={name:"피카츄",preview:"blob:test",file:{name:"photo.jpg"}};
 const state={
  user:{uid:"u"},photoSaving:false,photoQueue:[item],photoCache:new Map(),
  firebase:{firestoreModule:{
    async setDoc(){},
    async deleteDoc(ref){deleted.push(ref)},
    serverTimestamp:()=>123
  }}
 };
 const deleted=[],revoked=[],alerts=[];
 let closed=0,rendered=0;
 const elements={
  "custom-photo-status":{textContent:""},
  "custom-photo-owned":{checked:true},
  "card-picker-dialog":{close(){closed++;}}
 };
 const ctx={
  state,currentDex:()=>dex,MAX_CARDS_PER_DEX:1500,alert:msg=>alerts.push(msg),
  renderPhotoQueue:()=>{},renderAll:()=>{rendered++;},
  $:id=>elements[id],makeId:()=>"new-photo",compressPhoto:async()=> "data:image/webp;base64,abc",
  photoRef:id=>id,saveDexes:async()=>{if(shouldReject)throw new Error("write denied")},
  URL:{revokeObjectURL:url=>revoked.push(url)},
  clean:s=>String(s||"").trim(),Date,Math,Promise,console
 };
 vm.runInNewContext(custom.slice(begin,end)+"\nglobalThis.upload=importPhotoBatch;",ctx);
 await ctx.upload();
 return {state,dex,prior,deleted,alerts,closed,rendered,elements,revoked};
}
test("32차: failed Firestore binder save rolls back added photos and retains old collection",async()=>{
 const f=await photoFixture(true);
 assert.equal(f.dex.cards.length,1);
 assert.strictEqual(f.dex.cards[0],f.prior);
 assert.equal(f.state.photoQueue.length,1,"failed photo remains retryable");
 assert.deepEqual(f.deleted,["new-photo"]);
 assert.equal(f.closed,0);
 assert.equal(f.state.photoSaving,false);
 assert.match(f.elements["custom-photo-status"].textContent,/0장 등록 완료/);
});
test("32차: successful photo registration updates only selected binder and releases preview",async()=>{
 const f=await photoFixture(false);
 assert.equal(f.dex.cards.length,2);
 assert.equal(f.dex.cards[0].key,"kept");
 assert.equal(f.dex.cards[1].key,"new-photo");
 assert.equal(f.dex.cards[1].owned,true);
 assert.equal(f.state.photoQueue.length,0);
 assert.equal(f.deleted.length,0);
 assert.deepEqual(f.revoked,["blob:test"]);
 assert.equal(f.closed,1);
 assert.equal(f.state.photoSaving,false);
});
test("32차: ownership save only commits local state after remote success, scanner denies shared writes",()=>{
 const start=search.indexOf("  async function toggleOwned() {");
 const end=search.indexOf("  const SEARCH_RESUME_KEY",start);
 const method=search.slice(start,end);
 assert.match(method,/await account\.saveOwned\(item\.card\.accountKey, nextOwned\);\s*item\.card\.seriesOwned = nextOwned/);
 assert.match(method,/catch \(error\) \{/);
 assert.match(scanner,/읽기 전용 화면에서는 보유 상태를 수정할 수 없습니다/);
 assert.match(custom,/Google 로그인 후 저장할 수 있습니다/);
 assert.match(custom,/customDexes: state\.dexes/);
});
test("32차: persisted user collections and card/audit sources are not modified by test-only workflow",()=>{
 const wf=read(".github/workflows/v29-v32-final-qa.yml");
 assert.match(wf,/npm run site:prepare/);
 assert.match(wf,/npm test/);
 for(const prefix of ["data/","db/","firestore","android-app/","radar-service/"]){
  assert.ok(wf.includes(prefix),prefix);
 }
});
