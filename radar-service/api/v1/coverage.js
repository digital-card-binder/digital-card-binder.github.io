// Public aggregate connection/coverage counters. No store IDs, personal data or credentials.
import {radarDatabase,fetchDatabaseSummary} from "../../lib/db.mjs";
import {send,allowGet} from "../../lib/http.mjs";
export default async function handler(req,res){
  if(!allowGet(req,res))return;
  try{
    const db=radarDatabase();
    const marker=await db.collection("radarSystem").doc("status").get();
    if(!marker.exists)return send(res,503,{
      service:"card-radar",dbStatus:"not_seeded",inventoryStatus:"unconnected"
    });
    const [counts,retailerDocs,approvedSourceResult]=await Promise.all([
      fetchDatabaseSummary(db),
      db.collection("radarRetailers").limit(20).get(),
      db.collection("radarSources").where("permissionStatus","==","approved").count().get()
    ]);
    const approvedSourceCount=approvedSourceResult.data().count;
    const retailers=retailerDocs.docs.map(doc=>{
      const r=doc.data()||{};
      return {
        retailerId:doc.id,
        name:String(r.name||doc.id).slice(0,40),
        kind:["mart","convenience"].includes(r.kind)?r.kind:"unknown",
        locationDataStatus:"partial",
        inventoryPermission:r.permissionStatus==="approved"?"approved":"unverified",
        dataAdapter:String(r.adapterState||"not_connected").slice(0,40)
      };
    }).sort((a,b)=>a.name.localeCompare(b.name,"ko"));
    const registered=counts.radarStores||0;
    const mappings=counts.radarStoreAliases||0;
    const skus=counts.radarSkuMappings||0;
    const observations=counts.radarObservations||0;
    const sources=counts.radarSources||0;
    return send(res,200,{
      schemaVersion:1,service:"card-radar",dbStatus:"connected",
      setCount:counts.radarSets||0,retailerCount:counts.radarRetailers||0,
      registeredStoreCount:registered,internalProductCount:counts.radarProducts||0,
      verifiedStoreAliasCount:mappings,verifiedRetailerSkuCount:skus,
      historicalObservationCount:observations,registeredSourceCount:sources,approvedSourceCount,
      retailers,
      // Historical observations do not imply currently positive stock.
      stockStatus:approvedSourceCount===0?"unconnected":"partial",
      coverageStatus:"limited",
      note:"점포 수는 자체 DB에 등록된 점포만 의미하며, 재고 보유 매장 수가 아닙니다."
    });
  }catch(e){
    console.error("radar_coverage_unavailable",String(e?.message||"unknown").slice(0,80));
    return send(res,503,{service:"card-radar",dbStatus:"unavailable"});
  }
}
