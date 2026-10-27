import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const ops=read("operations.js"), opsHtml=read("operations.html");
const feedback=read("feedback.js");
const collector=read("collector-nav.js");
const mobile=read("site-mobile-nav.js");
const runtime=read("site-error-diagnostics.js");

test("owner operations dashboard includes manual feedback controls and a direct inbox link",()=>{
  for(const id of ["operations-feedback-refresh","operations-feedback-total","operations-feedback-new",
    "operations-feedback-bugs","operations-feedback-completed","operations-feedback-status",
    "operations-error-total","operations-error-page","operations-error-refresh",
    "operations-error-clear"])assert.ok(opsHtml.includes('id="'+id+'"'),id);
  assert.match(opsHtml,/href="\.\/index\.html#feedback-admin"/);
  assert.match(feedback,/function openAdminDeepLinkIfAuthorized\(\)/);
  assert.match(feedback,/window\.location\.hash !== "#feedback-admin" \|\| !isOwner\(currentUser\)/);
  assert.match(feedback,/window\.addEventListener\("hashchange", openAdminDeepLinkIfAuthorized\)/);
  assert.match(ops,/getDocsFromServer\(reference\)/);
  assert.match(ops,/if \(!state\.user \|\| !accountCore\.isOwner\(CONFIG, state\.user\)\) return;/);
});

const a=ops.indexOf("  async function refreshFeedbackMetrics() {");
const b=ops.indexOf("  async function readCollection(",a);
assert.ok(a>0&&b>a);

function feedbackFixture(rows,fail=false){
  const names=["operations-feedback-refresh","operations-feedback-total","operations-feedback-new",
    "operations-feedback-bugs","operations-feedback-completed",
    "operations-feedback-badge","operations-feedback-status",
    "operations-error-total","operations-error-page","operations-error-status"];
  const nodes=Object.fromEntries(names.map(key=>[key,{textContent:"",dataset:{},disabled:false}]));
  const context={
    state:{user:{uid:"owner"},
      firebase:{db:{},firestoreModule:{
        collection:(_,collection)=>{assert.equal(collection,"siteFeedback");return {};},
        getDocsFromServer:async()=>{if(fail)throw Error("offline");
          return {docs:rows.map(row=>({data:()=>row}))}}
      }}},
    accountCore:{isOwner:()=>true},CONFIG:{},
    $:id=>nodes[id],
    setStatus:(n,msg,kind="")=>{n.textContent=msg;n.dataset.state=kind},
    console:{warn(){}},sessionStorage:{
      entries:new Map(),
      getItem(k){return this.entries.get(k)||null},
      removeItem(k){this.entries.delete(k)},
      setItem(k,v){this.entries.set(k,v)}
    },JSON,String,Array
  };
  vm.runInNewContext(ops.slice(a,b)+
    "\nglobalThis.__metrics={refreshFeedbackMetrics,refreshLocalDiagnostics,clearLocalDiagnostics};",context);
  return {ctx:context,nodes,api:context.__metrics};
}

test("feedback KPIs are aggregated on server without displaying sender details",async()=>{
 const t=feedbackFixture([{status:"new",type:"bug",authorEmail:"private@example.com"},
   {status:"reviewed",type:"bug"},{status:"completed",type:"suggestion"}]);
 await t.api.refreshFeedbackMetrics();
 assert.equal(t.nodes["operations-feedback-total"].textContent,"3");
 assert.equal(t.nodes["operations-feedback-new"].textContent,"1");
 assert.equal(t.nodes["operations-feedback-bugs"].textContent,"2");
 assert.equal(t.nodes["operations-feedback-completed"].textContent,"1");
 assert.equal(t.nodes["operations-feedback-badge"].textContent,"1건 확인 필요");
 assert.equal(t.nodes["operations-feedback-refresh"].disabled,false);
 assert.ok(!JSON.stringify(t.nodes).includes("private@example.com"));
});

test("offline feedback summary never pretends all issues were reviewed",async()=>{
 const t=feedbackFixture([],true);
 await t.api.refreshFeedbackMetrics();
 assert.equal(t.nodes["operations-feedback-badge"].textContent,"조회 실패");
 assert.equal(t.nodes["operations-feedback-status"].dataset.state,"error");
 assert.equal(t.nodes["operations-feedback-refresh"].disabled,false);
});

test("same-tab sanitized errors record script/promise category only and cap at 20",()=>{
 const handlers={};
 const storage=new Map();
 const window={
   __dcbSessionErrorDiagnosticsInstalled:false,
   location:{pathname:"/pokemon-search.html",search:"?q=SECRET",hash:"#owner"},
   sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
   addEventListener:(k,fn)=>handlers[k]=fn
 };
 vm.runInNewContext(runtime,{window,Date,JSON,Array});
 for(let i=0;i<25;i++)handlers.unhandledrejection({reason:{message:"private information "+i}});
 handlers.error({target:window,message:"name@example.com",filename:"secret.js"});
 const records=JSON.parse(storage.get("dcb-session-error-diagnostics-v1"));
 assert.equal(records.length,20);
 assert.deepEqual(records.map(x=>x.type).slice(-2),["promise","script"]);
 assert.equal(records.at(-1).page,"pokemon-search.html");
 assert.ok(!JSON.stringify(records).includes("SECRET"));
 assert.ok(!JSON.stringify(records).includes("private information"));
 assert.ok(!JSON.stringify(records).includes("name@example.com"));
 assert.ok(!JSON.stringify(records).includes("secret.js"));
});

test("operations view shows local error totals without uploading data",()=>{
 const t=feedbackFixture([]);
 t.ctx.sessionStorage.setItem("dcb-session-error-diagnostics-v1",
   JSON.stringify([{page:"studio.html",type:"script",at:"2026-10-27T00:00:00Z"}]));
 t.api.refreshLocalDiagnostics();
 assert.equal(t.nodes["operations-error-total"].textContent,"1");
 assert.equal(t.nodes["operations-error-page"].textContent,"studio.html");
 t.api.clearLocalDiagnostics();
 assert.equal(t.nodes["operations-error-total"].textContent,"0");
 assert.equal(t.nodes["operations-error-page"].textContent,"없음");
 assert.ok(!runtime.includes("fetch("));
 assert.ok(!runtime.includes("navigator.sendBeacon"));
});

test("diagnostics loader covers regular catalog plus WebView/studio pages without doubling",()=>{
 assert.match(collector,/__dcbDiagnosticsLoaderRequested/);
 assert.match(collector,/site-error-diagnostics\.js/);
 assert.match(mobile,/__dcbDiagnosticsLoaderRequested/);
 assert.match(mobile,/site-error-diagnostics\.js/);
 assert.match(runtime,/__dcbSessionErrorDiagnosticsInstalled/);
 assert.match(runtime,/sessionStorage\.setItem\(KEY, JSON\.stringify\(rows\)\)/);
});
