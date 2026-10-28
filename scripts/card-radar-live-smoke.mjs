// One-shot, low-volume smoke probe. No retailer credentials or live inventory stored.
// Verifies transport + deployed parser shape; cannot certify official in-store stock.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {publicRetailerMappingCandidates}
  from "../radar-service/lib/public-sku-candidates.mjs";
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
const probes=[
  {provider:"cu",storeArea:"",scenario:"default"},
  {provider:"gs25",storeArea:"",scenario:"default"},
  {provider:"seveneleven",storeArea:"금곡동",scenario:"default"},
  {provider:"emart24",storeArea:"금곡동",scenario:"default"},
  // A 500 only when using the district filter suggests a query-shape problem
  // rather than a blanket service outage; never assume the two are equivalent.
  {provider:"emart24",storeArea:"분당",scenario:"district_alias"},
  {provider:"emart24",storeArea:"",scenario:"without_area"}
];
const reviewCandidates={schemaVersion:1,source:"third-party-public-aggregator",
  reviewed:false,automaticallyImportable:false,
  capturedAt:new Date().toISOString(),retailerSkus:[],storeAliases:[]};
const report={schemaVersion:1,checkedAt:new Date().toISOString(),
  target:"South Korea, Seongnam area (approximate map test center)",
  productKeyword:keyword,
  checks:[]};
for(const {provider,storeArea,scenario} of probes){
  const started=Date.now();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),24000);
  const result={provider,scenario,status:"not_checked",httpStatus:null,
    browserCors:"not_checked",apiSuccess:null,
    dataKeys:[],returnedStoreCount:null,validNearbyStockRows:0,
    positiveQuantityRows:0,responseMs:0};
  try{
    const url=endpoint(provider,keyword,storeArea);
    const res=await fetch(url,{signal:controller.signal,
      headers:{"Accept":"application/json",
        "Origin":"https://digital-card-binder.github.io"},redirect:"follow"});
    result.httpStatus=res.status;
    const allowOrigin=res.headers.get("access-control-allow-origin")||"";
    result.browserCors=(allowOrigin==="*"||
      allowOrigin==="https://digital-card-binder.github.io")?
      "allowed":"missing_or_mismatch";
    const contentType=res.headers.get("content-type")||"";
    if(!res.ok){result.status="http_error";}
    else if(!contentType.toLowerCase().includes("json")){
      result.status="not_json";
    }else{
      const payload=await res.json();
      result.apiSuccess=payload?.success===true;
      const candidates=publicRetailerMappingCandidates(provider,payload,{
        requestedKeyword:keyword,discoveredAt:report.checkedAt
      });
      reviewCandidates.retailerSkus.push(...candidates.retailerSkus);
      reviewCandidates.storeAliases.push(...candidates.storeAliases);
      result.skuCandidatesRequiringReview=candidates.retailerSkus.length;
      result.storeCandidatesRequiringReview=candidates.storeAliases.length;
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
      }else if(provider==="gs25" && data.itemCodeUsed===false){
        result.status="product_identity_unverified";
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
// Representative read-only cross-checks for stock-positive retail examples.
// Never fail the build when stock legitimately sells out or retailer access
// changes; report checked products and parser output transparently.
for(const check of [
  {provider:"emart24",keyword:"조로아&조로아크",area:"양양",
    center:{lat:38.15,lng:128.60},store:"양양물치항점",code:"starter-zoroark"},
  {provider:"seveneleven",keyword:"메가심포니아",area:"명동",
    center:{lat:37.5633,lng:126.9837},store:"명동스카이호텔점",code:"m1S"}
]){
  state.center=check.center;
  state.radiusKm=10;
  const started=Date.now();
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),12000);
  const status={provider:check.provider,scenario:"named_card_product",
    keyword:check.keyword,area:check.area,status:"unchecked",
    matches:0,positiveQuantityRows:0,expectedStoreMatched:false};
  try{
    const res=await fetch(endpoint(check.provider,check.keyword,check.area),
      {signal:abort.signal,headers:{Accept:"application/json",
        Origin:"https://digital-card-binder.github.io"}});
    status.httpStatus=res.status;
    if(!res.ok)status.status="http_error";
    else{
      const payload=await res.json();
      if(payload?.success!==true||!payload?.data)status.status="api_error";
      else{
        const parsed=parseRetail(check.provider,payload,new Date().toISOString(),
          check.keyword);
        const exact=parsed.filter(row=>row.items.some(item=>
          item.code===check.code));
        const atStore=exact.filter(row=>row.name.includes(check.store));
        status.matches=exact.length;
        status.expectedStoreMatched=atStore.length>0;
        status.positiveQuantityRows=exact.filter(row=>
          row.items.some(item=>Number.isSafeInteger(item.quantity)&&item.quantity>0)).length;
        status.status="parsed";
      }
    }
  }catch(error){
    status.status=error?.name==="AbortError"?"timeout":"transport_error";
  }finally{
    clearTimeout(timer);
    status.responseMs=Date.now()-started;
    report.checks.push(status);
    process.stdout.write("RADAR_RETAIL_CATALOG_PROBE "+JSON.stringify(status)+"\n");
  }
}
mkdirSync("reports",{recursive:true});
writeFileSync("reports/card-radar-live-smoke.json",JSON.stringify(report,null,2)+"\n");
const uniqueBy=(records,key)=>[...new Map(records.map(r=>[key(r),r])).values()];
reviewCandidates.retailerSkus=uniqueBy(reviewCandidates.retailerSkus,
  row=>row.retailerId+"|"+row.retailerItemCode);
reviewCandidates.storeAliases=uniqueBy(reviewCandidates.storeAliases,
  row=>row.retailerId+"|"+row.providerStoreId);
writeFileSync("reports/card-radar-sku-review-candidates.json",
  JSON.stringify(reviewCandidates,null,2)+"\n");
const outcomes=report.checks.reduce((x,cur)=>{
  x[cur.status]=(x[cur.status]||0)+1;
  return x;
},{});
process.stdout.write("RADAR_LIVE_SUMMARY "+JSON.stringify(outcomes)+"\n");
process.stdout.write("Note: public API stock rows are unverified against official retailer apps.\n");

// One-off official retail origin reachability check; removed before merge.
await import("./radar-mart-original-probe.mjs");
