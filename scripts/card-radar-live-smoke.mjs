// Temporary manual diagnostic only. Never merge to main.
// Tests public aggregator responses for a user-supplied business/product screenshot.
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const src=readFileSync(new URL("../card-radar.js",import.meta.url),"utf8");
const hooked=src.replace(/\}\)\(\);\s*$/,[
 "globalThis.__radarProbe={state,endpoint,parseRetail,isCardProduct,liveQueries,packFromTitle};",
 "})();"
].join("\n"));
if(hooked===src)throw Error("INJECTION_FAILED");
const context={document:{readyState:"loading",addEventListener(){}},window:{},
 navigator:{},URL,URLSearchParams,Date,Math,console};
runInNewContext(hooked,context,{filename:"card-radar.js"});
const {state,endpoint,parseRetail,isCardProduct,liveQueries,packFromTitle}=context.__radarProbe;
// Approximate publicly known Yangyang/Mulchi area, never user coordinates.
state.center={lat:38.15,lng:128.60};state.radiusKm=10;
const probes=[
 {keyword:"조로아",area:"물치항",mode:"site"},
 {keyword:"조로아&조로아크",area:"물치항",mode:"site"},
 {keyword:"MEGA 스타터 세트 ex",area:"물치항",mode:"site"},
 {keyword:"조로아",area:"양양",mode:"site"},
 {keyword:"스톰에메랄다",area:"물치항",mode:"site"},
 {keyword:"조로아",area:"",mode:"site"},
 {keyword:"조로아",area:"양양물치항",mode:"no-geo"}
];
console.log("YANGYANG_RADAR_CATALOG",JSON.stringify({
 defaultHasStarter:liveQueries().some(x=>/조로아|스타터/.test(x)),
 parserRecognizesStarter:isCardProduct("MEGA 스타터 세트 ex 「조로아&조로아크 ex」"),
 skuSetCode:packFromTitle("MEGA 스타터 세트 ex 「조로아&조로아크 ex」"),
 totalDefaultQueries:liveQueries().length
}));
for(const p of probes){
 const begin=Date.now();
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),10000);
 const report={keyword:p.keyword,area:p.area,mode:p.mode,status:null,http:null,selectedName:null,
  candidateNames:[],shopNameMatches:[],returnedStores:0,parsedNearby:0,parsedPositive:0,
  rawPositive:0,elapsedMs:null};
 try {
   let url=endpoint("emart24",p.keyword,p.area);
   if(p.mode==="no-geo"){
     const u=new URL(url);u.searchParams.delete("lat");u.searchParams.delete("lng");url=u.toString();
   }
   const res=await fetch(url,{headers:{Accept:"application/json",
      Origin:"https://digital-card-binder.github.io"},signal:controller.signal});
   report.http=res.status;
   if(!res.ok){report.status="http_"+res.status;}
   else{
     const payload=await res.json();
     const d=payload?.data;
     if(payload.success!==true||!d){report.status="api_error";}
     else{
       const candidates=Array.isArray(d.productCandidates)?d.productCandidates:[];
       report.candidateNames=candidates.map(x=>String(x.goodsName||x.goodsNm||"")).filter(Boolean).slice(0,8);
       report.selectedName=String(d.goodsInfo?.goodsName||d.goodsInfo?.goodsNm||"");
       report.selectedPlu=String(d.pluCd||"");
       const raw=Array.isArray(d.stores)?d.stores:[];
       const others=Array.isArray(d.nearbyStores)?d.nearbyStores:(d.nearbyStores?.stores||[]);
       report.returnedStores=raw.length;
       report.nearbyStores=others.length;
       report.rawPositive=raw.filter(x=>Number.isSafeInteger(x.bizQty)&&x.bizQty>0).length;
       const needle=/양양물치항|물치항|물치/;
       report.shopNameMatches=raw.filter(x=>needle.test(String(x.storeName||""))).map(x=>({
         name:String(x.storeName||"").slice(0,60),bizQty:x.bizQty,
         storeCode:String(x.bizNo||"").slice(0,24)})).slice(0,10);
       report.nearbyNameMatches=others.filter(x=>needle.test(String(x.storeName||""))).map(x=>({
         name:String(x.storeName||"").slice(0,60),storeCode:String(x.storeCode||"").slice(0,24)})).slice(0,10);
       const parsed=parseRetail("emart24",payload,new Date().toISOString(),p.keyword);
       report.parsedNearby=parsed.length;
       report.parsedPositive=parsed.filter(x=>(x.items||[]).some(i=>i.quantity>0)).length;
       report.status="json_ok";
     }
   }
 }catch(e){report.status=e?.name==="AbortError"?"timeout":"transport_error";
   report.error=String(e?.message||"").slice(0,90);
 }finally{clearTimeout(timeout);report.elapsedMs=Date.now()-begin;
   console.log("YANGYANG_RADAR_CHECK",JSON.stringify(report));}
}
