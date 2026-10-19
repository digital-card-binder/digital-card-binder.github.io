// One-shot, low-volume smoke probe. No retailer credentials or live inventory stored.
// Verifies transport + deployed parser shape; cannot certify official in-store stock.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {runInNewContext} from "node:vm";

const src=readFileSync(new URL("../card-radar.js",import.meta.url),"utf8");
const hooked=src.replace(/\}\)\(\);\s*$/,[
  "globalThis.__radarSmoke={state,endpoint,parseRetail};",
  "})();"
].join("\n"));
if(hooked===src)throw Error("RADAR_SCRIPT_CONTRACT_CHANGED");
const context={
  document:{readyState:"loading",addEventListener(){}},
  window:{},navigator:{},URL,URLSearchParams,Date,Math,console
};
runInNewContext(hooked,context,{filename:"card-radar.js"});
const {state,endpoint,parseRetail}=context.__radarSmoke;
// Public neighborhood-center approximation, not a user's device coordinates.
state.center={lat:37.35,lng:127.10};
state.radiusKm=3;
const keyword="인페르노X";
const providers=["cu","gs25","seveneleven","emart24"];
const report={schemaVersion:1,checkedAt:new Date().toISOString(),
  target:"South Korea, Seongnam area (approximate map test center)",
  productKeyword:keyword,
  checks:[]};
for(const provider of providers){
  const started=Date.now();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),24000);
  const storeArea=(provider==="seveneleven"||provider==="emart24")?"금곡동":"";
  const result={provider,status:"not_checked",httpStatus:null,apiSuccess:null,
    dataKeys:[],returnedStoreCount:null,validNearbyStockRows:0,
    positiveQuantityRows:0,responseMs:0};
  try{
    const url=endpoint(provider,keyword,storeArea);
    const res=await fetch(url,{signal:controller.signal,
      headers:{"Accept":"application/json"},redirect:"follow"});
    result.httpStatus=res.status;
    const contentType=res.headers.get("content-type")||"";
    if(!res.ok){result.status="http_error";}
    else if(!contentType.toLowerCase().includes("json")){
      result.status="not_json";
    }else{
      const payload=await res.json();
      result.apiSuccess=payload?.success===true;
      const data=payload?.data;
      result.dataKeys=data&&typeof data==="object"?
        Object.keys(data).slice(0,18):[];
      const storeRows=provider==="cu"?data?.nearbyStores?.stores:
        provider==="gs25"?data?.inventory?.stores:
        provider==="seveneleven"?data?.inventory?.stores:
        data?.stores;
      result.returnedStoreCount=Array.isArray(storeRows)?storeRows.length:null;
      if(!result.apiSuccess||!data){result.status="api_returned_error";}
      else if((provider==="cu"&&data.inventory?.available===false)||
        (provider==="seveneleven"&&data.stockAvailable===false)){
        result.status="source_stock_unavailable";
      }else{
        const rows=parseRetail(provider,payload,new Date().toISOString(),keyword);
        result.validNearbyStockRows=rows.length;
        result.positiveQuantityRows=rows.filter(x=>x.items.some(
          item=>Number.isSafeInteger(item.quantity)&&item.quantity>0)).length;
        result.status=rows.length?"parsed_stock_rows":"api_ok_no_matching_stock_rows";
      }
    }
  }catch(error){
    result.status=error?.name==="AbortError"?"timeout":"transport_or_parse_error";
    result.errorClass=String(error?.name||"Error").slice(0,50);
  }finally{
    clearTimeout(timer);
    result.responseMs=Date.now()-started;
    report.checks.push(result);
    process.stdout.write("RADAR_LIVE_CHECK "+JSON.stringify(result)+"\n");
  }
}
mkdirSync("reports",{recursive:true});
writeFileSync("reports/card-radar-live-smoke.json",JSON.stringify(report,null,2)+"\n");
const outcomes=report.checks.reduce((x,cur)=>{
  x[cur.status]=(x[cur.status]||0)+1;
  return x;
},{});
process.stdout.write("RADAR_LIVE_SUMMARY "+JSON.stringify(outcomes)+"\n");
process.stdout.write("Note: public API stock rows are unverified against official retailer apps.\n");
