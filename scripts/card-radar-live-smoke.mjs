// One-shot, low-volume smoke probe. No retailer credentials or live inventory stored.
// Verifies transport + deployed parser shape; cannot certify official in-store stock.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {publicRetailerMappingCandidates}
  from "../radar-service/lib/public-sku-candidates.mjs";
import {runInNewContext} from "node:vm";

const src=readFileSync(new URL("../card-radar.js",import.meta.url),"utf8");
const hooked=src.replace(/\}\)\(\);\s*$/,[
  "globalThis.__radarSmoke={state,endpoint,parseRetail,mergeInventory,inventoryLabel};",
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


// Temporary diagnostic-only multi-city probe. This branch must NOT be merged.
// Probe a small number of common Pokémon TCG pack keywords through the live
// public aggregator. Never represent its numbers as official retailer POS stock.
const multiRegions=[
  {name:"서울 강남",lat:37.4979,lng:127.0276,area:"역삼"},
  {name:"서울 홍대",lat:37.5563,lng:126.9236,area:"서교"},
  {name:"인천 부평",lat:37.4895,lng:126.7245,area:"부평"},
  {name:"부산 서면",lat:35.1578,lng:129.0592,area:"부전"},
  {name:"대구 동성로",lat:35.8695,lng:128.5956,area:"동성로"},
  {name:"대전 둔산",lat:36.3511,lng:127.3888,area:"둔산"}
];
const multiProducts=["인페르노X","메가브레이브","닌자스피너","어비스아이"];
const multiProviders=["cu","gs25","emart24"];
const multiReport={schemaVersion:1,checkedAt:new Date().toISOString(),
  note:"Public aggregator replies only; NOT official POS verified stock.",
  checks:[],positive:[]};
const noLongerAvailable=new Set();
let multiRequests=0;
for(const region of multiRegions){
  state.center={lat:region.lat,lng:region.lng};
  state.radiusKm=10;
  for(const product of multiProducts){
    for(const provider of multiProviders){
      if(multiRequests>=66 || noLongerAvailable.has(provider))continue;
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),11500);
      const record={region:region.name,keyword:product,provider,
        httpStatus:null,status:"unknown",parsedRows:0,positiveRows:0,
        firstStock:null};
      const start=Date.now();
      try{
        const url=endpoint(provider,product,provider==="emart24"?region.area:"");
        const response=await fetch(url,{signal:controller.signal,
          headers:{Accept:"application/json",
            Origin:"https://digital-card-binder.github.io"},
          redirect:"follow"});
        multiRequests++;
        record.httpStatus=response.status;
        if(response.status===429)noLongerAvailable.add(provider);
        if(!response.ok){record.status="http_error";}
        else {
          const payload=await response.json();
          if(payload.success!==true || !payload.data)record.status="api_error";
          else if(provider==="cu"&&payload.data.inventory?.available===false)
            record.status="stock_unavailable";
          else if(provider==="gs25"&&payload.data.itemCodeUsed===false)
            record.status="sku_unverified";
          else if(provider==="emart24"&&payload.data?.pluCd==null)
            record.status="sku_unverified";
          else{
            const rows=parseRetail(provider,payload,new Date().toISOString(),product);
            state.inventory=rows;
            state.curatedShops=[];state.shops=[];state.retailerShops=[];
            state.publicShops=[];state.masterShops=[];state.martInventory=[];
            const merged=multiSmokeMerge(rows);
            const found=merged.filter(store=>multiSmokeStock(store));
            record.parsedRows=rows.length;
            record.positiveRows=found.length;
            record.status=rows.length?"parsed":"no_matching_rows";
            if(found.length){
              const store=found[0];
              const item=(store.verifiedInventory||[]).find(p=>
                Number.isSafeInteger(p.quantity)&&p.quantity>0);
              record.firstStock={store:store.name,item:item?.name,
                quantity:item?.quantity,lat:store.lat,lng:store.lng};
              for(const shop of found.slice(0,5)){
                const stock=(shop.verifiedInventory||[]).find(p=>
                  Number.isSafeInteger(p.quantity)&&p.quantity>0);
                multiReport.positive.push({region:region.name,provider,
                  store:shop.name,lat:shop.lat,lng:shop.lng,
                  item:stock?.name,quantity:stock?.quantity,
                  checkedAt:new Date().toISOString()});
              }
            }
          }
        }
      }catch(error){record.status=error?.name==="AbortError"?
          "timeout":"network_or_parser_error";
        record.error=String(error?.message||"Error").slice(0,90);
      }finally{
        clearTimeout(timer);
        record.elapsedMs=Date.now()-start;
        multiReport.checks.push(record);
        console.log("RADAR_MULTI_CHECK "+JSON.stringify(record));
      }
    }
    // A small result sample is sufficient to show whether any stock-positive
    // location renders; stop rather than generate unnecessary traffic.
    if(multiReport.positive.length>=3)break;
  }
  if(multiReport.positive.length>=3)break;
}
mkdirSync("reports",{recursive:true});
writeFileSync("reports/card-radar-multi-region.json",
  JSON.stringify(multiReport,null,2)+"\n");
console.log("RADAR_MULTI_SUMMARY "+JSON.stringify({
  checkedAt:multiReport.checkedAt,requests:multiRequests,
  checked:multiReport.checks.length,
  parsed:multiReport.checks.filter(x=>x.status==="parsed").length,
  positiveRows:multiReport.positive.length,
  positive:multiReport.positive.slice(0,8),
  failures:multiReport.checks.filter(x=>
    ["http_error","timeout","network_or_parser_error","api_error"].includes(x.status)).length
}));
function multiSmokeMerge(rows){
  // Reuse the deployed site's merge path, not raw unchecked JSON.
  state.inventory=rows;
  return context.__radarSmoke.mergeInventory([]);
}
function multiSmokeStock(store){
  return context.__radarSmoke.inventoryLabel(store).known===true;
}
